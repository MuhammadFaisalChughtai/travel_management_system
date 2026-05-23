import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4005;
const prisma = new PrismaClient();

app.use(helmet());
app.use(cors());
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
app.post('/', requireGatewayHeaders, authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'AGENT'), async (req: CustomRequest, res: Response) => {
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
app.get('/my-bookings', requireGatewayHeaders, async (req: CustomRequest, res: Response) => {
  try {
    const {
      id, dateStart, dateEnd, departureDateStart, departureDateEnd,
      bookingReference, agentName, customerName, customerEmail,
      customerPhone, status, lockedStatus, paymentStatus,
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
    if (lockedStatus && lockedStatus !== 'Any') {
      whereClause.lockedStatus = lockedStatus as string;
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

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      orderBy: { date: 'desc' }
    });

    res.status(200).json({ bookings });
  } catch (error) {
    console.error('Fetch Bookings Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get Single Booking Detail (With Tenant Isolation)
app.get('/:id', requireGatewayHeaders, async (req: CustomRequest, res: Response) => {
  try {
    const bookingId = parseInt(req.params.id);
    const tenantIdNumeric = parseInt(req.tenantId!);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customers: true,
        payments: { orderBy: { paidOn: 'desc' } },
        vendorPayments: true,
        accommodations: true,
        flightServices: true,
        transportServices: true,
        visaServices: true,
        discounts: { orderBy: { date: 'desc' } },
        refunds: { orderBy: { date: 'desc' } },
        additionalServices: true
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Not Found', message: 'Booking does not exist' });
    }

    // Enforce Tenant isolation (unless platform admin)
    if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied to this booking workspace' });
    }

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
  lockedStatus: z.string().optional(),
  departureDate: z.string().optional(),
  agentName: z.string().optional(),
  date: z.string().optional()
});

app.patch('/:id', requireGatewayHeaders, authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'AGENT'), async (req: CustomRequest, res: Response) => {
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
        lockedStatus: parsedData.lockedStatus || undefined,
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

app.post('/:id/passengers', requireGatewayHeaders, authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'AGENT'), async (req: CustomRequest, res: Response) => {
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
  notes: z.string().nullable().optional()
});

app.post('/:id/payments', requireGatewayHeaders, authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'AGENT'), async (req: CustomRequest, res: Response) => {
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

    const payment = await prisma.bookingPayment.create({
      data: {
        tenantId: tenantIdNumeric,
        bookingId,
        amount: parsedData.amount,
        paymentMethod: parsedData.paymentMethod,
        paymentType: parsedData.paymentType,
        paidOn: new Date(parsedData.paidOn),
        notes: parsedData.notes || null
      }
    });

    // Automatically recalculate booking paid & remaining amounts
    const allPayments = await prisma.bookingPayment.findMany({
      where: { bookingId }
    });
    
    const totalPaid = allPayments.reduce((acc, p) => acc + Number(p.amount), 0);
    const remaining = Number(booking.totalPrice) + Number(booking.cardPaymentCharges) + Number(booking.cancellationCharges) - totalPaid - Number(booking.refundAmount);

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
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

app.post('/:id/vendor-payments', requireGatewayHeaders, authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'AGENT'), async (req: CustomRequest, res: Response) => {
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

    const remainingDue = parsedData.remainingDue !== undefined 
      ? parsedData.remainingDue 
      : (parsedData.amount - parsedData.totalPaid);

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

    res.status(201).json({ message: 'Vendor payment registered successfully', vendorPayment });
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

app.post('/:id/accommodations', requireGatewayHeaders, authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'AGENT'), async (req: CustomRequest, res: Response) => {
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
app.post('/:id/flight-services', requireGatewayHeaders, authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'AGENT'), async (req: CustomRequest, res: Response) => {
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
app.post('/:id/transport-services', requireGatewayHeaders, authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'AGENT'), async (req: CustomRequest, res: Response) => {
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
app.post('/:id/visa-services', requireGatewayHeaders, authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'AGENT'), async (req: CustomRequest, res: Response) => {
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
app.post('/:id/discounts', requireGatewayHeaders, authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'AGENT'), async (req: CustomRequest, res: Response) => {
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

    res.status(201).json({ message: 'Discount added successfully', discount });
  } catch (error) {
    console.error('Add Discount Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Add Refund to Booking
app.post('/:id/refunds', requireGatewayHeaders, authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'AGENT'), async (req: CustomRequest, res: Response) => {
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

    res.status(201).json({ message: 'Refund logged successfully', refund });
  } catch (error) {
    console.error('Add Refund Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Add Additional Service
app.post('/:id/additional-services', requireGatewayHeaders, authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'AGENT'), async (req: CustomRequest, res: Response) => {
  try {
    const bookingId = parseInt(req.params.id);
    const tenantIdNumeric = parseInt(req.tenantId!);
    const { serviceName, charges, notes } = req.body;

    if (!serviceName) {
      return res.status(400).json({ error: 'Validation failed', message: 'serviceName is required' });
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ error: 'Not Found', message: 'Booking does not exist' });
    if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
    }

    const additionalService = await (prisma as any).additionalService.create({
      data: {
        tenantId: tenantIdNumeric,
        bookingId,
        serviceName,
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
app.patch('/:id/accommodations/:serviceId', requireGatewayHeaders, authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'AGENT'), async (req, res) => {
  try {
    const serviceId = parseInt(req.params.serviceId);
    const parsedData = req.body;
    
    if (parsedData.paidToVendor || parsedData.isPaidToVendor) {
      await (prisma as any).bookingPayment.create({
        data: {
          tenantId: parseInt((req as any).tenantId),
          bookingId: parseInt(req.params.id),
          amount: parseFloat(parsedData.price) || 0,
          paymentMethod: 'system_auto',
          paymentType: 'Sent to Vendor',
          paidOn: new Date(),
          notes: `Auto-logged vendor payment for ${parsedData.hotelName || "Accommodation"}`
        }
      });
    }
    
    const updated = await (prisma as any).accommodationService.update({
      where: { id: serviceId },
      data: {
        vendorName: parsedData.vendorName,
        hotelName: parsedData.hotelName,
        roomType: parsedData.roomType || null,
        checkInDate: parsedData.checkInDate ? new Date(parsedData.checkInDate) : null,
        checkOutDate: parsedData.checkOutDate ? new Date(parsedData.checkOutDate) : null,
        mealType: parsedData.mealType || null,
        reservationNumber: parsedData.reservationNumber || null,
        qty: parsedData.qty ? parseInt(parsedData.qty) : 1,
        price: parseFloat(parsedData.price) || 0,
        currency: parsedData.currency,
        otherCurrency: parsedData.otherCurrency || null,
        conversionRate: parsedData.conversionRate ? parseFloat(parsedData.conversionRate) : null,
        issueDate: parsedData.issueDate ? new Date(parsedData.issueDate) : null,
        refundAmount: parseFloat(parsedData.refundAmount) || 0,
        fineAmount: parseFloat(parsedData.fineAmount) || 0,
        hotelConfirmationNumber: parsedData.hotelConfirmationNumber || null,
        hotelAddress: parsedData.hotelAddress || null,
        lastCancellationDate: parsedData.lastCancellationDate ? new Date(parsedData.lastCancellationDate) : null,
        isPaidToVendor: parsedData.paidToVendor || parsedData.isPaidToVendor || false
      }
    });
    res.json({ accommodation: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Edit Flight
app.patch('/:id/flight-services/:serviceId', requireGatewayHeaders, authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'AGENT'), async (req, res) => {
  try {
    const serviceId = parseInt(req.params.serviceId);
    const parsedData = req.body;
    
    if (parsedData.paidToVendor || parsedData.isPaidToVendor) {
      await (prisma as any).bookingPayment.create({
        data: {
          tenantId: parseInt((req as any).tenantId),
          bookingId: parseInt(req.params.id),
          amount: parseFloat(parsedData.price) || 0,
          paymentMethod: 'system_auto',
          paymentType: 'Sent to Vendor',
          paidOn: new Date(),
          notes: `Auto-logged vendor payment for Flight (${parsedData.flightNo || "Unknown"})`
        }
      });
    }

    const updated = await (prisma as any).flightService.update({
      where: { id: serviceId },
      data: {
        vendorName: parsedData.vendorName,
        flightNo: parsedData.flightNo,
        pnr: parsedData.pnr,
        departedFrom: parsedData.departedFrom,
        arrivedAt: parsedData.arrivedAt,
        departTime: parsedData.departTime,
        arrivalTime: parsedData.arrivalTime,
        price: parseFloat(parsedData.price) || 0,
        currency: parsedData.currency,
        issueDate: parsedData.issueDate ? new Date(parsedData.issueDate) : null,
        refundAmount: parseFloat(parsedData.refundAmount) || 0,
        fineAmount: parseFloat(parsedData.fineAmount) || 0,
        baggage: parsedData.baggage,
        carryOnBaggage: parsedData.carryOnBaggage,
        checkedBaggage: parsedData.checkedBaggage,
        flightClass: parsedData.flightClass,
        date: parsedData.date ? new Date(parsedData.date) : null,
        isPaidToVendor: parsedData.paidToVendor || parsedData.isPaidToVendor || false
      }
    });
    res.json({ flight: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Edit Transport
app.patch('/:id/transport-services/:serviceId', requireGatewayHeaders, authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'AGENT'), async (req, res) => {
  try {
    const serviceId = parseInt(req.params.serviceId);
    const parsedData = req.body;
    
    if (parsedData.paidToVendor || parsedData.isPaidToVendor) {
      await (prisma as any).bookingPayment.create({
        data: {
          tenantId: parseInt((req as any).tenantId),
          bookingId: parseInt(req.params.id),
          amount: parseFloat(parsedData.price) || 0,
          paymentMethod: 'system_auto',
          paymentType: 'Sent to Vendor',
          paidOn: new Date(),
          notes: `Auto-logged vendor payment for Transport (${parsedData.vehicleType || "Vehicle"})`
        }
      });
    }

    const updated = await (prisma as any).transportService.update({
      where: { id: serviceId },
      data: {
        vendorName: parsedData.vendorName,
        vehicleType: parsedData.vehicleType,
        departureDestination: parsedData.departureDestination,
        arrivalDestination: parsedData.arrivalDestination,
        departureTime: parsedData.departureTime,
        arrivalTime: parsedData.arrivalTime,
        flightNo: parsedData.flightNo,
        price: parseFloat(parsedData.price) || 0,
        currency: parsedData.currency,
        otherCurrency: parsedData.otherCurrency,
        conversionRate: parsedData.conversionRate ? parseFloat(parsedData.conversionRate) : null,
        issueDate: parsedData.issueDate ? new Date(parsedData.issueDate) : null,
        refundAmount: parseFloat(parsedData.refundAmount) || 0,
        fineAmount: parseFloat(parsedData.fineAmount) || 0,
        date: parsedData.date ? new Date(parsedData.date) : null,
        isPaidToVendor: parsedData.paidToVendor || parsedData.isPaidToVendor || false
      }
    });
    res.json({ transport: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Edit Visa
app.patch('/:id/visa-services/:serviceId', requireGatewayHeaders, authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'AGENT'), async (req, res) => {
  try {
    const serviceId = parseInt(req.params.serviceId);
    const parsedData = req.body;
    
    if (parsedData.paidToVendor || parsedData.isPaidToVendor) {
      await (prisma as any).bookingPayment.create({
        data: {
          tenantId: parseInt((req as any).tenantId),
          bookingId: parseInt(req.params.id),
          amount: parseFloat(parsedData.price) || 0,
          paymentMethod: 'system_auto',
          paymentType: 'Sent to Vendor',
          paidOn: new Date(),
          notes: `Auto-logged vendor payment for Visa (${parsedData.visaType || "Application"})`
        }
      });
    }

    const updated = await (prisma as any).visaService.update({
      where: { id: serviceId },
      data: {
        vendorName: parsedData.vendorName,
        passportNumber: parsedData.passportNumber,
        visaType: parsedData.visaType,
        visaNumber: parsedData.visaNumber,
        issueDate: parsedData.issueDate ? new Date(parsedData.issueDate) : null,
        expiryDate: parsedData.expiryDate ? new Date(parsedData.expiryDate) : null,
        price: parseFloat(parsedData.price) || 0,
        currency: parsedData.currency,
        otherCurrency: parsedData.otherCurrency,
        conversionRate: parsedData.conversionRate ? parseFloat(parsedData.conversionRate) : null,
        refundAmount: parseFloat(parsedData.refundAmount) || 0,
        fineAmount: parseFloat(parsedData.fineAmount) || 0,
        isPaidToVendor: parsedData.paidToVendor || parsedData.isPaidToVendor || false
      }
    });
    res.json({ visa: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Edit Additional Service
app.patch('/:id/additional-services/:serviceId', requireGatewayHeaders, authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'AGENT'), async (req, res) => {
  try {
    const serviceId = parseInt(req.params.serviceId);
    const parsedData = req.body;
    
    if (parsedData.paidToVendor || parsedData.isPaidToVendor) {
      await (prisma as any).bookingPayment.create({
        data: {
          tenantId: parseInt((req as any).tenantId),
          bookingId: parseInt(req.params.id),
          amount: parseFloat(parsedData.charges) || 0,
          paymentMethod: 'system_auto',
          paymentType: 'Sent to Vendor',
          paidOn: new Date(),
          notes: `Auto-logged vendor payment for ${parsedData.serviceName}`
        }
      });
    }

    const updated = await (prisma as any).additionalService.update({
      where: { id: serviceId },
      data: {
        serviceName: parsedData.serviceName,
        charges: parseFloat(parsedData.charges) || 0,
        notes: parsedData.notes || null,
        isPaidToVendor: parsedData.paidToVendor || parsedData.isPaidToVendor || false
      }
    });
    res.json({ additionalService: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Edit Passenger
app.patch('/:id/passengers/:passengerId', requireGatewayHeaders, authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'AGENT'), async (req, res) => {
  try {
    const passengerId = parseInt(req.params.passengerId);
    const parsedData = req.body;
    
    const updated = await (prisma as any).passenger.update({
      where: { id: passengerId },
      data: {
        type: parsedData.type,
        title: parsedData.title,
        firstName: parsedData.firstName,
        lastName: parsedData.lastName,
        dob: parsedData.dob ? new Date(parsedData.dob) : null,
        passportNumber: parsedData.passportNumber,
        passportExpiry: parsedData.passportExpiry ? new Date(parsedData.passportExpiry) : null,
        gender: parsedData.gender || null,
        role: parsedData.role || null
      }
    });
    res.json({ passenger: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.listen(PORT, () => {
  console.log(`Booking Service is running on port ${PORT}`);
});
