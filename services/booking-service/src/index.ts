import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client-booking';
import { requirePermission } from './middleware/rbac';
import { Permission, Role } from './types/rbac';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4005;
const prisma = new PrismaClient();

app.use(helmet());
const corsOptions = {
  origin: '*',
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// Extend Express Request type
interface CustomRequest extends Request {
  userId?: string;
  userRole?: string;
  tenantId?: string;
  isPlatformAdmin?: boolean;
}

// Middleware to extract headers injected by the SaaS API Gateway
const requireGatewayHeaders = (req: CustomRequest, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'] as string;
  const userRole = req.headers['x-user-role'] as string;
  const tenantId = req.headers['x-tenant-id'] as string;
  const isPlatformAdmin = req.headers['x-is-platform-admin'] === 'true';

  if (!userId || !userRole || !tenantId) {
    return res.status(400).json({ 
      error: 'Bad Request', 
      message: 'Missing propagation context. Please route requests through the API Gateway.' 
    });
  }

  req.userId = userId;
  req.userRole = userRole;
  req.tenantId = tenantId;
  req.isPlatformAdmin = isPlatformAdmin;
  next();
};

// RBAC authorization builder
const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: CustomRequest, res: Response, next: NextFunction) => {
    if (req.isPlatformAdmin) {
      return next(); // Platform Super Admin bypasses role checks downstream
    }
    
    if (req.userRole && allowedRoles.includes(req.userRole)) {
      return next();
    }
    
    res.status(403).json({ error: 'Forbidden', message: 'Insufficient role permissions' });
  };
};

const createBookingSchema = z.object({
  bookingReference: z.string().min(5),
  date: z.string(),
  totalPrice: z.number().positive(),
  customers: z.array(z.number()).optional().default([]),
  agentName: z.string().optional()
});

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', service: 'Booking Service' });
});

// Create Booking (Company Admin or Agent can book)
app.post('/', requireGatewayHeaders, requirePermission(Permission.CREATE_BOOKING), async (req: CustomRequest, res: Response) => {
  try {
    const parsedData = createBookingSchema.parse(req.body);
    
    // Extract tenant ID from gateway propagation header
    const tenantIdNumeric = parseInt(req.tenantId!);

    // Generate sequential suffix based on tenant's total booking count
    const totalBookings = await prisma.booking.count({
      where: { tenantId: tenantIdNumeric }
    });
    const suffix = String(totalBookings + 1).padStart(3, '0');
    const finalBookingReference = `${parsedData.bookingReference}-${suffix}`;

    const newBooking = await prisma.booking.create({
      data: {
        tenantId: tenantIdNumeric,
        bookingReference: finalBookingReference,
        date: new Date(parsedData.date),
        totalPrice: parsedData.totalPrice,
        status: 'confirmed',
        agentName: parsedData.agentName || null
      },
      include: {
        customers: true,
        additionalServices: true
      }
    });

    res.status(201).json({ message: 'Booking created successfully', booking: newBooking });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Create Booking Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get User Bookings (With Tenant Isolation and Filtering)
app.get('/search', requireGatewayHeaders, async (req: CustomRequest, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    if (!q) {
      return res.status(200).json({ bookings: [] });
    }
    
    const tenantId = parseInt(req.tenantId!);
    const limit = 10;

    const bookings = await prisma.booking.findMany({
      where: {
        tenantId,
        OR: [
          { bookingReference: { contains: q, mode: 'insensitive' } },
          { flightServices: { some: { pnr: { contains: q, mode: 'insensitive' } } } },
          { agentName: { contains: q, mode: 'insensitive' } },
          { customers: { some: { firstName: { contains: q, mode: 'insensitive' } } } },
          { customers: { some: { lastName: { contains: q, mode: 'insensitive' } } } }
        ]
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        bookingReference: true,
        agentName: true,
        totalPrice: true,
        flightServices: { select: { pnr: true } },
        customers: { select: { firstName: true, lastName: true }, take: 1 }
      }
    });

    res.status(200).json({ bookings });
  } catch (error: any) {
    console.error('Search bookings error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message, stack: error.stack });
  }
});

app.get('/my-bookings', requireGatewayHeaders, async (req: CustomRequest, res: Response) => {
  try {
    const {
      id, dateStart, dateEnd, departureDateStart, departureDateEnd,
      bookingReference, agentName, customerName, customerEmail,
      customerPhone, status, isLocked, paymentStatus,
      createdAtStart, createdAtEnd, tenantId
    } = req.query;

    const whereClause: any = {};

    if (id) {
      whereClause.id = parseInt(id as string);
    }
    if (bookingReference) {
      whereClause.bookingReference = { contains: bookingReference as string, mode: 'insensitive' };
    }
    if (agentName && agentName !== 'Any') {
      whereClause.agentName = agentName as string;
    }
    if (status && status !== 'Any') {
      whereClause.status = status as string;
    }
    if (isLocked !== undefined && isLocked !== 'Any') {
      whereClause.isLocked = isLocked === 'true';
    }
    if (paymentStatus && paymentStatus !== 'Any') {
      whereClause.paymentStatus = paymentStatus as string;
    }

    if (dateStart || dateEnd) {
      whereClause.date = {};
      if (dateStart) whereClause.date.gte = new Date(dateStart as string);
      if (dateEnd) whereClause.date.lte = new Date(dateEnd as string);
    }
    if (departureDateStart || departureDateEnd) {
      whereClause.departureDate = {};
      if (departureDateStart) whereClause.departureDate.gte = new Date(departureDateStart as string);
      if (departureDateEnd) whereClause.departureDate.lte = new Date(departureDateEnd as string);
    }
    if (createdAtStart || createdAtEnd) {
      whereClause.createdAt = {};
      if (createdAtStart) whereClause.createdAt.gte = new Date(createdAtStart as string);
      if (createdAtEnd) whereClause.createdAt.lte = new Date(createdAtEnd as string);
    }

    if (customerName || customerEmail || customerPhone) {
      const customerFilter: any = {};
      if (customerName) {
        customerFilter.OR = [
          { firstName: { contains: customerName as string, mode: 'insensitive' } },
          { lastName: { contains: customerName as string, mode: 'insensitive' } }
        ];
      }
      if (customerEmail) {
        customerFilter.email = { contains: customerEmail as string, mode: 'insensitive' };
      }
      if (customerPhone) {
        customerFilter.phoneNumber = { contains: customerPhone as string, mode: 'insensitive' };
      }
      whereClause.customers = { some: customerFilter };
    }

    if (req.isPlatformAdmin) {
      const targetTenantId = tenantId ? parseInt(tenantId as string) : undefined;
      if (targetTenantId) whereClause.tenantId = targetTenantId;
    } else {
      whereClause.tenantId = parseInt(req.tenantId!);
    }

    const pageNum = parseInt(req.query.page as string) || 1;
    const isAll = req.query.limit === 'all';
    const limitNum = isAll ? undefined : (parseInt(req.query.limit as string) || 10);
    const skip = isAll ? undefined : (pageNum - 1) * limitNum!;

    const [total, bookings] = await Promise.all([
      prisma.booking.count({ where: whereClause }),
      prisma.booking.findMany({
        where: whereClause,
        ...(skip !== undefined && { skip }),
        ...(limitNum !== undefined && { take: limitNum }),
        include: {
          customers: true,
          payments: true,
          vendorPayments: true,
          refunds: true,
          discounts: true,
          _count: {
            select: {
              flightServices: true,
              accommodations: true,
              transportServices: true,
              visaServices: true,
              additionalServices: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    res.status(200).json({ 
      bookings,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: limitNum ? Math.ceil(total / limitNum) : 1
    });
  } catch (error) {
    console.error('Fetch Bookings Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get Single Booking Detail (With Tenant Isolation)
// ---------------------------------------------------------
// Service Catalog Endpoints
// ---------------------------------------------------------

// GET /catalog
app.get('/catalog', requireGatewayHeaders, async (req: CustomRequest, res: Response) => {
  try {
    const { serviceType } = req.query;
    const filter: any = { isActive: true, tenantId: parseInt(req.tenantId as string) || 1 };
    if (serviceType) filter.serviceType = String(serviceType);

    const pageNum = parseInt(req.query.page as string) || 1;
    const limitNum = parseInt(req.query.limit as string) || 10;
    const skip = (pageNum - 1) * limitNum;

    const [total, items] = await Promise.all([
      prisma.serviceCatalog.count({ where: filter }),
      prisma.serviceCatalog.findMany({
        where: filter,
        skip,
        take: limitNum,
        orderBy: { name: 'asc' }
      })
    ]);

    res.json({
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: limitNum ? Math.ceil(total / limitNum) : 1
    });
  } catch (error) {
    console.error('Fetch catalog error:', error);
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
});

// POST /catalog (Admin Only)
app.post('/catalog', requireGatewayHeaders, authorizeRoles('COMPANY_ADMIN', 'MAIN_COMPANY_ADMIN', 'SUPER_ADMIN'), async (req: CustomRequest, res: Response) => {
  try {
    const item = await prisma.serviceCatalog.create({
      data: {
        tenantId: parseInt(req.tenantId as string) || 1,
        serviceType: req.body.serviceType,
        name: req.body.name,
        unitPrice: req.body.unitPrice,
        currency: req.body.currency,
        metadata: req.body.metadata || {}
      }
    });
    res.status(201).json(item);
  } catch (error) {
    console.error('Create catalog item error:', error);
    res.status(500).json({ error: 'Failed to create catalog item' });
  }
});

// PUT /catalog/:id (Admin Only)
app.patch('/catalog/:id', requireGatewayHeaders, authorizeRoles('COMPANY_ADMIN', 'MAIN_COMPANY_ADMIN', 'SUPER_ADMIN'), async (req: CustomRequest, res: Response) => {
  try {
    const item = await prisma.serviceCatalog.update({
      where: { id: parseInt(req.params.id) },
      data: {
        serviceType: req.body.serviceType,
        name: req.body.name,
        unitPrice: req.body.unitPrice,
        currency: req.body.currency,
        isActive: req.body.isActive,
        metadata: req.body.metadata
      }
    });
    res.json(item);
  } catch (error) {
    console.error('Update catalog item error:', error);
    res.status(500).json({ error: 'Failed to update catalog item' });
  }
});

// DELETE /catalog/:id (Admin Only)
app.delete('/catalog/:id', requireGatewayHeaders, authorizeRoles('COMPANY_ADMIN', 'MAIN_COMPANY_ADMIN', 'SUPER_ADMIN'), async (req: CustomRequest, res: Response) => {
  try {
    await prisma.serviceCatalog.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.status(204).send();
  } catch (error) {
    console.error('Delete catalog item error:', error);
    res.status(500).json({ error: 'Failed to delete catalog item' });
  }
});


app.get('/:id', requireGatewayHeaders, async (req: CustomRequest, res: Response) => {
  try {
    const bookingId = parseInt(req.params.id);
    const tenantIdNumeric = parseInt(req.tenantId!);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customers: { orderBy: { id: 'asc' } },
        payments: { orderBy: { paidOn: 'desc' } },
        vendorPayments: { orderBy: { id: 'asc' } },
        accommodations: { orderBy: { id: 'asc' } },
        flightServices: { orderBy: { id: 'asc' } },
        transportServices: { orderBy: { id: 'asc' } },
        visaServices: { orderBy: { id: 'asc' } },
        discounts: { orderBy: { date: 'desc' } },
        refunds: { orderBy: { date: 'desc' } },
        additionalServices: { orderBy: { id: 'asc' } }
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Not Found', message: 'Booking does not exist' });
    }

    // Enforce Tenant isolation (unless platform admin)
    if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied to this booking workspace' });
    }

    if (booking.isLocked && req.userRole === Role.AGENT) {
      return res.status(403).json({ error: 'Forbidden', message: 'This booking is locked.' });
    }

    const vendorPayments = booking.payments.filter(p => p.paymentType === 'Sent to Vendor');
    booking.flightServices.forEach(s => {
      // @ts-ignore
      const matchString = `- ${s.flightNo || 'No Flight No'} (${s.pnr})`;
      if (!s.isPaidToVendor && vendorPayments.some(p => p.notes?.includes(matchString))) s.isPaidToVendor = true;
    });
    booking.accommodations.forEach(s => {
      const matchString = `Hotel: ${s.hotelName}`;
      if (!s.isPaidToVendor && vendorPayments.some(p => p.notes?.includes(matchString))) s.isPaidToVendor = true;
    });
    booking.transportServices.forEach(s => {
      const matchString = `Transport: ${s.vehicleType}`;
      if (!s.isPaidToVendor && vendorPayments.some(p => p.notes?.includes(matchString))) s.isPaidToVendor = true;
    });
    booking.visaServices.forEach(s => {
      const matchString = `Visa: ${s.vendorName || 'Unknown'} (${s.visaType})`;
      if (!s.isPaidToVendor && vendorPayments.some(p => p.notes?.includes(matchString))) s.isPaidToVendor = true;
    });
    booking.additionalServices.forEach(s => {
      const matchString = `Service: ${s.serviceName}`;
      if (!s.isPaidToVendor && vendorPayments.some(p => p.notes?.includes(matchString))) s.isPaidToVendor = true;
    });

    res.status(200).json({ booking });
  } catch (error) {
    console.error('Fetch Booking Detail Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update Booking Status/Charges (PATCH)
const patchBookingSchema = z.object({
  totalPrice: z.number().optional(),
  paidAmount: z.number().optional(),
  refundAmount: z.number().optional(),
  cardPaymentCharges: z.number().optional(),
  cancellationCharges: z.number().optional(),
  remainingAmount: z.number().optional(),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  isLocked: z.boolean().optional(),
  departureDate: z.string().optional(),
  agentName: z.string().optional(),
  date: z.string().optional()
});

app.patch('/:id', requireGatewayHeaders, requirePermission(Permission.UPDATE_BOOKING), async (req: CustomRequest, res: Response) => {
  try {
    const bookingId = parseInt(req.params.id);
    const parsedData = patchBookingSchema.parse(req.body);
    const tenantIdNumeric = parseInt(req.tenantId!);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Not Found', message: 'Booking does not exist' });
    }

    if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied to this booking workspace' });
    }

    if (booking.isLocked && req.userRole === Role.AGENT) {
      return res.status(403).json({ error: 'Forbidden', message: 'This booking is locked.' });
    }

    if (booking.isLocked && req.userRole === Role.AGENT) {
      return res.status(403).json({ error: 'Forbidden', message: 'This booking is locked and cannot be edited by agents.' });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        totalPrice: parsedData.totalPrice !== undefined ? parsedData.totalPrice : undefined,
        paidAmount: parsedData.paidAmount !== undefined ? parsedData.paidAmount : undefined,
        refundAmount: parsedData.refundAmount !== undefined ? parsedData.refundAmount : undefined,
        cardPaymentCharges: parsedData.cardPaymentCharges !== undefined ? parsedData.cardPaymentCharges : undefined,
        cancellationCharges: parsedData.cancellationCharges !== undefined ? parsedData.cancellationCharges : undefined,
        remainingAmount: parsedData.remainingAmount !== undefined ? parsedData.remainingAmount : undefined,
        status: parsedData.status || undefined,
        paymentStatus: parsedData.paymentStatus || undefined,
        isLocked: parsedData.isLocked !== undefined ? parsedData.isLocked : undefined,
        departureDate: parsedData.departureDate ? new Date(parsedData.departureDate) : undefined,
        agentName: parsedData.agentName || undefined,
        date: parsedData.date ? new Date(parsedData.date) : undefined
      }
    });

    res.status(200).json({ message: 'Booking updated successfully', booking: updatedBooking });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Patch Booking Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Add Passenger / Customer to Booking
const addPassengerSchema = z.object({
  title: z.string().nullable().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  ageCategory: z.string().default('Adult'),
  email: z.string().email().optional().or(z.literal('')).nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  passportNumber: z.string().nullable().optional(),
  passportExpiryDate: z.string().nullable().optional(),
  agentName: z.string().nullable().optional(),
  role: z.string().nullable().optional().default('Family Member')
});

app.post('/:id/passengers', requireGatewayHeaders, requirePermission(Permission.UPDATE_BOOKING), async (req: CustomRequest, res: Response) => {
  try {
    const bookingId = parseInt(req.params.id);
    const parsedData = addPassengerSchema.parse(req.body);
    const tenantIdNumeric = parseInt(req.tenantId!);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Not Found', message: 'Booking does not exist' });
    }

    if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
    }

    if (booking.isLocked && req.userRole === Role.AGENT) {
      return res.status(403).json({ error: 'Forbidden', message: 'This booking is locked.' });
    }

    const passenger = await prisma.bookingCustomer.create({
      data: {
        tenantId: tenantIdNumeric,
        bookingId,
        title: parsedData.title || null,
        firstName: parsedData.firstName,
        lastName: parsedData.lastName,
        ageCategory: parsedData.ageCategory,
        email: parsedData.email || null,
        phoneNumber: parsedData.phoneNumber || null,
        passportNumber: parsedData.passportNumber || null,
        passportExpiryDate: parsedData.passportExpiryDate ? new Date(parsedData.passportExpiryDate) : null,
        agentName: parsedData.agentName || null,
        role: parsedData.role
      }
    });

    res.status(201).json({ message: 'Passenger added successfully', passenger });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return res.status(400).json({ error: 'Validation failed', message: messages });
    }
    console.error('Add Passenger Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error?.message || 'Unknown error' });
  }
});

// Add Payment / Transaction to Booking
const addPaymentSchema = z.object({
  amount: z.number(),
  paymentMethod: z.string().min(1),
  paymentType: z.string().min(1),
  paidOn: z.string(),
  notes: z.string().nullable().optional(),
  cardCharges: z.number().optional()
});

// POST /:id/clawback-margin
app.post('/:id/clawback-margin', requireGatewayHeaders, requirePermission(Permission.UPDATE_TRANSACTION), async (req: CustomRequest, res: Response) => {
  try {
    const bookingId = parseInt(req.params.id);
    const tenantIdNumeric = parseInt(req.tenantId!);
    const { amount, reason } = req.body;
    const clawbackAmount = parseFloat(amount);

    if (isNaN(clawbackAmount) || clawbackAmount <= 0) {
      return res.status(400).json({ error: 'Invalid clawback amount' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) return res.status(404).json({ error: 'Not Found', message: 'Booking does not exist' });
    if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) return res.status(403).json({ error: 'Forbidden' });
    if (booking.isLocked && req.userRole === Role.AGENT) return res.status(403).json({ error: 'Forbidden', message: 'Booking is locked.' });

    // Ensure they have the correct role for clawbacks
    if (req.userRole !== 'MAIN_COMPANY_ADMIN' && !req.isPlatformAdmin) {
      return res.status(403).json({ error: 'Forbidden', message: 'Only MAIN_COMPANY_ADMIN can clawback margin' });
    }

    if (!booking.agentName) {
      return res.status(400).json({ error: 'No agent associated with this booking' });
    }

    // Double Entry Accounting
    const tx = await prisma.ledgerTransaction.create({
      data: {
        tenantId: tenantIdNumeric,
        transactionDate: new Date(),
        referenceNumber: booking.bookingReference,
        description: `Margin Clawback from Agent ${booking.agentName}. Reason: ${reason || ''}`,
        type: 'MARGIN_CLAWBACK'
      }
    });

    // Asset account: Agent Advances / Receivables
    let assetAccount = await prisma.ledgerAccount.findFirst({
      where: { tenantId: tenantIdNumeric, accountType: 'AGENT_RECEIVABLE', entityName: booking.agentName }
    });
    if (!assetAccount) {
      assetAccount = await prisma.ledgerAccount.create({
        data: { tenantId: tenantIdNumeric, accountType: 'AGENT_RECEIVABLE', entityName: booking.agentName }
      });
    }

    // Expense account: Agent Margin Expense
    let expenseAccount = await prisma.ledgerAccount.findFirst({
      where: { tenantId: tenantIdNumeric, accountType: 'AGENT_COMMISSION_EXPENSE', entityName: booking.agentName }
    });
    if (!expenseAccount) {
      expenseAccount = await prisma.ledgerAccount.create({
        data: { tenantId: tenantIdNumeric, accountType: 'AGENT_COMMISSION_EXPENSE', entityName: booking.agentName }
      });
    }

    // Debit Asset, Credit Expense
    await prisma.ledgerEntry.createMany({
      data: [
        { transactionId: tx.id, accountId: assetAccount.id, debitAmount: clawbackAmount, creditAmount: 0 },
        { transactionId: tx.id, accountId: expenseAccount.id, debitAmount: 0, creditAmount: clawbackAmount }
      ]
    });

    await prisma.ledgerAccount.update({ where: { id: assetAccount.id }, data: { balance: { increment: clawbackAmount } } });
    await prisma.ledgerAccount.update({ where: { id: expenseAccount.id }, data: { balance: { decrement: clawbackAmount } } });

    // Also add to booking payments to show on ledger
    const clawbackPayment = await prisma.bookingPayment.create({
      data: {
        tenantId: tenantIdNumeric,
        bookingId,
        amount: -clawbackAmount,
        paymentMethod: 'Agent Wallet Deduction',
        paymentType: 'Margin Paid to Agent',
        paidOn: new Date(),
        notes: `Clawback: ${reason || ''}`
      }
    });

    // Hit Auth-Service to update wallet
    try {
      const authUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
      // 1. Get Agent ID
      const agentRes = await fetch(`${authUrl}/agents/by-name/${encodeURIComponent(booking.agentName)}`, {
        headers: { 'x-tenant-id': tenantIdNumeric.toString() }
      });
      if (agentRes.ok) {
        const agentData = await agentRes.json();
        const agentId = agentData.agent.id;

        // 2. Post Wallet Transaction
        await fetch(`${authUrl}/agents/${agentId}/wallet/transaction`, {
          method: 'POST',
          headers: {
            'x-tenant-id': tenantIdNumeric.toString(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: -clawbackAmount,
            transactionType: 'MARGIN_CLAWBACK',
            referenceId: booking.bookingReference,
            notes: `Clawback: ${reason || ''}`
          })
        });
      }

      // Update marginStatus
      await prisma.booking.update({
        where: { id: bookingId },
        data: { marginStatus: 'Clawed_Back' }
      });
    } catch (e) {
      console.error('Failed to sync agent wallet with auth-service', e);
    }

    res.status(201).json({ message: 'Margin clawback successful', clawbackPayment });
  } catch (error: any) {
    console.error('Margin Clawback Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /:id/finalize-margin
app.post('/:id/finalize-margin', requireGatewayHeaders, requirePermission(Permission.CREATE_TRANSACTION), async (req: CustomRequest, res: Response) => {
  try {
    const bookingId = parseInt(req.params.id);
    const { amount, notes } = req.body;
    const tenantIdNumeric = parseInt(req.tenantId!);

    if (!amount || isNaN(parseFloat(amount))) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid amount' });
    }
    const earnedAmount = parseFloat(amount);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        vendorPayments: true,
        payments: true,
        flightServices: true,
        accommodations: true,
        transportServices: true,
        visaServices: true,
        additionalServices: true
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Not Found', message: 'Booking not found' });
    }

    if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
    }

    if (booking.isLocked && req.userRole === Role.AGENT) {
      return res.status(403).json({ error: 'Forbidden', message: 'Booking is locked.' });
    }

    if (!booking.agentName || booking.agentName === 'System / Auto' || booking.agentName === 'Direct Client') {
      return res.status(400).json({ error: 'Bad Request', message: 'Booking has no assigned agent.' });
    }

    const legacyVendorPayments = booking.payments?.filter(p => p.paymentType === 'Sent to Vendor').reduce((sum, p) => sum + (parseFloat(p.amount.toString()) || 0), 0) || 0;
    const modernVendorPayments = booking.vendorPayments?.reduce((sum, p) => sum + (parseFloat(p.amount.toString()) || 0), 0) || 0;
    const totalVendorSent = legacyVendorPayments + modernVendorPayments;
    
    // Calculate actual total vendor cost
    const flightCost = booking.flightServices?.reduce((sum, f) => sum + (parseFloat(f.price?.toString() || '0')), 0) || 0;
    const accCost = booking.accommodations?.reduce((sum, a) => sum + (parseFloat(a.price?.toString() || '0')), 0) || 0;
    const transCost = booking.transportServices?.reduce((sum, t) => sum + (parseFloat(t.price?.toString() || '0')), 0) || 0;
    const visaCost = booking.visaServices?.reduce((sum, v) => sum + (parseFloat(v.price?.toString() || '0')), 0) || 0;
    const addCost = booking.additionalServices?.reduce((sum, s) => sum + (parseFloat(s.charges?.toString() || '0')), 0) || 0;
    const totalVendorCost = flightCost + accCost + transCost + visaCost + addCost;

    if (totalVendorSent < totalVendorCost) {
      return res.status(400).json({ error: 'Bad Request', message: 'Cannot finalize margin: Vendor payments are less than the total booking cost.' });
    }

    // Update marginStatus
    await prisma.booking.update({
      where: { id: bookingId },
      data: { marginStatus: 'Finalized' }
    });

    // Double Entry Accounting
    const tx = await prisma.ledgerTransaction.create({
      data: {
        tenantId: tenantIdNumeric,
        transactionDate: new Date(),
        referenceNumber: booking.bookingReference,
        description: `Margin Earned by Agent ${booking.agentName}. ${notes || ''}`,
        type: 'MARGIN_EARNED'
      }
    });

    // Asset account: Agent Advances / Receivables (Will be credited to decrease what they owe us / increase what we owe them)
    let assetAccount = await prisma.ledgerAccount.findFirst({
      where: { tenantId: tenantIdNumeric, accountType: 'AGENT_RECEIVABLE', entityName: booking.agentName }
    });
    if (!assetAccount) {
      assetAccount = await prisma.ledgerAccount.create({
        data: { tenantId: tenantIdNumeric, accountType: 'AGENT_RECEIVABLE', entityName: booking.agentName }
      });
    }

    // Expense account: Agent Margin Expense (Will be debited to increase expense)
    let expenseAccount = await prisma.ledgerAccount.findFirst({
      where: { tenantId: tenantIdNumeric, accountType: 'AGENT_COMMISSION_EXPENSE', entityName: booking.agentName }
    });
    if (!expenseAccount) {
      expenseAccount = await prisma.ledgerAccount.create({
        data: { tenantId: tenantIdNumeric, accountType: 'AGENT_COMMISSION_EXPENSE', entityName: booking.agentName }
      });
    }

    // Debit Expense, Credit Asset
    await prisma.ledgerEntry.createMany({
      data: [
        { transactionId: tx.id, accountId: expenseAccount.id, debitAmount: earnedAmount, creditAmount: 0 },
        { transactionId: tx.id, accountId: assetAccount.id, debitAmount: 0, creditAmount: earnedAmount }
      ]
    });

    await prisma.ledgerAccount.update({ where: { id: expenseAccount.id }, data: { balance: { increment: earnedAmount } } });
    await prisma.ledgerAccount.update({ where: { id: assetAccount.id }, data: { balance: { decrement: earnedAmount } } });

    // Also add to booking payments to show on ledger as a positive margin earned
    const earnedPayment = await prisma.bookingPayment.create({
      data: {
        tenantId: tenantIdNumeric,
        bookingId,
        amount: earnedAmount,
        paymentMethod: 'Agent Wallet Credit',
        paymentType: 'Margin Earned',
        paidOn: new Date(),
        notes: notes || null
      }
    });

    // Hit Auth-Service to update wallet
    try {
      const authUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:4001';
      let agentId = booking.agentId;
      if (!agentId && booking.agentName) {
        const agentRes = await fetch(`${authUrl}/agents/by-name/${encodeURIComponent(booking.agentName)}`, {
          headers: { 'x-tenant-id': tenantIdNumeric.toString() }
        });
        if (agentRes.ok) {
          const agentData = await agentRes.json();
          agentId = agentData.agent.id;
        }
      }

      if (agentId) {
        // 1. Fetch current debt BEFORE applying the earned margin
        let currentDebt = 0;
        try {
          const debtRes = await fetch(`${authUrl}/agents/${agentId}/wallet/debt`, {
            headers: { 'x-tenant-id': tenantIdNumeric.toString() }
          });
          if (debtRes.ok) {
            const data = await debtRes.json();
            currentDebt = data.debt || 0;
          }
        } catch (e) {
          console.error('Failed to fetch pre-margin debt', e);
        }

        // 2. Add the earned margin to the wallet
        await fetch(`${authUrl}/agents/${agentId}/wallet/transaction`, {
          method: 'POST',
          headers: {
            'x-tenant-id': tenantIdNumeric.toString(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: earnedAmount,
            transactionType: 'MARGIN_EARNED',
            referenceId: booking.bookingReference,
            notes: `Margin Earned. ${notes || ''}`
          })
        });

        // 3. Automatic Debt Offset
        if (currentDebt > 0) {
          // The amount of margin that was instantly swallowed by the debt
          const absorbedAmount = Math.min(currentDebt, earnedAmount);
          
          if (absorbedAmount > 0) {
            // Automatically log a BookingPayment of type Margin Paid to Agent (Debt Offset)
            // so that the booking's remaining margin goes down correctly without double-debiting the wallet!
            await prisma.bookingPayment.create({
              data: {
                tenantId: tenantIdNumeric,
                bookingId,
                amount: absorbedAmount,
                paymentMethod: 'Debt Offset',
                paymentType: 'Margin Paid to Agent',
                paidOn: new Date(),
                notes: `System automatically offset £${absorbedAmount.toFixed(2)} against past agent debt upon finalization.`
              }
            });

            // If the entire margin was absorbed, mark the booking marginStatus as Paid!
            if (absorbedAmount >= earnedAmount) {
              await prisma.booking.update({
                where: { id: bookingId },
                data: { marginStatus: 'Paid' }
              });
            }
          }
        }

      } else {
        console.warn('Could not sync wallet: Agent ID not found for agentName:', booking.agentName);
      }
    } catch (e) {
      console.error('Failed to sync agent wallet with auth-service', e);
    }

    res.status(201).json({ message: 'Margin finalized successfully', earnedPayment });
  } catch (error: any) {
    console.error('Commit Margin Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/:id/payments', requireGatewayHeaders, requirePermission(Permission.CREATE_TRANSACTION), async (req: CustomRequest, res: Response) => {
  try {
    const bookingId = parseInt(req.params.id);
    const parsedData = addPaymentSchema.parse(req.body);
    const tenantIdNumeric = parseInt(req.tenantId!);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Not Found', message: 'Booking does not exist' });
    }

    if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
    }

    if (booking.isLocked && req.userRole === Role.AGENT) {
      return res.status(403).json({ error: 'Forbidden', message: 'This booking is locked.' });
    }

    if (parsedData.paymentType === 'Margin Paid to Agent' && booking.marginStatus !== 'Finalized' && booking.marginStatus !== 'Paid') {
      return res.status(400).json({ error: 'Bad Request', message: 'Cannot pay margin to agent until the booking margin has been finalized.' });
    }

    let finalNotes = parsedData.notes || '';
    if (parsedData.cardCharges && parsedData.cardCharges > 0) {
      finalNotes = finalNotes 
        ? `${finalNotes}\n(Includes Credit Card Charge: £${parsedData.cardCharges.toFixed(2)})`
        : `(Includes Credit Card Charge: £${parsedData.cardCharges.toFixed(2)})`;
    }

    const payment = await prisma.bookingPayment.create({
      data: {
        tenantId: tenantIdNumeric,
        bookingId,
        amount: parsedData.amount,
        paymentMethod: parsedData.paymentMethod,
        paymentType: parsedData.paymentType,
        paidOn: new Date(parsedData.paidOn),
        notes: finalNotes || null
      }
    });

    // --- LEDGER INTEGRATION (DOUBLE ENTRY) ---
    if (parsedData.paymentType === 'Sent to Vendor') {
      const vendorName = 'General Vendors'; // Or parse from notes if needed
      let vendorAccount = await prisma.ledgerAccount.findFirst({
        where: { tenantId: tenantIdNumeric, accountType: 'VENDOR_PAYABLE', entityName: vendorName }
      });
      if (!vendorAccount) {
        vendorAccount = await prisma.ledgerAccount.create({
          data: { tenantId: tenantIdNumeric, accountType: 'VENDOR_PAYABLE', entityName: vendorName }
        });
      }

      const mainTx = await prisma.ledgerTransaction.create({
        data: {
          tenantId: tenantIdNumeric,
          transactionDate: new Date(parsedData.paidOn),
          referenceNumber: booking.bookingReference,
          description: `Vendor Payment via ${parsedData.paymentMethod}. ${parsedData.notes || ''}`,
          type: 'PAYMENT'
        }
      });

      await prisma.ledgerEntry.create({
        data: {
          transactionId: mainTx.id,
          accountId: vendorAccount.id,
          debitAmount: parsedData.amount, // Debit Payable to reduce liability
          creditAmount: 0
        }
      });

      await prisma.ledgerAccount.update({
        where: { id: vendorAccount.id },
        data: { balance: { decrement: parsedData.amount } }
      });
    } else if (parsedData.paymentType === 'Received from Client') {
      const customerName = booking.agentName || 'Direct Client';
      let customerAccount = await prisma.ledgerAccount.findFirst({
        where: { tenantId: tenantIdNumeric, accountType: 'CUSTOMER_RECEIVABLE', entityName: customerName }
      });
      if (!customerAccount) {
        customerAccount = await prisma.ledgerAccount.create({
          data: { tenantId: tenantIdNumeric, accountType: 'CUSTOMER_RECEIVABLE', entityName: customerName }
        });
      }

      const mainTx = await prisma.ledgerTransaction.create({
        data: {
          tenantId: tenantIdNumeric,
          transactionDate: new Date(parsedData.paidOn),
          referenceNumber: booking.bookingReference,
          description: `Client Payment via ${parsedData.paymentMethod}. ${parsedData.notes || ''}`,
          type: 'PAYMENT'
        }
      });

      await prisma.ledgerEntry.create({
        data: {
          transactionId: mainTx.id,
          accountId: customerAccount.id,
          debitAmount: 0,
          creditAmount: parsedData.amount
        }
      });

      await prisma.ledgerAccount.update({
        where: { id: customerAccount.id },
        data: { balance: { decrement: parsedData.amount } }
      });

      // 2. Separate Transaction for Credit Card Charges (Debit Customer Receivable)
      if (parsedData.cardCharges && parsedData.cardCharges > 0) {
        const feeTx = await prisma.ledgerTransaction.create({
          data: {
            tenantId: tenantIdNumeric,
            transactionDate: new Date(parsedData.paidOn),
            referenceNumber: booking.bookingReference,
            description: `Credit Card Processing Fee`,
            type: 'FEE'
          }
        });

        await prisma.ledgerEntry.create({
          data: {
            transactionId: feeTx.id,
            accountId: customerAccount.id,
            debitAmount: parsedData.cardCharges,
            creditAmount: 0
          }
        });

        await prisma.ledgerAccount.update({
          where: { id: customerAccount.id },
          data: { balance: { increment: parsedData.cardCharges } }
        });
      }
    }
    // --------------------------------------------
    // --- AGENT WALLET SYNC ---
    if (parsedData.paymentType === 'Margin Paid to Agent' && booking.agentName && booking.agentName !== 'Direct Client' && booking.agentName !== 'System / Auto') {
      try {
        const authUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:4001';
        let agentId = booking.agentId;
        if (!agentId) {
          const agentRes = await fetch(`${authUrl}/agents/by-name/${encodeURIComponent(booking.agentName)}`, {
            headers: { 'x-tenant-id': tenantIdNumeric.toString() }
          });
          if (agentRes.ok) {
            const agentData = await agentRes.json();
            agentId = agentData.agent.id;
          }
        }
        
        if (agentId) {
          if (parsedData.paymentMethod !== 'Debt Offset') {
            // Ensure amount is negative for payout
            const walletAmount = parsedData.amount > 0 ? -parsedData.amount : parsedData.amount;
            
            await fetch(`${authUrl}/agents/${agentId}/wallet/transaction`, {
              method: 'POST',
              headers: {
                'x-tenant-id': tenantIdNumeric.toString(),
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                amount: walletAmount,
                transactionType: 'MARGIN_PAID_OUT',
                referenceId: booking.bookingReference,
                notes: `Margin Paid to Agent via Booking. ${parsedData.notes || ''}`
              })
            });
          }

          // Update marginStatus
          await prisma.booking.update({
            where: { id: bookingId },
            data: { marginStatus: 'Paid' }
          });
        }
      } catch (e) {
        console.error('Failed to sync client payment with agent wallet', e);
      }
    }
    // ---------------------------

    // Automatically recalculate booking paid & remaining amounts
    const allPayments = await prisma.bookingPayment.findMany({
      where: { bookingId }
    });
    
    const totalPaid = allPayments.reduce((acc, p) => acc + Number(p.amount), 0);
    
    // Add new card charges to existing
    const newCardCharges = Number(booking.cardPaymentCharges) + (parsedData.cardCharges || 0);
    const remaining = Number(booking.totalPrice) + newCardCharges + Number(booking.cancellationCharges) - totalPaid - Number(booking.refundAmount);

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        cardPaymentCharges: newCardCharges,
        paidAmount: totalPaid,
        remainingAmount: remaining >= 0 ? remaining : 0,
        paymentStatus: remaining <= 0 ? 'paid' : (totalPaid > 0 ? 'partially_paid' : 'unpaid')
      }
    });

    res.status(201).json({ message: 'Transaction registered successfully', payment });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return res.status(400).json({ error: 'Validation failed', message: messages });
    }
    console.error('Add Payment Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error?.message || 'Unknown error' });
  }
});

// Add Vendor Payment
const addVendorPaymentSchema = z.object({
  vendorName: z.string().min(1),
  amount: z.number(),
  paymentStatus: z.string().default('unpaid'),
  paidOn: z.string().nullable().optional(),
  flightPnr: z.string().nullable().optional(),
  issueDate: z.string().nullable().optional(),
  reservationNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  totalPaid: z.number().default(0),
  totalRefunded: z.number().default(0),
  remainingDue: z.number().optional()
});

app.post('/:id/vendor-payments', requireGatewayHeaders, requirePermission(Permission.CREATE_TRANSACTION), async (req: CustomRequest, res: Response) => {
  try {
    const bookingId = parseInt(req.params.id);
    const parsedData = addVendorPaymentSchema.parse(req.body);
    const tenantIdNumeric = parseInt(req.tenantId!);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Not Found', message: 'Booking does not exist' });
    }

    if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
    }

    if (booking.isLocked && req.userRole === Role.AGENT) {
      return res.status(403).json({ error: 'Forbidden', message: 'This booking is locked.' });
    }

    const remainingDue = parsedData.remainingDue !== undefined 
      ? parsedData.remainingDue 
      : (parsedData.amount - parsedData.totalPaid);

    // 1. Create Vendor Payment
    const vendorPayment = await prisma.vendorPayment.create({
      data: {
        tenantId: tenantIdNumeric,
        bookingId,
        vendorName: parsedData.vendorName,
        amount: parsedData.amount,
        paymentStatus: parsedData.paymentStatus,
        paidOn: parsedData.paidOn ? new Date(parsedData.paidOn) : null,
        flightPnr: parsedData.flightPnr || null,
        issueDate: parsedData.issueDate ? new Date(parsedData.issueDate) : null,
        reservationNumber: parsedData.reservationNumber || null,
        notes: parsedData.notes || null,
        totalPaid: parsedData.totalPaid,
        totalRefunded: parsedData.totalRefunded,
        remainingDue
      }
    });

    // 2. Ledger Integration
    let vendorAccount = await prisma.ledgerAccount.findFirst({
      where: { tenantId: tenantIdNumeric, accountType: 'VENDOR_PAYABLE', entityName: parsedData.vendorName }
    });
    if (!vendorAccount) {
      vendorAccount = await prisma.ledgerAccount.create({
        data: { tenantId: tenantIdNumeric, accountType: 'VENDOR_PAYABLE', entityName: parsedData.vendorName }
      });
    }

    const tx = await prisma.ledgerTransaction.create({
      data: {
        tenantId: tenantIdNumeric,
        transactionDate: parsedData.paidOn ? new Date(parsedData.paidOn) : new Date(),
        referenceNumber: booking.bookingReference,
        description: `Vendor Payment to ${parsedData.vendorName}. ${parsedData.notes || ''}`,
        type: 'PAYMENT'
      }
    });

    await prisma.ledgerEntry.create({
      data: {
        transactionId: tx.id,
        accountId: vendorAccount.id,
        debitAmount: parsedData.amount,
        creditAmount: 0
      }
    });
    await prisma.ledgerAccount.update({
      where: { id: vendorAccount.id },
      data: { balance: { decrement: parsedData.amount } }
    });

    // 3. FIFO Service Allocation for THIS booking and vendor
    const fetchServices = async (model: any, type: string) => {
      const svcs = await model.findMany({
        where: { tenantId: tenantIdNumeric, bookingId, vendorName: parsedData.vendorName, isPaidToVendor: false },
        orderBy: { createdAt: 'asc' }
      });
      return svcs.map((s: any) => ({ ...s, serviceType: type }));
    };

    const flights = await fetchServices(prisma.flightService, 'FLIGHT');
    const hotels = await fetchServices(prisma.accommodationService, 'HOTEL');
    const transports = await fetchServices(prisma.transportService, 'TRANSPORT');
    const visas = await fetchServices(prisma.visaService, 'VISA');
    const additionals = await fetchServices(prisma.additionalService, 'ADDITIONAL');

    let allUnpaid = [...flights, ...hotels, ...transports, ...visas, ...additionals].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const allocations = [];
    let remainingAmountToAllocate = parseFloat(parsedData.amount as any);

    for (const service of allUnpaid) {
      if (remainingAmountToAllocate <= 0) break;

      const previousAllocations = await prisma.bookingAllocation.aggregate({
        where: { tenantId: tenantIdNumeric, serviceType: service.serviceType, serviceId: service.id },
        _sum: { allocatedAmount: true }
      });
      
      const totalCost = parseFloat(service.price) || 0;
      const alreadyAllocated = parseFloat(previousAllocations?._sum?.allocatedAmount as any) || 0;
      const serviceRemainingDue = totalCost - alreadyAllocated;

      if (serviceRemainingDue > 0) {
        const allocateAmt = Math.min(serviceRemainingDue, remainingAmountToAllocate);
        
        allocations.push({
          tenantId: tenantIdNumeric,
          transactionId: tx.id,
          bookingId: bookingId,
          serviceType: service.serviceType,
          serviceId: service.id,
          allocatedAmount: allocateAmt
        });

        remainingAmountToAllocate -= allocateAmt;

        if (allocateAmt >= serviceRemainingDue) {
          const updateData = { isPaidToVendor: true };
          switch(service.serviceType) {
            case 'FLIGHT': await prisma.flightService.update({ where: { id: service.id }, data: updateData }); break;
            case 'HOTEL': await prisma.accommodationService.update({ where: { id: service.id }, data: updateData }); break;
            case 'TRANSPORT': await prisma.transportService.update({ where: { id: service.id }, data: updateData }); break;
            case 'VISA': await prisma.visaService.update({ where: { id: service.id }, data: updateData }); break;
            case 'ADDITIONAL': await prisma.additionalService.update({ where: { id: service.id }, data: updateData }); break;
          }
        }
      }
    }

    if (allocations.length > 0) {
      await prisma.bookingAllocation.createMany({ data: allocations });
    }

    // --- AGENT WALLET SYNC ---
    // If the vendor is actually an Agent, sync this payment to their wallet
    try {
      const authUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
      const agentRes = await fetch(`${authUrl}/agents/by-name/${encodeURIComponent(parsedData.vendorName)}`, {
        headers: { 'x-tenant-id': tenantIdNumeric.toString() }
      });
      if (agentRes.ok) {
        const agentData = await agentRes.json();
        const agentId = agentData.agent.id;

        // Determine if it's a payment to agent or refund from agent based on amount
        // Wait, vendor payment amount is positive here.
        const walletAmount = -parsedData.amount; // Payment TO agent reduces their receivable balance in wallet, or increases their payout. Wait. Wallet usually tracks Balance owed to agent?
        // Wait, if they earned 100 margin, wallet balance goes +100.
        // When we pay them 20, wallet balance goes -20.
        
        await fetch(`${authUrl}/agents/${agentId}/wallet/transaction`, {
          method: 'POST',
          headers: {
            'x-tenant-id': tenantIdNumeric.toString(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: walletAmount, // Paying out reduces the balance owed to the agent
            transactionType: 'MARGIN_PAID_OUT',
            referenceId: booking.bookingReference,
            notes: `Vendor Payment via Booking. ${parsedData.notes || ''}`
          })
        });
      }
    } catch (e) {
      console.error('Failed to sync vendor payment with agent wallet', e);
    }
    // -------------------------

    res.status(201).json({ message: 'Vendor payment registered successfully', vendorPayment, allocationsCount: allocations.length });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return res.status(400).json({ error: 'Validation failed', message: messages });
    }
    console.error('Add Vendor Payment Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error?.message || 'Unknown error' });
  }
});

// Add Accommodation Service
const addAccommodationSchema = z.object({
  vendorName: z.string().min(1),
  hotelName: z.string().min(1),
  roomType: z.string().nullable().optional(),
  checkInDate: z.string().nullable().optional(),
  checkOutDate: z.string().nullable().optional(),
  mealType: z.string().nullable().optional(),
  reservationNumber: z.string().nullable().optional(),
  qty: z.number().default(1),
  price: z.number().default(0),
  currency: z.string().nullable().optional().default('GBP'),
  otherCurrency: z.string().nullable().optional(),
  conversionRate: z.number().nullable().optional(),
  issueDate: z.string().nullable().optional(),
  refundAmount: z.number().default(0),
  fineAmount: z.number().default(0),
  hotelConfirmationNumber: z.string().nullable().optional(),
  hotelAddress: z.string().nullable().optional(),
  lastCancellationDate: z.string().nullable().optional()
});

app.post('/:id/accommodations', requireGatewayHeaders, requirePermission(Permission.UPDATE_BOOKING), async (req: CustomRequest, res: Response) => {
  try {
    const bookingId = parseInt(req.params.id);
    const parsedData = addAccommodationSchema.parse(req.body);
    const tenantIdNumeric = parseInt(req.tenantId!);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Not Found', message: 'Booking does not exist' });
    }

    if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
    }

    if (booking.isLocked && req.userRole === Role.AGENT) {
      return res.status(403).json({ error: 'Forbidden', message: 'This booking is locked.' });
    }

    const accommodation = await prisma.accommodationService.create({
      data: {
        tenantId: tenantIdNumeric,
        bookingId,
        vendorName: parsedData.vendorName,
        hotelName: parsedData.hotelName,
        roomType: parsedData.roomType || null,
        checkInDate: parsedData.checkInDate ? new Date(parsedData.checkInDate) : null,
        checkOutDate: parsedData.checkOutDate ? new Date(parsedData.checkOutDate) : null,
        mealType: parsedData.mealType || null,
        reservationNumber: parsedData.reservationNumber || null,
        qty: parsedData.qty,
        price: parsedData.price,
        currency: parsedData.currency,
        otherCurrency: parsedData.otherCurrency || null,
        conversionRate: parsedData.conversionRate || null,
        issueDate: parsedData.issueDate ? new Date(parsedData.issueDate) : null,
        refundAmount: parsedData.refundAmount,
        fineAmount: parsedData.fineAmount,
        hotelConfirmationNumber: parsedData.hotelConfirmationNumber || null,
        hotelAddress: parsedData.hotelAddress || null,
        lastCancellationDate: parsedData.lastCancellationDate ? new Date(parsedData.lastCancellationDate) : null
      }
    });

    
    if (req.body.paidToVendor) {
      await prisma.bookingPayment.create({
        data: {
          tenantId: tenantIdNumeric,
          bookingId,
          amount: String(parsedData.price || 0),
          paymentMethod: 'system_auto',
          paymentType: 'Sent to Vendor',
          paidOn: new Date(),
          notes: `Auto-logged vendor payment for ${parsedData.hotelName || "Accommodation"}`
        }
      });
    }

    res.status(201).json({ message: 'Accommodation service registered successfully', accommodation });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return res.status(400).json({ error: 'Validation failed', message: messages });
    }
    console.error('Add Accommodation Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error?.message || 'Unknown error' });
  }
});

// Add Flight Service
app.post('/:id/flight-services', requireGatewayHeaders, requirePermission(Permission.UPDATE_BOOKING), async (req: CustomRequest, res: Response) => {
  try {
    const bookingId = parseInt(req.params.id);
    const tenantIdNumeric = parseInt(req.tenantId!);
    const parsedData = req.body;
    
    const flight = await prisma.flightService.create({
      data: {
        tenantId: tenantIdNumeric,
        bookingId,
        vendorName: parsedData.vendorName,
        flightNo: parsedData.flightNo,
        pnr: parsedData.pnr,
        departedFrom: parsedData.departedFrom,
        arrivedAt: parsedData.arrivedAt,
        departTime: parsedData.departTime,
        arrivalTime: parsedData.arrivalTime,
        qty: parsedData.qty ? parseInt(parsedData.qty) : 1,
        unitPrice: parseFloat(parsedData.unitPrice) || 0,
        price: Number(parsedData.price) || 0,
        currency: parsedData.currency,
        issueDate: parsedData.issueDate ? new Date(parsedData.issueDate) : null,
        refundAmount: parseFloat(parsedData.refundAmount) || 0,
        fineAmount: parseFloat(parsedData.fineAmount) || 0,
        isPaidToVendor: req.body.paidToVendor || req.body.isPaidToVendor || false,
        baggage: parsedData.baggage,
        carryOnBaggage: parsedData.carryOnBaggage,
        checkedBaggage: parsedData.checkedBaggage,
        flightClass: parsedData.flightClass,
        date: parsedData.date ? new Date(parsedData.date) : null
      }
    });
    
    if (req.body.paidToVendor) {
      await prisma.bookingPayment.create({
        data: {
          tenantId: tenantIdNumeric,
          bookingId,
          amount: String(parsedData.price || 0),
          paymentMethod: 'system_auto',
          paymentType: 'Sent to Vendor',
          paidOn: new Date(),
          notes: `Auto-logged vendor payment for Flight (${parsedData.flightNo || "Unknown"})`
        }
      });
    }

    res.status(201).json({ flight });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Add Transport Service
app.post('/:id/transport-services', requireGatewayHeaders, requirePermission(Permission.UPDATE_BOOKING), async (req: CustomRequest, res: Response) => {
  try {
    const bookingId = parseInt(req.params.id);
    const tenantIdNumeric = parseInt(req.tenantId!);
    const parsedData = req.body;
    
    const transport = await prisma.transportService.create({
      data: {
        tenantId: tenantIdNumeric,
        bookingId,
        vendorName: parsedData.vendorName,
        vehicleType: parsedData.vehicleType,
        departureDestination: parsedData.departureDestination,
        arrivalDestination: parsedData.arrivalDestination,
        departureTime: parsedData.departureTime,
        arrivalTime: parsedData.arrivalTime,
        flightNo: parsedData.flightNo,
        price: Number(parsedData.price) || 0,
        currency: parsedData.currency,
        otherCurrency: parsedData.otherCurrency,
        conversionRate: parsedData.conversionRate ? parseFloat(parsedData.conversionRate) : null,
        issueDate: parsedData.issueDate ? new Date(parsedData.issueDate) : null,
        refundAmount: parseFloat(parsedData.refundAmount) || 0,
        fineAmount: parseFloat(parsedData.fineAmount) || 0,
        isPaidToVendor: req.body.paidToVendor || req.body.isPaidToVendor || false,
        date: parsedData.date ? new Date(parsedData.date) : null
      }
    });
    
    if (req.body.paidToVendor) {
      await prisma.bookingPayment.create({
        data: {
          tenantId: tenantIdNumeric,
          bookingId,
          amount: String(parsedData.price || 0),
          paymentMethod: 'system_auto',
          paymentType: 'Sent to Vendor',
          paidOn: new Date(),
          notes: `Auto-logged vendor payment for Transport (${parsedData.vehicleType || "Vehicle"})`
        }
      });
    }

    res.status(201).json({ transport });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Add Visa Service
app.post('/:id/visa-services', requireGatewayHeaders, requirePermission(Permission.UPDATE_BOOKING), async (req: CustomRequest, res: Response) => {
  try {
    const bookingId = parseInt(req.params.id);
    const tenantIdNumeric = parseInt(req.tenantId!);
    const parsedData = req.body;
    
    const visa = await prisma.visaService.create({
      data: {
        tenantId: tenantIdNumeric,
        bookingId,
        vendorName: parsedData.vendorName,
        passportNumber: parsedData.passportNumber,
        visaType: parsedData.visaType,
        visaNumber: parsedData.visaNumber,
        issueDate: parsedData.issueDate ? new Date(parsedData.issueDate) : null,
        expiryDate: parsedData.expiryDate ? new Date(parsedData.expiryDate) : null,
        qty: parsedData.qty ? parseInt(parsedData.qty) : 1,
        unitPrice: parseFloat(parsedData.unitPrice) || 0,
        price: Number(parsedData.price) || 0,
        currency: parsedData.currency,
        otherCurrency: parsedData.otherCurrency,
        conversionRate: parsedData.conversionRate ? parseFloat(parsedData.conversionRate) : null,
        refundAmount: parseFloat(parsedData.refundAmount) || 0,
        fineAmount: parseFloat(parsedData.fineAmount) || 0,
        isPaidToVendor: req.body.paidToVendor || req.body.isPaidToVendor || false
      }
    });
    
    if (req.body.paidToVendor) {
      await prisma.bookingPayment.create({
        data: {
          tenantId: tenantIdNumeric,
          bookingId,
          amount: String(parsedData.price || 0),
          paymentMethod: 'system_auto',
          paymentType: 'Sent to Vendor',
          paidOn: new Date(),
          notes: `Auto-logged vendor payment for Visa (${parsedData.visaType || "Application"})`
        }
      });
    }

    res.status(201).json({ visa });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Add Discount to Booking
app.post('/:id/discounts', requireGatewayHeaders, requirePermission(Permission.CREATE_TRANSACTION), async (req: CustomRequest, res: Response) => {
  try {
    const bookingId = parseInt(req.params.id);
    const tenantIdNumeric = parseInt(req.tenantId!);
    const { vendorCategory, serviceName, amount, notes, date } = req.body;

    if (!vendorCategory || !amount || !date) {
      return res.status(400).json({ error: 'Validation failed', message: 'vendorCategory, amount, and date are required' });
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ error: 'Not Found', message: 'Booking does not exist' });
    if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
    }

    if (booking.isLocked && req.userRole === Role.AGENT) {
      return res.status(403).json({ error: 'Forbidden', message: 'This booking is locked.' });
    }

    const discount = await (prisma as any).bookingDiscount.create({
      data: {
        tenantId: tenantIdNumeric,
        bookingId,
        vendorCategory,
        serviceName: serviceName || null,
        amount: parseFloat(amount),
        notes: notes || null,
        date: new Date(date)
      }
    });

    // Ledger Integration
    const customerName = booking.agentName || 'Direct Client';
    let customerAccount = await prisma.ledgerAccount.findFirst({
      where: { tenantId: tenantIdNumeric, accountType: 'CUSTOMER_RECEIVABLE', entityName: customerName }
    });
    if (!customerAccount) {
      customerAccount = await prisma.ledgerAccount.create({
        data: { tenantId: tenantIdNumeric, accountType: 'CUSTOMER_RECEIVABLE', entityName: customerName }
      });
    }

    const tx = await prisma.ledgerTransaction.create({
      data: {
        tenantId: tenantIdNumeric,
        transactionDate: new Date(date),
        referenceNumber: booking.bookingReference,
        description: `Discount applied to ${vendorCategory} - ${serviceName || ''}. ${notes || ''}`,
        type: 'DISCOUNT'
      }
    });

    await prisma.ledgerEntry.create({
      data: { transactionId: tx.id, accountId: customerAccount.id, debitAmount: 0, creditAmount: parseFloat(amount) }
    });
    await prisma.ledgerAccount.update({
      where: { id: customerAccount.id },
      data: { balance: { decrement: parseFloat(amount) } }
    });

    res.status(201).json({ message: 'Discount added successfully', discount });
  } catch (error) {
    console.error('Add Discount Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Add Refund to Booking
app.post('/:id/refunds', requireGatewayHeaders, requirePermission(Permission.CREATE_TRANSACTION), async (req: CustomRequest, res: Response) => {
  try {
    const bookingId = parseInt(req.params.id);
    const tenantIdNumeric = parseInt(req.tenantId!);
    const { direction, vendorCategory, serviceName, amount, notes, date } = req.body;

    if (!direction || !vendorCategory || !amount || !date) {
      return res.status(400).json({ error: 'Validation failed', message: 'direction, vendorCategory, amount, and date are required' });
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ error: 'Not Found', message: 'Booking does not exist' });
    if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
    }

    if (booking.isLocked && req.userRole === Role.AGENT) {
      return res.status(403).json({ error: 'Forbidden', message: 'This booking is locked.' });
    }

    const refund = await (prisma as any).bookingRefund.create({
      data: {
        tenantId: tenantIdNumeric,
        bookingId,
        direction,
        vendorCategory,
        serviceName: serviceName || null,
        amount: parseFloat(amount),
        notes: notes || null,
        date: new Date(date)
      }
    });

    // Ledger Integration
    const tx = await prisma.ledgerTransaction.create({
      data: {
        tenantId: tenantIdNumeric,
        transactionDate: new Date(date),
        referenceNumber: booking.bookingReference,
        description: `${direction} for ${vendorCategory} - ${serviceName || ''}. ${notes || ''}`,
        type: 'REFUND'
      }
    });

    if (direction === 'Refund to Client') {
      const customerName = booking.agentName || 'Direct Client';
      let customerAccount = await prisma.ledgerAccount.findFirst({
        where: { tenantId: tenantIdNumeric, accountType: 'CUSTOMER_RECEIVABLE', entityName: customerName }
      });
      if (!customerAccount) {
        customerAccount = await prisma.ledgerAccount.create({
          data: { tenantId: tenantIdNumeric, accountType: 'CUSTOMER_RECEIVABLE', entityName: customerName }
        });
      }
      await prisma.ledgerEntry.create({
        data: { transactionId: tx.id, accountId: customerAccount.id, debitAmount: parseFloat(amount), creditAmount: 0 }
      });
      await prisma.ledgerAccount.update({
        where: { id: customerAccount.id },
        data: { balance: { increment: parseFloat(amount) } }
      });
    } else {
      let vendorAccount = await prisma.ledgerAccount.findFirst({
        where: { tenantId: tenantIdNumeric, accountType: 'VENDOR_PAYABLE', entityName: vendorCategory }
      });
      if (!vendorAccount) {
        vendorAccount = await prisma.ledgerAccount.create({
          data: { tenantId: tenantIdNumeric, accountType: 'VENDOR_PAYABLE', entityName: vendorCategory }
        });
      }
      await prisma.ledgerEntry.create({
        data: { transactionId: tx.id, accountId: vendorAccount.id, debitAmount: 0, creditAmount: parseFloat(amount) }
      });
      await prisma.ledgerAccount.update({
        where: { id: vendorAccount.id },
        data: { balance: { increment: parseFloat(amount) } }
      });

      // --- AGENT WALLET SYNC FOR REFUNDS ---
      try {
        const authUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
        const agentRes = await fetch(`${authUrl}/agents/by-name/${encodeURIComponent(vendorCategory)}`, {
          headers: { 'x-tenant-id': tenantIdNumeric.toString() }
        });
        if (agentRes.ok) {
          const agentData = await agentRes.json();
          const agentId = agentData.agent.id;

          await fetch(`${authUrl}/agents/${agentId}/wallet/transaction`, {
            method: 'POST',
            headers: {
              'x-tenant-id': tenantIdNumeric.toString(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              amount: parseFloat(amount), // Refund from agent reverses the payout
              transactionType: 'REFUND_FROM_AGENT',
              referenceId: booking.bookingReference,
              notes: `Refund from Vendor via Booking. ${notes || ''}`
            })
          });
        }
      } catch (e) {
        console.error('Failed to sync vendor refund with agent wallet', e);
      }
      // -------------------------------------
    }

    res.status(201).json({ message: 'Refund logged successfully', refund });
  } catch (error) {
    console.error('Add Refund Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Add Additional Service
app.post('/:id/additional-services', requireGatewayHeaders, requirePermission(Permission.UPDATE_BOOKING), async (req: CustomRequest, res: Response) => {
  try {
    const bookingId = parseInt(req.params.id);
    const tenantIdNumeric = parseInt(req.tenantId!);
    const { serviceName, charges, notes, vendorName } = req.body;

    if (!serviceName) {
      return res.status(400).json({ error: 'Validation failed', message: 'serviceName is required' });
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ error: 'Not Found', message: 'Booking does not exist' });
    if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
    }

    if (booking.isLocked && req.userRole === Role.AGENT) {
      return res.status(403).json({ error: 'Forbidden', message: 'This booking is locked.' });
    }

    const additionalService = await (prisma as any).additionalService.create({
      data: {
        tenantId: tenantIdNumeric,
        bookingId,
        serviceName,
        vendorName: vendorName || null,
        charges: parseFloat(charges) || 0,
        notes: notes || null
      }
    });

    // Update total price of the booking
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        totalPrice: {
          increment: parseFloat(charges) || 0
        }
      }
    });

    res.status(201).json({ message: 'Additional Service logged successfully', additionalService });
  } catch (error) {
    console.error('Add Additional Service Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



// --- EDIT (PATCH) ENDPOINTS ---

// Edit Accommodation
app.patch('/:id/accommodations/:serviceId', requireGatewayHeaders, requirePermission(Permission.UPDATE_BOOKING), async (req, res) => {
  try {
    const serviceId = parseInt(req.params.serviceId);
    const parsedData = req.body;
    

    
    const updateData: any = {};
    if (parsedData.vendorName !== undefined) updateData.vendorName = parsedData.vendorName;
    if (parsedData.hotelName !== undefined) updateData.hotelName = parsedData.hotelName;
    if (parsedData.city !== undefined) updateData.city = parsedData.city || null;
    if (parsedData.roomType !== undefined) updateData.roomType = parsedData.roomType || null;
    if (parsedData.checkInDate !== undefined) updateData.checkInDate = parsedData.checkInDate ? new Date(parsedData.checkInDate) : null;
    if (parsedData.checkOutDate !== undefined) updateData.checkOutDate = parsedData.checkOutDate ? new Date(parsedData.checkOutDate) : null;
    if (parsedData.mealType !== undefined) updateData.mealType = parsedData.mealType || null;
    if (parsedData.reservationNumber !== undefined) updateData.reservationNumber = parsedData.reservationNumber || null;
    if (parsedData.qty !== undefined) updateData.qty = parsedData.qty ? parseInt(parsedData.qty) : 1;
    if (parsedData.price !== undefined) updateData.price = parseFloat(parsedData.price) || 0;
    if (parsedData.currency !== undefined) updateData.currency = parsedData.currency;
    if (parsedData.otherCurrency !== undefined) updateData.otherCurrency = parsedData.otherCurrency || null;
    if (parsedData.conversionRate !== undefined) updateData.conversionRate = parsedData.conversionRate ? parseFloat(parsedData.conversionRate) : null;
    if (parsedData.issueDate !== undefined) updateData.issueDate = parsedData.issueDate ? new Date(parsedData.issueDate) : null;
    if (parsedData.refundAmount !== undefined) updateData.refundAmount = parseFloat(parsedData.refundAmount) || 0;
    if (parsedData.fineAmount !== undefined) updateData.fineAmount = parseFloat(parsedData.fineAmount) || 0;
    if (parsedData.hotelConfirmationNumber !== undefined) updateData.hotelConfirmationNumber = parsedData.hotelConfirmationNumber || null;
    if (parsedData.hotelAddress !== undefined) updateData.hotelAddress = parsedData.hotelAddress || null;
    if (parsedData.lastCancellationDate !== undefined) updateData.lastCancellationDate = parsedData.lastCancellationDate ? new Date(parsedData.lastCancellationDate) : null;
    if (parsedData.paidToVendor !== undefined) updateData.isPaidToVendor = parsedData.paidToVendor;
    if (parsedData.isPaidToVendor !== undefined) updateData.isPaidToVendor = parsedData.isPaidToVendor;

    const updated = await (prisma as any).accommodationService.update({
      where: { id: serviceId },
      data: updateData
    });
    res.json({ accommodation: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Edit Flight
app.patch('/:id/flight-services/:serviceId', requireGatewayHeaders, requirePermission(Permission.UPDATE_BOOKING), async (req, res) => {
  try {
    const serviceId = parseInt(req.params.serviceId);
    const parsedData = req.body;
    


    const updateData: any = {};
    if (parsedData.vendorName !== undefined) updateData.vendorName = parsedData.vendorName;
    if (parsedData.flightNo !== undefined) updateData.flightNo = parsedData.flightNo;
    if (parsedData.pnr !== undefined) updateData.pnr = parsedData.pnr;
    if (parsedData.departedFrom !== undefined) updateData.departedFrom = parsedData.departedFrom;
    if (parsedData.arrivedAt !== undefined) updateData.arrivedAt = parsedData.arrivedAt;
    if (parsedData.departTime !== undefined) updateData.departTime = parsedData.departTime;
    if (parsedData.arrivalTime !== undefined) updateData.arrivalTime = parsedData.arrivalTime;
    if (parsedData.price !== undefined) updateData.price = parseFloat(parsedData.price) || 0;
    if (parsedData.currency !== undefined) updateData.currency = parsedData.currency;
    if (parsedData.issueDate !== undefined) updateData.issueDate = parsedData.issueDate ? new Date(parsedData.issueDate) : null;
    if (parsedData.refundAmount !== undefined) updateData.refundAmount = parseFloat(parsedData.refundAmount) || 0;
    if (parsedData.fineAmount !== undefined) updateData.fineAmount = parseFloat(parsedData.fineAmount) || 0;
    if (parsedData.baggage !== undefined) updateData.baggage = parsedData.baggage;
    if (parsedData.carryOnBaggage !== undefined) updateData.carryOnBaggage = parsedData.carryOnBaggage;
    if (parsedData.checkedBaggage !== undefined) updateData.checkedBaggage = parsedData.checkedBaggage;
    if (parsedData.flightClass !== undefined) updateData.flightClass = parsedData.flightClass;
    if (parsedData.date !== undefined) updateData.date = parsedData.date ? new Date(parsedData.date) : null;
    if (parsedData.paidToVendor !== undefined) updateData.isPaidToVendor = parsedData.paidToVendor;
    if (parsedData.isPaidToVendor !== undefined) updateData.isPaidToVendor = parsedData.isPaidToVendor;

    const updated = await (prisma as any).flightService.update({
      where: { id: serviceId },
      data: updateData
    });
    res.json({ flight: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Edit Transport
app.patch('/:id/transport-services/:serviceId', requireGatewayHeaders, requirePermission(Permission.UPDATE_BOOKING), async (req, res) => {
  try {
    const serviceId = parseInt(req.params.serviceId);
    const parsedData = req.body;
    


    const updateData: any = {};
    if (parsedData.vendorName !== undefined) updateData.vendorName = parsedData.vendorName;
    if (parsedData.vehicleType !== undefined) updateData.vehicleType = parsedData.vehicleType;
    if (parsedData.departureDestination !== undefined) updateData.departureDestination = parsedData.departureDestination;
    if (parsedData.arrivalDestination !== undefined) updateData.arrivalDestination = parsedData.arrivalDestination;
    if (parsedData.departureTime !== undefined) updateData.departureTime = parsedData.departureTime;
    if (parsedData.arrivalTime !== undefined) updateData.arrivalTime = parsedData.arrivalTime;
    if (parsedData.flightNo !== undefined) updateData.flightNo = parsedData.flightNo;
    if (parsedData.price !== undefined) updateData.price = parseFloat(parsedData.price) || 0;
    if (parsedData.currency !== undefined) updateData.currency = parsedData.currency;
    if (parsedData.otherCurrency !== undefined) updateData.otherCurrency = parsedData.otherCurrency;
    if (parsedData.conversionRate !== undefined) updateData.conversionRate = parsedData.conversionRate ? parseFloat(parsedData.conversionRate) : null;
    if (parsedData.issueDate !== undefined) updateData.issueDate = parsedData.issueDate ? new Date(parsedData.issueDate) : null;
    if (parsedData.refundAmount !== undefined) updateData.refundAmount = parseFloat(parsedData.refundAmount) || 0;
    if (parsedData.fineAmount !== undefined) updateData.fineAmount = parseFloat(parsedData.fineAmount) || 0;
    if (parsedData.date !== undefined) updateData.date = parsedData.date ? new Date(parsedData.date) : null;
    if (parsedData.paidToVendor !== undefined) updateData.isPaidToVendor = parsedData.paidToVendor;
    if (parsedData.isPaidToVendor !== undefined) updateData.isPaidToVendor = parsedData.isPaidToVendor;

    const updated = await (prisma as any).transportService.update({
      where: { id: serviceId },
      data: updateData
    });
    res.json({ transport: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Edit Visa
app.patch('/:id/visa-services/:serviceId', requireGatewayHeaders, requirePermission(Permission.UPDATE_BOOKING), async (req, res) => {
  try {
    const serviceId = parseInt(req.params.serviceId);
    const parsedData = req.body;
    


    const updateData: any = {};
    if (parsedData.vendorName !== undefined) updateData.vendorName = parsedData.vendorName;
    if (parsedData.passportNumber !== undefined) updateData.passportNumber = parsedData.passportNumber;
    if (parsedData.visaType !== undefined) updateData.visaType = parsedData.visaType;
    if (parsedData.visaNumber !== undefined) updateData.visaNumber = parsedData.visaNumber;
    if (parsedData.issueDate !== undefined) updateData.issueDate = parsedData.issueDate ? new Date(parsedData.issueDate) : null;
    if (parsedData.expiryDate !== undefined) updateData.expiryDate = parsedData.expiryDate ? new Date(parsedData.expiryDate) : null;
    if (parsedData.price !== undefined) updateData.price = parseFloat(parsedData.price) || 0;
    if (parsedData.currency !== undefined) updateData.currency = parsedData.currency;
    if (parsedData.otherCurrency !== undefined) updateData.otherCurrency = parsedData.otherCurrency;
    if (parsedData.conversionRate !== undefined) updateData.conversionRate = parsedData.conversionRate ? parseFloat(parsedData.conversionRate) : null;
    if (parsedData.refundAmount !== undefined) updateData.refundAmount = parseFloat(parsedData.refundAmount) || 0;
    if (parsedData.fineAmount !== undefined) updateData.fineAmount = parseFloat(parsedData.fineAmount) || 0;
    if (parsedData.paidToVendor !== undefined) updateData.isPaidToVendor = parsedData.paidToVendor;
    if (parsedData.isPaidToVendor !== undefined) updateData.isPaidToVendor = parsedData.isPaidToVendor;

    const updated = await (prisma as any).visaService.update({
      where: { id: serviceId },
      data: updateData
    });
    res.json({ visa: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Edit Additional Service
app.patch('/:id/additional-services/:serviceId', requireGatewayHeaders, requirePermission(Permission.UPDATE_BOOKING), async (req, res) => {
  try {
    const serviceId = parseInt(req.params.serviceId);
    const parsedData = req.body;
    


    const updateData: any = {};
    if (parsedData.serviceName !== undefined) updateData.serviceName = parsedData.serviceName;
    if (parsedData.vendorName !== undefined) updateData.vendorName = parsedData.vendorName || null;
    if (parsedData.charges !== undefined) updateData.charges = parseFloat(parsedData.charges) || 0;
    if (parsedData.notes !== undefined) updateData.notes = parsedData.notes || null;
    if (parsedData.paidToVendor !== undefined) updateData.isPaidToVendor = parsedData.paidToVendor;
    if (parsedData.isPaidToVendor !== undefined) updateData.isPaidToVendor = parsedData.isPaidToVendor;

    const updated = await (prisma as any).additionalService.update({
      where: { id: serviceId },
      data: updateData
    });
    res.json({ additionalService: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Edit Passenger
app.patch('/:id/passengers/:passengerId', requireGatewayHeaders, requirePermission(Permission.UPDATE_BOOKING), async (req, res) => {
  try {
    const passengerId = parseInt(req.params.passengerId);
    const parsedData = req.body;
    
    const updated = await prisma.bookingCustomer.update({
      where: { id: passengerId },
      data: {
        ageCategory: parsedData.type || parsedData.ageCategory,
        title: parsedData.title,
        firstName: parsedData.firstName,
        lastName: parsedData.lastName,
        passportNumber: parsedData.passportNumber,
        passportExpiryDate: parsedData.passportExpiryDate ? new Date(parsedData.passportExpiryDate) : null,
        email: parsedData.email || null,
        phoneNumber: parsedData.phoneNumber || null,
        role: parsedData.role || null
      }
    });
    res.json({ passenger: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// PATCH /:id/payments/:serviceId
app.patch('/:id/payments/:serviceId', requireGatewayHeaders, requirePermission(Permission.UPDATE_TRANSACTION), async (req, res) => {
  try {
    const updated = await prisma.bookingPayment.update({
      where: { id: parseInt(req.params.serviceId) },
      data: req.body
    });
    res.json({ payment: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update payment', message: err.message });
  }
});

// PATCH /:id/vendor-payments/:serviceId
app.patch('/:id/vendor-payments/:serviceId', requireGatewayHeaders, requirePermission(Permission.UPDATE_TRANSACTION), async (req, res) => {
  try {
    const updated = await prisma.vendorPayment.update({
      where: { id: parseInt(req.params.serviceId) },
      data: req.body
    });
    res.json({ vendorPayment: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update vendor payment', message: err.message });
  }
});

// Generic Delete Route
app.delete('/:bookingId/services/:serviceType/:id', requireGatewayHeaders, requirePermission(Permission.UPDATE_BOOKING), async (req: CustomRequest, res: Response) => {
  try {
    const bookingId = parseInt(req.params.bookingId);
    const serviceId = parseInt(req.params.id);
    const { serviceType } = req.params;
    const tenantIdNumeric = parseInt(req.tenantId!);

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ error: 'Not Found' });
    if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) return res.status(403).json({ error: 'Forbidden' });

    if (booking.isLocked && req.userRole === Role.AGENT) {
      return res.status(403).json({ error: 'Forbidden', message: 'This booking is locked.' });
    }

    // Strict Permission check for financial deletions
    if (['payment', 'vendor-payment'].includes(serviceType)) {
      const userRole = req.headers['x-user-role'] as string;
      if (!req.isPlatformAdmin && userRole !== Role.MAIN_COMPANY_ADMIN && userRole !== Role.COMPANY_ADMIN && userRole !== Role.ADMIN) {
        return res.status(403).json({ error: 'Forbidden', message: 'You lack the DELETE_TRANSACTION permission required to delete financial records.' });
      }
    }

    switch(serviceType) {
      case 'accommodation': await prisma.accommodationService.delete({ where: { id: serviceId } }); break;
      case 'flight': await prisma.flightService.delete({ where: { id: serviceId } }); break;
      case 'transport': await prisma.transportService.delete({ where: { id: serviceId } }); break;
      case 'visa': await prisma.visaService.delete({ where: { id: serviceId } }); break;
      case 'additional': await prisma.additionalService.delete({ where: { id: serviceId } }); break;
      case 'passenger': await prisma.bookingCustomer.delete({ where: { id: serviceId } }); break;
      case 'payment': await prisma.bookingPayment.delete({ where: { id: serviceId } }); break;
      case 'vendor-payment': await prisma.vendorPayment.delete({ where: { id: serviceId } }); break;
      default: return res.status(400).json({ error: 'Invalid service type' });
    }

    res.status(200).json({ message: 'Deleted successfully' });
  } catch(error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



// ─── LEDGER & FINANCE SYSTEM ───────────────────────────────────────────────────

app.get('/finance/vendors/unpaid-bookings', requireGatewayHeaders, async (req: CustomRequest, res: Response) => {
  try {
    const tenantId = parseInt(req.tenantId!);
    const vendorName = req.query.vendorName as string;

    if (!vendorName) {
      return res.status(400).json({ error: 'vendorName query parameter is required' });
    }

    // Helper to fetch unpaid services for this vendor
    const fetchServices = async (model: any) => {
      return await model.findMany({
        where: { tenantId, vendorName, isPaidToVendor: false },
        orderBy: { createdAt: 'asc' },
        include: {
          booking: {
            select: {
              id: true,
              bookingReference: true,
              totalPrice: true
            }
          }
        }
      });
    };

    const flights = await fetchServices(prisma.flightService);
    const hotels = await fetchServices(prisma.accommodationService);
    const transports = await fetchServices(prisma.transportService);
    const visas = await fetchServices(prisma.visaService);
    const additionals = await fetchServices(prisma.additionalService);

    const allServicesRaw = [
      ...flights.map((s: any) => ({ ...s, serviceType: 'FLIGHT', category: 'Flights', desc: `Flight ${s.flightNo} (${s.pnr})` })),
      ...hotels.map((s: any) => ({ ...s, serviceType: 'HOTEL', category: 'Hotels', desc: `Hotel ${s.hotelName} (${s.roomType || 'Standard'})` })),
      ...transports.map((s: any) => ({ ...s, serviceType: 'TRANSPORT', category: 'Transportation', desc: `Transport ${s.vehicleType} - ${s.departureDestination} to ${s.arrivalDestination}` })),
      ...visas.map((s: any) => ({ ...s, serviceType: 'VISA', category: 'Visas', desc: `${s.visaType} Visa` })),
      ...additionals.map((s: any) => ({ ...s, serviceType: 'ADDITIONAL', category: 'Special Services', desc: s.serviceName }))
    ];

    const flightIds = flights.map((s: any) => s.id);
    const hotelIds = hotels.map((s: any) => s.id);
    const transportIds = transports.map((s: any) => s.id);
    const visaIds = visas.map((s: any) => s.id);
    const additionalIds = additionals.map((s: any) => s.id);

    const allocations = await prisma.bookingAllocation.findMany({
      where: {
        tenantId,
        OR: [
          { serviceType: 'FLIGHT', serviceId: { in: flightIds } },
          { serviceType: 'HOTEL', serviceId: { in: hotelIds } },
          { serviceType: 'TRANSPORT', serviceId: { in: transportIds } },
          { serviceType: 'VISA', serviceId: { in: visaIds } },
          { serviceType: 'ADDITIONAL', serviceId: { in: additionalIds } }
        ]
      }
    });

    const allocMap: Record<string, number> = {};
    for (const alloc of allocations) {
      const key = `${alloc.serviceType}_${alloc.serviceId}`;
      allocMap[key] = (allocMap[key] || 0) + parseFloat(alloc.allocatedAmount.toString());
    }

    const services = [];
    const uniqueBookingsMap = new Map();

    for (const s of allServicesRaw) {
      const key = `${s.serviceType}_${s.id}`;
      const allocated = allocMap[key] || 0;
      const totalCost = parseFloat((s.price || s.charges || 0).toString());
      const pendingAmount = Math.max(0, totalCost - allocated);

      if (pendingAmount > 0 && s.booking) {
        services.push({
          id: s.id,
          bookingId: s.bookingId,
          bookingRef: s.booking.bookingReference,
          serviceCategory: s.category,
          serviceType: s.serviceType,
          description: s.desc,
          pendingAmount
        });

        uniqueBookingsMap.set(s.booking.id, {
          id: s.booking.id,
          bookingReference: s.booking.bookingReference,
          totalPrice: parseFloat(s.booking.totalPrice.toString())
        });
      }
    }

    // Fetch VENDOR_PAYABLE ledger balance for this vendor
    const account = await prisma.ledgerAccount.findFirst({
      where: { tenantId, accountType: 'VENDOR_PAYABLE', entityName: vendorName }
    });

    let walletBalance = 0;
    if (account && parseFloat(account.balance.toString()) < 0) {
      walletBalance = Math.abs(parseFloat(account.balance.toString()));
    }

    res.status(200).json({
      bookings: Array.from(uniqueBookingsMap.values()),
      services,
      walletBalance
    });
  } catch (error: any) {
    console.error('Fetch Vendor Unpaid Bookings Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

app.get('/finance/vendors/wallets', requireGatewayHeaders, async (req: CustomRequest, res: Response) => {
  try {
    const tenantId = parseInt(req.tenantId!);
    const authUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:4001';

    let dbVendors: any[] = [];
    try {
      const vendorsRes = await fetch(`${authUrl}/vendors`, {
        headers: {
          'x-tenant-id': String(tenantId),
          'x-user-id': req.headers['x-user-id'] as string || '',
          'x-user-role': req.headers['x-user-role'] as string || ''
        }
      });
      if (vendorsRes.ok) {
        const data = await vendorsRes.json();
        dbVendors = data.vendors || [];
      }
    } catch (err: any) {
      console.error('Failed to fetch vendors from auth-service in wallets route:', err);
    }

    const accounts = await prisma.ledgerAccount.findMany({
      where: {
        tenantId,
        accountType: 'VENDOR_PAYABLE'
      }
    });

    const accountMap = new Map<string, any>();
    for (const acc of accounts) {
      if (acc.entityName) {
        accountMap.set(acc.entityName.toLowerCase().trim(), acc);
      }
    }

    const walletsMap = new Map<string, any>();

    for (const v of dbVendors) {
      const vNameKey = v.name.toLowerCase().trim();
      const acc = accountMap.get(vNameKey);
      const ledgerBalance = acc ? parseFloat(acc.balance.toString()) : 0.00;
      const walletBalance = ledgerBalance < 0 ? Math.abs(ledgerBalance) : 0.00;

      walletsMap.set(vNameKey, {
        id: v.id,
        vendorName: v.name,
        ledgerBalance,
        walletBalance
      });
    }

    for (const acc of accounts) {
      if (acc.entityName) {
        const vNameKey = acc.entityName.toLowerCase().trim();
        if (!walletsMap.has(vNameKey)) {
          const ledgerBalance = parseFloat(acc.balance.toString());
          const walletBalance = ledgerBalance < 0 ? Math.abs(ledgerBalance) : 0.00;
          walletsMap.set(vNameKey, {
            id: acc.id,
            vendorName: acc.entityName,
            ledgerBalance,
            walletBalance
          });
        }
      }
    }

    const wallets = Array.from(walletsMap.values());
    res.status(200).json({ wallets });
  } catch (error: any) {
    console.error('Fetch Vendor Wallets Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

app.post('/ledger/vendor-payment', requireGatewayHeaders, requirePermission(Permission.CREATE_TRANSACTION), async (req: CustomRequest, res: Response) => {
  try {
    const tenantId = parseInt(req.tenantId!);
    const { vendorName, amount, paymentMethod, paidOn, notes, allocations: manualAllocations, walletCreditUsed = 0 } = req.body;
    
    const cashAmount = parseFloat(amount) || 0;
    const creditUsedAmount = parseFloat(walletCreditUsed) || 0;
    let remainingAmount = cashAmount + creditUsedAmount;

    if (!vendorName || remainingAmount <= 0) {
      return res.status(400).json({ error: 'Invalid input parameters' });
    }

    // Find or create Vendor LedgerAccount
    let account = await prisma.ledgerAccount.findFirst({
      where: { tenantId, accountType: 'VENDOR_PAYABLE', entityName: vendorName }
    });
    if (!account) {
      account = await prisma.ledgerAccount.create({
        data: { tenantId, accountType: 'VENDOR_PAYABLE', entityName: vendorName }
      });
    }

    const allocations: any[] = [];

    // Process manual allocations
    if (manualAllocations && Array.isArray(manualAllocations) && manualAllocations.length > 0) {
      for (const alloc of manualAllocations) {
        const { bookingId, serviceId, serviceType, amountApplied } = alloc;
        const parsedAmount = parseFloat(amountApplied);
        if (isNaN(parsedAmount) || parsedAmount <= 0) continue;

        let serviceModel;
        switch(serviceType) {
          case 'FLIGHT': serviceModel = prisma.flightService; break;
          case 'HOTEL': serviceModel = prisma.accommodationService; break;
          case 'TRANSPORT': serviceModel = prisma.transportService; break;
          case 'VISA': serviceModel = prisma.visaService; break;
          case 'ADDITIONAL': serviceModel = prisma.additionalService; break;
          default: continue;
        }

        const service = await (serviceModel as any).findUnique({
          where: { id: serviceId }
        });

        if (!service || service.tenantId !== tenantId) continue;

        allocations.push({
          tenantId,
          bookingId,
          serviceType,
          serviceId,
          allocatedAmount: parsedAmount
        });

        // Mark as paid if settled
        const previousAllocations = await prisma.bookingAllocation.aggregate({
          where: { tenantId, serviceType, serviceId },
          _sum: { allocatedAmount: true }
        });
        
        const totalCost = parseFloat(service.price || service.charges || 0);
        const alreadyAllocated = parseFloat(previousAllocations?._sum?.allocatedAmount as any) || 0;
        const serviceRemainingDue = totalCost - alreadyAllocated;

        if (parsedAmount >= serviceRemainingDue) {
          await (serviceModel as any).update({
            where: { id: serviceId },
            data: { isPaidToVendor: true }
          });
        }
      }
    } else {
      // FIFO Fallback
      const fetchServices = async (model: any, type: string) => {
        const svcs = await model.findMany({
          where: { tenantId, vendorName, isPaidToVendor: false },
          orderBy: { createdAt: 'asc' },
          include: { booking: true }
        });
        return svcs.map((s: any) => ({ ...s, serviceType: type }));
      };

      const flights = await fetchServices(prisma.flightService, 'FLIGHT');
      const hotels = await fetchServices(prisma.accommodationService, 'HOTEL');
      const transports = await fetchServices(prisma.transportService, 'TRANSPORT');
      const visas = await fetchServices(prisma.visaService, 'VISA');
      const additionals = await fetchServices(prisma.additionalService, 'ADDITIONAL');

      let allUnpaid = [...flights, ...hotels, ...transports, ...visas, ...additionals].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      let tempRemaining = remainingAmount;
      for (const service of allUnpaid) {
        if (tempRemaining <= 0) break;

        const previousAllocations = await prisma.bookingAllocation.aggregate({
          where: { tenantId, serviceType: service.serviceType, serviceId: service.id },
          _sum: { allocatedAmount: true }
        });
        
        const totalCost = parseFloat(service.price || service.charges || 0);
        const alreadyAllocated = parseFloat(previousAllocations?._sum?.allocatedAmount as any) || 0;
        const serviceRemainingDue = totalCost - alreadyAllocated;

        if (serviceRemainingDue > 0) {
          const allocateAmt = Math.min(serviceRemainingDue, tempRemaining);
          allocations.push({
            tenantId,
            bookingId: service.bookingId,
            serviceType: service.serviceType,
            serviceId: service.id,
            allocatedAmount: allocateAmt
          });
          tempRemaining -= allocateAmt;

          if (allocateAmt >= serviceRemainingDue) {
            const updateData = { isPaidToVendor: true };
            switch(service.serviceType) {
              case 'FLIGHT': await prisma.flightService.update({ where: { id: service.id }, data: updateData }); break;
              case 'HOTEL': await prisma.accommodationService.update({ where: { id: service.id }, data: updateData }); break;
              case 'TRANSPORT': await prisma.transportService.update({ where: { id: service.id }, data: updateData }); break;
              case 'VISA': await prisma.visaService.update({ where: { id: service.id }, data: updateData }); break;
              case 'ADDITIONAL': await prisma.additionalService.update({ where: { id: service.id }, data: updateData }); break;
            }
          }
        }
      }
    }

    const totalAllocation = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
    const allocatedCash = Math.max(0, totalAllocation - creditUsedAmount);
    const overpaidAmount = Math.max(0, cashAmount - allocatedCash);

    // Get unique booking references for allocation description
    const uniqueBookingIds = Array.from(new Set(allocations.map(a => a.bookingId)));
    const bookings = await prisma.booking.findMany({
      where: { id: { in: uniqueBookingIds } },
      select: { id: true, bookingReference: true }
    });
    const bookingRefMap = new Map<number, string>();
    for (const b of bookings) {
      bookingRefMap.set(b.id, b.bookingReference);
    }
    const uniqueBookingRefs = Array.from(new Set(bookings.map(b => b.bookingReference)));
    const bookingRefsStr = uniqueBookingRefs.join(', ');

    let mainTxId: number | null = null;

    // 1. Credit Used Drawdown Transaction (if any)
    if (creditUsedAmount > 0) {
      const creditTx = await prisma.ledgerTransaction.create({
        data: {
          tenantId,
          transactionDate: paidOn ? new Date(paidOn) : new Date(),
          description: `Wallet credit drawdown applied to bookings. Allocated to ${allocations.length} service(s) on booking(s): ${bookingRefsStr}`,
          type: 'PAYMENT',
          referenceNumber: bookingRefsStr || null
        }
      });
      await prisma.ledgerEntry.create({
        data: {
          transactionId: creditTx.id,
          accountId: account.id,
          debitAmount: 0,
          creditAmount: creditUsedAmount
        }
      });
    }

    // 2. Allocated Cash Transaction
    if (allocatedCash > 0) {
      const notesSuffix = creditUsedAmount > 0 ? ` (£${creditUsedAmount.toFixed(2)} applied from Vendor Wallet)` : '';
      const cashTx = await prisma.ledgerTransaction.create({
        data: {
          tenantId,
          transactionDate: paidOn ? new Date(paidOn) : new Date(),
          description: `Bulk payment to vendor ${vendorName}. Allocated to ${allocations.length} service(s) on booking(s): ${bookingRefsStr}.${notesSuffix} ${notes || ''}`,
          type: 'PAYMENT',
          referenceNumber: bookingRefsStr || null
        }
      });
      mainTxId = cashTx.id;

      await prisma.ledgerEntry.create({
        data: {
          transactionId: cashTx.id,
          accountId: account.id,
          debitAmount: allocatedCash,
          creditAmount: 0
        }
      });
    }

    // 3. Overpaid Cash Transaction
    if (overpaidAmount > 0) {
      const overTx = await prisma.ledgerTransaction.create({
        data: {
          tenantId,
          transactionDate: paidOn ? new Date(paidOn) : new Date(),
          description: `Overpayment hold for future use (Vendor Wallet credit) for ${vendorName}. ${notes || ''}`,
          type: 'PAYMENT',
          referenceNumber: bookingRefsStr || null
        }
      });
      if (!mainTxId) mainTxId = overTx.id;

      await prisma.ledgerEntry.create({
        data: {
          transactionId: overTx.id,
          accountId: account.id,
          debitAmount: overpaidAmount,
          creditAmount: 0
        }
      });
    }

    // If completely unallocated and no cash was paid (only credit used, which is rare/weird, or 0 transaction)
    if (!mainTxId && cashAmount > 0 && totalAllocation === 0) {
      const unallocatedTx = await prisma.ledgerTransaction.create({
        data: {
          tenantId,
          transactionDate: paidOn ? new Date(paidOn) : new Date(),
          description: `Vendor Wallet Credit / Prepayment to ${vendorName}. ${notes || ''}`,
          type: 'PAYMENT',
          referenceNumber: null
        }
      });
      mainTxId = unallocatedTx.id;

      await prisma.ledgerEntry.create({
        data: {
          transactionId: unallocatedTx.id,
          accountId: account.id,
          debitAmount: cashAmount,
          creditAmount: 0
        }
      });
    }

    // Save allocations using the main transaction ID if available
    const allocTxId = mainTxId || 0;
    if (allocations.length > 0 && allocTxId > 0) {
      const allocationsWithTx = allocations.map(a => ({
        ...a,
        transactionId: allocTxId
      }));
      await prisma.bookingAllocation.createMany({ data: allocationsWithTx });
    }

    // Group allocations by bookingId to record VendorPayment entities in the registry
    const bookingAmounts: Record<number, number> = {};
    for (const alloc of allocations) {
      bookingAmounts[alloc.bookingId] = (bookingAmounts[alloc.bookingId] || 0) + alloc.allocatedAmount;
    }

    for (const [bIdStr, bAmount] of Object.entries(bookingAmounts)) {
      const bId = parseInt(bIdStr);
      await prisma.vendorPayment.create({
        data: {
          tenantId,
          bookingId: bId,
          vendorName,
          amount: bAmount,
          paymentStatus: 'paid',
          paidOn: paidOn ? new Date(paidOn) : new Date(),
          notes: `Allocated payment from bulk reconciliation payment. ${notes || ''}`
        }
      });
    }

    // Update account balance (liability decrements with cash payment, increments with allocations)
    const balanceDelta = totalAllocation - cashAmount;
    await prisma.ledgerAccount.update({
      where: { id: account.id },
      data: { balance: { increment: balanceDelta } }
    });

    res.status(200).json({ 
      message: 'Vendor payment processed successfully',
      allocationsCount: allocations.length,
      cashAllocated: allocatedCash,
      walletCreditDeducted: creditUsedAmount,
      walletCreditGenerated: overpaidAmount
    });

  } catch (error: any) {
    console.error('Vendor Bulk Payment Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

app.get('/ledger/report', requireGatewayHeaders, requirePermission(Permission.READ_TRANSACTION), async (req: CustomRequest, res: Response) => {
  try {
    const tenantId = parseInt(req.tenantId!);
    const { dateStart, dateEnd, vendorName, agentName, reference } = req.query;

    const whereTransaction: any = { tenantId };
    
    if (dateStart && dateEnd) {
      whereTransaction.transactionDate = {
        gte: new Date(dateStart as string),
        lte: new Date(dateEnd as string)
      };
    } else if (dateStart) {
      whereTransaction.transactionDate = { gte: new Date(dateStart as string) };
    } else if (dateEnd) {
      whereTransaction.transactionDate = { lte: new Date(dateEnd as string) };
    }

    if (reference) {
      whereTransaction.OR = [
        { referenceNumber: { contains: reference as string, mode: 'insensitive' } },
        { description: { contains: reference as string, mode: 'insensitive' } }
      ];
    }

    // Advanced filtering by looking at the associated LedgerEntries or Allocations
    if (vendorName) {
      // Find transactions that have an entry tied to this vendor's account
      whereTransaction.entries = {
        some: {
          account: {
            entityName: { contains: vendorName as string, mode: 'insensitive' }
          }
        }
      };
    }

    if (agentName) {
      // Find transactions allocated to bookings assigned to this agent
      // Note: we can't easily traverse deep to bookings here without a custom join, 
      // but if we store agent name in description or if it's a specific ledger type, we can filter.
      // For now, search description as a fallback since Agent Name is usually appended to notes
      if (!whereTransaction.OR) {
        whereTransaction.OR = [];
      }
      whereTransaction.OR.push({ description: { contains: agentName as string, mode: 'insensitive' } });
    }

    const transactions = await prisma.ledgerTransaction.findMany({
      where: whereTransaction,
      include: {
        entries: {
          include: { account: true }
        },
        allocations: {
          include: {
            transaction: true
          }
        }
      },
      orderBy: { transactionDate: 'desc' }
    });

    // Also fetch all accounts for closing balances
    const accounts = await prisma.ledgerAccount.findMany({
      where: { tenantId }
    });

    // Collect all bookingIds across all allocations to enrich response with booking references
    const bookingIds = new Set<number>();
    for (const txn of transactions) {
      if (txn.allocations) {
        for (const alloc of txn.allocations) {
          bookingIds.add(alloc.bookingId);
        }
      }
    }

    const bookings = await prisma.booking.findMany({
      where: {
        id: { in: Array.from(bookingIds) }
      },
      select: {
        id: true,
        bookingReference: true
      }
    });

    const bookingRefMap = new Map<number, string>();
    for (const b of bookings) {
      bookingRefMap.set(b.id, b.bookingReference);
    }

    const enrichedTransactions = transactions.map((txn: any) => {
      const enrichedAllocations = txn.allocations?.map((alloc: any) => ({
        ...alloc,
        bookingRef: bookingRefMap.get(alloc.bookingId) || `BKG-${alloc.bookingId}`
      })) || [];

      let referenceNumber = txn.referenceNumber;
      if (!referenceNumber && enrichedAllocations.length > 0) {
        const uniqueRefs = Array.from(new Set(enrichedAllocations.map((a: any) => a.bookingRef)));
        referenceNumber = uniqueRefs.join(', ');
      }

      return {
        ...txn,
        referenceNumber,
        allocations: enrichedAllocations
      };
    });

    res.status(200).json({ transactions: enrichedTransactions, accounts });
  } catch (error) {
    console.error('Ledger Report Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/finance/payments', requireGatewayHeaders, async (req: CustomRequest, res: Response) => {
  try {
    const tenantId = parseInt(req.tenantId!);
    const { type, page, limit, search } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const skip = (pageNum - 1) * limitNum;

    if (type === 'vendor') {
      const where: any = { tenantId };
      if (search) {
        where.OR = [
          { vendorName: { contains: search as string, mode: 'insensitive' } },
          { notes: { contains: search as string, mode: 'insensitive' } },
          { booking: { bookingReference: { contains: search as string, mode: 'insensitive' } } }
        ];
      }
      const [total, payments] = await Promise.all([
        prisma.vendorPayment.count({ where }),
        prisma.vendorPayment.findMany({
          where,
          skip,
          take: limitNum,
          include: { booking: { select: { bookingReference: true } } },
          orderBy: { paidOn: 'desc' }
        })
      ]);
      const formatted = payments.map(p => ({ ...p, bookingRef: p.booking?.bookingReference, isVendor: true }));
      return res.json({ payments: formatted, total, page: pageNum, limit: limitNum, totalPages: limitNum ? Math.ceil(total / limitNum) : 1 });
    } else {
      const where: any = { tenantId };
      if (search) {
        where.OR = [
          { paymentMethod: { contains: search as string, mode: 'insensitive' } },
          { notes: { contains: search as string, mode: 'insensitive' } },
          { booking: { bookingReference: { contains: search as string, mode: 'insensitive' } } }
        ];
      }
      const [total, payments] = await Promise.all([
        prisma.bookingPayment.count({ where }),
        prisma.bookingPayment.findMany({
          where,
          skip,
          take: limitNum,
          include: { booking: { select: { bookingReference: true } } },
          orderBy: { paidOn: 'desc' }
        })
      ]);
      const formatted = payments.map(p => ({ ...p, bookingRef: p.booking?.bookingReference, isVendor: false }));
      return res.json({ payments: formatted, total, page: pageNum, limit: limitNum, totalPages: limitNum ? Math.ceil(total / limitNum) : 1 });
    }
  } catch (error) {
    console.error('Fetch Payments Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`Booking Service is running on port ${PORT}`);
});
