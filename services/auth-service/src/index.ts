import express, { Request, Response } from 'express';
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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';
const prisma = new PrismaClient();

app.use(helmet());
app.use(cors());
app.use(express.json());

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
      user: { id: user.id, email: user.email, name: user.name, tenantId: user.tenantId, role: userRole, permissions } 
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

      // 2. Create the ADMIN role for this tenant
      const adminRole = await tx.role.create({
        data: {
          name: 'ADMIN',
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
    const { name, email, phoneNumber, gdsSystem, client, pcc, jobStatus } = req.body;
    if (!name) return res.status(400).json({ error: 'Validation failed', message: 'name is required' });

    const agent = await (prisma as any).agent.create({
      data: {
        tenantId,
        name,
        email: email || null,
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
    const { name, email, phoneNumber, gdsSystem, client, pcc, jobStatus } = req.body;

    const existing = await (prisma as any).agent.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Not Found', message: 'Agent not found' });

    const agent = await (prisma as any).agent.update({
      where: { id },
      data: {
        ...(name && { name }),
        email: email !== undefined ? email || null : undefined,
        phoneNumber: phoneNumber !== undefined ? phoneNumber || null : undefined,
        gdsSystem: gdsSystem !== undefined ? gdsSystem || null : undefined,
        client: client !== undefined ? client || null : undefined,
        pcc: pcc !== undefined ? pcc || null : undefined,
        ...(jobStatus && { jobStatus })
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

  { name: 'MANAGE_SETTINGS', module: 'System Settings' }
];

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  AGENT: [
    'CREATE_BOOKING', 'READ_BOOKING', 'UPDATE_BOOKING',
    'CREATE_CLIENT', 'READ_CLIENT', 'UPDATE_CLIENT',
    'READ_VENDOR', 'READ_AGENT', 'READ_SERVICE', 'READ_TRANSACTION', 'READ_DASHBOARD'
  ],
  COMPANY_ADMIN: [
    'CREATE_BOOKING', 'READ_BOOKING', 'UPDATE_BOOKING', 'DELETE_BOOKING',
    'CREATE_CLIENT', 'READ_CLIENT', 'UPDATE_CLIENT', 'DELETE_CLIENT',
    'CREATE_VENDOR', 'READ_VENDOR', 'UPDATE_VENDOR', 'DELETE_VENDOR',
    'CREATE_AGENT', 'READ_AGENT', 'UPDATE_AGENT', 'DELETE_AGENT',
    'CREATE_SERVICE', 'READ_SERVICE', 'UPDATE_SERVICE', 'DELETE_SERVICE',
    'READ_DASHBOARD',
    'CREATE_USER', 'READ_USER', 'UPDATE_USER', 'DELETE_USER',
    'CREATE_TRANSACTION', 'READ_TRANSACTION', 'UPDATE_TRANSACTION', 'DELETE_TRANSACTION'
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
    'MANAGE_SETTINGS'
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
    }
    
    await seedDefaultRolePermissions(role.id, name);
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
  if (name.startsWith('CREATE_')) return 'Create';
  if (name.startsWith('READ_')) {
    if (name === 'READ_DASHBOARD') return 'Access';
    return 'Read';
  }
  if (name.startsWith('UPDATE_')) return 'Update';
  if (name.startsWith('DELETE_')) return 'Delete';
  if (name.startsWith('MANAGE_')) return 'Manage';
  return name;
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

