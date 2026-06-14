import express, { Request, Response } from 'express';
import axios from 'axios';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client-auth';
import * as Minio from 'minio';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';
const prisma = new PrismaClient();

app.use(helmet());
app.use(cors());
app.use(express.json());

function getRequiredPermissionForPath(path: string, method: string): string | null {
  const cleanPath = path.split('?')[0];

  // Users endpoints
  if (cleanPath === '/users') {
    if (method === 'GET') return 'READ_USER';
    if (method === 'POST') return 'CREATE_USER';
  }
  if (cleanPath.startsWith('/users/')) {
    if (method === 'GET') return 'READ_USER';
    if (method === 'PATCH' || method === 'PUT') return 'UPDATE_USER';
    if (method === 'DELETE') return 'DELETE_USER';
  }

  // Vendors endpoints
  if (cleanPath === '/vendors') {
    if (method === 'GET') return 'READ_VENDOR';
    if (method === 'POST') return 'CREATE_VENDOR';
  }
  if (cleanPath.startsWith('/vendors/by-name/')) {
    return 'READ_VENDOR';
  }
  if (cleanPath.startsWith('/vendors/')) {
    if (method === 'PATCH' || method === 'PUT') return 'UPDATE_VENDOR';
    if (method === 'DELETE') return 'DELETE_VENDOR';
  }

  // Agents endpoints
  if (cleanPath === '/agents') {
    if (method === 'GET') return 'READ_AGENT';
    if (method === 'POST') return 'CREATE_AGENT';
  }
  if (cleanPath.startsWith('/agents/by-name/')) {
    return 'READ_AGENT';
  }
  if (cleanPath === '/agents/payroll') {
    return 'READ_PAYROLL';
  }
  if (cleanPath.startsWith('/agents/payroll/')) {
    const segments = cleanPath.split('/');
    if (segments.length === 4 && segments[3] === 'send') { // /agents/payroll/:id/send
      return 'CREATE_PAYROLL';
    }
    if (segments.length === 3) { // /agents/payroll/:id
      if (method === 'PATCH' || method === 'PUT') return 'UPDATE_PAYROLL';
    }
  }
  if (cleanPath === '/agents/attendance') {
    return 'READ_ATTENDANCE';
  }
  if (cleanPath.startsWith('/agents/')) {
    const segments = cleanPath.split('/');
    if (segments.length === 4 && segments[3] === 'attendance') { // /agents/:id/attendance
      return 'READ_ATTENDANCE';
    }
    if (segments.length === 5 && segments[3] === 'attendance' && segments[4] === 'checkin') { // /agents/:id/attendance/checkin
      return 'CREATE_ATTENDANCE';
    }
    if (segments.length === 5 && segments[3] === 'attendance' && segments[4] === 'checkout') { // /agents/:id/attendance/checkout
      return 'CREATE_ATTENDANCE';
    }
    if (segments.length === 4 && segments[3] === 'payroll') { // /agents/:id/payroll
      return 'CREATE_PAYROLL';
    }
    if (cleanPath.endsWith('/margin-segments')) {
      return 'UPDATE_AGENT';
    }
    if (cleanPath.endsWith('/wallet/debt')) {
      return 'READ_AGENT';
    }
    if (cleanPath.endsWith('/wallet/transaction')) {
      return 'UPDATE_AGENT';
    }
    if (segments.length === 3) { // /agents/:id
      if (method === 'GET') return 'READ_AGENT';
      if (method === 'PATCH' || method === 'PUT') return 'UPDATE_AGENT';
      if (method === 'DELETE') return 'DELETE_AGENT';
    }
  }

  // Roles & Permissions matrix
  if (cleanPath.startsWith('/roles/permissions/matrix')) {
    return 'MANAGE_SETTINGS';
  }

  // Tenant profile
  if (cleanPath === '/tenants/profile') {
    if (method === 'GET') return 'READ_USER';
    if (method === 'PUT' || method === 'PATCH') return 'MANAGE_SETTINGS';
  }
  if (cleanPath === '/tenants/send-email') {
    return 'MANAGE_SETTINGS';
  }

  return null;
}

async function checkAgentPermission(roleId: number, permissionName: string): Promise<boolean> {
  const permission = await prisma.permission.findFirst({
    where: { name: permissionName }
  });
  if (!permission) return false;

  const hasPermission = await prisma.rolePermission.findUnique({
    where: {
      roleId_permissionId: {
        roleId,
        permissionId: permission.id
      }
    }
  });
  return !!hasPermission;
}

// Global middleware to enforce security checks on every request sent by an AGENT
app.use(async (req: any, res: Response, next: any) => {
  const userRole = req.headers['x-user-role'] || req.headers['X-User-Role'];
  const userId = req.headers['x-user-id'] || req.headers['X-User-Id'];
  const tenantIdStr = req.headers['x-tenant-id'] || req.headers['X-Tenant-Id'];

  if (userRole === 'AGENT') {
    // Bypass public / health endpoints / authentication
    const path = req.path;
    if (
      path.startsWith('/auth/login') ||
      path.startsWith('/auth/register') ||
      path.startsWith('/auth/super-admin/register') ||
      path.startsWith('/auth/request-demo') ||
      path.startsWith('/verify-token') ||
      path === '/health' ||
      path === '/agents/verify-request' // Exclude our own verification endpoint
    ) {
      return next();
    }

    if (!userId || !tenantIdStr) {
      return res.status(403).json({ error: 'Forbidden', message: 'Permission Denied: Missing user or tenant context' });
    }

    const uId = parseInt(userId as string);
    const tId = parseInt(tenantIdStr as string);

    if (isNaN(uId) || isNaN(tId)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Permission Denied: Invalid user or tenant ID' });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: uId },
        include: { role: true }
      });

      if (!user) {
        return res.status(403).json({ error: 'Forbidden', message: 'Permission Denied: User not found' });
      }

      if (user.tenantId !== tId) {
        return res.status(403).json({ error: 'Forbidden', message: 'Permission Denied: Tenant context mismatch' });
      }

      if (user.role?.name !== 'AGENT') {
        return res.status(403).json({ error: 'Forbidden', message: 'Permission Denied: Role mismatch' });
      }

      // Route permission check
      const requiredPermission = getRequiredPermissionForPath(req.path, req.method);
      if (requiredPermission) {
        const hasPermission = await checkAgentPermission(user.roleId || 0, requiredPermission);
        if (!hasPermission) {
          return res.status(403).json({ error: 'Forbidden', message: `Permission Denied: Missing ${requiredPermission} permission` });
        }
      }
    } catch (error) {
      console.error('Agent security check error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  next();
});


// MinIO Setup
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadminpassword',
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'travelbooker-media';

// Setup MinIO bucket on startup
async function initMinio() {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log(`Created MinIO Bucket: ${BUCKET_NAME}`);
      
      // Set bucket policy to allow public read (anonymous access) to files
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicRead',
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
          },
        ],
      };
      await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
      console.log(`Configured public read policy for bucket: ${BUCKET_NAME}`);
    } else {
      console.log(`MinIO Bucket ${BUCKET_NAME} already exists.`);
    }
  } catch (error) {
    console.error('Failed to initialize MinIO bucket:', error);
  }
}

// Trigger MinIO initialization
initMinio();

// Multer config for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, GIF, and WEBP are allowed.'));
    }
  }
});

// Validation Schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  tenantId: z.number().optional() // Optional to allow registering Super Admins under separate endpoints or via custom flag
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  isSuperAdmin: z.boolean().optional().default(false)
});

const createTenantSchema = z.object({
  name: z.string().min(2),
  domain: z.string().optional().nullable(),
  status: z.string().optional().default('active'),
  logo: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  subscriptionPlan: z.string().optional().default('trial'),
  subscriptionStatus: z.string().optional().default('trial'),
  trialDurationDays: z.number().optional().default(14),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(6)
});

const updateTenantSchema = z.object({
  name: z.string().min(2).optional(),
  domain: z.string().optional().nullable(),
  status: z.string().optional(),
  logo: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  subscriptionPlan: z.string().optional(),
  subscriptionStatus: z.string().optional(),
  trialEndsAt: z.string().optional().nullable()
});

// Middleware to authorize Platform Super Admins downstream
const requirePlatformAdmin = (req: any, res: Response, next: any) => {
  const isPlatformAdmin = req.headers['x-is-platform-admin'] === 'true' || req.headers['X-Is-Platform-Admin'] === 'true';
  const role = req.headers['x-user-role'] || req.headers['X-User-Role'];
  
  if (!isPlatformAdmin && role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Forbidden', message: 'Platform Super Admin access required' });
  }
  next();
};

// Health Check
app.get('/health', (req: any, res: Response) => {
  res.status(200).json({ status: 'UP', service: 'Auth Service' });
});

// File Upload Route
app.post('/upload', upload.single('file'), async (req: any, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const fileExt = path.extname(file.originalname) || '.png';
    const fileName = `${crypto.randomUUID()}${fileExt}`;

    await minioClient.putObject(BUCKET_NAME, fileName, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    });

    const externalUrl = process.env.MINIO_EXTERNAL_URL || 'http://localhost:9010';
    const fileUrl = `${externalUrl}/${BUCKET_NAME}/${fileName}`;

    res.status(200).json({ url: fileUrl });
  } catch (error: any) {
    console.error('File Upload Error:', error);
    res.status(500).json({ error: 'Failed to upload file', message: error.message });
  }
});

// Register User (Tenant Specific)
app.post('/register', async (req: any, res: Response) => {
  try {
    const parsedData = registerSchema.parse(req.body);
    const tenantId = parsedData.tenantId || 1; // Default tenant
    
    const existingUser = await prisma.user.findUnique({
      where: { email: parsedData.email }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'This email is already registered in the system. Users cannot cross-login across different companies.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(parsedData.password, salt);

    const tenant = await prisma.tenant.upsert({
      where: { id: tenantId },
      update: {},
      create: { name: 'Default Tenant', status: 'active' }
    });

    let role = await prisma.role.findFirst({
      where: { name: 'MAIN_COMPANY_ADMIN', tenantId: tenant.id }
    });
    if (!role) {
      role = await prisma.role.create({
        data: { name: 'MAIN_COMPANY_ADMIN', tenantId: tenant.id }
      });
    }

    // Seed default roles and permissions for this tenant immediately on registration
    await ensureRolePermissionsSeeded(tenant.id);

    // Refresh role ID reference just in case
    const updatedRole = await prisma.role.findFirst({
      where: { name: 'MAIN_COMPANY_ADMIN', tenantId: tenant.id }
    });
    const finalRoleId = updatedRole ? updatedRole.id : role.id;

    const newUser = await prisma.user.create({
      data: {
        email: parsedData.email,
        name: parsedData.name,
        encryptedPassword: hashedPassword,
        tenantId: tenant.id,
        roleId: finalRoleId
      }
    });

    res.status(201).json({ 
      message: 'User registered successfully', 
      user: { id: newUser.id, email: newUser.email, name: newUser.name, tenantId: newUser.tenantId } 
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: (error as any).errors });
    }
    console.error('Registration Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Register SaaS Super Admin (Platform Level)
app.post('/super-admin/register', async (req: any, res: Response) => {
  try {
    const parsedData = registerSchema.parse(req.body);
    
    const existingAdmin = await prisma.platformAdmin.findUnique({
      where: { email: parsedData.email }
    });

    if (existingAdmin) {
      return res.status(409).json({ error: 'Platform admin already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(parsedData.password, salt);

    const newAdmin = await prisma.platformAdmin.create({
      data: {
        email: parsedData.email,
        name: parsedData.name,
        encryptedPassword: hashedPassword
      }
    });

    res.status(201).json({ 
      message: 'Platform admin registered successfully', 
      admin: { id: newAdmin.id, email: newAdmin.email, name: newAdmin.name } 
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: (error as any).errors });
    }
    console.error('Platform Registration Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Login (Handles both Platform Admins and Tenant Users)
app.post('/login', async (req: any, res: Response) => {
  try {
    const parsedData = loginSchema.parse(req.body);
    
    if (parsedData.isSuperAdmin) {
      // Platform Admin Login
      const admin = await prisma.platformAdmin.findUnique({
        where: { email: parsedData.email }
      });

      if (!admin) {
        return res.status(401).json({ error: 'Invalid platform admin credentials' });
      }

      const isValid = await bcrypt.compare(parsedData.password, admin.encryptedPassword);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid platform admin credentials' });
      }

      const token = jwt.sign(
        { id: admin.id, email: admin.email, role: 'SUPER_ADMIN', isPlatformLevel: true },
        JWT_SECRET,
        { expiresIn: '1d' }
      );

      return res.status(200).json({ 
        message: 'Platform login successful',
        token, 
        user: { id: admin.id, email: admin.email, name: admin.name, role: 'SUPER_ADMIN' } 
      });
    }

    // Regular Tenant User Login
    const user = await prisma.user.findFirst({
      where: { email: parsedData.email },
      include: { role: true, tenant: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(parsedData.password, user.encryptedPassword);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify Subscription Expiry / Trial Expiry / Account Status
    const tenant = user.tenant;
    if (tenant.status === 'suspended') {
      return res.status(403).json({ error: 'Company account is suspended. Please contact admin.' });
    }

    if (tenant.subscriptionPlan === 'trial') {
      if (tenant.trialEndsAt && new Date() > new Date(tenant.trialEndsAt)) {
        return res.status(402).json({ 
          error: 'Trial period has expired', 
          message: 'Your company\'s free trial has ended. Please ask your administrator to purchase a lifetime or active subscription plan.' 
        });
      }
    } else if (tenant.subscriptionStatus === 'expired') {
      return res.status(402).json({
        error: 'Subscription expired',
        message: 'Your company\'s subscription has expired. Please contact support.'
      });
    }

    // Role resolving
    const userRole = user.role?.name || 'COMPANY_USER';

    // Ensure role permissions are seeded for the tenant
    await ensureRolePermissionsSeeded(user.tenantId);

    // Get permissions for the user's role
    let permissions: string[] = [];
    if (user.roleId) {
      const rolePerms = await prisma.rolePermission.findMany({
        where: { roleId: user.roleId },
        include: { permission: true }
      });
      permissions = rolePerms.map((rp: any) => rp.permission.name);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, tenantId: user.tenantId, role: userRole, isPlatformLevel: false },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(200).json({ 
      message: 'Login successful',
      token, 
      user: { id: user.id, email: user.email, name: user.name, tenantId: user.tenantId, role: userRole, permissions, agentId: user.agentId } 
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: (error as any).errors });
    }
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Verify Token Route
app.post('/verify-token', (req: any, res: Response) => {
  const token = req.body.token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ valid: false, error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.status(200).json({ valid: true, decoded });
  } catch (error) {
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});

// Tenant Management routes (Platform Admin only)
app.get('/tenants', requirePlatformAdmin, async (req: any, res: Response) => {
  try {
    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: { users: true }
        }
      }
    });
    res.status(200).json({ tenants });
  } catch (error) {
    console.error('Fetch Tenants Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.post('/tenants', requirePlatformAdmin, async (req: any, res: Response) => {
  try {
    const parsedData = createTenantSchema.parse(req.body);
    
    // Check if domain exists
    if (parsedData.domain) {
      const existingDomain = await prisma.tenant.findUnique({
        where: { domain: parsedData.domain }
      });
      if (existingDomain) {
        return res.status(409).json({ error: 'Tenant domain already registered' });
      }
    }

    const existingEmail = await prisma.user.findUnique({ where: { email: parsedData.adminEmail } });
    if (existingEmail) {
      return res.status(409).json({ error: 'This admin email is already registered to another company. Users cannot cross-login across different companies.' });
    }

    let trialEndsAt: Date | null = null;
    if (parsedData.subscriptionPlan === 'trial') {
      const durationDays = parsedData.trialDurationDays || 14;
      const ends = new Date();
      ends.setDate(ends.getDate() + durationDays);
      trialEndsAt = ends;
    }

    // Execute in a transaction to guarantee both tenant & admin user are successfully created
    const newTenant = await prisma.$transaction(async (tx: any) => {
      // 1. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: parsedData.name,
          domain: parsedData.domain || null,
          status: parsedData.status,
          logo: parsedData.logo || null,
          description: parsedData.description || null,
          industry: parsedData.industry || null,
          location: parsedData.location || null,
          email: parsedData.email || null,
          phone: parsedData.phone || null,
          subscriptionPlan: parsedData.subscriptionPlan || 'trial',
          subscriptionStatus: parsedData.subscriptionPlan === 'trial' ? 'trial' : 'active',
          trialEndsAt
        }
      });

      // 2. Create the MAIN_COMPANY_ADMIN role for this tenant
      const adminRole = await tx.role.create({
        data: {
          name: 'MAIN_COMPANY_ADMIN',
          tenantId: tenant.id
        }
      });

      // 3. Hash the initial admin password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(parsedData.adminPassword, salt);

      // 4. Create the initial administrator user
      await tx.user.create({
        data: {
          email: parsedData.adminEmail,
          name: 'Administrator',
          encryptedPassword: hashedPassword,
          tenantId: tenant.id,
          roleId: adminRole.id
        }
      });

      return tenant;
    });

    // Seed default roles and permissions for this tenant
    await ensureRolePermissionsSeeded(newTenant.id);

    res.status(201).json({ message: 'Tenant and admin user created successfully', tenant: newTenant });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: (error as any).errors });
    }
    console.error('Create Tenant Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/tenants/:id', requirePlatformAdmin, async (req: any, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const parsedData = updateTenantSchema.parse(req.body);

    if (parsedData.domain) {
      const existingDomain = await prisma.tenant.findFirst({
        where: { domain: parsedData.domain, NOT: { id } }
      });
      if (existingDomain) {
        return res.status(409).json({ error: 'Tenant domain already registered' });
      }
    }

    const updateData: any = { ...parsedData };
    if (parsedData.trialEndsAt !== undefined) {
      updateData.trialEndsAt = parsedData.trialEndsAt ? new Date(parsedData.trialEndsAt) : null;
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id },
      data: updateData
    });

    res.status(200).json({ message: 'Tenant updated successfully', tenant: updatedTenant });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: (error as any).errors });
    }
    console.error('Update Tenant Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─── AGENT MANAGEMENT ROUTES ─────────────────────────────────────────────────

// Helper: require tenant context (from gateway headers)
const requireTenantContext = (req: any, res: Response, next: any) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId || tenantId === 'platform') {
    return res.status(400).json({ error: 'Bad Request', message: 'Tenant context required' });
  }
  req.tenantId = tenantId;
  next();
};

app.get('/tenants/profile', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.tenantId!);
    const tenant = await (prisma as any).tenant.findUnique({
      where: { id: tenantId }
    });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.status(200).json({ tenant });
  } catch (error) {
    console.error('Fetch Tenant Profile Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/tenants/profile', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.tenantId!);
    const { name, logo, domain, description, industry, location, email, phone, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass } = req.body;

    const updatedTenant = await (prisma as any).tenant.update({
      where: { id: tenantId },
      data: {
        ...(name !== undefined && { name }),
        ...(logo !== undefined && { logo: logo || null }),
        ...(domain !== undefined && { domain }),
        ...(description !== undefined && { description }),
        ...(industry !== undefined && { industry }),
        ...(location !== undefined && { location }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(smtpHost !== undefined && { smtpHost: smtpHost || null }),
        ...(smtpPort !== undefined && { smtpPort: smtpPort === null || smtpPort === '' ? null : parseInt(smtpPort) }),
        ...(smtpSecure !== undefined && { smtpSecure: !!smtpSecure }),
        ...(smtpUser !== undefined && { smtpUser: smtpUser || null }),
        ...(smtpPass !== undefined && { smtpPass: smtpPass || null })
      }
    });

    res.status(200).json({ message: 'Tenant profile updated successfully', tenant: updatedTenant });
  } catch (error: any) {
    console.error('Update Tenant Profile Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error?.message });
  }
});

app.post('/tenants/send-email', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.tenantId!);
    const { to, subject, html, text } = req.body;

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const tenant = await (prisma as any).tenant.findUnique({
      where: { id: tenantId }
    });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    let transporter;
    let fromEmail = tenant.email || 'operations@travelbooker.co.uk';
    let fromName = tenant.name || 'Travel Agency';

    if (tenant.smtpHost && tenant.smtpPort && tenant.smtpUser && tenant.smtpPass) {
      console.log(`Using custom SMTP for tenant ${tenantId}: ${tenant.smtpHost}`);
      transporter = nodemailer.createTransport({
        host: tenant.smtpHost,
        port: tenant.smtpPort,
        secure: !!tenant.smtpSecure,
        auth: {
          user: tenant.smtpUser,
          pass: tenant.smtpPass,
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      if (tenant.smtpUser.includes('@')) {
        fromEmail = tenant.smtpUser;
      }
    } else {
      console.log(`Using default system SMTP for tenant ${tenantId}`);
      transporter = await getSmtpTransporter();
      const userSetting = await prisma.systemSetting.findUnique({ where: { key: 'smtp_user' } });
      if (userSetting?.value) {
        fromEmail = userSetting.value;
      }
    }

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      ...(html && { html }),
      ...(text && { text })
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error: any) {
    console.error('Send Tenant Email Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error?.message });
  }
});

app.get('/agents/verify-request', async (req: any, res: Response) => {
  const userRole = req.headers['x-user-role'] || req.headers['X-User-Role'];
  const userId = req.headers['x-user-id'] || req.headers['X-User-Id'];
  const tenantIdStr = req.headers['x-tenant-id'] || req.headers['X-Tenant-Id'];
  const permissionName = req.query.permission as string;

  // We only run this check for AGENT role. If it is NOT an agent, we assume it's allowed or handled elsewhere.
  if (userRole !== 'AGENT') {
    return res.status(200).json({ allowed: true });
  }

  if (!userId || !tenantIdStr) {
    return res.status(200).json({ allowed: false, message: 'Missing user or tenant context headers' });
  }

  const uId = parseInt(userId as string);
  const tId = parseInt(tenantIdStr as string);

  if (isNaN(uId) || isNaN(tId)) {
    return res.status(200).json({ allowed: false, message: 'Invalid user or tenant ID' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: uId },
      include: { role: true }
    });

    if (!user) {
      return res.status(200).json({ allowed: false, message: 'User not found' });
    }

    if (user.tenantId !== tId) {
      return res.status(200).json({ allowed: false, message: 'Tenant context mismatch' });
    }

    if (user.role?.name !== 'AGENT') {
      return res.status(200).json({ allowed: false, message: 'Role mismatch' });
    }

    // Check permission if specified
    if (permissionName) {
      const hasPermission = await checkAgentPermission(user.roleId || 0, permissionName);
      if (!hasPermission) {
        return res.status(200).json({ allowed: false, message: `Missing required permission: ${permissionName}` });
      }
    }

    return res.status(200).json({ allowed: true });
  } catch (error) {
    console.error('Verify Agent Request endpoint error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /agents — list all agents for current tenant
app.get('/agents', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.headers['x-tenant-id'] as string);
    const { page, limit, search } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const isAll = limit === 'all';
    const limitNum = isAll ? undefined : (parseInt(limit as string) || 10);
    const skip = isAll ? undefined : (pageNum - 1) * limitNum!;

    const where: any = { tenantId };
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [total, agents] = await Promise.all([
      (prisma as any).agent.count({ where }),
      (prisma as any).agent.findMany({
        where,
        ...(skip !== undefined && { skip }),
        ...(limitNum !== undefined && { take: limitNum }),
        include: { 
          marginSegments: { orderBy: { minAmount: 'asc' } },
          wallet: { include: { transactions: { orderBy: { createdAt: 'desc' } } } }
        },
        orderBy: { name: 'asc' }
      })
    ]);
    res.status(200).json({ 
      agents, 
      total, 
      page: pageNum, 
      limit: limitNum, 
      totalPages: limitNum ? Math.ceil(total / limitNum) : 1 
    });
  } catch (error: any) {
    console.error('List Agents Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error?.message });
  }
});

// GET /agents/by-name/:name — find agent by name (used by booking module)
app.get('/agents/by-name/:name', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.headers['x-tenant-id'] as string);
    const name = decodeURIComponent(req.params.name);
    const agent = await (prisma as any).agent.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } },
      include: { marginSegments: { orderBy: { minAmount: 'asc' } } }
    });
    if (!agent) return res.status(404).json({ error: 'Not Found', message: 'Agent not found' });
    res.status(200).json({ agent });
  } catch (error: any) {
    console.error('Find Agent By Name Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error?.message });
  }
});

// ─── Agent Attendance Endpoints ───────────────────────────────────────────────

// GET /agents/attendance — all agents' attendance with filters
app.get('/agents/attendance', async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(req.headers['x-tenant-id'] as string);
    if (!tenantId) return res.status(400).json({ error: 'Missing tenant' });

    const { agentId, from, to, view } = req.query as Record<string, string>;

    // Build date range
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    const now = new Date();

    if (view === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (view === 'week') {
      const day = now.getDay(); // 0=Sun
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((day + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      startDate = monday;
      endDate = sunday;
    } else if (view === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (from || to) {
      if (from) { startDate = new Date(from); startDate.setHours(0, 0, 0, 0); }
      if (to) { endDate = new Date(to); endDate.setHours(23, 59, 59, 999); }
    }

    const userRole = req.headers['x-user-role'] || req.headers['X-User-Role'];
    const userId = req.headers['x-user-id'] || req.headers['X-User-Id'];

    const where: any = { tenantId };
    if (userRole === 'AGENT') {
      if (!userId) {
        return res.status(403).json({ error: 'Forbidden', message: 'Permission Denied: User context required' });
      }
      const user = await prisma.user.findUnique({
        where: { id: parseInt(userId as string) }
      });
      if (user && user.agentId) {
        where.agentId = user.agentId;
      } else {
        where.agentId = -1;
      }
    } else {
      if (agentId) where.agentId = parseInt(agentId);
    }
    if (startDate || endDate) {
      where.checkIn = {};
      if (startDate) where.checkIn.gte = startDate;
      if (endDate) where.checkIn.lte = endDate;
    }

    const records = await prisma.agentAttendance.findMany({
      where,
      include: { agent: { select: { id: true, name: true, email: true, jobStatus: true } } },
      orderBy: { checkIn: 'desc' },
    });

    // Compute duration
    const data = records.map((r: any) => ({
      ...r,
      durationMinutes: r.checkOut
        ? Math.round((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 60000)
        : null,
    }));

    // Summary stats
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const todayRecords = await prisma.agentAttendance.findMany({ where: { tenantId, checkIn: { gte: todayStart, lte: todayEnd } } });
    const currentlyIn = await prisma.agentAttendance.count({ where: { tenantId, checkOut: null } });

    return res.json({
      attendance: data,
      total: data.length,
      summary: {
        todayCheckIns: todayRecords.length,
        currentlyIn,
      },
    });
  } catch (err) {
    console.error('GET attendance error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /agents/:id/attendance — single agent attendance
app.get('/agents/:id/attendance', async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(req.headers['x-tenant-id'] as string);
    const agentId = parseInt(req.params.id);

    const { from, to, view } = req.query as Record<string, string>;
    const now = new Date();
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (view === 'week') {
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((day + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      startDate = monday;
      endDate = sunday;
    } else if (view === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (from || to) {
      if (from) { startDate = new Date(from); startDate.setHours(0, 0, 0, 0); }
      if (to) { endDate = new Date(to); endDate.setHours(23, 59, 59, 999); }
    }

    const where: any = { tenantId, agentId };
    if (startDate || endDate) {
      where.checkIn = {};
      if (startDate) where.checkIn.gte = startDate;
      if (endDate) where.checkIn.lte = endDate;
    }

    const records = await prisma.agentAttendance.findMany({
      where,
      orderBy: { checkIn: 'desc' },
    });

    // Check if currently checked in
    const openRecord = await prisma.agentAttendance.findFirst({
      where: { tenantId, agentId, checkOut: null },
      orderBy: { checkIn: 'desc' },
    });

    const data = records.map((r: any) => ({
      ...r,
      durationMinutes: r.checkOut
        ? Math.round((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 60000)
        : null,
    }));

    return res.json({ attendance: data, total: data.length, isCheckedIn: !!openRecord, openRecord: openRecord || null });
  } catch (err) {
    console.error('GET agent attendance error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /agents/:id/attendance/checkin
app.post('/agents/:id/attendance/checkin', async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(req.headers['x-tenant-id'] as string);
    const agentId = parseInt(req.params.id);
    const { notes } = req.body || {};

    const userRole = req.headers['x-user-role'] || req.headers['X-User-Role'];
    const userId = req.headers['x-user-id'] || req.headers['X-User-Id'];
    if (userRole === 'AGENT') {
      if (!userId) {
        return res.status(403).json({ error: 'Forbidden', message: 'Permission Denied: User context required' });
      }
      const user = await prisma.user.findUnique({
        where: { id: parseInt(userId as string) }
      });
      if (!user || user.agentId !== agentId) {
        return res.status(403).json({ error: 'Forbidden', message: 'Permission Denied: Agents can only manage their own attendance' });
      }
    }

    // Verify agent belongs to tenant
    const agent = await prisma.agent.findFirst({ where: { id: agentId, tenantId } });
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    // Check if already checked in
    const existing = await prisma.agentAttendance.findFirst({
      where: { tenantId, agentId, checkOut: null },
      orderBy: { checkIn: 'desc' },
    });
    if (existing) {
      return res.status(400).json({ error: 'Agent is already checked in', record: existing });
    }

    const record = await prisma.agentAttendance.create({
      data: {
        agentId,
        tenantId,
        checkIn: new Date(),
        notes: notes || null,
      },
      include: { agent: { select: { id: true, name: true, email: true } } },
    });

    return res.status(201).json({ message: 'Checked in successfully', record });
  } catch (err) {
    console.error('Check-in error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /agents/:id/attendance/checkout
app.post('/agents/:id/attendance/checkout', async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(req.headers['x-tenant-id'] as string);
    const agentId = parseInt(req.params.id);
    const { notes } = req.body || {};

    const userRole = req.headers['x-user-role'] || req.headers['X-User-Role'];
    const userId = req.headers['x-user-id'] || req.headers['X-User-Id'];
    if (userRole === 'AGENT') {
      if (!userId) {
        return res.status(403).json({ error: 'Forbidden', message: 'Permission Denied: User context required' });
      }
      const user = await prisma.user.findUnique({
        where: { id: parseInt(userId as string) }
      });
      if (!user || user.agentId !== agentId) {
        return res.status(403).json({ error: 'Forbidden', message: 'Permission Denied: Agents can only manage their own attendance' });
      }
    }

    // Find open check-in record
    const openRecord = await prisma.agentAttendance.findFirst({
      where: { tenantId, agentId, checkOut: null },
      orderBy: { checkIn: 'desc' },
    });

    if (!openRecord) {
      return res.status(400).json({ error: 'Agent is not currently checked in' });
    }

    const checkOutTime = new Date();
    const record = await prisma.agentAttendance.update({
      where: { id: openRecord.id },
      data: {
        checkOut: checkOutTime,
        notes: notes || openRecord.notes,
      },
      include: { agent: { select: { id: true, name: true, email: true } } },
    });

    const durationMinutes = Math.round(
      (checkOutTime.getTime() - new Date(openRecord.checkIn).getTime()) / 60000
    );

    return res.json({ message: 'Checked out successfully', record, durationMinutes });
  } catch (err) {
    console.error('Check-out error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─── Agent Payroll Endpoints ───────────────────────────────────────────────────

// GET /agents/payroll - list payroll records for the current tenant
app.get('/agents/payroll', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.tenantId);
    const { agentId, status, from, to } = req.query;

    const where: any = { tenantId };

    if (agentId) {
      where.agentId = parseInt(agentId as string);
    }
    if (status) {
      where.status = status as string;
    }
    if (from || to) {
      where.periodFrom = {};
      if (from) {
        where.periodFrom.gte = new Date(from as string);
      }
      if (to) {
        where.periodFrom.lte = new Date(to as string);
      }
    }

    const payrolls = await prisma.agentPayroll.findMany({
      where,
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            email: true,
            personalEmail: true,
            basicSalary: true,
            gdsSystem: true,
            pcc: true,
          }
        }
      },
      orderBy: {
        periodFrom: 'desc'
      }
    });

    return res.json({ payrolls });
  } catch (err: any) {
    console.error('GET /agents/payroll error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /agents/:id/payroll - generate payroll record for a given agent and period
app.post('/agents/:id/payroll', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.tenantId);
    const agentId = parseInt(req.params.id);
    const { periodFrom, periodTo, notes } = req.body;

    if (!periodFrom || !periodTo) {
      return res.status(400).json({ error: 'Missing required fields: periodFrom and periodTo' });
    }

    // Find agent
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, tenantId }
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const basicSalary = agent.basicSalary ? Number(agent.basicSalary) : 0.00;

    // Call booking-service to get total margin earned
    const bookingServiceUrl = process.env.BOOKING_SERVICE_URL || 'http://booking-service:4005';
    let totalMarginEarned = 0.00;

    try {
      const response = await axios.get(`${bookingServiceUrl}/finance/agent-margin-summary`, {
        params: { agentId, from: periodFrom, to: periodTo },
        headers: {
          'X-Tenant-Id': String(tenantId),
          'X-User-Id': String(req.headers['x-user-id'] || '1'),
          'X-User-Role': String(req.headers['x-user-role'] || 'COMPANY_ADMIN'),
        }
      });
      totalMarginEarned = response.data.totalMarginEarned ? parseFloat(response.data.totalMarginEarned) : 0.00;
    } catch (apiErr: any) {
      console.error('Failed to fetch agent margin summary from booking-service:', apiErr.message);
      return res.status(502).json({ error: 'Failed to fetch agent margin summary from booking service' });
    }

    const totalPaid = basicSalary + totalMarginEarned;

    const payroll = await prisma.agentPayroll.create({
      data: {
        agentId,
        tenantId,
        periodFrom: new Date(periodFrom),
        periodTo: new Date(periodTo),
        basicSalary,
        totalMarginEarned,
        totalPaid,
        status: 'Draft',
        notes: notes || null
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            email: true,
            personalEmail: true
          }
        }
      }
    });

    return res.status(201).json({ message: 'Payroll generated successfully', payroll });
  } catch (err: any) {
    console.error('POST /agents/:id/payroll error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /agents/payroll/:id - mark as Paid / update status or notes
app.patch('/agents/payroll/:id', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.tenantId);
    const payrollId = parseInt(req.params.id);
    const { status, notes } = req.body;

    const existing = await prisma.agentPayroll.findFirst({
      where: { id: payrollId, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    const updated = await prisma.agentPayroll.update({
      where: { id: payrollId },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes: notes || null })
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            email: true,
            personalEmail: true
          }
        }
      }
    });

    return res.json({ message: 'Payroll updated successfully', payroll: updated });
  } catch (err: any) {
    console.error('PATCH /agents/payroll/:id error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /agents/payroll/:id/send - send branded email payroll slip
app.post('/agents/payroll/:id/send', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.tenantId);
    const payrollId = parseInt(req.params.id);

    const payroll = await prisma.agentPayroll.findFirst({
      where: { id: payrollId, tenantId },
      include: {
        agent: true
      }
    });

    if (!payroll) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    const targetEmail = req.body.email || payroll.agent.personalEmail || payroll.agent.email;
    if (!targetEmail) {
      return res.status(400).json({ error: 'Recipient email address is required' });
    }

    const customTotalWorkdays = req.body.totalWorkdays !== undefined ? Number(req.body.totalWorkdays) : null;
    const customDaysPresent = req.body.daysPresent !== undefined ? Number(req.body.daysPresent) : null;
    const customAbsents = req.body.absents !== undefined ? Number(req.body.absents) : null;
    const paidHolidaysCount = req.body.paidHolidaysCount !== undefined ? Number(req.body.paidHolidaysCount) : 0;
    const paidHolidaysRate = req.body.paidHolidaysRate !== undefined ? Number(req.body.paidHolidaysRate) : 0;
    const publicHolidaysCount = req.body.publicHolidaysCount !== undefined ? Number(req.body.publicHolidaysCount) : 0;
    const publicHolidaysRate = req.body.publicHolidaysRate !== undefined ? Number(req.body.publicHolidaysRate) : 0;
    const allowances = req.body.allowances || [];
    const deductions = req.body.deductions || [];
    const customNotes = req.body.notes !== undefined ? req.body.notes : payroll.notes;

    // Fetch tenant profile for branding information (logo, name)
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    const companyName = tenant?.name || 'Travel Booker';
    const logoUrl = tenant?.logo || 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80';

    // Fetch unique attendance check-ins during the period if not overridden
    let daysPresent = 0;
    if (customDaysPresent !== null) {
      daysPresent = customDaysPresent;
    } else {
      const attendanceRecords = await prisma.agentAttendance.findMany({
        where: {
          agentId: payroll.agentId,
          tenantId,
          checkIn: {
            gte: payroll.periodFrom,
            lte: new Date(new Date(payroll.periodTo).setHours(23, 59, 59, 999))
          }
        }
      });
      const uniqueDays = new Set(
        attendanceRecords.map((r: any) => new Date(r.checkIn).toLocaleDateString('en-GB'))
      );
      daysPresent = uniqueDays.size;
    }

    // Calculate total weekdays (working days)
    let weekdaysCount = 0;
    const curDate = new Date(payroll.periodFrom);
    const endDate = new Date(payroll.periodTo);
    while (curDate <= endDate) {
      const day = curDate.getDay();
      if (day !== 0 && day !== 6) { // 0 = Sunday, 6 = Saturday
        weekdaysCount++;
      }
      curDate.setDate(curDate.getDate() + 1);
    }
    const totalWorkdays = customTotalWorkdays !== null ? customTotalWorkdays : (weekdaysCount || 1);
    const absents = customAbsents !== null ? customAbsents : Math.max(0, totalWorkdays - daysPresent);

    const basicSalaryVal = Number(payroll.basicSalary);
    const marginEarnedVal = Number(payroll.totalMarginEarned);

    let finalAllowances = allowances;
    if (req.body.allowances === undefined) {
      const gdsAllowance = payroll.agent.gdsSystem ? 120.00 : 0.00;
      const travelAllowance = 80.00;
      finalAllowances = [
        { description: 'Travel & Internet connectivity allowance (Amenities)', amount: travelAllowance }
      ];
      if (gdsAllowance > 0) {
        finalAllowances.push({ description: 'GDS Terminal Premium allowance (Amenities)', amount: gdsAllowance });
      }
    }

    const totalAllowances = finalAllowances.reduce((sum: number, a: any) => sum + Number(a.amount), 0);
    const dailyRate = totalWorkdays > 0 ? (basicSalaryVal / totalWorkdays) : 0;
    const absentDeduction = dailyRate * absents;
    const holidayPay = (paidHolidaysCount * paidHolidaysRate) + (publicHolidaysCount * publicHolidaysRate);
    
    const grossEarnings = basicSalaryVal + marginEarnedVal + totalAllowances + holidayPay;
    
    const customDeductionsVal = deductions.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
    const totalDeductions = absentDeduction + customDeductionsVal;
    const finalNetPay = Math.max(0, grossEarnings - totalDeductions);

    // Create dates formats
    const periodFromStr = new Date(payroll.periodFrom).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const periodToStr = new Date(payroll.periodTo).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const issueDateStr = new Date(payroll.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    // Generate PDF Slip
    let logoBuffer: Buffer | null = null;
    if (logoUrl) {
      logoBuffer = await fetchLogoBuffer(logoUrl);
    }

    const pdfBuffer = await generateSalarySlipPdf({
      companyName,
      logoBuffer,
      agentName: payroll.agent.name,
      agentEmail: targetEmail,
      periodFromStr,
      periodToStr,
      gdsSystem: payroll.agent.gdsSystem || 'None',
      pcc: payroll.agent.pcc || 'None',
      totalWorkdays,
      daysPresent,
      absents,
      paidHolidaysCount,
      paidHolidaysRate,
      publicHolidaysCount,
      publicHolidaysRate,
      basicSalaryVal,
      marginEarnedVal,
      allowances: finalAllowances,
      deductions,
      notes: customNotes || undefined,
      issueDateStr
    });

    // Create a beautiful branded HTML email content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; background-color: #f1f5f9; }
          .container { max-width: 650px; margin: 40px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 35px 30px; text-align: center; color: white; position: relative; }
          .logo { max-height: 50px; margin-bottom: 12px; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #38bdf8; }
          .header p { margin: 4px 0 0 0; font-size: 14px; color: #cbd5e1; font-weight: 500; }
          
          .content { padding: 35px 30px; }
          
          /* Info block */
          .info-section { display: table; width: 100%; border-collapse: collapse; margin-bottom: 25px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 20px; }
          .info-col { display: table-cell; width: 50%; vertical-align: top; }
          .info-label { font-size: 11px; text-transform: uppercase; font-weight: bold; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px; }
          .info-value { font-size: 14px; font-weight: bold; color: #0f172a; margin-bottom: 12px; }
          
          /* Attendance block */
          .attendance-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; margin-bottom: 30px; }
          .attendance-title { font-size: 11px; text-transform: uppercase; font-weight: 800; color: #475569; letter-spacing: 0.5px; margin-bottom: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; }
          .attendance-grid { display: table; width: 100%; }
          .attendance-item { display: table-cell; width: 33.33%; text-align: center; }
          .attendance-count { font-size: 18px; font-weight: 800; color: #0f172a; }
          .attendance-lbl { font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase; margin-top: 2px; }
          
          /* Table breakdown */
          .slip-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          .slip-table th { text-align: left; padding: 10px 12px; background-color: #f8fafc; font-size: 11px; text-transform: uppercase; color: #475569; font-weight: bold; border-top: 1px solid #e2e8f0; border-bottom: 2px solid #e2e8f0; }
          .slip-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; }
          .slip-table .number { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
          .slip-table .section-title { font-weight: bold; color: #0f172a; background-color: #f8fafc; padding: 6px 12px; font-size: 11px; text-transform: uppercase; border-left: 3px solid #6366f1; }
          
          .subtotal-row td { font-weight: bold; color: #0f172a; background-color: #f8fafc; border-top: 1px solid #cbd5e1; }
          .net-pay-row { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); color: #ffffff !important; }
          .net-pay-row td { font-size: 16px; font-weight: 800; padding: 16px 12px; border: none; color: #ffffff !important; }
          .net-pay-row .number { color: #38bdf8; font-size: 18px; }
          
          .notes-box { font-size: 12px; color: #475569; background-color: #fef3c7; border: 1px solid #fde68a; border-left: 4px solid #d97706; padding: 15px; border-radius: 8px; margin-bottom: 25px; line-height: 1.5; }
          .footer { background-color: #f8fafc; padding: 25px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${logoUrl ? `<img src="${logoUrl}" alt="${companyName} Logo" class="logo" />` : ''}
            <h1>Official Salary Slip</h1>
            <p>${companyName}</p>
          </div>
          
          <div class="content">
            <!-- Employee & Slip Meta Info -->
            <div class="info-section">
              <div class="info-col">
                <div class="info-label">Employee / Agent</div>
                <div class="info-value">${payroll.agent.name}</div>
                
                <div class="info-label">Personal Email</div>
                <div class="info-value">${targetEmail}</div>
              </div>
              <div class="info-col">
                <div class="info-label">Pay Period</div>
                <div class="info-value">${periodFromStr} &ndash; ${periodToStr}</div>
                
                <div class="info-label">GDS PCC & System</div>
                <div class="info-value">${payroll.agent.gdsSystem || 'None'} / ${payroll.agent.pcc || 'None'}</div>
              </div>
            </div>
            
            <!-- Attendance Summary -->
            <div class="attendance-box">
              <div class="attendance-title">Attendance & Calendar Summary</div>
              <div class="attendance-grid">
                <div class="attendance-item">
                  <div class="attendance-count">${totalWorkdays}</div>
                  <div class="attendance-lbl">Total Workdays</div>
                </div>
                <div class="attendance-item">
                  <div class="attendance-count" style="color: #16a34a;">${daysPresent}</div>
                  <div class="attendance-lbl">Days Present</div>
                </div>
                <div class="attendance-item">
                  <div class="attendance-count" style="color: #dc2626;">${absents}</div>
                  <div class="attendance-lbl">Days Absent</div>
                </div>
              </div>
            </div>
            
            <!-- Salary Slip Tables -->
            <table class="slip-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th style="text-align: right; width: 120px;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <!-- Earnings Section -->
                <tr>
                  <td colspan="2" class="section-title">Earnings & Commissions</td>
                </tr>
                <tr>
                  <td>Basic Salary (Monthly contract)</td>
                  <td class="number">£${basicSalaryVal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Commission / Margin Share (dynamic yield)</td>
                  <td class="number">£${marginEarnedVal.toFixed(2)}</td>
                </tr>
                ${finalAllowances.map((a: any) => `
                <tr>
                  <td>${a.description}</td>
                  <td class="number">£${Number(a.amount).toFixed(2)}</td>
                </tr>
                `).join('')}
                ${paidHolidaysCount > 0 ? `
                <tr>
                  <td>Paid Holidays (${paidHolidaysCount} days @ £${paidHolidaysRate.toFixed(2)}/day)</td>
                  <td class="number">£${(paidHolidaysCount * paidHolidaysRate).toFixed(2)}</td>
                </tr>
                ` : ''}
                ${publicHolidaysCount > 0 ? `
                <tr>
                  <td>Public Holidays (${publicHolidaysCount} days @ £${publicHolidaysRate.toFixed(2)}/day)</td>
                  <td class="number">£${(publicHolidaysCount * publicHolidaysRate).toFixed(2)}</td>
                </tr>
                ` : ''}
                <tr class="subtotal-row">
                  <td>Total Gross Earnings</td>
                  <td class="number">£${grossEarnings.toFixed(2)}</td>
                </tr>
                
                <!-- Deductions Section -->
                <tr>
                  <td colspan="2" class="section-title" style="border-left-color: #ef4444;">Deductions & Adjustments</td>
                </tr>
                ${absents > 0 && dailyRate > 0 ? `
                <tr>
                  <td>Absenteeism Penalty (${absents} days absent @ £${dailyRate.toFixed(2)}/day)</td>
                  <td class="number" style="color: #dc2626;">-£${absentDeduction.toFixed(2)}</td>
                </tr>
                ` : ''}
                ${deductions.map((d: any) => `
                <tr>
                  <td>${d.description}</td>
                  <td class="number" style="color: #dc2626;">-£${Number(d.amount).toFixed(2)}</td>
                </tr>
                `).join('')}
                <tr class="subtotal-row">
                  <td>Total Deductions</td>
                  <td class="number" style="color: #dc2626;">£${totalDeductions.toFixed(2)}</td>
                </tr>
                
                <!-- Net Pay Section -->
                <tr class="net-pay-row">
                  <td>Total Net Payable (Net Salary)</td>
                  <td class="number">£${finalNetPay.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            ${customNotes ? `<div class="notes-box"><strong>Notes & Remarks:</strong><br/>${customNotes}</div>` : ''}
            
            <p style="font-size: 12px; line-height: 1.5; color: #64748b; margin: 30px 0 0 0; text-align: center;">
              This is a secure official statement generated by your employer. If you have any inquiries regarding this document, please contact the finance team.
            </p>
          </div>
          
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.<br/>
            Sent via custom secure company mail server (SMTP). This is an automated notification. Please do not reply directly.
          </div>
        </div>
      </body>
      </html>
    `;

    // Send the email using the tenant SMTP helper getTenantSmtpTransporter
    const { transporter, fromEmail, fromName } = await getTenantSmtpTransporter(tenantId);

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: targetEmail,
      subject: `Payroll Slip: ${periodFromStr} - ${periodToStr}`,
      html: htmlContent,
      attachments: [
        {
          filename: `SalarySlip_${payroll.agent.name.replace(/\s+/g, '_')}_${periodFromStr.replace(/\s+/g, '_')}.pdf`,
          content: pdfBuffer
        }
      ]
    });

    // Update status to Sent, set sentAt, and save the customized calculations
    const updated = await prisma.agentPayroll.update({
      where: { id: payrollId },
      data: {
        status: 'Sent',
        sentAt: new Date(),
        totalPaid: finalNetPay,
        notes: customNotes,
        totalWorkdays,
        daysPresent,
        absents,
        paidHolidaysCount,
        paidHolidaysRate,
        publicHolidaysCount,
        publicHolidaysRate,
        allowances: finalAllowances,
        deductions: deductions
      }
    });

    // Double entry ledger integration (without agent margin)
    try {
      const bookingServiceUrl = process.env.BOOKING_SERVICE_URL || 'http://booking-service:4005';
      await axios.post(`${bookingServiceUrl}/finance/payroll-ledger-entry`, {
        agentName: payroll.agent.name,
        basicSalary: basicSalaryVal,
        allowances: totalAllowances + holidayPay,
        deductions: totalDeductions,
        notes: customNotes || '',
        periodFrom: periodFromStr,
        periodTo: periodToStr,
        payrollId: payrollId
      }, {
        headers: {
          'X-Tenant-Id': String(tenantId),
          'X-User-Id': String(req.headers['x-user-id'] || '1'),
          'X-User-Role': String(req.headers['x-user-role'] || 'COMPANY_ADMIN'),
        }
      });
    } catch (ledgerErr: any) {
      console.error('Failed to register payroll in ledger:', ledgerErr.response?.data || ledgerErr.message);
      return res.status(502).json({
        error: 'Failed to register payroll in ledger',
        message: ledgerErr.response?.data?.error || ledgerErr.message
      });
    }

    return res.json({ message: 'Payroll slip sent successfully and logged in ledger', payroll: updated });
  } catch (err: any) {
    console.error('POST /agents/payroll/:id/send error:', err);
    return res.status(500).json({ error: 'Failed to send payroll slip', message: err.message });
  }
});

// ─── End Attendance ────────────────────────────────────────────────────────────

// GET /agents/:id — get single agent with margin segments
app.get('/agents/:id', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.headers['x-tenant-id'] as string);
    const id = parseInt(req.params.id);
    const agent = await (prisma as any).agent.findFirst({
      where: { id, tenantId },
      include: { 
        marginSegments: { orderBy: { minAmount: 'asc' } },
        wallet: { include: { transactions: { orderBy: { createdAt: 'desc' } } } }
      }
    });
    if (!agent) return res.status(404).json({ error: 'Not Found', message: 'Agent not found' });
    res.status(200).json({ agent });
  } catch (error: any) {
    console.error('Get Agent Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error?.message });
  }
});

// POST /agents — create agent

// ==========================================
// TEAM MANAGEMENT ROUTES (USER CRUD)
// ==========================================

app.get('/users', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.tenantId!);
    const { page, limit, search } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const isAll = limit === 'all';
    const limitNum = isAll ? undefined : (parseInt(limit as string) || 10);
    const skip = isAll ? undefined : (pageNum - 1) * limitNum!;

    const where: any = { tenantId };
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { role: { name: { contains: search as string, mode: 'insensitive' } } }
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        ...(skip !== undefined && { skip }),
        ...(limitNum !== undefined && { take: limitNum }),
        include: { role: true, agent: true },
        orderBy: { createdAt: 'desc' }
      })
    ]);
    
    // Map response to hide password and format role
    const sanitized = users.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role?.name || 'UNKNOWN',
      agentId: u.agentId,
      agentName: u.agent?.name,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    }));

    res.status(200).json({
      users: sanitized,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: limitNum ? Math.ceil(total / limitNum) : 1
    });
  } catch (error) {
    console.error('Fetch Users Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/users/:id', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.tenantId!);
    const userId = parseInt(req.params.id);
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId }
    });
    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }
    res.status(200).json({ id: user.id, name: user.name, email: user.email });
  } catch (error) {
    console.error('Get User Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/users', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.tenantId!);
    const { name, email, password, roleName, agentId } = req.body;

    if (!name || !email || !password || !roleName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'This email is already registered in the system.' });
    }

    // Find or create role
    let role = await prisma.role.findFirst({
      where: { tenantId, name: roleName }
    });

    if (!role) {
      role = await prisma.role.create({
        data: { name: roleName, tenantId }
      });
    }

    let resolvedAgentId = agentId ? parseInt(agentId) : null;

    // User -> Agent sync: If the user's role is AGENT, verify/create an agent profile
    if (role.name === 'AGENT') {
      try {
        if (!resolvedAgentId) {
          // Check if an agent profile with this email already exists
          const existingAgent = await (prisma as any).agent.findFirst({
            where: { tenantId, email }
          });
          if (existingAgent) {
            resolvedAgentId = existingAgent.id;
          } else {
            // Create a new agent profile
            const newAgent = await (prisma as any).agent.create({
              data: {
                tenantId,
                name,
                email: email || null,
                jobStatus: 'Active'
              }
            });
            resolvedAgentId = newAgent.id;
          }
        }
      } catch (agentSyncErr) {
        console.error('Create User Agent Sync Error:', agentSyncErr);
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        encryptedPassword: hashedPassword,
        tenantId,
        roleId: role.id,
        agentId: resolvedAgentId
      }
    });

    res.status(201).json({
      message: 'Team member created successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: role.name
      }
    });
  } catch (error) {
    console.error('Create User Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.patch('/users/:id', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.tenantId!);
    const userId = parseInt(req.params.id);
    const { name, roleName, password, agentId } = req.body;

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: { role: true }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let dataToUpdate: any = {};
    if (name) dataToUpdate.name = name;
    if (agentId !== undefined) dataToUpdate.agentId = agentId === null ? null : parseInt(agentId);

    if (password) {
      const salt = await bcrypt.genSalt(10);
      dataToUpdate.encryptedPassword = await bcrypt.hash(password, salt);
    }

    const oldRoleName = user.role?.name;
    let resolvedRoleName = oldRoleName;

    if (roleName) {
      resolvedRoleName = roleName;
      let role = await prisma.role.findFirst({ where: { tenantId, name: roleName } });
      if (!role) {
        role = await prisma.role.create({ data: { name: roleName, tenantId } });
      }
      dataToUpdate.roleId = role.id;
    }

    // Role conversion and agent sync handling
    if (resolvedRoleName === 'AGENT') {
      try {
        let currentAgentId = dataToUpdate.agentId !== undefined ? dataToUpdate.agentId : user.agentId;
        if (!currentAgentId) {
          // Find or create agent profile
          const existingAgent = await (prisma as any).agent.findFirst({
            where: { tenantId, email: user.email }
          });
          if (existingAgent) {
            dataToUpdate.agentId = existingAgent.id;
            currentAgentId = existingAgent.id;
          } else {
            const newAgent = await (prisma as any).agent.create({
              data: {
                tenantId,
                name: name || user.name || '',
                email: user.email,
                jobStatus: 'Active'
              }
            });
            dataToUpdate.agentId = newAgent.id;
            currentAgentId = newAgent.id;
          }
        }

        // Update the agent profile details if name/email changed
        if (currentAgentId) {
          await (prisma as any).agent.update({
            where: { id: currentAgentId },
            data: {
              ...(name && { name })
            }
          });
        }
      } catch (agentSyncErr) {
        console.error('Update User Agent Sync Error:', agentSyncErr);
      }
    } else if (oldRoleName === 'AGENT' && resolvedRoleName !== 'AGENT') {
      // User is no longer an agent, delete the associated agent profile
      const agentToDeleteId = user.agentId;
      if (agentToDeleteId) {
        dataToUpdate.agentId = null;
        try {
          await (prisma as any).agent.delete({ where: { id: agentToDeleteId } });
        } catch (e) {
          console.error('Failed to delete agent profile on user role change:', e);
        }
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      include: { role: true }
    });

    res.status(200).json({
      message: 'User updated successfully',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role?.name
      }
    });
  } catch (error) {
    console.error('Update User Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/users/:id', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.tenantId!);
    const userId = parseInt(req.params.id);

    const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Clean up associated agent profile if present
    if (user.agentId) {
      try {
        await (prisma as any).agent.delete({ where: { id: user.agentId } });
      } catch (e) {
        console.error('Failed to delete associated agent on user deletion:', e);
      }
    }

    await prisma.user.delete({ where: { id: userId } });
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete User Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.post('/agents', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.headers['x-tenant-id'] as string);
    const { name, email, personalEmail, phoneNumber, gdsSystem, client, pcc, jobStatus } = req.body;
    if (!name) return res.status(400).json({ error: 'Validation failed', message: 'name is required' });

    const agent = await (prisma as any).agent.create({
      data: {
        tenantId,
        name,
        email: email || null,
        personalEmail: personalEmail || null,
        phoneNumber: phoneNumber || null,
        gdsSystem: gdsSystem || null,
        client: client || null,
        pcc: pcc || null,
        jobStatus: jobStatus || 'Active'
      },
      include: { marginSegments: true }
    });

    // Bidirectional sync: Automatically create / link User account with AGENT role
    if (email) {
      try {
        await ensureRolePermissionsSeeded(tenantId);
        let agentRole = await prisma.role.findFirst({
          where: { tenantId, name: 'AGENT' }
        });
        if (!agentRole) {
          agentRole = await prisma.role.create({
            data: { name: 'AGENT', tenantId }
          });
        }

        const existingUser = await prisma.user.findUnique({
          where: { email }
        });

        if (existingUser) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              agentId: agent.id,
              roleId: agentRole.id
            }
          });
        } else {
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash('Agent@123', salt);
          await prisma.user.create({
            data: {
              name,
              email,
              encryptedPassword: hashedPassword,
              tenantId,
              roleId: agentRole.id,
              agentId: agent.id
            }
          });
        }
      } catch (syncError) {
        console.error('Create Agent User Sync Error:', syncError);
      }
    }

    res.status(201).json({ message: 'Agent created successfully', agent });
  } catch (error: any) {
    console.error('Create Agent Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error?.message });
  }
});

// PATCH /agents/:id — update agent profile
app.patch('/agents/:id', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.headers['x-tenant-id'] as string);
    const id = parseInt(req.params.id);
    const { name, email, personalEmail, phoneNumber, gdsSystem, client, pcc, jobStatus, basicSalary } = req.body;

    const existing = await (prisma as any).agent.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Not Found', message: 'Agent not found' });

    const agent = await (prisma as any).agent.update({
      where: { id },
      data: {
        ...(name && { name }),
        email: email !== undefined ? email || null : undefined,
        personalEmail: personalEmail !== undefined ? personalEmail || null : undefined,
        phoneNumber: phoneNumber !== undefined ? phoneNumber || null : undefined,
        gdsSystem: gdsSystem !== undefined ? gdsSystem || null : undefined,
        client: client !== undefined ? client || null : undefined,
        pcc: pcc !== undefined ? pcc || null : undefined,
        ...(jobStatus && { jobStatus }),
        ...(basicSalary !== undefined && { basicSalary: basicSalary === '' || basicSalary === null ? null : parseFloat(basicSalary) }),
      },
      include: { marginSegments: { orderBy: { minAmount: 'asc' } } }
    });

    // Bidirectional sync: Automatically update or create / delete User account
    try {
      await ensureRolePermissionsSeeded(tenantId);
      let agentRole = await prisma.role.findFirst({
        where: { tenantId, name: 'AGENT' }
      });
      if (!agentRole) {
        agentRole = await prisma.role.create({
          data: { name: 'AGENT', tenantId }
        });
      }

      if (agent.email) {
        let assocUser = await prisma.user.findFirst({
          where: { agentId: agent.id }
        });
        if (!assocUser) {
          assocUser = await prisma.user.findUnique({
            where: { email: agent.email }
          });
        }

        if (assocUser) {
          await prisma.user.update({
            where: { id: assocUser.id },
            data: {
              name: agent.name,
              email: agent.email,
              agentId: agent.id,
              roleId: agentRole.id
            }
          });
        } else {
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash('Agent@123', salt);
          await prisma.user.create({
            data: {
              name: agent.name,
              email: agent.email,
              encryptedPassword: hashedPassword,
              tenantId,
              roleId: agentRole.id,
              agentId: agent.id
            }
          });
        }
      } else {
        // If agent email is removed/empty, delete any associated user profile
        await prisma.user.deleteMany({
          where: { agentId: agent.id }
        });
      }
    } catch (syncError) {
      console.error('Update Agent User Sync Error:', syncError);
    }

    res.status(200).json({ message: 'Agent updated successfully', agent });
  } catch (error: any) {
    console.error('Update Agent Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error?.message });
  }
});

// POST /agents/:id/margin-segments — replace all margin segments for an agent
app.post('/agents/:id/margin-segments', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.headers['x-tenant-id'] as string);
    const id = parseInt(req.params.id);
    const { segments } = req.body; // Array of { minAmount, maxAmount, marginPercent, label }

    const existing = await (prisma as any).agent.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Not Found', message: 'Agent not found' });

    if (!Array.isArray(segments)) {
      return res.status(400).json({ error: 'Validation failed', message: 'segments must be an array' });
    }

    // Replace all segments in a transaction
    await (prisma as any).$transaction([
      (prisma as any).agentMarginSegment.deleteMany({ where: { agentId: id } }),
      ...(segments.length > 0 ? [(prisma as any).agentMarginSegment.createMany({
        data: segments.map((s: any) => ({
          agentId: id,
          minAmount: parseFloat(s.minAmount),
          maxAmount: s.maxAmount !== null && s.maxAmount !== undefined ? parseFloat(s.maxAmount) : null,
          marginPercent: parseFloat(s.marginPercent),
          label: s.label || null
        }))
      })] : [])
    ]);

    const agent = await (prisma as any).agent.findFirst({
      where: { id },
      include: { marginSegments: { orderBy: { minAmount: 'asc' } } }
    });
    res.status(200).json({ message: 'Margin segments updated successfully', agent });
  } catch (error: any) {
    console.error('Update Margin Segments Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error?.message });
  }
});

// GET /agents/:id/wallet/debt — Fetch negative balance for offset
app.get('/agents/:id/wallet/debt', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.headers['x-tenant-id'] as string);
    const agentId = parseInt(req.params.id);

    const agent = await (prisma as any).agent.findFirst({ where: { id: agentId, tenantId } });
    if (!agent) return res.status(404).json({ error: 'Not Found', message: 'Agent not found' });

    const wallet = await (prisma as any).agentWallet.findUnique({ where: { agentId } });
    if (!wallet) return res.status(200).json({ debt: 0 });

    const currentBalance = parseFloat(wallet.currentBalance);
    const debt = currentBalance < 0 ? Math.abs(currentBalance) : 0;

    res.status(200).json({ debt });
  } catch (error: any) {
    console.error('Fetch Debt Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error?.message });
  }
});

// POST /agents/:id/wallet/transaction — Log a transaction to the Agent's Wallet
app.post('/agents/:id/wallet/transaction', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.headers['x-tenant-id'] as string);
    const agentId = parseInt(req.params.id);
    const { amount, transactionType, referenceId, notes } = req.body;

    const agent = await (prisma as any).agent.findFirst({ where: { id: agentId, tenantId } });
    if (!agent) return res.status(404).json({ error: 'Not Found', message: 'Agent not found' });

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return res.status(400).json({ error: 'Invalid amount' });

    // Execute in transaction to prevent race conditions
    const result = await (prisma as any).$transaction(async (tx: any) => {
      // Find or create wallet
      let wallet = await tx.agentWallet.findUnique({ where: { agentId } });
      if (!wallet) {
        wallet = await tx.agentWallet.create({ data: { agentId, currentBalance: 0 } });
      }

      // Create transaction log
      const txn = await tx.agentTransaction.create({
        data: {
          agentWalletId: wallet.id,
          amount: numAmount,
          transactionType,
          referenceId: referenceId || null,
          notes: notes || null
        }
      });

      // Update wallet balance
      wallet = await tx.agentWallet.update({
        where: { id: wallet.id },
        data: { currentBalance: { increment: numAmount } }
      });

      return { wallet, txn };
    });

    res.status(201).json({ message: 'Wallet transaction logged', ...result });
  } catch (error: any) {
    console.error('Wallet Transaction Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error?.message });
  }
});

// DELETE /agents/:id — delete agent
app.delete('/agents/:id', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.headers['x-tenant-id'] as string);
    const id = parseInt(req.params.id);
    const existing = await (prisma as any).agent.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Not Found', message: 'Agent not found' });

    // Clean up associated user first to maintain database sync
    await prisma.user.deleteMany({
      where: { agentId: id }
    });

    await (prisma as any).agent.delete({ where: { id } });
    res.status(200).json({ message: 'Agent deleted successfully' });
  } catch (error: any) {
    console.error('Delete Agent Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error?.message });
  }
});

// ==================== VENDOR ROUTES ====================

// GET /vendors — get all vendors for a tenant
app.get('/vendors', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.headers['x-tenant-id'] as string);
    const { page, limit, search } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const isAll = limit === 'all';
    const limitNum = isAll ? undefined : (parseInt(limit as string) || 10);
    const skip = isAll ? undefined : (pageNum - 1) * limitNum!;

    const where: any = { tenantId };
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { contactEmail: { contains: search as string, mode: 'insensitive' } },
        { contactPhone: { contains: search as string, mode: 'insensitive' } },
        { categories: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [total, vendors] = await Promise.all([
      (prisma as any).vendor.count({ where }),
      (prisma as any).vendor.findMany({
        where,
        ...(skip !== undefined && { skip }),
        ...(limitNum !== undefined && { take: limitNum }),
        orderBy: { createdAt: 'desc' }
      })
    ]);
    res.status(200).json({
      vendors,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: limitNum ? Math.ceil(total / limitNum) : 1
    });
  } catch (error: any) {
    console.error('Get Vendors Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error?.message });
  }
});

// GET /vendors/by-name/:name
app.get('/vendors/by-name/:name', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.headers['x-tenant-id'] as string);
    const name = req.params.name;
    const vendor = await (prisma as any).vendor.findFirst({
      where: { tenantId, name }
    });
    if (!vendor) return res.status(404).json({ error: 'Not Found', message: 'Vendor not found' });
    res.status(200).json({ vendor });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error?.message });
  }
});

// POST /vendors — create vendor
app.post('/vendors', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.headers['x-tenant-id'] as string);
    const { name, phoneNumber, email, website, vendorType, creditBalance } = req.body;
    if (!name) return res.status(400).json({ error: 'Validation failed', message: 'name is required' });

    const vendor = await (prisma as any).vendor.create({
      data: {
        tenantId,
        name,
        phoneNumber: phoneNumber || null,
        email: email || null,
        website: website || null,
        vendorType: vendorType || null,
        creditBalance: creditBalance || 0
      }
    });
    res.status(201).json({ message: 'Vendor created successfully', vendor });
  } catch (error: any) {
    console.error('Create Vendor Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error?.message });
  }
});

// PATCH /vendors/:id — update vendor
app.patch('/vendors/:id', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.headers['x-tenant-id'] as string);
    const id = parseInt(req.params.id);
    const { name, phoneNumber, email, website, vendorType, creditBalance } = req.body;

    const existing = await (prisma as any).vendor.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Not Found', message: 'Vendor not found' });

    const vendor = await (prisma as any).vendor.update({
      where: { id },
      data: {
        ...(name && { name }),
        phoneNumber: phoneNumber !== undefined ? phoneNumber || null : undefined,
        email: email !== undefined ? email || null : undefined,
        website: website !== undefined ? website || null : undefined,
        vendorType: vendorType !== undefined ? vendorType || null : undefined,
        creditBalance: creditBalance !== undefined ? creditBalance : undefined
      }
    });
    res.status(200).json({ message: 'Vendor updated successfully', vendor });
  } catch (error: any) {
    console.error('Update Vendor Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error?.message });
  }
});

// DELETE /vendors/:id — delete vendor
app.delete('/vendors/:id', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.headers['x-tenant-id'] as string);
    const id = parseInt(req.params.id);
    const existing = await (prisma as any).vendor.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Not Found', message: 'Vendor not found' });
    await (prisma as any).vendor.delete({ where: { id } });
    res.status(200).json({ message: 'Vendor deleted successfully' });
  } catch (error: any) {
    console.error('Delete Vendor Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error?.message });
  }
});

// Helper to create nodemailer transporter dynamically from DB settings or defaults
async function getSmtpTransporter() {
  const hostSetting = await prisma.systemSetting.findUnique({ where: { key: 'smtp_host' } });
  const portSetting = await prisma.systemSetting.findUnique({ where: { key: 'smtp_port' } });
  const secureSetting = await prisma.systemSetting.findUnique({ where: { key: 'smtp_secure' } });
  const userSetting = await prisma.systemSetting.findUnique({ where: { key: 'smtp_user' } });
  const passSetting = await prisma.systemSetting.findUnique({ where: { key: 'smtp_pass' } });

  const host = hostSetting?.value || 'smtp.gmail.com';
  const port = parseInt(portSetting?.value || '587');
  const secure = secureSetting ? secureSetting.value === 'true' : false;
  const user = userSetting?.value || 'muhammadfaisalchughtai@gmail.com';
  const pass = passSetting?.value || 'ozgx vknu tvbi kmzl';

  console.log(`Creating SMTP transporter: ${host}:${port} (secure: ${secure}) with user ${user}`);

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

interface PdfSlipData {
  companyName: string;
  logoBuffer: Buffer | null;
  agentName: string;
  agentEmail: string;
  periodFromStr: string;
  periodToStr: string;
  gdsSystem: string;
  pcc: string;
  totalWorkdays: number;
  daysPresent: number;
  absents: number;
  paidHolidaysCount: number;
  paidHolidaysRate: number;
  publicHolidaysCount: number;
  publicHolidaysRate: number;
  basicSalaryVal: number;
  marginEarnedVal: number;
  allowances: { description: string; amount: number }[];
  deductions: { description: string; amount: number }[];
  notes?: string;
  issueDateStr: string;
}

async function fetchLogoBuffer(logoUrl: string): Promise<Buffer | null> {
  if (!logoUrl) return null;
  try {
    let targetUrl = logoUrl;
    if (targetUrl.includes('localhost:9010')) {
      targetUrl = targetUrl.replace('localhost:9010', 'minio:9000');
    }
    if (targetUrl.includes('bucket.techbarred.com')) {
      targetUrl = targetUrl.replace('https://bucket.techbarred.com', 'http://minio:9000');
      targetUrl = targetUrl.replace('http://bucket.techbarred.com', 'http://minio:9000');
    }
    const response = await axios.get(targetUrl, { responseType: 'arraybuffer', timeout: 5000 });
    return Buffer.from(response.data);
  } catch (err) {
    console.error('Failed to fetch logo buffer from URL:', logoUrl, err);
    return null;
  }
}

function generateSalarySlipPdf(data: PdfSlipData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers: Buffer[] = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      let headerY = 40;
      if (data.logoBuffer) {
        try {
          doc.image(data.logoBuffer, 40, 40, { height: 40 });
          headerY = 90;
        } catch (e) {
          console.error('PDF Logo rendering error:', e);
        }
      }

      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(16).text(data.companyName.toUpperCase(), 40, headerY);
      doc.fillColor('#64748b').font('Helvetica').fontSize(9).text('Official Salary Slip', 40, headerY + 18);
      
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10).text(`Pay Period: ${data.periodFromStr} - ${data.periodToStr}`, 300, headerY, { align: 'right', width: 255 });
      doc.fillColor('#64748b').font('Helvetica').fontSize(9).text(`Issued: ${data.issueDateStr}`, 300, headerY + 15, { align: 'right', width: 255 });

      let currentY = headerY + 45;

      doc.rect(40, currentY, 515, 6).fill('#1e1b4b');
      currentY += 16;

      doc.rect(40, currentY, 515, 65).lineWidth(1).strokeColor('#e2e8f0').stroke();
      
      doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold').text('EMPLOYEE / AGENT', 55, currentY + 10);
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(data.agentName, 55, currentY + 22);
      doc.fillColor('#475569').fontSize(9).font('Helvetica').text(data.agentEmail, 55, currentY + 36);

      doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold').text('GDS SYSTEM / PCC', 330, currentY + 10);
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(`${data.gdsSystem} / ${data.pcc}`, 330, currentY + 22);
      currentY += 80;

      doc.rect(40, currentY, 515, 45).fill('#f8fafc');
      doc.rect(40, currentY, 515, 45).lineWidth(1).strokeColor('#e2e8f0').stroke();

      doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold').text(String(data.totalWorkdays), 40, currentY + 10, { width: 171, align: 'center' });
      doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold').text('TOTAL WORKDAYS', 40, currentY + 26, { width: 171, align: 'center' });

      doc.fillColor('#16a34a').fontSize(13).font('Helvetica-Bold').text(String(data.daysPresent), 211, currentY + 10, { width: 171, align: 'center' });
      doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold').text('DAYS PRESENT', 211, currentY + 26, { width: 171, align: 'center' });

      doc.fillColor('#dc2626').fontSize(13).font('Helvetica-Bold').text(String(data.absents), 382, currentY + 10, { width: 173, align: 'center' });
      doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold').text('DAYS ABSENT', 382, currentY + 26, { width: 173, align: 'center' });

      currentY += 60;

      doc.rect(40, currentY, 515, 20).fill('#f1f5f9');
      doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold').text('DESCRIPTION', 50, currentY + 6);
      doc.text('EARNINGS', 340, currentY + 6, { width: 100, align: 'right' });
      doc.text('DEDUCTIONS', 440, currentY + 6, { width: 100, align: 'right' });
      currentY += 20;

      const drawRow = (desc: string, earn: string, ded: string, isBold: boolean = false) => {
        doc.lineWidth(0.5).strokeColor('#e2e8f0').moveTo(40, currentY).lineTo(555, currentY).stroke();
        
        doc.fillColor('#0f172a').fontSize(9).font(isBold ? 'Helvetica-Bold' : 'Helvetica').text(desc, 50, currentY + 6);
        if (earn) {
          doc.fillColor(earn.startsWith('+') ? '#16a34a' : '#0f172a').font('Helvetica-Bold').text(earn, 340, currentY + 6, { width: 100, align: 'right' });
        } else {
          doc.fillColor('#cbd5e1').text('—', 340, currentY + 6, { width: 100, align: 'right' });
        }
        
        if (ded) {
          doc.fillColor('#dc2626').font('Helvetica-Bold').text(ded, 440, currentY + 6, { width: 100, align: 'right' });
        } else {
          doc.fillColor('#cbd5e1').text('—', 440, currentY + 6, { width: 100, align: 'right' });
        }
        currentY += 22;
      };

      const dailyRate = data.totalWorkdays > 0 ? (data.basicSalaryVal / data.totalWorkdays) : 0;
      const absentDeduction = dailyRate * data.absents;
      const totalAllowancesVal = data.allowances.reduce((sum, a) => sum + Number(a.amount), 0);
      const holidayPay = (data.paidHolidaysCount * data.paidHolidaysRate) + (data.publicHolidaysCount * data.publicHolidaysRate);
      const grossEarnings = data.basicSalaryVal + data.marginEarnedVal + totalAllowancesVal + holidayPay;
      const totalDeductions = absentDeduction + data.deductions.reduce((sum, d) => sum + Number(d.amount), 0);
      const finalNetPay = Math.max(0, grossEarnings - totalDeductions);

      drawRow('Basic Contract Salary (Monthly contract)', `£${data.basicSalaryVal.toFixed(2)}`, '');
      drawRow('Booking Commission / Margin Share', `+£${data.marginEarnedVal.toFixed(2)}`, '');

      data.allowances.forEach(a => {
        drawRow(a.description, `+£${Number(a.amount).toFixed(2)}`, '');
      });

      if (data.paidHolidaysCount > 0) {
        drawRow(`Paid Holidays (${data.paidHolidaysCount} days @ £${data.paidHolidaysRate.toFixed(2)}/day)`, `+£${(data.paidHolidaysCount * data.paidHolidaysRate).toFixed(2)}`, '');
      }

      if (data.publicHolidaysCount > 0) {
        drawRow(`Public Holidays (${data.publicHolidaysCount} days @ £${data.publicHolidaysRate.toFixed(2)}/day)`, `+£${(data.publicHolidaysCount * data.publicHolidaysRate).toFixed(2)}`, '');
      }

      if (data.absents > 0 && dailyRate > 0) {
        drawRow(`Absenteeism Penalty (${data.absents} days absent @ £${dailyRate.toFixed(2)}/day)`, '', `-£${absentDeduction.toFixed(2)}`);
      }

      data.deductions.forEach(d => {
        drawRow(d.description, '', `-£${Number(d.amount).toFixed(2)}`);
      });

      doc.lineWidth(1).strokeColor('#cbd5e1').moveTo(40, currentY).lineTo(555, currentY).stroke();
      doc.rect(40, currentY, 515, 20).fill('#f8fafc');
      doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold').text('SUBTOTALS', 50, currentY + 6);
      doc.fillColor('#0f172a').text(`£${grossEarnings.toFixed(2)}`, 340, currentY + 6, { width: 100, align: 'right' });
      doc.fillColor('#dc2626').text(`£${totalDeductions.toFixed(2)}`, 440, currentY + 6, { width: 100, align: 'right' });
      currentY += 20;

      doc.rect(40, currentY, 515, 28).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text('TOTAL NET PAYABLE (NET SALARY)', 50, currentY + 9);
      doc.fillColor('#38bdf8').fontSize(12).font('Helvetica-Bold').text(`£${finalNetPay.toFixed(2)}`, 340, currentY + 8, { width: 200, align: 'right' });
      currentY += 28;

      if (data.notes) {
        currentY += 15;
        doc.rect(40, currentY, 515, 45).fill('#fef3c7');
        doc.rect(40, currentY, 515, 45).lineWidth(1).strokeColor('#fde68a').stroke();
        doc.fillColor('#b45309').fontSize(8).font('Helvetica-Bold').text('NOTES & REMARKS', 50, currentY + 6);
        doc.fillColor('#78350f').fontSize(8).font('Helvetica').text(data.notes, 50, currentY + 18, { width: 495 });
        currentY += 45;
      }

      currentY += 30;
      doc.lineWidth(0.5).strokeColor('#e2e8f0').moveTo(40, currentY).lineTo(555, currentY).stroke();
      doc.fillColor('#64748b').fontSize(8).font('Helvetica').text(`This is a secure official statement generated by your employer (${data.companyName}).`, 40, currentY + 10, { align: 'center', width: 515 });
      doc.text('If you have any inquiries regarding this document, please contact the finance team.', 40, currentY + 20, { align: 'center', width: 515 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Helper to create tenant-specific SMTP transporter (falls back to system-wide)
async function getTenantSmtpTransporter(tenantId: number): Promise<{ transporter: any; fromEmail: string; fromName: string; tenant: any }> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

  // Use tenant SMTP if configured
  if (tenant?.smtpHost && tenant?.smtpUser && tenant?.smtpPass) {
    const transporter = nodemailer.createTransport({
      host: tenant.smtpHost,
      port: tenant.smtpPort || 587,
      secure: tenant.smtpSecure || false,
      auth: { user: tenant.smtpUser, pass: tenant.smtpPass },
      tls: { rejectUnauthorized: false }
    });
    return { transporter, fromEmail: tenant.smtpUser, fromName: tenant.name, tenant };
  }

  // Fall back to system-wide SMTP
  const transporter = await getSmtpTransporter();
  const userSetting = await prisma.systemSetting.findUnique({ where: { key: 'smtp_user' } });
  const fromEmail = userSetting?.value || 'muhammadfaisalchughtai@gmail.com';
  return { transporter, fromEmail, fromName: tenant?.name || 'Travel Agency', tenant };
}

// POST /tenants/send-email — Internal endpoint (called by booking-service) to send branded email
app.post('/tenants/send-email', async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(req.headers['x-tenant-id'] as string);
    if (!tenantId) return res.status(400).json({ error: 'Missing x-tenant-id header' });

    const { to, subject, html } = req.body;
    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
    }

    const { transporter, fromEmail, fromName, tenant } = await getTenantSmtpTransporter(tenantId);

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
    });

    console.log(`[Tenant ${tenantId}] Email sent to ${to} via ${fromEmail}`);
    return res.status(200).json({ message: 'Email dispatched successfully' });
  } catch (err: any) {
    console.error('Tenant send-email error:', err);
    return res.status(500).json({ error: 'Failed to send email', message: err.message });
  }
});

// POST /request-demo — Public endpoint to submit a demo request

app.post('/request-demo', async (req: Request, res: Response) => {
  try {
    const { fullName, email, companyName, phoneNumber, agencySize, gdsSystems, message } = req.body;

    if (!fullName || !email || !companyName) {
      return res.status(400).json({ error: 'Validation failed', message: 'Full Name, Work Email, and Company Name are required.' });
    }

    // 1. Save demo request to database
    const demoReq = await prisma.demoRequest.create({
      data: {
        fullName,
        email,
        companyName,
        phoneNumber: phoneNumber || null,
        agencySize: agencySize || null,
        gdsSystems: gdsSystems || null,
        message: message || null,
      }
    });

    // 2. Fetch transporter
    const transporter = await getSmtpTransporter();

    // Get current configured user for sending
    const userSetting = await prisma.systemSetting.findUnique({ where: { key: 'smtp_user' } });
    const smtpUser = userSetting?.value || 'muhammadfaisalchughtai@gmail.com';

    // 3. Email to admin
    const adminEmail = smtpUser; // Receive admin emails at configured user
    const adminMailOptions = {
      from: `"TravelBooker Platform" <${smtpUser}>`,
      to: adminEmail,
      subject: `New Demo Request: ${companyName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top: 0;">New Demo Request</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; width: 35%; color: #475569;">Company Name:</td>
              <td style="padding: 8px 0; color: #1e293b;">${companyName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #475569;">Full Name:</td>
              <td style="padding: 8px 0; color: #1e293b;">${fullName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #475569;">Work Email:</td>
              <td style="padding: 8px 0; color: #1e293b;"><a href="mailto:${email}">${email}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #475569;">Phone Number:</td>
              <td style="padding: 8px 0; color: #1e293b;">${phoneNumber || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #475569;">Agency Size:</td>
              <td style="padding: 8px 0; color: #1e293b;">${agencySize || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #475569;">GDS / Systems:</td>
              <td style="padding: 8px 0; color: #1e293b;">${gdsSystems || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #475569; vertical-align: top;">Message/Notes:</td>
              <td style="padding: 8px 0; color: #1e293b; white-space: pre-line;">${message || 'N/A'}</td>
            </tr>
          </table>
          <div style="margin-top: 25px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px;">
            Received at ${new Date().toLocaleString()} • TravelBooker Platform Command Center
          </div>
        </div>
      `
    };

    // 4. Email to user requesting
    const userMailOptions = {
      from: `"TravelBooker Support" <${smtpUser}>`,
      to: email,
      subject: `Demo Request Received - TravelBooker`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #fafafa;">
          <div style="background-color: #0b0f19; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">Travel<span style="color: #3b82f6;">Booker</span></h1>
          </div>
          <div style="background-color: #ffffff; padding: 25px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
            <p style="font-size: 16px; color: #1e293b; font-weight: 600; margin-top: 0;">Dear ${fullName},</p>
            <p style="font-size: 15px; color: #475569; line-height: 1.6;">
              Thank you for requesting a demo of <strong>TravelBooker</strong>. We are thrilled to show you how our B2B travel operating system can transform your agency operations.
            </p>
            <p style="font-size: 15px; color: #475569; line-height: 1.6;">
              A member of our team will contact you shortly at <strong>${email}</strong> (or <strong>${phoneNumber || 'your phone number'}</strong>) to schedule a personalized walkthrough.
            </p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #f1f5f9;">
              <h4 style="margin: 0 0 10px 0; color: #0f172a; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Details You Submitted:</h4>
              <p style="margin: 3px 0; font-size: 13px; color: #475569;"><strong>Company:</strong> ${companyName}</p>
              <p style="margin: 3px 0; font-size: 13px; color: #475569;"><strong>Size:</strong> ${agencySize || 'Not specified'}</p>
              <p style="margin: 3px 0; font-size: 13px; color: #475569;"><strong>GDS:</strong> ${gdsSystems || 'Not specified'}</p>
            </div>
            
            <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin-top: 20px;">
              Best regards,<br/>
              <strong>TravelBooker Sales Team</strong>
            </p>
          </div>
          <div style="margin-top: 20px; font-size: 11px; color: #94a3b8; text-align: center;">
            This email was sent to ${email} regarding your request for a demo of the B2B Travel OS.
          </div>
        </div>
      `
    };

    // Send emails in background, but log failures
    transporter.sendMail(adminMailOptions).catch((err: any) => {
      console.error('Failed to send admin notification email:', err);
    });
    transporter.sendMail(userMailOptions).catch((err: any) => {
      console.error('Failed to send user confirmation email:', err);
    });

    res.status(201).json({ message: 'Demo request submitted successfully', demoRequest: demoReq });
  } catch (error: any) {
    console.error('Request Demo Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error?.message });
  }
});

// GET /system-settings/smtp — Fetch current SMTP settings (Platform Admin only)
app.get('/system-settings/smtp', requirePlatformAdmin, async (req: any, res: Response) => {
  try {
    const host = await prisma.systemSetting.findUnique({ where: { key: 'smtp_host' } });
    const port = await prisma.systemSetting.findUnique({ where: { key: 'smtp_port' } });
    const secure = await prisma.systemSetting.findUnique({ where: { key: 'smtp_secure' } });
    const user = await prisma.systemSetting.findUnique({ where: { key: 'smtp_user' } });
    const pass = await prisma.systemSetting.findUnique({ where: { key: 'smtp_pass' } });

    res.status(200).json({
      settings: {
        host: host?.value || 'smtp.gmail.com',
        port: port?.value || '587',
        secure: secure ? secure.value === 'true' : false,
        user: user?.value || 'muhammadfaisalchughtai@gmail.com',
        pass: pass?.value || 'ozgx vknu tvbi kmzl'
      }
    });
  } catch (error) {
    console.error('Fetch SMTP Settings Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /system-settings/smtp — Save SMTP settings (Platform Admin only)
app.post('/system-settings/smtp', requirePlatformAdmin, async (req: any, res: Response) => {
  try {
    const { host, port, secure, user, pass } = req.body;

    if (!host || !port || !user || !pass) {
      return res.status(400).json({ error: 'Validation failed', message: 'Host, port, user, and password are required.' });
    }

    await prisma.$transaction([
      prisma.systemSetting.upsert({
        where: { key: 'smtp_host' },
        update: { value: host },
        create: { key: 'smtp_host', value: host }
      }),
      prisma.systemSetting.upsert({
        where: { key: 'smtp_port' },
        update: { value: String(port) },
        create: { key: 'smtp_port', value: String(port) }
      }),
      prisma.systemSetting.upsert({
        where: { key: 'smtp_secure' },
        update: { value: String(secure) },
        create: { key: 'smtp_secure', value: String(secure) }
      }),
      prisma.systemSetting.upsert({
        where: { key: 'smtp_user' },
        update: { value: user },
        create: { key: 'smtp_user', value: user }
      }),
      prisma.systemSetting.upsert({
        where: { key: 'smtp_pass' },
        update: { value: pass },
        create: { key: 'smtp_pass', value: pass }
      }),
    ]);

    res.status(200).json({ message: 'SMTP Settings updated successfully' });
  } catch (error) {
    console.error('Update SMTP Settings Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /demo-requests — Fetch all submitted demo requests (Platform Admin only)
app.get('/demo-requests', requirePlatformAdmin, async (req: any, res: Response) => {
  try {
    const requests = await prisma.demoRequest.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ requests });
  } catch (error) {
    console.error('Fetch Demo Requests Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /demo-requests/:id — Update status of a demo request (Platform Admin only)
app.patch('/demo-requests/:id', requirePlatformAdmin, async (req: any, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const request = await prisma.demoRequest.update({
      where: { id },
      data: { status }
    });
    res.status(200).json({ message: 'Demo request updated successfully', request });
  } catch (error) {
    console.error('Update Demo Request Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─── ROLE & PERMISSION MATRIX CONFIGURATION ───────────────────────────────────

const SYSTEM_PERMISSIONS = [
  { name: 'CREATE_BOOKING', module: 'Bookings & Itineraries' },
  { name: 'READ_BOOKING', module: 'Bookings & Itineraries' },
  { name: 'UPDATE_BOOKING', module: 'Bookings & Itineraries' },
  { name: 'DELETE_BOOKING', module: 'Bookings & Itineraries' },

  { name: 'CREATE_CLIENT', module: 'Client Records' },
  { name: 'READ_CLIENT', module: 'Client Records' },
  { name: 'UPDATE_CLIENT', module: 'Client Records' },
  { name: 'DELETE_CLIENT', module: 'Client Records' },

  { name: 'CREATE_VENDOR', module: 'Vendor Records' },
  { name: 'READ_VENDOR', module: 'Vendor Records' },
  { name: 'UPDATE_VENDOR', module: 'Vendor Records' },
  { name: 'DELETE_VENDOR', module: 'Vendor Records' },

  { name: 'CREATE_AGENT', module: 'Agent Registry' },
  { name: 'READ_AGENT', module: 'Agent Registry' },
  { name: 'UPDATE_AGENT', module: 'Agent Registry' },
  { name: 'DELETE_AGENT', module: 'Agent Registry' },

  { name: 'CREATE_SERVICE', module: 'Service Catalog' },
  { name: 'READ_SERVICE', module: 'Service Catalog' },
  { name: 'UPDATE_SERVICE', module: 'Service Catalog' },
  { name: 'DELETE_SERVICE', module: 'Service Catalog' },

  { name: 'READ_DASHBOARD', module: 'Agency Dashboard' },

  { name: 'CREATE_USER', module: 'Team Management' },
  { name: 'READ_USER', module: 'Team Management' },
  { name: 'UPDATE_USER', module: 'Team Management' },
  { name: 'DELETE_USER', module: 'Team Management' },

  { name: 'CREATE_TRANSACTION', module: 'Financials (Refunds/Profit)' },
  { name: 'READ_TRANSACTION', module: 'Financials (Refunds/Profit)' },
  { name: 'UPDATE_TRANSACTION', module: 'Financials (Refunds/Profit)' },
  { name: 'DELETE_TRANSACTION', module: 'Financials (Refunds/Profit)' },

  { name: 'MANAGE_SETTINGS', module: 'System Settings' },

  // Attendance permissions
  { name: 'CREATE_ATTENDANCE', module: 'Attendance' },
  { name: 'READ_ATTENDANCE', module: 'Attendance' },
  { name: 'UPDATE_ATTENDANCE', module: 'Attendance' },
  { name: 'DELETE_ATTENDANCE', module: 'Attendance' },

  // Payroll permissions
  { name: 'CREATE_PAYROLL', module: 'Payroll' },
  { name: 'READ_PAYROLL', module: 'Payroll' },
  { name: 'UPDATE_PAYROLL', module: 'Payroll' },
  { name: 'DELETE_PAYROLL', module: 'Payroll' },

  // Document Studio permissions
  { name: 'CREATE_TEMPLATE', module: 'Document Studio' },
  { name: 'READ_TEMPLATE', module: 'Document Studio' },
  { name: 'UPDATE_TEMPLATE', module: 'Document Studio' },
  { name: 'DELETE_TEMPLATE', module: 'Document Studio' }
];

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  AGENT: [
    'CREATE_BOOKING', 'READ_BOOKING', 'UPDATE_BOOKING',
    'CREATE_CLIENT', 'READ_CLIENT', 'UPDATE_CLIENT',
    'READ_VENDOR', 'READ_AGENT', 'READ_SERVICE', 'READ_TRANSACTION', 'READ_DASHBOARD',
    'CREATE_ATTENDANCE', 'READ_ATTENDANCE',
    'READ_PAYROLL'
  ],
  COMPANY_ADMIN: [
    'CREATE_BOOKING', 'READ_BOOKING', 'UPDATE_BOOKING', 'DELETE_BOOKING',
    'CREATE_CLIENT', 'READ_CLIENT', 'UPDATE_CLIENT', 'DELETE_CLIENT',
    'CREATE_VENDOR', 'READ_VENDOR', 'UPDATE_VENDOR', 'DELETE_VENDOR',
    'CREATE_AGENT', 'READ_AGENT', 'UPDATE_AGENT', 'DELETE_AGENT',
    'CREATE_SERVICE', 'READ_SERVICE', 'UPDATE_SERVICE', 'DELETE_SERVICE',
    'READ_DASHBOARD',
    'CREATE_USER', 'READ_USER', 'UPDATE_USER', 'DELETE_USER',
    'CREATE_TRANSACTION', 'READ_TRANSACTION', 'UPDATE_TRANSACTION', 'DELETE_TRANSACTION',
    'CREATE_ATTENDANCE', 'READ_ATTENDANCE', 'UPDATE_ATTENDANCE', 'DELETE_ATTENDANCE',
    'CREATE_PAYROLL', 'READ_PAYROLL', 'UPDATE_PAYROLL', 'DELETE_PAYROLL',
    'CREATE_TEMPLATE', 'READ_TEMPLATE', 'UPDATE_TEMPLATE', 'DELETE_TEMPLATE'
  ],
  MAIN_COMPANY_ADMIN: [
    'CREATE_BOOKING', 'READ_BOOKING', 'UPDATE_BOOKING', 'DELETE_BOOKING',
    'CREATE_CLIENT', 'READ_CLIENT', 'UPDATE_CLIENT', 'DELETE_CLIENT',
    'CREATE_VENDOR', 'READ_VENDOR', 'UPDATE_VENDOR', 'DELETE_VENDOR',
    'CREATE_AGENT', 'READ_AGENT', 'UPDATE_AGENT', 'DELETE_AGENT',
    'CREATE_SERVICE', 'READ_SERVICE', 'UPDATE_SERVICE', 'DELETE_SERVICE',
    'READ_DASHBOARD',
    'CREATE_USER', 'READ_USER', 'UPDATE_USER', 'DELETE_USER',
    'CREATE_TRANSACTION', 'READ_TRANSACTION', 'UPDATE_TRANSACTION', 'DELETE_TRANSACTION',
    'MANAGE_SETTINGS',
    'CREATE_ATTENDANCE', 'READ_ATTENDANCE', 'UPDATE_ATTENDANCE', 'DELETE_ATTENDANCE',
    'CREATE_PAYROLL', 'READ_PAYROLL', 'UPDATE_PAYROLL', 'DELETE_PAYROLL',
    'CREATE_TEMPLATE', 'READ_TEMPLATE', 'UPDATE_TEMPLATE', 'DELETE_TEMPLATE'
  ]
};

async function initPermissions() {
  try {
    for (const p of SYSTEM_PERMISSIONS) {
      const existing = await prisma.permission.findFirst({
        where: { name: p.name }
      });
      if (!existing) {
        await prisma.permission.create({
          data: { name: p.name, module: p.module }
        });
      } else if (existing.module !== p.module) {
        await prisma.permission.update({
          where: { id: existing.id },
          data: { module: p.module }
        });
      }
    }
    console.log('System permissions initialized successfully');
  } catch (error) {
    console.error('Failed to initialize system permissions:', error);
  }
}

async function seedDefaultRolePermissions(roleId: number, roleName: string) {
  try {
    const permissionNames = DEFAULT_ROLE_PERMISSIONS[roleName] || [];
    if (permissionNames.length === 0) return;

    const dbPermissions = await prisma.permission.findMany({
      where: { name: { in: permissionNames } }
    });

    for (const perm of dbPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId: perm.id
          }
        },
        create: {
          roleId,
          permissionId: perm.id
        },
        update: {}
      });
    }
  } catch (error) {
    console.error(`Error seeding default permissions for role ${roleName}:`, error);
  }
}

async function ensureRolePermissionsSeeded(tenantId: number) {
  const roles = ['AGENT', 'COMPANY_ADMIN', 'MAIN_COMPANY_ADMIN'];
  for (const name of roles) {
    let role = await prisma.role.findFirst({
      where: { tenantId, name }
    });
    if (!role) {
      role = await prisma.role.create({
        data: { name, tenantId }
      });
      await seedDefaultRolePermissions(role.id, name);
    }
  }
}

function getAccessLevel(module: string, permissions: string[]): string {
  if (module === 'Agency Dashboard') {
    return permissions.includes('READ_DASHBOARD') ? 'Full Access' : 'No Access';
  }
  if (module === 'System Settings') {
    return permissions.includes('MANAGE_SETTINGS') ? 'Full Access' : 'No Access';
  }
  
  let prefix = '';
  if (module === 'Bookings & Itineraries') prefix = 'BOOKING';
  else if (module === 'Client Records') prefix = 'CLIENT';
  else if (module === 'Vendor Records') prefix = 'VENDOR';
  else if (module === 'Team Management') prefix = 'USER';
  else if (module === 'Financials (Refunds/Profit)') prefix = 'TRANSACTION';
  
  const hasCreate = permissions.includes(`CREATE_${prefix}`);
  const hasRead = permissions.includes(`READ_${prefix}`);
  const hasUpdate = permissions.includes(`UPDATE_${prefix}`);
  const hasDelete = permissions.includes(`DELETE_${prefix}`);
  
  if (hasCreate && hasRead && hasUpdate && hasDelete) return 'Create, Read, Update, Delete';
  if (hasCreate && hasRead && hasUpdate) return 'Create, Read, Update';
  if (hasRead) return 'Read Only';
  return 'No Access';
}

function getPermissionsForAccessLevel(module: string, accessLevel: string): string[] {
  if (module === 'Agency Dashboard') {
    return accessLevel !== 'No Access' ? ['READ_DASHBOARD'] : [];
  }
  if (module === 'System Settings') {
    return accessLevel !== 'No Access' ? ['MANAGE_SETTINGS'] : [];
  }
  
  let prefix = '';
  if (module === 'Bookings & Itineraries') prefix = 'BOOKING';
  else if (module === 'Client Records') prefix = 'CLIENT';
  else if (module === 'Vendor Records') prefix = 'VENDOR';
  else if (module === 'Team Management') prefix = 'USER';
  else if (module === 'Financials (Refunds/Profit)') prefix = 'TRANSACTION';
  
  if (accessLevel === 'Create, Read, Update, Delete') {
    return [`CREATE_${prefix}`, `READ_${prefix}`, `UPDATE_${prefix}`, `DELETE_${prefix}`];
  }
  if (accessLevel === 'Create, Read, Update') {
    return [`CREATE_${prefix}`, `READ_${prefix}`, `UPDATE_${prefix}`];
  }
  if (accessLevel === 'Read Only') {
    return [`READ_${prefix}`];
  }
  return []; // No Access
}

const getPermissionLabel = (name: string): string => {
  const mapping: Record<string, string> = {
    CREATE_BOOKING: 'Create bookings and itineraries',
    READ_BOOKING: 'View bookings and itineraries',
    UPDATE_BOOKING: 'Edit bookings and itineraries',
    DELETE_BOOKING: 'Delete bookings and itineraries',
    CREATE_CLIENT: 'Create client records',
    READ_CLIENT: 'View client records',
    UPDATE_CLIENT: 'Edit client records',
    DELETE_CLIENT: 'Delete client records',
    CREATE_VENDOR: 'Create vendor records',
    READ_VENDOR: 'View vendor records',
    UPDATE_VENDOR: 'Edit vendor records',
    DELETE_VENDOR: 'Delete vendor records',
    CREATE_AGENT: 'Add agents to registry',
    READ_AGENT: 'View agent records & attendance',
    UPDATE_AGENT: 'Edit agent registry records',
    DELETE_AGENT: 'Delete agent records',
    CREATE_SERVICE: 'Add services to catalog',
    READ_SERVICE: 'View service catalog',
    UPDATE_SERVICE: 'Edit service catalog items',
    DELETE_SERVICE: 'Delete service catalog items',
    READ_DASHBOARD: 'Access agency dashboard',
    CREATE_USER: 'Add company team members',
    READ_USER: 'View team members & roles',
    UPDATE_USER: 'Edit team members & roles',
    DELETE_USER: 'Delete team members',
    CREATE_TRANSACTION: 'Log payments & cost transactions',
    READ_TRANSACTION: 'View profit ledger & transactions',
    UPDATE_TRANSACTION: 'Edit ledger transaction records',
    DELETE_TRANSACTION: 'Delete ledger transactions',
    MANAGE_SETTINGS: 'Edit system configurations & settings',
    CREATE_ATTENDANCE: 'Log attendance (Clock In/Out)',
    READ_ATTENDANCE: 'View attendance records',
    UPDATE_ATTENDANCE: 'Edit attendance records',
    DELETE_ATTENDANCE: 'Delete attendance records',
    CREATE_PAYROLL: 'Generate salary slips',
    READ_PAYROLL: 'View payroll & salary slips',
    UPDATE_PAYROLL: 'Edit payroll & salary slips',
    DELETE_PAYROLL: 'Delete payroll records',
    CREATE_TEMPLATE: 'Create invoice & voucher templates',
    READ_TEMPLATE: 'View document templates',
    UPDATE_TEMPLATE: 'Edit document templates',
    DELETE_TEMPLATE: 'Delete document templates'
  };
  return mapping[name] || name.toLowerCase().replace(/_/g, ' ');
};

// ─── ENDPOINTS ───────────────────────────────────────────────────────────────

app.get('/roles/permissions/matrix', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.tenantId!);
    await ensureRolePermissionsSeeded(tenantId);
    
    const roles = await prisma.role.findMany({
      where: { tenantId },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });
    
    const rolePermissionsMap: Record<string, string[]> = {};
    for (const role of roles) {
      rolePermissionsMap[role.name] = role.permissions.map((p: any) => p.permission.name);
    }
    
    const allPermissions = await prisma.permission.findMany({
      orderBy: [
        { module: 'asc' },
        { name: 'asc' }
      ]
    });
    
    const moduleMap: Record<string, { name: string; label: string }[]> = {};
    for (const p of allPermissions) {
      if (!moduleMap[p.module]) {
        moduleMap[p.module] = [];
      }
      moduleMap[p.module].push({
        name: p.name,
        label: getPermissionLabel(p.name)
      });
    }
    
    const matrix = Object.entries(moduleMap).map(([moduleName, perms]) => ({
      module: moduleName,
      permissions: perms
    }));
    
    res.status(200).json({ matrix, permissions: rolePermissionsMap });
  } catch (error) {
    console.error('Fetch Permissions Matrix Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/roles/permissions/matrix', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.tenantId!);
    const { permissions } = req.body;
    
    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ error: 'Invalid payload: permissions map required' });
    }
    
    await ensureRolePermissionsSeeded(tenantId);
    
    const roles = await prisma.role.findMany({
      where: { tenantId }
    });
    
    const roleMap = roles.reduce((acc: any, r: any) => {
      acc[r.name] = r.id;
      return acc;
    }, {} as Record<string, number>);
    
    const allPermissions = await prisma.permission.findMany();
    const permMap = allPermissions.reduce((acc: any, p: any) => {
      acc[p.name] = p.id;
      return acc;
    }, {} as Record<string, number>);
    
    // Lock MAIN_COMPANY_ADMIN permissions - only update AGENT and COMPANY_ADMIN
    for (const roleName of ['AGENT', 'COMPANY_ADMIN']) {
      const roleId = roleMap[roleName];
      if (!roleId) continue;
      
      const targetPermissionsList = permissions[roleName];
      if (!Array.isArray(targetPermissionsList)) continue;
      
      await prisma.rolePermission.deleteMany({
        where: { roleId }
      });
      
      const createData = targetPermissionsList
        .map((pName: string) => permMap[pName])
        .filter(pId => pId !== undefined)
        .map(pId => ({
          roleId,
          permissionId: pId
        }));
        
      if (createData.length > 0) {
        await prisma.rolePermission.createMany({
          data: createData
        });
      }
    }
    
    res.status(200).json({ message: 'Permissions matrix updated successfully' });
  } catch (error) {
    console.error('Update Permissions Matrix Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/roles/permissions/check', async (req: any, res: Response) => {
  try {
    const roleName = req.query.role as string;
    const tenantId = parseInt(req.query.tenantId as string);
    const permissionName = req.query.permission as string;
    
    if (!roleName || isNaN(tenantId) || !permissionName) {
      return res.status(400).json({ error: 'Missing required query parameters' });
    }

    const userRole = req.headers['x-user-role'] || req.headers['X-User-Role'];
    const userId = req.headers['x-user-id'] || req.headers['X-User-Id'];
    if (userRole === 'AGENT') {
      if (!userId) {
        return res.status(200).json({ allowed: false, message: 'Missing user context' });
      }
      const user = await prisma.user.findUnique({
        where: { id: parseInt(userId as string) }
      });
      if (!user || user.tenantId !== tenantId) {
        return res.status(200).json({ allowed: false, message: 'Tenant context mismatch' });
      }
    }
    
    const isPlatformAdmin = req.headers['x-is-platform-admin'] === 'true';
    if (isPlatformAdmin || roleName === 'SUPER_ADMIN') {
      return res.status(200).json({ allowed: true });
    }
    
    const role = await prisma.role.findFirst({
      where: { tenantId, name: roleName }
    });
    
    if (!role) {
      return res.status(200).json({ allowed: false, message: 'Role not found' });
    }
    
    const permission = await prisma.permission.findFirst({
      where: { name: permissionName }
    });
    
    if (!permission) {
      return res.status(200).json({ allowed: false, message: 'Permission not found' });
    }
    
    const hasPermission = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id
        }
      }
    });
    
    res.status(200).json({ allowed: !!hasPermission });
  } catch (error) {
    console.error('Check Permission Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/my-permissions', requireTenantContext, async (req: any, res: Response) => {
  try {
    const userId = parseInt(req.headers['x-user-id'] as string);
    if (isNaN(userId)) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User context required' });
    }
    
    const isPlatformAdmin = req.headers['x-is-platform-admin'] === 'true';
    if (isPlatformAdmin) {
      const allPerms = await prisma.permission.findMany();
      return res.status(200).json({ permissions: allPerms.map((p: any) => p.name) });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const permissions = user.role?.permissions.map((p: any) => p.permission.name) || [];
    res.status(200).json({ permissions });
  } catch (error) {
    console.error('Fetch My Permissions Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});





app.listen(PORT, async () => {
  await initPermissions();
  console.log(`Auth Service is running on port ${PORT}`);
});

