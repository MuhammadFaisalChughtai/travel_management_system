import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import * as Minio from 'minio';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';

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
  fileFilter: (req, file, cb) => {
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

    const externalUrl = process.env.MINIO_EXTERNAL_URL || 'http://localhost:9000';
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

    const newUser = await prisma.user.create({
      data: {
        email: parsedData.email,
        name: parsedData.name,
        encryptedPassword: hashedPassword,
        tenantId: tenant.id,
        roleId: role.id
      }
    });

    res.status(201).json({ 
      message: 'User registered successfully', 
      user: { id: newUser.id, email: newUser.email, name: newUser.name, tenantId: newUser.tenantId } 
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
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
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
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

    const token = jwt.sign(
      { id: user.id, email: user.email, tenantId: user.tenantId, role: userRole, isPlatformLevel: false },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(200).json({ 
      message: 'Login successful',
      token, 
      user: { id: user.id, email: user.email, name: user.name, tenantId: user.tenantId, role: userRole } 
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
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
    const newTenant = await prisma.$transaction(async (tx) => {
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
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
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
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
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

// GET /agents — list all agents for current tenant
app.get('/agents', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.headers['x-tenant-id'] as string);
    const agents = await (prisma as any).agent.findMany({
      where: { tenantId },
      include: { 
        marginSegments: { orderBy: { minAmount: 'asc' } },
        wallet: { include: { transactions: { orderBy: { createdAt: 'desc' } } } }
      },
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ agents });
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
    const users = await prisma.user.findMany({
      where: { tenantId },
      include: { role: true },
      orderBy: { createdAt: 'desc' }
    });
    
    // Map response to hide password and format role
    const sanitized = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role?.name || 'UNKNOWN',
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    }));

    res.status(200).json({ users: sanitized });
  } catch (error) {
    console.error('Fetch Users Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/users', requireTenantContext, async (req: any, res: Response) => {
  try {
    const tenantId = parseInt(req.tenantId!);
    const { name, email, password, roleName } = req.body;

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

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        encryptedPassword: hashedPassword,
        tenantId,
        roleId: role.id
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
    const { name, roleName, password } = req.body;

    const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let dataToUpdate: any = {};
    if (name) dataToUpdate.name = name;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      dataToUpdate.encryptedPassword = await bcrypt.hash(password, salt);
    }

    if (roleName) {
      let role = await prisma.role.findFirst({ where: { tenantId, name: roleName } });
      if (!role) {
        role = await prisma.role.create({ data: { name: roleName, tenantId } });
      }
      dataToUpdate.roleId = role.id;
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
    const vendors = await (prisma as any).vendor.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ vendors });
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

app.listen(PORT, () => {
  console.log(`Auth Service is running on port ${PORT}`);
});

