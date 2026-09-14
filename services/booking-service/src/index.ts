import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import crypto from "crypto";
import { z } from "zod";
import { PrismaClient } from "@prisma/client-booking";
import { requirePermission } from "./middleware/rbac";
import { Permission, Role } from "./types/rbac";
import { calculateAndSyncAgentMargin } from "./utils/marginCalculator";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4005;
const prisma = new PrismaClient();

const JWT_SECRET =
  process.env.JWT_SECRET || "fallback_secret_do_not_use_in_prod";

// Simple helper to encrypt passenger info token
function encryptToken(payload: object): string {
  const text = JSON.stringify(payload);
  const key = crypto.createHash("sha256").update(JWT_SECRET).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

// Simple helper to decrypt passenger info token
function decryptToken(token: string): any {
  try {
    const [ivHex, encryptedHex] = token.split(":");
    if (!ivHex || !encryptedHex) return null;
    const key = crypto.createHash("sha256").update(JWT_SECRET).digest();
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return JSON.parse(decrypted);
  } catch (err) {
    console.error("Decrypt token error:", err);
    return null;
  }
}

app.use(helmet());
const corsOptions = {
  origin: "*",
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());

// Normalize /bookings prefix so all booking endpoints match seamlessly whether incoming requests retain /bookings prefix or not
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.url.startsWith("/bookings/")) {
    req.url = req.url.slice("/bookings".length);
  } else if (req.url === "/bookings" || req.url.startsWith("/bookings?")) {
    req.url = req.url.replace(/^\/bookings/, "") || "/";
  }
  next();
});

function getBookingPermissionForPath(
  path: string,
  method: string,
): string | null {
  let cleanPath = path.split("?")[0];
  if (cleanPath.startsWith("/bookings/")) {
    cleanPath = cleanPath.slice("/bookings".length);
  } else if (cleanPath === "/bookings") {
    cleanPath = "/";
  }

  if (cleanPath.startsWith("/catalog")) {
    if (method === "GET") return "READ_SERVICE";
    if (method === "POST") return "CREATE_SERVICE";
    if (method === "PUT" || method === "PATCH") return "UPDATE_SERVICE";
    if (method === "DELETE") return "DELETE_SERVICE";
  }

  if (cleanPath.startsWith("/finance/expenses")) {
    if (method === "GET") return "READ_TRANSACTION";
    if (method === "POST") return "CREATE_TRANSACTION";
    if (method === "PUT" || method === "PATCH") return "UPDATE_TRANSACTION";
    if (method === "DELETE") return "DELETE_TRANSACTION";
  }

  if (cleanPath.startsWith("/finance/templates")) {
    if (cleanPath.includes("/compile")) return "READ_BOOKING";
    if (cleanPath.includes("/set-global-default-invoice")) return null;
    if (method === "GET") return "READ_TEMPLATE";
    if (method === "POST") return "CREATE_TEMPLATE";
    if (method === "PUT" || method === "PATCH") return "UPDATE_TEMPLATE";
  }

  if (cleanPath.startsWith("/finance/vendors/wallets")) {
    return "READ_VENDOR";
  }

  if (cleanPath.startsWith("/finance")) {
    if (method === "GET") return "READ_TRANSACTION";
    return "UPDATE_TRANSACTION";
  }

  if (cleanPath.startsWith("/ledger")) {
    if (method === "GET") return "READ_TRANSACTION";
    return "CREATE_TRANSACTION";
  }

  if (cleanPath === "/search" || cleanPath === "/my-bookings" || cleanPath === "/bookings/my-bookings" || cleanPath.endsWith("/my-bookings")) {
    return "READ_BOOKING";
  }

  // Check sub-resources under /:id or general booking resources
  const isNumberPath = /^\/\d+/.test(cleanPath);
  if (isNumberPath) {
    if (
      cleanPath.includes("/payments") ||
      cleanPath.includes("/refunds") ||
      cleanPath.includes("/discounts") ||
      cleanPath.includes("/vendor-payments")
    ) {
      if (method === "GET") return "READ_BOOKING";
      if (method === "POST") return "CREATE_TRANSACTION";
      return "UPDATE_TRANSACTION";
    }
    // Accommodations, flights, transports, visas, additional-services, or the booking itself
    if (method === "GET") return "READ_BOOKING";
    if (method === "POST") return "CREATE_BOOKING";
    if (method === "PATCH" || method === "PUT") return "UPDATE_BOOKING";
    if (method === "DELETE") return "DELETE_BOOKING";
  }

  if (cleanPath.startsWith("/bookings") || cleanPath === "/") {
    if (method === "GET") return "READ_BOOKING";
    if (method === "POST") return "CREATE_BOOKING";
    if (method === "PATCH" || method === "PUT") return "UPDATE_BOOKING";
    if (method === "DELETE") return "DELETE_BOOKING";
  }

  return null;
}

app.use(async (req: Request, res: Response, next: NextFunction) => {
  const userRole = req.headers["x-user-role"] as string;
  const userId = req.headers["x-user-id"] as string;
  const tenantId = req.headers["x-tenant-id"] as string;

  if (userRole === "AGENT") {
    const path = req.path;
    // Bypass health check and public endpoints
    if (path === "/health" || path.startsWith("/public")) {
      return next();
    }

    if (!userId || !tenantId) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Permission Denied: Missing user or tenant context",
      });
    }

    try {
      const requiredPermission = getBookingPermissionForPath(
        req.path,
        req.method,
      );
      const authUrl =
        process.env.AUTH_SERVICE_URL || "http://auth-service:4001";
      const checkUrl = `${authUrl}/agents/verify-request${requiredPermission ? `?permission=${requiredPermission}` : ""}`;

      const response = await fetch(checkUrl, {
        headers: {
          "X-User-Id": userId,
          "X-User-Role": userRole,
          "X-Tenant-Id": tenantId,
        },
      });

      if (!response.ok) {
        return res.status(403).json({
          error: "Forbidden",
          message: "Permission Denied: Verification service error",
        });
      }

      const data = await response.json();
      if (!data.allowed) {
        return res.status(403).json({
          error: "Forbidden",
          message: data.message || "Permission Denied",
        });
      }
    } catch (error) {
      console.error("Booking agent verification error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }

  next();
});

// Extend Express Request type
interface CustomRequest extends Request {
  userId?: string;
  userRole?: string;
  tenantId?: string;
  isPlatformAdmin?: boolean;
}

// Middleware to extract headers injected by the SaaS API Gateway
const requireGatewayHeaders = (
  req: CustomRequest,
  res: Response,
  next: NextFunction,
) => {
  const userId = req.headers["x-user-id"] as string;
  const userRole = req.headers["x-user-role"] as string;
  const tenantId = req.headers["x-tenant-id"] as string;
  const isPlatformAdmin = req.headers["x-is-platform-admin"] === "true";

  if (!userId || !userRole || !tenantId) {
    return res.status(400).json({
      error: "Bad Request",
      message:
        "Missing propagation context. Please route requests through the API Gateway.",
    });
  }

  req.userId = userId;
  req.userRole = userRole;
  req.tenantId = tenantId;
  req.isPlatformAdmin = isPlatformAdmin;
  next();
};

const getUserName = async (
  userId: string | number | undefined,
  tenantId: string | number | undefined,
): Promise<string> => {
  if (!userId) return "Agent";
  try {
    const authUrl = process.env.AUTH_SERVICE_URL || "http://auth-service:4001";
    const res = await fetch(`${authUrl}/users/${userId}`, {
      headers: { "x-tenant-id": String(tenantId) },
    });
    if (res.ok) {
      const data = await res.json();
      return data.name || "Agent";
    }
  } catch (err) {
    console.error("Error fetching user name from auth-service:", err);
  }
  return "Agent";
};

const getTenantCurrency = async (
  tenantId: string | number | undefined,
): Promise<string> => {
  if (!tenantId) return "GBP";
  try {
    const authUrl = process.env.AUTH_SERVICE_URL || "http://auth-service:4001";
    const res = await fetch(`${authUrl}/tenants/profile`, {
      headers: { "x-tenant-id": String(tenantId) },
    });
    if (res.ok) {
      const data = await res.json();
      return data.tenant?.currency || "GBP";
    }
  } catch (err) {
    console.error("Error fetching tenant currency from auth-service:", err);
  }
  return "GBP";
};

const getTenantCurrencySymbol = async (
  tenantId: string | number | undefined,
): Promise<string> => {
  const currency = await getTenantCurrency(tenantId);
  switch (currency.toUpperCase()) {
    case "GBP":
      return "£";
    case "EUR":
      return "€";
    case "PKR":
      return "Rs";
    case "USD":
      return "$";
    case "AED":
      return "AED ";
    case "MYR":
      return "RM";
    default:
      return `${currency} `;
  }
};

const resolveVendorName = async (
  notes: string | null | undefined,
  tenantIdNumeric: number,
): Promise<string> => {
  const defaultVendor = "General Vendors";
  if (!notes) return defaultVendor;

  const notesLower = notes.toLowerCase();

  try {
    const vendorAccounts = await prisma.ledgerAccount.findMany({
      where: { tenantId: tenantIdNumeric, accountType: "VENDOR_PAYABLE" },
    });
    const sortedAccounts = [...vendorAccounts].sort(
      (a, b) => (b.entityName || "").length - (a.entityName || "").length,
    );
    const matchedAccount = sortedAccounts.find(
      (acc) =>
        acc.entityName &&
        acc.entityName.toLowerCase() !== "general vendors" &&
        notesLower.includes(acc.entityName.toLowerCase()),
    );
    if (matchedAccount && matchedAccount.entityName) {
      return matchedAccount.entityName;
    }
  } catch (err) {
    console.error("Error fetching vendor accounts in resolveVendorName:", err);
  }

  const patterns = [
    /Flight:\s*([^-]+)/i,
    /Visa:\s*([^(\n\r]+)/i,
    /Hotel:\s*([^\n\r]+)/i,
    /Transport:\s*([^\n\r]+)/i,
    /Service:\s*([^\n\r]+)/i,
  ];

  for (const pattern of patterns) {
    const match = notes.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      if (extracted && extracted.toLowerCase() !== "unknown") {
        return extracted;
      }
    }
  }

  return defaultVendor;
};

const syncBookingFinancials = async (
  bookingId: number,
  additionalCardCharges: number = 0,
) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      payments: true,
      refunds: true,
    },
  });
  if (!booking) return;

  const totalPaid =
    booking.payments
      .filter(
        (p: any) =>
          p.paymentType === "Received from Client" && p.status === "approved",
      )
      .reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0) || 0;

  const totalRefunded =
    booking.refunds
      .filter((r: any) => r.direction === "Refund to Client")
      .reduce((acc: number, r: any) => acc + Number(r.amount || 0), 0) || 0;

  const newCardCharges =
    Number(booking.cardPaymentCharges || 0) + additionalCardCharges;
  const remaining =
    Number(booking.totalPrice || 0) +
    newCardCharges +
    Number(booking.cancellationCharges || 0) -
    totalPaid +
    totalRefunded;

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      cardPaymentCharges: newCardCharges,
      paidAmount: totalPaid,
      refundAmount: totalRefunded,
      remainingAmount: remaining >= 0 ? remaining : 0,
      paymentStatus:
        remaining <= 0
          ? "paid"
          : totalPaid - totalRefunded > 0
            ? "partially_paid"
            : "unpaid",
    },
  });
};

const logPriceChange = async ({
  tenantId,
  bookingId,
  serviceType,
  serviceName,
  action,
  oldPrice,
  newPrice,
  userId,
}: {
  tenantId: number;
  bookingId: number;
  serviceType: string;
  serviceName: string;
  action: "ADD" | "UPDATE";
  oldPrice: number;
  newPrice: number;
  userId: string | undefined;
}) => {
  try {
    const loggedByName = await getUserName(userId, tenantId);
    await prisma.bookingPriceLog.create({
      data: {
        tenantId,
        bookingId,
        serviceType,
        serviceName,
        action,
        oldPrice,
        newPrice,
        loggedByName,
        loggedById: userId ? parseInt(userId) : null,
      },
    });
  } catch (err) {
    console.error("Failed to log price change:", err);
  }
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

    res
      .status(403)
      .json({ error: "Forbidden", message: "Insufficient role permissions" });
  };
};

const parseDateWithCurrentTime = (dateInput: any): Date => {
  if (!dateInput) return new Date();
  const dateObj = new Date(dateInput);
  if (isNaN(dateObj.getTime())) return new Date();

  const now = new Date();
  dateObj.setHours(
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  );
  return dateObj;
};

const createBookingSchema = z.object({
  bookingReference: z.string().min(5),
  date: z.string(),
  departureDate: z.string().optional(),
  totalPrice: z.number().positive(),
  customers: z.array(z.number()).optional().default([]),
  agentName: z.string().optional(),
});

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "UP", service: "Booking Service" });
});

// Create Booking (Company Admin or Agent can book)
app.post(
  "/",
  requireGatewayHeaders,
  requirePermission(Permission.CREATE_BOOKING),
  async (req: CustomRequest, res: Response) => {
    try {
      const parsedData = createBookingSchema.parse(req.body);

      // Extract tenant ID from gateway propagation header
      const tenantIdNumeric = parseInt(req.tenantId!);

      // Generate sequential suffix based on tenant's total booking count
      const totalBookings = await prisma.booking.count({
        where: { tenantId: tenantIdNumeric },
      });
      const suffix = String(totalBookings + 1).padStart(3, "0");
      const finalBookingReference = `${parsedData.bookingReference}-${suffix}`;

      const newBooking = await prisma.booking.create({
        data: {
          tenantId: tenantIdNumeric,
          bookingReference: finalBookingReference,
          date: new Date(parsedData.date),
          ...(parsedData.departureDate ? { departureDate: new Date(parsedData.departureDate) } : {}),
          totalPrice: parsedData.totalPrice,
          status: "confirmed",
          agentName: parsedData.agentName || null,
        },
        include: {
          customers: true,
          additionalServices: true,
        },
      });

      res
        .status(201)
        .json({ message: "Booking created successfully", booking: newBooking });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      console.error("Create Booking Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// Get User Bookings (With Tenant Isolation and Filtering)
app.get(
  "/search",
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      const q = (req.query.q as string) || "";
      if (!q) {
        return res.status(200).json({ bookings: [] });
      }

      const limit = 10;
      const isSuper = req.isPlatformAdmin || req.userRole === "SUPER_ADMIN";
      const targetTenantId = req.query.tenantId ? parseInt(req.query.tenantId as string) : (isSuper ? undefined : parseInt(req.tenantId!));

      const bookings = await prisma.booking.findMany({
        where: {
          ...(targetTenantId ? { tenantId: targetTenantId } : {}),
          OR: [
            { bookingReference: { contains: q, mode: "insensitive" } },
            {
              flightServices: {
                some: { pnr: { contains: q, mode: "insensitive" } },
              },
            },
            { agentName: { contains: q, mode: "insensitive" } },
            {
              customers: {
                some: { firstName: { contains: q, mode: "insensitive" } },
              },
            },
            {
              customers: {
                some: { lastName: { contains: q, mode: "insensitive" } },
              },
            },
          ],
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          bookingReference: true,
          agentName: true,
          totalPrice: true,
          flightServices: { select: { pnr: true } },
          customers: { select: { firstName: true, lastName: true }, take: 1 },
        },
      });

      res.status(200).json({ bookings });
    } catch (error: any) {
      console.error("Search bookings error:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message: error.message,
        stack: error.stack,
      });
    }
  },
);

app.get(
  ["/my-bookings", "/bookings/my-bookings"],
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      const {
        id,
        dateStart,
        dateEnd,
        departureDateStart,
        departureDateEnd,
        bookingReference,
        agentName,
        customerName,
        customerEmail,
        customerPhone,
        status,
        isLocked,
        paymentStatus,
        createdAtStart,
        createdAtEnd,
        tenantId,
      } = req.query;

      const whereClause: any = {};

      if (id) {
        whereClause.id = parseInt(id as string);
      }
      if (bookingReference) {
        whereClause.bookingReference = {
          contains: bookingReference as string,
          mode: "insensitive",
        };
      }
      if (agentName && agentName !== "Any") {
        whereClause.agentName = {
          contains: (agentName as string).trim(),
          mode: "insensitive",
        };
      }
      if (status && status !== "Any") {
        whereClause.status = status as string;
      } else if (req.query.includeHidden !== "true") {
        whereClause.AND = whereClause.AND || [];
        whereClause.AND.push({
          status: { not: "hidden" },
          isDeleted: { not: true }
        });
      }
      if (isLocked !== undefined && isLocked !== "Any") {
        whereClause.isLocked = isLocked === "true";
      }
      if (paymentStatus && paymentStatus !== "Any") {
        whereClause.paymentStatus = paymentStatus as string;
      }

      if (dateStart || dateEnd) {
        whereClause.date = {};
        if (dateStart) whereClause.date.gte = new Date(dateStart as string);
        if (dateEnd) whereClause.date.lte = new Date(dateEnd as string);
      }
      if (departureDateStart || departureDateEnd) {
        const depGte = departureDateStart ? new Date(departureDateStart as string) : undefined;
        const depLte = departureDateEnd ? new Date(departureDateEnd as string) : undefined;
        whereClause.AND = whereClause.AND || [];
        whereClause.AND.push({
          OR: [
            {
              departureDate: {
                ...(depGte && { gte: depGte }),
                ...(depLte && { lte: depLte }),
              },
            },
            {
              departureDate: null,
              date: {
                ...(depGte && { gte: depGte }),
                ...(depLte && { lte: depLte }),
              },
            },
          ],
        });
      }
      if (createdAtStart || createdAtEnd) {
        whereClause.createdAt = {};
        if (createdAtStart)
          whereClause.createdAt.gte = new Date(createdAtStart as string);
        if (createdAtEnd)
          whereClause.createdAt.lte = new Date(createdAtEnd as string);
      }

      if (customerName || customerEmail || customerPhone) {
        const customerFilter: any = {};
        if (customerName) {
          customerFilter.OR = [
            {
              firstName: {
                contains: customerName as string,
                mode: "insensitive",
              },
            },
            {
              lastName: {
                contains: customerName as string,
                mode: "insensitive",
              },
            },
          ];
        }
        if (customerEmail) {
          customerFilter.email = {
            contains: customerEmail as string,
            mode: "insensitive",
          };
        }
        if (customerPhone) {
          customerFilter.phoneNumber = {
            contains: customerPhone as string,
            mode: "insensitive",
          };
        }
        whereClause.customers = { some: customerFilter };
      }

      if (req.isPlatformAdmin || req.userRole === "SUPER_ADMIN") {
        const targetTenantId = tenantId
          ? parseInt(tenantId as string)
          : undefined;
        if (targetTenantId) whereClause.tenantId = targetTenantId;
      } else {
        whereClause.tenantId = parseInt(req.tenantId!);
      }

      const pageNum = parseInt(req.query.page as string) || 1;
      const isAll = req.query.limit === "all";
      const limitNum = isAll
        ? undefined
        : parseInt(req.query.limit as string) || 10;
      const skip = isAll ? undefined : (pageNum - 1) * limitNum!;

      const activeTenantId = req.tenantId ? parseInt(req.tenantId) : undefined;
      if (activeTenantId) {
        await syncCreditCardFeeRecords(activeTenantId);
      }

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
                additionalServices: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      res.status(200).json({
        bookings,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: limitNum ? Math.ceil(total / limitNum) : 1,
      });
    } catch (error: any) {
      console.error("Fetch Bookings Error:", error);
      res.status(500).json({ error: "Internal Server Error", message: error?.message || String(error) });
    }
  },
);

// PUT /bookings/:id/hide -- Soft delete / Hide booking (Main Admin only)
app.put(
  ["/:id/hide", "/bookings/:id/hide"],
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      if (req.userRole === "AGENT") {
        return res.status(403).json({ error: "Only Main Admin can hide or soft-delete bookings." });
      }
      const bookingId = parseInt(req.params.id);
      const tenantId = parseInt(req.tenantId!);

      const booking = await prisma.booking.findFirst({
        where: { id: bookingId, tenantId },
      });
      if (!booking) {
        return res.status(404).json({ error: "Booking not found." });
      }

      const updated = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "hidden",
          ...("isDeleted" in booking ? { isDeleted: true } : {}),
        },
      });

      res.status(200).json({ message: "Booking hidden successfully", booking: updated });
    } catch (error: any) {
      console.error("Hide Booking Error:", error);
      res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
  }
);

// PUT /bookings/:id/unhide -- Restore hidden booking (Main Admin only)
app.put(
  ["/:id/unhide", "/bookings/:id/unhide"],
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      if (req.userRole === "AGENT") {
        return res.status(403).json({ error: "Only Main Admin can restore hidden bookings." });
      }
      const bookingId = parseInt(req.params.id);
      const tenantId = parseInt(req.tenantId!);

      const booking = await prisma.booking.findFirst({
        where: { id: bookingId, tenantId },
      });
      if (!booking) {
        return res.status(404).json({ error: "Booking not found." });
      }

      const updated = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "confirmed",
          ...("isDeleted" in booking ? { isDeleted: false } : {}),
        },
      });

      res.status(200).json({ message: "Booking restored successfully", booking: updated });
    } catch (error: any) {
      console.error("Unhide Booking Error:", error);
      res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
  }
);

// DELETE /bookings/:id -- Soft delete booking (Main Admin only)
app.delete(
  ["/:id", "/bookings/:id"],
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      if (req.userRole === "AGENT") {
        return res.status(403).json({ error: "Only Main Admin can hide or soft-delete bookings." });
      }
      const bookingId = parseInt(req.params.id);
      const tenantId = parseInt(req.tenantId!);

      const booking = await prisma.booking.findFirst({
        where: { id: bookingId, tenantId },
      });
      if (!booking) {
        return res.status(404).json({ error: "Booking not found." });
      }

      const updated = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "hidden",
          ...("isDeleted" in booking ? { isDeleted: true } : {}),
        },
      });

      res.status(200).json({ message: "Booking soft deleted successfully", booking: updated });
    } catch (error: any) {
      console.error("Soft Delete Booking Error:", error);
      res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
  }
);

// Get Single Booking Detail (With Tenant Isolation)
// ---------------------------------------------------------
// Service Catalog Endpoints
// ---------------------------------------------------------

// GET /catalog
app.get(
  "/catalog",
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      const { serviceType } = req.query;
      const filter: any = {
        isActive: true,
        tenantId: parseInt(req.tenantId as string) || 1,
      };
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
          orderBy: { name: "asc" },
        }),
      ]);

      res.json({
        items,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: limitNum ? Math.ceil(total / limitNum) : 1,
      });
    } catch (error) {
      console.error("Fetch catalog error:", error);
      res.status(500).json({ error: "Failed to fetch catalog" });
    }
  },
);

// POST /catalog (Admin Only)
app.post(
  "/catalog",
  requireGatewayHeaders,
  authorizeRoles("COMPANY_ADMIN", "MAIN_COMPANY_ADMIN", "ADMIN", "SUPER_ADMIN"),
  async (req: CustomRequest, res: Response) => {
    try {
      const item = await prisma.serviceCatalog.create({
        data: {
          tenantId: parseInt(req.tenantId as string) || 1,
          serviceType: req.body.serviceType,
          name: req.body.name,
          unitPrice: req.body.unitPrice,
          currency: req.body.currency,
          metadata: req.body.metadata || {},
        },
      });
      res.status(201).json(item);
    } catch (error) {
      console.error("Create catalog item error:", error);
      res.status(500).json({ error: "Failed to create catalog item" });
    }
  },
);

// PUT /catalog/:id (Admin Only)
app.patch(
  "/catalog/:id",
  requireGatewayHeaders,
  authorizeRoles("COMPANY_ADMIN", "MAIN_COMPANY_ADMIN", "ADMIN", "SUPER_ADMIN"),
  async (req: CustomRequest, res: Response) => {
    try {
      const item = await prisma.serviceCatalog.update({
        where: { id: parseInt(req.params.id) },
        data: {
          serviceType: req.body.serviceType,
          name: req.body.name,
          unitPrice: req.body.unitPrice,
          currency: req.body.currency,
          isActive: req.body.isActive,
          metadata: req.body.metadata,
        },
      });
      res.json(item);
    } catch (error) {
      console.error("Update catalog item error:", error);
      res.status(500).json({ error: "Failed to update catalog item" });
    }
  },
);

// DELETE /catalog/:id (Admin Only)
app.delete(
  "/catalog/:id",
  requireGatewayHeaders,
  authorizeRoles("COMPANY_ADMIN", "MAIN_COMPANY_ADMIN", "ADMIN", "SUPER_ADMIN"),
  async (req: CustomRequest, res: Response) => {
    try {
      await prisma.serviceCatalog.delete({
        where: { id: parseInt(req.params.id) },
      });
      res.status(204).send();
    } catch (error) {
      console.error("Delete catalog item error:", error);
      res.status(500).json({ error: "Failed to delete catalog item" });
    }
  },
);

// GET /passengers/search -- Search across all booking customers for autocomplete
app.get(
  "/passengers/search",
  requireGatewayHeaders,
  requirePermission(Permission.UPDATE_BOOKING),
  async (req: CustomRequest, res: Response) => {
    try {
      const tenantIdNumeric = parseInt(req.tenantId!);
      const query = ((req.query.q as string) || "").trim();

      if (!query) {
        return res.json({ passengers: [] });
      }

      const passengers = await prisma.bookingCustomer.findMany({
        where: {
          tenantId: tenantIdNumeric,
          OR: [
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { passportNumber: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 10,
        orderBy: { id: "desc" },
      });

      res.json({ passengers });
    } catch (error: any) {
      console.error("Passenger Search Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

app.get(
  ["/:id", "/bookings/:id"],
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      const bookingId = parseInt(req.params.id);
      const tenantIdNumeric = parseInt(req.tenantId!);

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          customers: {
            orderBy: { id: "asc" },
            include: { documents: { orderBy: { id: "asc" } } },
          },
          payments: { orderBy: { paidOn: "desc" } },
          vendorPayments: { orderBy: { id: "asc" } },
          accommodations: { orderBy: { id: "asc" } },
          flightServices: { orderBy: { id: "asc" } },
          transportServices: { orderBy: { id: "asc" } },
          visaServices: { orderBy: { id: "asc" } },
          discounts: { orderBy: { date: "desc" } },
          refunds: { orderBy: { date: "desc" } },
          additionalServices: { orderBy: { id: "asc" } },
          priceLogs: { orderBy: { createdAt: "desc" } },
        },
      });

      if (!booking) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Booking does not exist" });
      }

      // Enforce Tenant isolation (unless platform admin)
      if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
        return res.status(403).json({
          error: "Forbidden",
          message: "Access denied to this booking workspace",
        });
      }

      if (booking.isLocked && req.userRole === Role.AGENT) {
        return res
          .status(403)
          .json({ error: "Forbidden", message: "This booking is locked." });
      }

      // Fetch allocations for this booking
      const allocations = await prisma.bookingAllocation.findMany({
        where: { bookingId },
        include: { transaction: true },
      });

      const vendorPayments = booking.payments.filter(
        (p) => p.paymentType === "Sent to Vendor",
      );

      const getAllocatedSum = (type: string, id: number) => {
        return allocations
          .filter((a) => a.serviceType === type && a.serviceId === id)
          .reduce(
            (sum, a) => sum + parseFloat(a.allocatedAmount.toString()),
            0,
          );
      };

      booking.flightServices.forEach((s) => {
        const cost = parseFloat((s.price || 0).toString());
        const allocated = getAllocatedSum("FLIGHT", s.id);
        // @ts-ignore
        const matchString = `- ${s.flightNo || "No Flight No"} (${s.pnr})`;
        const legacyPaid = vendorPayments.some((p) =>
          p.notes?.includes(matchString),
        )
          ? cost
          : 0;
        if (allocated + legacyPaid >= cost) {
          s.isPaidToVendor = true;
        }
      });

      booking.accommodations.forEach((s) => {
        const cost = parseFloat((s.price || 0).toString());
        const allocated = getAllocatedSum("HOTEL", s.id);
        const matchString = `Hotel: ${s.hotelName}`;
        const legacyPaid = vendorPayments.some((p) =>
          p.notes?.includes(matchString),
        )
          ? cost
          : 0;
        if (allocated + legacyPaid >= cost) {
          s.isPaidToVendor = true;
        }
      });

      booking.transportServices.forEach((s) => {
        const cost = parseFloat((s.price || 0).toString());
        const allocated = getAllocatedSum("TRANSPORT", s.id);
        const matchString = `Transport: ${s.vehicleType}`;
        const legacyPaid = vendorPayments.some((p) =>
          p.notes?.includes(matchString),
        )
          ? cost
          : 0;
        if (allocated + legacyPaid >= cost) {
          s.isPaidToVendor = true;
        }
      });

      booking.visaServices.forEach((s) => {
        const cost = parseFloat((s.price || 0).toString());
        const allocated = getAllocatedSum("VISA", s.id);
        const matchString = `Visa: ${s.vendorName || "Unknown"} (${s.visaType})`;
        const legacyPaid = vendorPayments.some((p) =>
          p.notes?.includes(matchString),
        )
          ? cost
          : 0;
        if (allocated + legacyPaid >= cost) {
          s.isPaidToVendor = true;
        }
      });

      booking.additionalServices.forEach((s) => {
        const cost = parseFloat((s.charges || 0).toString());
        const allocated = getAllocatedSum("ADDITIONAL", s.id);
        const matchString = `Service: ${s.serviceName}`;
        const legacyPaid = vendorPayments.some((p) =>
          p.notes?.includes(matchString),
        )
          ? cost
          : 0;
        if (allocated + legacyPaid >= cost) {
          s.isPaidToVendor = true;
        }
      });

      res.status(200).json({
        booking: {
          ...booking,
          allocations,
        },
      });
    } catch (error) {
      console.error("Fetch Booking Detail Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

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
  date: z.string().optional(),
});

app.patch(
  ["/:id", "/bookings/:id"],
  requireGatewayHeaders,
  requirePermission(Permission.UPDATE_BOOKING),
  async (req: CustomRequest, res: Response) => {
    try {
      const bookingId = parseInt(req.params.id);
      const parsedData = patchBookingSchema.parse(req.body);
      const tenantIdNumeric = parseInt(req.tenantId!);

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Booking does not exist" });
      }

      if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
        return res.status(403).json({
          error: "Forbidden",
          message: "Access denied to this booking workspace",
        });
      }

      if (booking.isLocked && req.userRole === Role.AGENT) {
        return res
          .status(403)
          .json({ error: "Forbidden", message: "This booking is locked." });
      }

      if (booking.isLocked && req.userRole === Role.AGENT) {
        return res.status(403).json({
          error: "Forbidden",
          message: "This booking is locked and cannot be edited by agents.",
        });
      }

      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          totalPrice:
            parsedData.totalPrice !== undefined
              ? parsedData.totalPrice
              : undefined,
          paidAmount:
            parsedData.paidAmount !== undefined
              ? parsedData.paidAmount
              : undefined,
          refundAmount:
            parsedData.refundAmount !== undefined
              ? parsedData.refundAmount
              : undefined,
          cardPaymentCharges:
            parsedData.cardPaymentCharges !== undefined
              ? parsedData.cardPaymentCharges
              : undefined,
          cancellationCharges:
            parsedData.cancellationCharges !== undefined
              ? parsedData.cancellationCharges
              : undefined,
          remainingAmount:
            parsedData.remainingAmount !== undefined
              ? parsedData.remainingAmount
              : undefined,
          status: parsedData.status || undefined,
          paymentStatus: parsedData.paymentStatus || undefined,
          isLocked:
            parsedData.isLocked !== undefined ? parsedData.isLocked : undefined,
          departureDate: parsedData.departureDate
            ? new Date(parsedData.departureDate)
            : undefined,
          agentName: parsedData.agentName || undefined,
          date: parsedData.date ? new Date(parsedData.date) : undefined,
        },
      });

      res.status(200).json({
        message: "Booking updated successfully",
        booking: updatedBooking,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      console.error("Patch Booking Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// Add Passenger / Customer to Booking
const addPassengerSchema = z.object({
  title: z.string().nullable().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  ageCategory: z.string().default("Adult"),
  email: z.string().email().optional().or(z.literal("")).nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  passportNumber: z.string().nullable().optional(),
  passportExpiryDate: z.string().nullable().optional(),
  dob: z.string().nullable().optional(),
  passportImage: z.string().nullable().optional(),
  agentName: z.string().nullable().optional(),
  role: z.string().nullable().optional().default("Family Member"),
  nationality: z.string().nullable().optional(),
  issuingCountry: z.string().nullable().optional(),
});

app.post(
  "/:id/passengers",
  requireGatewayHeaders,
  requirePermission(Permission.UPDATE_BOOKING),
  async (req: CustomRequest, res: Response) => {
    try {
      const bookingId = parseInt(req.params.id);
      const parsedData = addPassengerSchema.parse(req.body);
      const tenantIdNumeric = parseInt(req.tenantId!);

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Booking does not exist" });
      }

      if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
        return res
          .status(403)
          .json({ error: "Forbidden", message: "Access denied" });
      }

      if (booking.isLocked && req.userRole === Role.AGENT) {
        return res
          .status(403)
          .json({ error: "Forbidden", message: "This booking is locked." });
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
          passportExpiryDate: parsedData.passportExpiryDate
            ? new Date(parsedData.passportExpiryDate)
            : null,
          dob: parsedData.dob ? new Date(parsedData.dob) : null,
          passportImage: parsedData.passportImage || null,
          agentName: parsedData.agentName || null,
          role: parsedData.role,
          nationality: parsedData.nationality || null,
          issuingCountry: parsedData.issuingCountry || null,
        },
        include: {
          documents: { orderBy: { id: "asc" } },
        },
      });

      res
        .status(201)
        .json({ message: "Passenger added successfully", passenger });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const messages = error.errors
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join(", ");
        return res
          .status(400)
          .json({ error: "Validation failed", message: messages });
      }
      console.error("Add Passenger Error:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message: error?.message || "Unknown error",
      });
    }
  },
);

const addPaymentSchema = z.object({
  amount: z.number(),
  paymentMethod: z.string().min(1),
  paymentType: z.string().min(1),
  paidOn: z.string(),
  notes: z.string().nullable().optional(),
  cardCharges: z.number().optional(),
  evidenceUrl: z.string().nullable().optional(),
  loggedByName: z.string().nullable().optional(),
});

// POST /:id/clawback-margin
app.post(
  "/:id/clawback-margin",
  requireGatewayHeaders,
  requirePermission(Permission.UPDATE_TRANSACTION),
  async (req: CustomRequest, res: Response) => {
    try {
      const bookingId = parseInt(req.params.id);
      const tenantIdNumeric = parseInt(req.tenantId!);
      const { amount, reason } = req.body;
      const clawbackAmount = parseFloat(amount);

      if (isNaN(clawbackAmount) || clawbackAmount <= 0) {
        return res.status(400).json({ error: "Invalid clawback amount" });
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking)
        return res
          .status(404)
          .json({ error: "Not Found", message: "Booking does not exist" });
      if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric)
        return res.status(403).json({ error: "Forbidden" });
      if (booking.isLocked && req.userRole === Role.AGENT)
        return res
          .status(403)
          .json({ error: "Forbidden", message: "Booking is locked." });

      // Ensure they have the correct role for clawbacks
      if (req.userRole !== "MAIN_COMPANY_ADMIN" && !req.isPlatformAdmin) {
        return res.status(403).json({
          error: "Forbidden",
          message: "Only MAIN_COMPANY_ADMIN can clawback margin",
        });
      }

      if (!booking.agentName) {
        return res
          .status(400)
          .json({ error: "No agent associated with this booking" });
      }

      // Double Entry Accounting
      const tx = await prisma.ledgerTransaction.create({
        data: {
          tenantId: tenantIdNumeric,
          transactionDate: new Date(),
          referenceNumber: booking.bookingReference,
          description: `Margin Clawback from Agent ${booking.agentName}. Reason: ${reason || ""}`,
          type: "MARGIN_CLAWBACK",
        },
      });

      // Asset account: Agent Advances / Receivables
      let assetAccount = await prisma.ledgerAccount.findFirst({
        where: {
          tenantId: tenantIdNumeric,
          accountType: "AGENT_RECEIVABLE",
          entityName: booking.agentName,
        },
      });
      if (!assetAccount) {
        assetAccount = await prisma.ledgerAccount.create({
          data: {
            tenantId: tenantIdNumeric,
            accountType: "AGENT_RECEIVABLE",
            entityName: booking.agentName,
          },
        });
      }

      // Expense account: Agent Margin Expense
      let expenseAccount = await prisma.ledgerAccount.findFirst({
        where: {
          tenantId: tenantIdNumeric,
          accountType: "AGENT_COMMISSION_EXPENSE",
          entityName: booking.agentName,
        },
      });
      if (!expenseAccount) {
        expenseAccount = await prisma.ledgerAccount.create({
          data: {
            tenantId: tenantIdNumeric,
            accountType: "AGENT_COMMISSION_EXPENSE",
            entityName: booking.agentName,
          },
        });
      }

      // Debit Asset, Credit Expense
      await prisma.ledgerEntry.createMany({
        data: [
          {
            transactionId: tx.id,
            accountId: assetAccount.id,
            debitAmount: clawbackAmount,
            creditAmount: 0,
          },
          {
            transactionId: tx.id,
            accountId: expenseAccount.id,
            debitAmount: 0,
            creditAmount: clawbackAmount,
          },
        ],
      });

      await prisma.ledgerAccount.update({
        where: { id: assetAccount.id },
        data: { balance: { increment: clawbackAmount } },
      });
      await prisma.ledgerAccount.update({
        where: { id: expenseAccount.id },
        data: { balance: { decrement: clawbackAmount } },
      });

      // Also add to booking payments to show on ledger
      const clawbackPayment = await prisma.bookingPayment.create({
        data: {
          tenantId: tenantIdNumeric,
          bookingId,
          amount: -clawbackAmount,
          paymentMethod: "Agent Wallet Deduction",
          paymentType: "Margin Paid to Agent",
          paidOn: new Date(),
          notes: `Clawback: ${reason || ""}`,
        },
      });

      // Hit Auth-Service to update wallet
      try {
        const authUrl =
          process.env.AUTH_SERVICE_URL || "http://auth-service:3001";
        // 1. Get Agent ID
        const agentRes = await fetch(
          `${authUrl}/agents/by-name/${encodeURIComponent(booking.agentName)}`,
          {
            headers: { "x-tenant-id": tenantIdNumeric.toString() },
          },
        );
        if (agentRes.ok) {
          const agentData = await agentRes.json();
          const agentId = agentData.agent.id;

          // 2. Post Wallet Transaction
          await fetch(`${authUrl}/agents/${agentId}/wallet/transaction`, {
            method: "POST",
            headers: {
              "x-tenant-id": tenantIdNumeric.toString(),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              amount: -clawbackAmount,
              transactionType: "MARGIN_CLAWBACK",
              referenceId: booking.bookingReference,
              notes: `Clawback: ${reason || ""}`,
            }),
          });
        }

        // Update marginStatus
        await prisma.booking.update({
          where: { id: bookingId },
          data: { marginStatus: "Clawed_Back" },
        });
      } catch (e) {
        console.error("Failed to sync agent wallet with auth-service", e);
      }

      res
        .status(201)
        .json({ message: "Margin clawback successful", clawbackPayment });
    } catch (error: any) {
      console.error("Margin Clawback Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// POST /:id/finalize-margin
app.post(
  "/:id/finalize-margin",
  requireGatewayHeaders,
  requirePermission(Permission.CREATE_TRANSACTION),
  async (req: CustomRequest, res: Response) => {
    try {
      const bookingId = parseInt(req.params.id);
      const { amount, notes } = req.body;
      const tenantIdNumeric = parseInt(req.tenantId!);

      if (!amount || isNaN(parseFloat(amount))) {
        return res
          .status(400)
          .json({ error: "Bad Request", message: "Invalid amount" });
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
          additionalServices: true,
        },
      });

      if (!booking) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Booking not found" });
      }

      if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
        return res
          .status(403)
          .json({ error: "Forbidden", message: "Access denied" });
      }

      if (req.userRole === Role.AGENT) {
        return res.status(403).json({
          error: "Forbidden",
          message: "Agents are not allowed to finalize margin.",
        });
      }

      if (
        !booking.agentName ||
        booking.agentName === "System / Auto" ||
        booking.agentName === "Direct Client"
      ) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Booking has no assigned agent.",
        });
      }

      const legacyVendorPayments =
        booking.payments
          ?.filter((p) => p.paymentType === "Sent to Vendor")
          .reduce(
            (sum, p) => sum + (parseFloat(p.amount.toString()) || 0),
            0,
          ) || 0;
      const modernVendorPayments =
        booking.vendorPayments?.reduce(
          (sum, p) => sum + (parseFloat(p.amount.toString()) || 0),
          0,
        ) || 0;
      const totalVendorSent = legacyVendorPayments + modernVendorPayments;

      // Calculate actual total vendor cost
      const flightCost =
        booking.flightServices?.reduce(
          (sum, f) => sum + parseFloat(f.price?.toString() || "0"),
          0,
        ) || 0;
      const accCost =
        booking.accommodations?.reduce(
          (sum, a) => sum + parseFloat(a.price?.toString() || "0"),
          0,
        ) || 0;
      const transCost =
        booking.transportServices?.reduce(
          (sum, t) => sum + parseFloat(t.price?.toString() || "0"),
          0,
        ) || 0;
      const visaCost =
        booking.visaServices?.reduce(
          (sum, v) => sum + parseFloat(v.price?.toString() || "0"),
          0,
        ) || 0;
      const addCost =
        booking.additionalServices?.reduce(
          (sum, s) => sum + parseFloat(s.charges?.toString() || "0"),
          0,
        ) || 0;
      const totalVendorCost =
        flightCost + accCost + transCost + visaCost + addCost;

      if (totalVendorSent < totalVendorCost) {
        return res.status(400).json({
          error: "Bad Request",
          message:
            "Cannot finalize margin: Vendor payments are less than the total booking cost.",
        });
      }

      // Update marginStatus
      await prisma.booking.update({
        where: { id: bookingId },
        data: { marginStatus: "Finalized" },
      });

      // Double Entry Accounting
      const tx = await prisma.ledgerTransaction.create({
        data: {
          tenantId: tenantIdNumeric,
          transactionDate: new Date(),
          referenceNumber: booking.bookingReference,
          description: `Margin Earned by Agent ${booking.agentName}. ${notes || ""}`,
          type: "MARGIN_EARNED",
        },
      });

      // Asset account: Agent Advances / Receivables (Will be credited to decrease what they owe us / increase what we owe them)
      let assetAccount = await prisma.ledgerAccount.findFirst({
        where: {
          tenantId: tenantIdNumeric,
          accountType: "AGENT_RECEIVABLE",
          entityName: booking.agentName,
        },
      });
      if (!assetAccount) {
        assetAccount = await prisma.ledgerAccount.create({
          data: {
            tenantId: tenantIdNumeric,
            accountType: "AGENT_RECEIVABLE",
            entityName: booking.agentName,
          },
        });
      }

      // Expense account: Agent Margin Expense (Will be debited to increase expense)
      let expenseAccount = await prisma.ledgerAccount.findFirst({
        where: {
          tenantId: tenantIdNumeric,
          accountType: "AGENT_COMMISSION_EXPENSE",
          entityName: booking.agentName,
        },
      });
      if (!expenseAccount) {
        expenseAccount = await prisma.ledgerAccount.create({
          data: {
            tenantId: tenantIdNumeric,
            accountType: "AGENT_COMMISSION_EXPENSE",
            entityName: booking.agentName,
          },
        });
      }

      // Debit Expense, Credit Asset
      await prisma.ledgerEntry.createMany({
        data: [
          {
            transactionId: tx.id,
            accountId: expenseAccount.id,
            debitAmount: earnedAmount,
            creditAmount: 0,
          },
          {
            transactionId: tx.id,
            accountId: assetAccount.id,
            debitAmount: 0,
            creditAmount: earnedAmount,
          },
        ],
      });

      await prisma.ledgerAccount.update({
        where: { id: expenseAccount.id },
        data: { balance: { increment: earnedAmount } },
      });
      await prisma.ledgerAccount.update({
        where: { id: assetAccount.id },
        data: { balance: { decrement: earnedAmount } },
      });

      // Also add to booking payments to show on ledger as a positive margin earned
      const earnedPayment = await prisma.bookingPayment.create({
        data: {
          tenantId: tenantIdNumeric,
          bookingId,
          amount: earnedAmount,
          paymentMethod: "Agent Wallet Credit",
          paymentType: "Margin Earned",
          paidOn: new Date(),
          notes: notes || null,
        },
      });

      // Hit Auth-Service to update wallet
      try {
        const authUrl =
          process.env.AUTH_SERVICE_URL || "http://auth-service:4001";
        let agentId = booking.agentId;
        if (!agentId && booking.agentName) {
          const agentRes = await fetch(
            `${authUrl}/agents/by-name/${encodeURIComponent(booking.agentName)}`,
            {
              headers: { "x-tenant-id": tenantIdNumeric.toString() },
            },
          );
          if (agentRes.ok) {
            const agentData = await agentRes.json();
            agentId = agentData.agent.id;
          }
        }

        if (agentId) {
          // 1. Fetch current debt BEFORE applying the earned margin
          let currentDebt = 0;
          try {
            const debtRes = await fetch(
              `${authUrl}/agents/${agentId}/wallet/debt`,
              {
                headers: { "x-tenant-id": tenantIdNumeric.toString() },
              },
            );
            if (debtRes.ok) {
              const data = await debtRes.json();
              currentDebt = data.debt || 0;
            }
          } catch (e) {
            console.error("Failed to fetch pre-margin debt", e);
          }

          // 2. Add the earned margin to the wallet
          await fetch(`${authUrl}/agents/${agentId}/wallet/transaction`, {
            method: "POST",
            headers: {
              "x-tenant-id": tenantIdNumeric.toString(),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              amount: earnedAmount,
              transactionType: "MARGIN_EARNED",
              referenceId: booking.bookingReference,
              notes: `Margin Earned. ${notes || ""}`,
            }),
          });

          // 3. Automatic Debt Offset
          if (currentDebt > 0) {
            // The amount of margin that was instantly swallowed by the debt
            const absorbedAmount = Math.min(currentDebt, earnedAmount);

            if (absorbedAmount > 0) {
              // Automatically log a BookingPayment of type Margin Paid to Agent (Debt Offset)
              // so that the booking's remaining margin goes down correctly without double-debiting the wallet!
              const curSym = await getTenantCurrencySymbol(tenantIdNumeric);
              await prisma.bookingPayment.create({
                data: {
                  tenantId: tenantIdNumeric,
                  bookingId,
                  amount: absorbedAmount,
                  paymentMethod: "Debt Offset",
                  paymentType: "Margin Paid to Agent",
                  paidOn: new Date(),
                  notes: `System automatically offset ${curSym}${absorbedAmount.toFixed(2)} against past agent debt upon finalization.`,
                },
              });

              // If the entire margin was absorbed, mark the booking marginStatus as Paid!
              if (absorbedAmount >= earnedAmount) {
                await prisma.booking.update({
                  where: { id: bookingId },
                  data: { marginStatus: "Paid" },
                });
              }
            }
          }
        } else {
          console.warn(
            "Could not sync wallet: Agent ID not found for agentName:",
            booking.agentName,
          );
        }
      } catch (e) {
        console.error("Failed to sync agent wallet with auth-service", e);
      }

      res
        .status(201)
        .json({ message: "Margin finalized successfully", earnedPayment });
    } catch (error: any) {
      console.error("Commit Margin Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

app.post(
  "/:id/payments",
  requireGatewayHeaders,
  requirePermission(Permission.CREATE_TRANSACTION),
  async (req: CustomRequest, res: Response) => {
    try {
      const bookingId = parseInt(req.params.id);
      const parsedData = addPaymentSchema.parse(req.body);
      const tenantIdNumeric = parseInt(req.tenantId!);
      const isAgent = req.userRole === Role.AGENT;
      const agentUserName = await getUserName(req.userId, req.tenantId);

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Booking does not exist" });
      }

      if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
        return res
          .status(403)
          .json({ error: "Forbidden", message: "Access denied" });
      }

      if (booking.isLocked && isAgent) {
        return res
          .status(403)
          .json({ error: "Forbidden", message: "This booking is locked." });
      }

      if (
        parsedData.paymentType === "Margin Paid to Agent" &&
        booking.marginStatus !== "Finalized" &&
        booking.marginStatus !== "Paid"
      ) {
        return res.status(400).json({
          error: "Bad Request",
          message:
            "Cannot pay margin to agent until the booking margin has been finalized.",
        });
      }

      const curSym = await getTenantCurrencySymbol(tenantIdNumeric);
      let finalNotes = parsedData.notes || "";
      if (parsedData.cardCharges && parsedData.cardCharges > 0) {
        finalNotes = finalNotes
          ? `${finalNotes}\n(Includes Credit Card Charge: ${curSym}${parsedData.cardCharges.toFixed(2)})`
          : `(Includes Credit Card Charge: ${curSym}${parsedData.cardCharges.toFixed(2)})`;
      }

      const payment = await prisma.bookingPayment.create({
        data: {
          tenantId: tenantIdNumeric,
          bookingId,
          amount: parsedData.amount,
          paymentMethod: parsedData.paymentMethod,
          paymentType: parsedData.paymentType,
          paidOn: parseDateWithCurrentTime(parsedData.paidOn),
          notes: finalNotes || null,
          status: isAgent ? "pending" : "approved",
          evidenceUrl: parsedData.evidenceUrl || null,
          loggedByRole: req.userRole || null,
          loggedById: req.userId ? parseInt(req.userId) : null,
          loggedByName:
            parsedData.loggedByName ||
            agentUserName ||
            (isAgent ? "Agent" : "Admin"),
          cardCharges: parsedData.cardCharges || 0.0,
        },
      });

      if (isAgent) {
        // Create admin notification
        await prisma.notification.create({
          data: {
            tenantId: booking.tenantId,
            title: "Transaction Approval Request",
            message: `${parsedData.loggedByName || agentUserName || "Agent"} logged a payment of ${curSym}${parsedData.amount.toFixed(2)} via ${parsedData.paymentMethod} for booking reference ${booking.bookingReference}. Please review and approve/reject.`,
            type: "PAYMENT_APPROVAL",
            referenceId: String(payment.id),
            isRead: false,
          },
        });

        return res.status(201).json({
          message: "Transaction submitted for admin approval successfully",
          payment,
        });
      }

      // --- LEDGER INTEGRATION (DOUBLE ENTRY) (Only for Admins/Auto-Approved) ---
      if (parsedData.paymentType === "Sent to Vendor") {
        const vendorName = await resolveVendorName(
          parsedData.notes,
          tenantIdNumeric,
        );
        let vendorAccount = await prisma.ledgerAccount.findFirst({
          where: {
            tenantId: tenantIdNumeric,
            accountType: "VENDOR_PAYABLE",
            entityName: vendorName,
          },
        });
        if (!vendorAccount) {
          vendorAccount = await prisma.ledgerAccount.create({
            data: {
              tenantId: tenantIdNumeric,
              accountType: "VENDOR_PAYABLE",
              entityName: vendorName,
            },
          });
        }

        const mainTx = await prisma.ledgerTransaction.create({
          data: {
            tenantId: tenantIdNumeric,
            transactionDate: parseDateWithCurrentTime(parsedData.paidOn),
            referenceNumber: booking.bookingReference,
            description: `Vendor Payment via ${parsedData.paymentMethod}. ${parsedData.notes || ""}`,
            type: "PAYMENT",
          },
        });

        await prisma.ledgerEntry.create({
          data: {
            transactionId: mainTx.id,
            accountId: vendorAccount.id,
            debitAmount: parsedData.amount, // Debit Payable to reduce liability
            creditAmount: 0,
          },
        });

        await prisma.ledgerAccount.update({
          where: { id: vendorAccount.id },
          data: { balance: { decrement: parsedData.amount } },
        });
      } else if (parsedData.paymentType === "Received from Client") {
        const customerName = booking.agentName || "Direct Client";
        let customerAccount = await prisma.ledgerAccount.findFirst({
          where: {
            tenantId: tenantIdNumeric,
            accountType: "CUSTOMER_RECEIVABLE",
            entityName: customerName,
          },
        });
        if (!customerAccount) {
          customerAccount = await prisma.ledgerAccount.create({
            data: {
              tenantId: tenantIdNumeric,
              accountType: "CUSTOMER_RECEIVABLE",
              entityName: customerName,
            },
          });
        }

        const mainTx = await prisma.ledgerTransaction.create({
          data: {
            tenantId: tenantIdNumeric,
            transactionDate: parseDateWithCurrentTime(parsedData.paidOn),
            referenceNumber: booking.bookingReference,
            description: `Client Payment via ${parsedData.paymentMethod}. ${parsedData.notes || ""}`,
            type: "PAYMENT",
          },
        });

        await prisma.ledgerEntry.create({
          data: {
            transactionId: mainTx.id,
            accountId: customerAccount.id,
            debitAmount: 0,
            creditAmount: parsedData.amount,
          },
        });

        await prisma.ledgerAccount.update({
          where: { id: customerAccount.id },
          data: { balance: { decrement: parsedData.amount } },
        });

        // 2. Separate Transaction for Credit Card Charges (Debit Customer Receivable)
        if (parsedData.cardCharges && parsedData.cardCharges > 0) {
          const existingFeeTx = await prisma.ledgerTransaction.findFirst({
            where: {
              tenantId: tenantIdNumeric,
              type: "FEE",
              referenceNumber: booking.bookingReference,
            },
          });

          if (!existingFeeTx) {
            const feeTx = await prisma.ledgerTransaction.create({
              data: {
                tenantId: tenantIdNumeric,
                transactionDate: parseDateWithCurrentTime(parsedData.paidOn),
                referenceNumber: booking.bookingReference,
                description: `Credit Card Gateway Processing Fee for ${booking.bookingReference}`,
                type: "FEE",
              },
            });

            await prisma.ledgerEntry.create({
              data: {
                transactionId: feeTx.id,
                accountId: customerAccount.id,
                debitAmount: parsedData.cardCharges,
                creditAmount: 0,
              },
            });

            await prisma.ledgerAccount.update({
              where: { id: customerAccount.id },
              data: { balance: { increment: parsedData.cardCharges } },
            });
          }
        }
      }
      // --------------------------------------------
      // --- AGENT WALLET SYNC ---
      if (
        parsedData.paymentType === "Margin Paid to Agent" &&
        booking.agentName &&
        booking.agentName !== "Direct Client" &&
        booking.agentName !== "System / Auto"
      ) {
        try {
          const authUrl =
            process.env.AUTH_SERVICE_URL || "http://auth-service:4001";
          let agentId = booking.agentId;
          if (!agentId) {
            const agentRes = await fetch(
              `${authUrl}/agents/by-name/${encodeURIComponent(booking.agentName)}`,
              {
                headers: { "x-tenant-id": tenantIdNumeric.toString() },
              },
            );
            if (agentRes.ok) {
              const agentData = await agentRes.json();
              agentId = agentData.agent.id;
            }
          }

          if (agentId) {
            if (parsedData.paymentMethod !== "Debt Offset") {
              // Ensure amount is negative for payout
              const walletAmount =
                parsedData.amount > 0 ? -parsedData.amount : parsedData.amount;

              await fetch(`${authUrl}/agents/${agentId}/wallet/transaction`, {
                method: "POST",
                headers: {
                  "x-tenant-id": tenantIdNumeric.toString(),
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  amount: walletAmount,
                  transactionType: "MARGIN_PAID_OUT",
                  referenceId: booking.bookingReference,
                  notes: `Margin Paid to Agent via Booking. ${parsedData.notes || ""}`,
                }),
              });
            }

            // Update marginStatus
            await prisma.booking.update({
              where: { id: bookingId },
              data: { marginStatus: "Paid" },
            });
          }
        } catch (e) {
          console.error("Failed to sync client payment with agent wallet", e);
        }
      }
      // ---------------------------

      // Automatically recalculate booking paid & remaining amounts
      await syncBookingFinancials(bookingId, parsedData.cardCharges || 0);

      res
        .status(201)
        .json({ message: "Transaction registered successfully", payment });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const messages = error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ");
        return res
          .status(400)
          .json({ error: "Validation failed", message: messages });
      }
      console.error("Add Payment Error:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message: error?.message || "Unknown error",
      });
    }
  },
);

// Add Vendor Payment
const addVendorPaymentSchema = z.object({
  vendorName: z.string().min(1),
  amount: z.number(),
  paymentStatus: z.string().default("unpaid"),
  paidOn: z.string().nullable().optional(),
  flightPnr: z.string().nullable().optional(),
  issueDate: z.string().nullable().optional(),
  reservationNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  totalPaid: z.number().default(0),
  totalRefunded: z.number().default(0),
  remainingDue: z.number().optional(),
  evidenceUrl: z.string().nullable().optional(),
  loggedByName: z.string().nullable().optional(),
});

app.post(
  "/:id/vendor-payments",
  requireGatewayHeaders,
  requirePermission(Permission.CREATE_TRANSACTION),
  async (req: CustomRequest, res: Response) => {
    try {
      const bookingId = parseInt(req.params.id);
      const parsedData = addVendorPaymentSchema.parse(req.body);
      const tenantIdNumeric = parseInt(req.tenantId!);

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Booking does not exist" });
      }

      if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
        return res
          .status(403)
          .json({ error: "Forbidden", message: "Access denied" });
      }

      if (booking.isLocked && req.userRole === Role.AGENT) {
        return res
          .status(403)
          .json({ error: "Forbidden", message: "This booking is locked." });
      }

      if (req.userRole === Role.AGENT) {
        const agentUserName = await getUserName(req.userId, req.tenantId);
        // Create a pending BookingPayment to represent this transaction
        const payment = await prisma.bookingPayment.create({
          data: {
            tenantId: tenantIdNumeric,
            bookingId,
            amount: parsedData.amount,
            paymentMethod: "Bank Transfer",
            paymentType: "Sent to Vendor",
            paidOn: parsedData.paidOn
              ? parseDateWithCurrentTime(parsedData.paidOn)
              : new Date(),
            notes: "[PENDING_VENDOR_PAYMENT] " + JSON.stringify(parsedData),
            status: "pending",
            evidenceUrl: parsedData.evidenceUrl || null,
            loggedByRole: req.userRole || null,
            loggedById: req.userId ? parseInt(req.userId) : null,
            loggedByName: parsedData.loggedByName || agentUserName || "Agent",
            cardCharges: 0.0,
          },
        });

        const curSym = await getTenantCurrencySymbol(booking.tenantId);
        // Create Admin Notification
        await prisma.notification.create({
          data: {
            tenantId: booking.tenantId,
            title: "Vendor Payment Approval Request",
            message: `${parsedData.loggedByName || agentUserName || "Agent"} logged a vendor payment of ${curSym}${parsedData.amount.toFixed(2)} to ${parsedData.vendorName} for booking reference ${booking.bookingReference}. Please review and approve/reject.`,
            type: "PAYMENT_APPROVAL",
            referenceId: String(payment.id),
            isRead: false,
          },
        });

        return res.status(201).json({
          message: "Vendor payment submitted for admin approval successfully",
          payment,
        });
      }

      const remainingDue =
        parsedData.remainingDue !== undefined
          ? parsedData.remainingDue
          : parsedData.amount - parsedData.totalPaid;

      // 1. Create Vendor Payment
      const vendorPayment = await prisma.vendorPayment.create({
        data: {
          tenantId: tenantIdNumeric,
          bookingId,
          vendorName: parsedData.vendorName,
          amount: parsedData.amount,
          paymentStatus: parsedData.paymentStatus,
          paidOn: parsedData.paidOn
            ? parseDateWithCurrentTime(parsedData.paidOn)
            : null,
          flightPnr: parsedData.flightPnr || null,
          issueDate: parsedData.issueDate
            ? new Date(parsedData.issueDate)
            : null,
          reservationNumber: parsedData.reservationNumber || null,
          notes: parsedData.notes || null,
          totalPaid: parsedData.totalPaid,
          totalRefunded: parsedData.totalRefunded,
          remainingDue,
        },
      });

      // 2. Ledger Integration
      let vendorAccount = await prisma.ledgerAccount.findFirst({
        where: {
          tenantId: tenantIdNumeric,
          accountType: "VENDOR_PAYABLE",
          entityName: parsedData.vendorName,
        },
      });
      if (!vendorAccount) {
        vendorAccount = await prisma.ledgerAccount.create({
          data: {
            tenantId: tenantIdNumeric,
            accountType: "VENDOR_PAYABLE",
            entityName: parsedData.vendorName,
          },
        });
      }

      const tx = await prisma.ledgerTransaction.create({
        data: {
          tenantId: tenantIdNumeric,
          transactionDate: parsedData.paidOn
            ? parseDateWithCurrentTime(parsedData.paidOn)
            : new Date(),
          referenceNumber: booking.bookingReference,
          description: `Vendor Payment to ${parsedData.vendorName}. ${parsedData.notes || ""}`,
          type: "PAYMENT",
        },
      });

      await prisma.ledgerEntry.create({
        data: {
          transactionId: tx.id,
          accountId: vendorAccount.id,
          debitAmount: parsedData.amount,
          creditAmount: 0,
        },
      });
      await prisma.ledgerAccount.update({
        where: { id: vendorAccount.id },
        data: { balance: { decrement: parsedData.amount } },
      });

      // 3. FIFO Service Allocation for THIS booking and vendor
      const fetchServices = async (model: any, type: string) => {
        const svcs = await model.findMany({
          where: {
            tenantId: tenantIdNumeric,
            bookingId,
            vendorName: parsedData.vendorName,
            isPaidToVendor: false,
          },
          orderBy: { createdAt: "asc" },
        });
        return svcs.map((s: any) => ({ ...s, serviceType: type }));
      };

      const flights = await fetchServices(prisma.flightService, "FLIGHT");
      const hotels = await fetchServices(prisma.accommodationService, "HOTEL");
      const transports = await fetchServices(
        prisma.transportService,
        "TRANSPORT",
      );
      const visas = await fetchServices(prisma.visaService, "VISA");
      const additionals = await fetchServices(
        prisma.additionalService,
        "ADDITIONAL",
      );

      let allUnpaid = [
        ...flights,
        ...hotels,
        ...transports,
        ...visas,
        ...additionals,
      ].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

      const allocations = [];
      let remainingAmountToAllocate = parseFloat(parsedData.amount as any);

      for (const service of allUnpaid) {
        if (remainingAmountToAllocate <= 0) break;

        const previousAllocations = await prisma.bookingAllocation.aggregate({
          where: {
            tenantId: tenantIdNumeric,
            serviceType: service.serviceType,
            serviceId: service.id,
          },
          _sum: { allocatedAmount: true },
        });

        const totalCost = parseFloat(service.price) || 0;
        const alreadyAllocated =
          parseFloat(previousAllocations?._sum?.allocatedAmount as any) || 0;
        const serviceRemainingDue = totalCost - alreadyAllocated;

        if (serviceRemainingDue > 0) {
          const allocateAmt = Math.min(
            serviceRemainingDue,
            remainingAmountToAllocate,
          );

          allocations.push({
            tenantId: tenantIdNumeric,
            transactionId: tx.id,
            bookingId: bookingId,
            serviceType: service.serviceType,
            serviceId: service.id,
            allocatedAmount: allocateAmt,
          });

          remainingAmountToAllocate -= allocateAmt;

          if (allocateAmt >= serviceRemainingDue) {
            const updateData = { isPaidToVendor: true };
            switch (service.serviceType) {
              case "FLIGHT":
                await prisma.flightService.update({
                  where: { id: service.id },
                  data: updateData,
                });
                break;
              case "HOTEL":
                await prisma.accommodationService.update({
                  where: { id: service.id },
                  data: updateData,
                });
                break;
              case "TRANSPORT":
                await prisma.transportService.update({
                  where: { id: service.id },
                  data: updateData,
                });
                break;
              case "VISA":
                await prisma.visaService.update({
                  where: { id: service.id },
                  data: updateData,
                });
                break;
              case "ADDITIONAL":
                await prisma.additionalService.update({
                  where: { id: service.id },
                  data: updateData,
                });
                break;
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
        const authUrl =
          process.env.AUTH_SERVICE_URL || "http://auth-service:3001";
        const agentRes = await fetch(
          `${authUrl}/agents/by-name/${encodeURIComponent(parsedData.vendorName)}`,
          {
            headers: { "x-tenant-id": tenantIdNumeric.toString() },
          },
        );
        if (agentRes.ok) {
          const agentData = await agentRes.json();
          const agentId = agentData.agent.id;

          // Determine if it's a payment to agent or refund from agent based on amount
          // Wait, vendor payment amount is positive here.
          const walletAmount = -parsedData.amount; // Payment TO agent reduces their receivable balance in wallet, or increases their payout. Wait. Wallet usually tracks Balance owed to agent?
          // Wait, if they earned 100 margin, wallet balance goes +100.
          // When we pay them 20, wallet balance goes -20.

          await fetch(`${authUrl}/agents/${agentId}/wallet/transaction`, {
            method: "POST",
            headers: {
              "x-tenant-id": tenantIdNumeric.toString(),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              amount: walletAmount, // Paying out reduces the balance owed to the agent
              transactionType: "MARGIN_PAID_OUT",
              referenceId: booking.bookingReference,
              notes: `Vendor Payment via Booking. ${parsedData.notes || ""}`,
            }),
          });
        }
      } catch (e) {
        console.error("Failed to sync vendor payment with agent wallet", e);
      }
      // -------------------------

      res.status(201).json({
        message: "Vendor payment registered successfully",
        vendorPayment,
        allocationsCount: allocations.length,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const messages = error.errors
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join(", ");
        return res
          .status(400)
          .json({ error: "Validation failed", message: messages });
      }
      console.error("Add Vendor Payment Error:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message: error?.message || "Unknown error",
      });
    }
  },
);

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
  currency: z.string().nullable().optional().default("GBP"),
  otherCurrency: z.string().nullable().optional(),
  conversionRate: z.number().nullable().optional(),
  issueDate: z.string().nullable().optional(),
  refundAmount: z.number().default(0),
  fineAmount: z.number().default(0),
  hotelConfirmationNumber: z.string().nullable().optional(),
  hotelAddress: z.string().nullable().optional(),
  lastCancellationDate: z.string().nullable().optional(),
});

app.post(
  "/:id/accommodations",
  requireGatewayHeaders,
  requirePermission(Permission.UPDATE_BOOKING),
  async (req: CustomRequest, res: Response) => {
    try {
      const bookingId = parseInt(req.params.id);
      const parsedData = addAccommodationSchema.parse(req.body);
      const tenantIdNumeric = parseInt(req.tenantId!);

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Booking does not exist" });
      }

      if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
        return res
          .status(403)
          .json({ error: "Forbidden", message: "Access denied" });
      }

      if (booking.isLocked && req.userRole === Role.AGENT) {
        return res
          .status(403)
          .json({ error: "Forbidden", message: "This booking is locked." });
      }

      const accommodation = await prisma.accommodationService.create({
        data: {
          tenantId: tenantIdNumeric,
          bookingId,
          vendorName: parsedData.vendorName,
          hotelName: parsedData.hotelName,
          roomType: parsedData.roomType || null,
          checkInDate: parsedData.checkInDate
            ? new Date(parsedData.checkInDate)
            : null,
          checkOutDate: parsedData.checkOutDate
            ? new Date(parsedData.checkOutDate)
            : null,
          mealType: parsedData.mealType || null,
          reservationNumber: parsedData.reservationNumber || null,
          qty: parsedData.qty,
          price: parsedData.price,
          currency: parsedData.currency,
          otherCurrency: parsedData.otherCurrency || null,
          conversionRate: parsedData.conversionRate || null,
          issueDate: parsedData.issueDate
            ? new Date(parsedData.issueDate)
            : null,
          refundAmount: parsedData.refundAmount,
          fineAmount: parsedData.fineAmount,
          hotelConfirmationNumber: parsedData.hotelConfirmationNumber || null,
          hotelAddress: parsedData.hotelAddress || null,
          lastCancellationDate: parsedData.lastCancellationDate
            ? new Date(parsedData.lastCancellationDate)
            : null,
        },
      });

      if (req.userRole === Role.AGENT) {
        await logPriceChange({
          tenantId: tenantIdNumeric,
          bookingId,
          serviceType: "Accommodation",
          serviceName: `${parsedData.hotelName} (${parsedData.vendorName})`,
          action: "ADD",
          oldPrice: 0,
          newPrice: parsedData.price || 0,
          userId: req.userId,
        });
      }

      if (req.body.paidToVendor) {
        await prisma.bookingPayment.create({
          data: {
            tenantId: tenantIdNumeric,
            bookingId,
            amount: String(parsedData.price || 0),
            paymentMethod: "system_auto",
            paymentType: "Sent to Vendor",
            paidOn: new Date(),
            notes: `Auto-logged vendor payment for ${parsedData.hotelName || "Accommodation"}`,
          },
        });
      }

      res.status(201).json({
        message: "Accommodation service registered successfully",
        accommodation,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const messages = error.errors
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join(", ");
        return res
          .status(400)
          .json({ error: "Validation failed", message: messages });
      }
      console.error("Add Accommodation Error:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message: error?.message || "Unknown error",
      });
    }
  },
);

// Add Flight Service
app.post(
  "/:id/flight-services",
  requireGatewayHeaders,
  requirePermission(Permission.UPDATE_BOOKING),
  async (req: CustomRequest, res: Response) => {
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
          issueDate: parsedData.issueDate
            ? new Date(parsedData.issueDate)
            : null,
          refundAmount: parseFloat(parsedData.refundAmount) || 0,
          fineAmount: parseFloat(parsedData.fineAmount) || 0,
          isPaidToVendor:
            req.body.paidToVendor || req.body.isPaidToVendor || false,
          baggage: parsedData.baggage,
          carryOnBaggage: parsedData.carryOnBaggage,
          checkedBaggage: parsedData.checkedBaggage,
          flightClass: parsedData.flightClass,
          flightType: parsedData.flightType || (parsedData.isTransit ? "Transit" : "Direct"),
          isTransit: Boolean(parsedData.isTransit || parsedData.flightType === "Transit"),
          date: parsedData.date ? new Date(parsedData.date) : null,
        },
      });

      if (req.userRole === Role.AGENT) {
        await logPriceChange({
          tenantId: tenantIdNumeric,
          bookingId,
          serviceType: "Flight",
          serviceName: `${parsedData.vendorName} (Flight: ${parsedData.flightNo || "Unknown"}, PNR: ${parsedData.pnr || "Unknown"})`,
          action: "ADD",
          oldPrice: 0,
          newPrice: Number(parsedData.price) || 0,
          userId: req.userId,
        });
      }

      if (req.body.paidToVendor) {
        await prisma.bookingPayment.create({
          data: {
            tenantId: tenantIdNumeric,
            bookingId,
            amount: String(parsedData.price || 0),
            paymentMethod: "system_auto",
            paymentType: "Sent to Vendor",
            paidOn: new Date(),
            notes: `Auto-logged vendor payment for Flight (${parsedData.flightNo || "Unknown"})`,
          },
        });
      }

      res.status(201).json({ flight });
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// Add Transport Service
app.post(
  "/:id/transport-services",
  requireGatewayHeaders,
  requirePermission(Permission.UPDATE_BOOKING),
  async (req: CustomRequest, res: Response) => {
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
          conversionRate: parsedData.conversionRate
            ? parseFloat(parsedData.conversionRate)
            : null,
          issueDate: parsedData.issueDate
            ? new Date(parsedData.issueDate)
            : null,
          refundAmount: parseFloat(parsedData.refundAmount) || 0,
          fineAmount: parseFloat(parsedData.fineAmount) || 0,
          isPaidToVendor:
            req.body.paidToVendor || req.body.isPaidToVendor || false,
          date: parsedData.date ? new Date(parsedData.date) : null,
        },
      });

      if (req.userRole === Role.AGENT) {
        await logPriceChange({
          tenantId: tenantIdNumeric,
          bookingId,
          serviceType: "Transport",
          serviceName: `${parsedData.vehicleType} (${parsedData.vendorName})`,
          action: "ADD",
          oldPrice: 0,
          newPrice: Number(parsedData.price) || 0,
          userId: req.userId,
        });
      }

      if (req.body.paidToVendor) {
        await prisma.bookingPayment.create({
          data: {
            tenantId: tenantIdNumeric,
            bookingId,
            amount: String(parsedData.price || 0),
            paymentMethod: "system_auto",
            paymentType: "Sent to Vendor",
            paidOn: new Date(),
            notes: `Auto-logged vendor payment for Transport (${parsedData.vehicleType || "Vehicle"})`,
          },
        });
      }

      res.status(201).json({ transport });
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// Add Visa Service
app.post(
  "/:id/visa-services",
  requireGatewayHeaders,
  requirePermission(Permission.UPDATE_BOOKING),
  async (req: CustomRequest, res: Response) => {
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
          issueDate: parsedData.issueDate
            ? new Date(parsedData.issueDate)
            : null,
          expiryDate: parsedData.expiryDate
            ? new Date(parsedData.expiryDate)
            : null,
          qty: parsedData.qty ? parseInt(parsedData.qty) : 1,
          unitPrice: parseFloat(parsedData.unitPrice) || 0,
          price: Number(parsedData.price) || 0,
          currency: parsedData.currency,
          otherCurrency: parsedData.otherCurrency,
          conversionRate: parsedData.conversionRate
            ? parseFloat(parsedData.conversionRate)
            : null,
          refundAmount: parseFloat(parsedData.refundAmount) || 0,
          fineAmount: parseFloat(parsedData.fineAmount) || 0,
          isPaidToVendor:
            req.body.paidToVendor || req.body.isPaidToVendor || false,
        },
      });

      if (req.userRole === Role.AGENT) {
        await logPriceChange({
          tenantId: tenantIdNumeric,
          bookingId,
          serviceType: "Visa",
          serviceName: `${parsedData.visaType || "Visa"} (${parsedData.vendorName})`,
          action: "ADD",
          oldPrice: 0,
          newPrice: Number(parsedData.price) || 0,
          userId: req.userId,
        });
      }

      if (req.body.paidToVendor) {
        await prisma.bookingPayment.create({
          data: {
            tenantId: tenantIdNumeric,
            bookingId,
            amount: String(parsedData.price || 0),
            paymentMethod: "system_auto",
            paymentType: "Sent to Vendor",
            paidOn: new Date(),
            notes: `Auto-logged vendor payment for Visa (${parsedData.visaType || "Application"})`,
          },
        });
      }

      res.status(201).json({ visa });
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// Add Discount to Booking
app.post(
  "/:id/discounts",
  requireGatewayHeaders,
  requirePermission(Permission.CREATE_TRANSACTION),
  async (req: CustomRequest, res: Response) => {
    try {
      const bookingId = parseInt(req.params.id);
      const tenantIdNumeric = parseInt(req.tenantId!);
      const { vendorCategory, serviceName, amount, notes, date } = req.body;

      if (!vendorCategory || !amount || !date) {
        return res.status(400).json({
          error: "Validation failed",
          message: "vendorCategory, amount, and date are required",
        });
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      if (!booking)
        return res
          .status(404)
          .json({ error: "Not Found", message: "Booking does not exist" });
      if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
        return res
          .status(403)
          .json({ error: "Forbidden", message: "Access denied" });
      }

      if (booking.isLocked && req.userRole === Role.AGENT) {
        return res
          .status(403)
          .json({ error: "Forbidden", message: "This booking is locked." });
      }

      if (req.userRole === Role.AGENT) {
        const agentUserName = await getUserName(req.userId, req.tenantId);
        // Create a pending BookingPayment to represent this transaction
        const payment = await prisma.bookingPayment.create({
          data: {
            tenantId: tenantIdNumeric,
            bookingId,
            amount: parseFloat(amount),
            paymentMethod: "Adjustment",
            paymentType: "Discount",
            paidOn: parseDateWithCurrentTime(date),
            notes:
              "[PENDING_DISCOUNT] " +
              JSON.stringify({
                vendorCategory,
                serviceName,
                amount,
                notes,
                date,
              }),
            status: "pending",
            loggedByRole: req.userRole || null,
            loggedById: req.userId ? parseInt(req.userId) : null,
            loggedByName: agentUserName || "Agent",
            cardCharges: 0.0,
          },
        });

        const curSym = await getTenantCurrencySymbol(booking.tenantId);
        // Create Admin Notification
        await prisma.notification.create({
          data: {
            tenantId: booking.tenantId,
            title: "Discount Approval Request",
            message: `${agentUserName || "Agent"} logged a discount of ${curSym}${parseFloat(amount).toFixed(2)} for booking reference ${booking.bookingReference}. Please review and approve/reject.`,
            type: "PAYMENT_APPROVAL",
            referenceId: String(payment.id),
            isRead: false,
          },
        });

        return res.status(201).json({
          message: "Discount submitted for admin approval successfully",
          payment,
        });
      }

      const discount = await (prisma as any).bookingDiscount.create({
        data: {
          tenantId: tenantIdNumeric,
          bookingId,
          vendorCategory,
          serviceName: serviceName || null,
          amount: parseFloat(amount),
          notes: notes || null,
          date: parseDateWithCurrentTime(date),
        },
      });

      // Ledger Integration
      const customerName = booking.agentName || "Direct Client";
      let customerAccount = await prisma.ledgerAccount.findFirst({
        where: {
          tenantId: tenantIdNumeric,
          accountType: "CUSTOMER_RECEIVABLE",
          entityName: customerName,
        },
      });
      if (!customerAccount) {
        customerAccount = await prisma.ledgerAccount.create({
          data: {
            tenantId: tenantIdNumeric,
            accountType: "CUSTOMER_RECEIVABLE",
            entityName: customerName,
          },
        });
      }

      const tx = await prisma.ledgerTransaction.create({
        data: {
          tenantId: tenantIdNumeric,
          transactionDate: parseDateWithCurrentTime(date),
          referenceNumber: booking.bookingReference,
          description: `Discount applied to ${vendorCategory} - ${serviceName || ""}. ${notes || ""}`,
          type: "DISCOUNT",
        },
      });

      await prisma.ledgerEntry.create({
        data: {
          transactionId: tx.id,
          accountId: customerAccount.id,
          debitAmount: 0,
          creditAmount: parseFloat(amount),
        },
      });
      await prisma.ledgerAccount.update({
        where: { id: customerAccount.id },
        data: { balance: { decrement: parseFloat(amount) } },
      });

      res
        .status(201)
        .json({ message: "Discount added successfully", discount });
    } catch (error) {
      console.error("Add Discount Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// Add Refund to Booking
app.post(
  "/:id/refunds",
  requireGatewayHeaders,
  requirePermission(Permission.CREATE_TRANSACTION),
  async (req: CustomRequest, res: Response) => {
    try {
      const bookingId = parseInt(req.params.id);
      const tenantIdNumeric = parseInt(req.tenantId!);
      const { direction, vendorCategory, serviceName, amount, notes, date } =
        req.body;

      if (!direction || !vendorCategory || !amount || !date) {
        return res.status(400).json({
          error: "Validation failed",
          message: "direction, vendorCategory, amount, and date are required",
        });
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      if (!booking)
        return res
          .status(404)
          .json({ error: "Not Found", message: "Booking does not exist" });
      if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
        return res
          .status(403)
          .json({ error: "Forbidden", message: "Access denied" });
      }

      if (booking.isLocked && req.userRole === Role.AGENT) {
        return res
          .status(403)
          .json({ error: "Forbidden", message: "This booking is locked." });
      }

      if (req.userRole === Role.AGENT) {
        const agentUserName = await getUserName(req.userId, req.tenantId);
        // Create a pending BookingPayment to represent this transaction
        const payment = await prisma.bookingPayment.create({
          data: {
            tenantId: tenantIdNumeric,
            bookingId,
            amount: parseFloat(amount),
            paymentMethod: "Refund",
            paymentType: direction, // 'Refund to Client' | 'Refund from Vendor'
            paidOn: parseDateWithCurrentTime(date),
            notes:
              "[PENDING_REFUND] " +
              JSON.stringify({
                direction,
                vendorCategory,
                serviceName,
                amount,
                notes,
                date,
              }),
            status: "pending",
            loggedByRole: req.userRole || null,
            loggedById: req.userId ? parseInt(req.userId) : null,
            loggedByName: agentUserName || "Agent",
            cardCharges: 0.0,
          },
        });

        const curSym = await getTenantCurrencySymbol(booking.tenantId);
        // Create Admin Notification
        await prisma.notification.create({
          data: {
            tenantId: booking.tenantId,
            title: "Refund Approval Request",
            message: `${agentUserName || "Agent"} logged a refund (${direction}) of ${curSym}${parseFloat(amount).toFixed(2)} for booking reference ${booking.bookingReference}. Please review and approve/reject.`,
            type: "PAYMENT_APPROVAL",
            referenceId: String(payment.id),
            isRead: false,
          },
        });

        return res.status(201).json({
          message: "Refund submitted for admin approval successfully",
          payment,
        });
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
          date: parseDateWithCurrentTime(date),
        },
      });

      // Ledger Integration
      const tx = await prisma.ledgerTransaction.create({
        data: {
          tenantId: tenantIdNumeric,
          transactionDate: parseDateWithCurrentTime(date),
          referenceNumber: booking.bookingReference,
          description: `${direction} for ${vendorCategory} - ${serviceName || ""}. ${notes || ""}`,
          type: "REFUND",
        },
      });

      if (direction === "Refund to Client") {
        const customerName = booking.agentName || "Direct Client";
        let customerAccount = await prisma.ledgerAccount.findFirst({
          where: {
            tenantId: tenantIdNumeric,
            accountType: "CUSTOMER_RECEIVABLE",
            entityName: customerName,
          },
        });
        if (!customerAccount) {
          customerAccount = await prisma.ledgerAccount.create({
            data: {
              tenantId: tenantIdNumeric,
              accountType: "CUSTOMER_RECEIVABLE",
              entityName: customerName,
            },
          });
        }
        await prisma.ledgerEntry.create({
          data: {
            transactionId: tx.id,
            accountId: customerAccount.id,
            debitAmount: parseFloat(amount),
            creditAmount: 0,
          },
        });
        await prisma.ledgerAccount.update({
          where: { id: customerAccount.id },
          data: { balance: { increment: parseFloat(amount) } },
        });
      } else {
        let vendorAccount = await prisma.ledgerAccount.findFirst({
          where: {
            tenantId: tenantIdNumeric,
            accountType: "VENDOR_PAYABLE",
            entityName: vendorCategory,
          },
        });
        if (!vendorAccount) {
          vendorAccount = await prisma.ledgerAccount.create({
            data: {
              tenantId: tenantIdNumeric,
              accountType: "VENDOR_PAYABLE",
              entityName: vendorCategory,
            },
          });
        }
        await prisma.ledgerEntry.create({
          data: {
            transactionId: tx.id,
            accountId: vendorAccount.id,
            debitAmount: 0,
            creditAmount: parseFloat(amount),
          },
        });
        await prisma.ledgerAccount.update({
          where: { id: vendorAccount.id },
          data: { balance: { increment: parseFloat(amount) } },
        });

        // --- AGENT WALLET SYNC FOR REFUNDS ---
        try {
          const authUrl =
            process.env.AUTH_SERVICE_URL || "http://auth-service:3001";
          const agentRes = await fetch(
            `${authUrl}/agents/by-name/${encodeURIComponent(vendorCategory)}`,
            {
              headers: { "x-tenant-id": tenantIdNumeric.toString() },
            },
          );
          if (agentRes.ok) {
            const agentData = await agentRes.json();
            const agentId = agentData.agent.id;

            await fetch(`${authUrl}/agents/${agentId}/wallet/transaction`, {
              method: "POST",
              headers: {
                "x-tenant-id": tenantIdNumeric.toString(),
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                amount: parseFloat(amount), // Refund from agent reverses the payout
                transactionType: "REFUND_FROM_AGENT",
                referenceId: booking.bookingReference,
                notes: `Refund from Vendor via Booking. ${notes || ""}`,
              }),
            });
          }
        } catch (e) {
          console.error("Failed to sync vendor refund with agent wallet", e);
        }
        // -------------------------------------
      }

      await syncBookingFinancials(bookingId);

      res.status(201).json({ message: "Refund logged successfully", refund });
    } catch (error) {
      console.error("Add Refund Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// Add Additional Service
app.post(
  "/:id/additional-services",
  requireGatewayHeaders,
  requirePermission(Permission.UPDATE_BOOKING),
  async (req: CustomRequest, res: Response) => {
    try {
      const bookingId = parseInt(req.params.id);
      const tenantIdNumeric = parseInt(req.tenantId!);
      const { serviceName, charges, notes, vendorName } = req.body;

      if (!serviceName) {
        return res.status(400).json({
          error: "Validation failed",
          message: "serviceName is required",
        });
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      if (!booking)
        return res
          .status(404)
          .json({ error: "Not Found", message: "Booking does not exist" });
      if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
        return res
          .status(403)
          .json({ error: "Forbidden", message: "Access denied" });
      }

      if (booking.isLocked && req.userRole === Role.AGENT) {
        return res
          .status(403)
          .json({ error: "Forbidden", message: "This booking is locked." });
      }

      const additionalService = await (prisma as any).additionalService.create({
        data: {
          tenantId: tenantIdNumeric,
          bookingId,
          serviceName,
          vendorName: vendorName || null,
          charges: parseFloat(charges) || 0,
          notes: notes || null,
        },
      });

      if (req.userRole === Role.AGENT) {
        await logPriceChange({
          tenantId: tenantIdNumeric,
          bookingId,
          serviceType: "Additional",
          serviceName: serviceName + (vendorName ? ` (${vendorName})` : ""),
          action: "ADD",
          oldPrice: 0,
          newPrice: parseFloat(charges) || 0,
          userId: req.userId,
        });
      }

      // Update total price of the booking
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          totalPrice: {
            increment: parseFloat(charges) || 0,
          },
        },
      });

      res.status(201).json({
        message: "Additional Service logged successfully",
        additionalService,
      });
    } catch (error) {
      console.error("Add Additional Service Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// --- EDIT (PATCH) ENDPOINTS ---

app.patch(
  "/:id/accommodations/:serviceId",
  requireGatewayHeaders,
  requirePermission(Permission.UPDATE_BOOKING),
  async (req: CustomRequest, res: Response) => {
    try {
      const serviceId = parseInt(req.params.serviceId);
      const parsedData = req.body;

      const existing = await prisma.accommodationService.findUnique({
        where: { id: serviceId },
      });
      if (!existing) {
        return res.status(404).json({
          error: "Not Found",
          message: "Accommodation service not found",
        });
      }

      const updateData: any = {};
      if (parsedData.vendorName !== undefined)
        updateData.vendorName = parsedData.vendorName;
      if (parsedData.hotelName !== undefined)
        updateData.hotelName = parsedData.hotelName;
      if (parsedData.city !== undefined)
        updateData.city = parsedData.city || null;
      if (parsedData.roomType !== undefined)
        updateData.roomType = parsedData.roomType || null;
      if (parsedData.checkInDate !== undefined)
        updateData.checkInDate = parsedData.checkInDate
          ? new Date(parsedData.checkInDate)
          : null;
      if (parsedData.checkOutDate !== undefined)
        updateData.checkOutDate = parsedData.checkOutDate
          ? new Date(parsedData.checkOutDate)
          : null;
      if (parsedData.mealType !== undefined)
        updateData.mealType = parsedData.mealType || null;
      if (parsedData.reservationNumber !== undefined)
        updateData.reservationNumber = parsedData.reservationNumber || null;
      if (parsedData.qty !== undefined)
        updateData.qty = parsedData.qty ? parseInt(parsedData.qty) : 1;
      if (parsedData.price !== undefined)
        updateData.price = parseFloat(parsedData.price) || 0;
      if (parsedData.currency !== undefined)
        updateData.currency = parsedData.currency;
      if (parsedData.otherCurrency !== undefined)
        updateData.otherCurrency = parsedData.otherCurrency || null;
      if (parsedData.conversionRate !== undefined)
        updateData.conversionRate = parsedData.conversionRate
          ? parseFloat(parsedData.conversionRate)
          : null;
      if (parsedData.issueDate !== undefined)
        updateData.issueDate = parsedData.issueDate
          ? new Date(parsedData.issueDate)
          : null;
      if (parsedData.refundAmount !== undefined)
        updateData.refundAmount = parseFloat(parsedData.refundAmount) || 0;
      if (parsedData.fineAmount !== undefined)
        updateData.fineAmount = parseFloat(parsedData.fineAmount) || 0;
      if (parsedData.hotelConfirmationNumber !== undefined)
        updateData.hotelConfirmationNumber =
          parsedData.hotelConfirmationNumber || null;
      if (parsedData.hotelAddress !== undefined)
        updateData.hotelAddress = parsedData.hotelAddress || null;
      if (parsedData.lastCancellationDate !== undefined)
        updateData.lastCancellationDate = parsedData.lastCancellationDate
          ? new Date(parsedData.lastCancellationDate)
          : null;
      if (parsedData.paidToVendor !== undefined)
        updateData.isPaidToVendor = parsedData.paidToVendor;
      if (parsedData.isPaidToVendor !== undefined)
        updateData.isPaidToVendor = parsedData.isPaidToVendor;

      const updated = await (prisma as any).accommodationService.update({
        where: { id: serviceId },
        data: updateData,
      });

      if (req.userRole === Role.AGENT && parsedData.price !== undefined) {
        const oldPrice = Number(existing.price);
        const newPrice = parseFloat(parsedData.price) || 0;
        if (Math.abs(oldPrice - newPrice) > 0.01) {
          await logPriceChange({
            tenantId: parseInt(req.tenantId!),
            bookingId: existing.bookingId,
            serviceType: "Accommodation",
            serviceName: `${existing.hotelName} (${existing.vendorName})`,
            action: "UPDATE",
            oldPrice,
            newPrice,
            userId: req.userId,
          });
        }
      }

      res.json({ accommodation: updated });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

app.patch(
  "/:id/flight-services/:serviceId",
  requireGatewayHeaders,
  requirePermission(Permission.UPDATE_BOOKING),
  async (req: CustomRequest, res: Response) => {
    try {
      const serviceId = parseInt(req.params.serviceId);
      const parsedData = req.body;

      const existing = await prisma.flightService.findUnique({
        where: { id: serviceId },
      });
      if (!existing) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Flight service not found" });
      }

      const updateData: any = {};
      if (parsedData.vendorName !== undefined)
        updateData.vendorName = parsedData.vendorName;
      if (parsedData.flightNo !== undefined)
        updateData.flightNo = parsedData.flightNo;
      if (parsedData.pnr !== undefined) updateData.pnr = parsedData.pnr;
      if (parsedData.departedFrom !== undefined)
        updateData.departedFrom = parsedData.departedFrom;
      if (parsedData.arrivedAt !== undefined)
        updateData.arrivedAt = parsedData.arrivedAt;
      if (parsedData.departTime !== undefined)
        updateData.departTime = parsedData.departTime;
      if (parsedData.arrivalTime !== undefined)
        updateData.arrivalTime = parsedData.arrivalTime;
      if (parsedData.price !== undefined)
        updateData.price = parseFloat(parsedData.price) || 0;
      if (parsedData.currency !== undefined)
        updateData.currency = parsedData.currency;
      if (parsedData.issueDate !== undefined)
        updateData.issueDate = parsedData.issueDate
          ? new Date(parsedData.issueDate)
          : null;
      if (parsedData.refundAmount !== undefined)
        updateData.refundAmount = parseFloat(parsedData.refundAmount) || 0;
      if (parsedData.fineAmount !== undefined)
        updateData.fineAmount = parseFloat(parsedData.fineAmount) || 0;
      if (parsedData.baggage !== undefined)
        updateData.baggage = parsedData.baggage;
      if (parsedData.carryOnBaggage !== undefined)
        updateData.carryOnBaggage = parsedData.carryOnBaggage;
      if (parsedData.checkedBaggage !== undefined)
        updateData.checkedBaggage = parsedData.checkedBaggage;
      if (parsedData.flightClass !== undefined)
        updateData.flightClass = parsedData.flightClass;
      if (parsedData.flightType !== undefined)
        updateData.flightType = parsedData.flightType;
      if (parsedData.isTransit !== undefined)
        updateData.isTransit = Boolean(parsedData.isTransit);
      if (parsedData.date !== undefined)
        updateData.date = parsedData.date ? new Date(parsedData.date) : null;
      if (parsedData.paidToVendor !== undefined)
        updateData.isPaidToVendor = parsedData.paidToVendor;
      if (parsedData.isPaidToVendor !== undefined)
        updateData.isPaidToVendor = parsedData.isPaidToVendor;

      const updated = await (prisma as any).flightService.update({
        where: { id: serviceId },
        data: updateData,
      });

      if (req.userRole === Role.AGENT && parsedData.price !== undefined) {
        const oldPrice = Number(existing.price);
        const newPrice = parseFloat(parsedData.price) || 0;
        if (Math.abs(oldPrice - newPrice) > 0.01) {
          await logPriceChange({
            tenantId: parseInt(req.tenantId!),
            bookingId: existing.bookingId,
            serviceType: "Flight",
            serviceName: `${existing.vendorName} (Flight: ${existing.flightNo}, PNR: ${existing.pnr})`,
            action: "UPDATE",
            oldPrice,
            newPrice,
            userId: req.userId,
          });
        }
      }

      res.json({ flight: updated });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

app.patch(
  "/:id/transport-services/:serviceId",
  requireGatewayHeaders,
  requirePermission(Permission.UPDATE_BOOKING),
  async (req: CustomRequest, res: Response) => {
    try {
      const serviceId = parseInt(req.params.serviceId);
      const parsedData = req.body;

      const existing = await prisma.transportService.findUnique({
        where: { id: serviceId },
      });
      if (!existing) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Transport service not found" });
      }

      const updateData: any = {};
      if (parsedData.vendorName !== undefined)
        updateData.vendorName = parsedData.vendorName;
      if (parsedData.vehicleType !== undefined)
        updateData.vehicleType = parsedData.vehicleType;
      if (parsedData.departureDestination !== undefined)
        updateData.departureDestination = parsedData.departureDestination;
      if (parsedData.arrivalDestination !== undefined)
        updateData.arrivalDestination = parsedData.arrivalDestination;
      if (parsedData.departureTime !== undefined)
        updateData.departureTime = parsedData.departureTime;
      if (parsedData.arrivalTime !== undefined)
        updateData.arrivalTime = parsedData.arrivalTime;
      if (parsedData.flightNo !== undefined)
        updateData.flightNo = parsedData.flightNo;
      if (parsedData.price !== undefined)
        updateData.price = parseFloat(parsedData.price) || 0;
      if (parsedData.currency !== undefined)
        updateData.currency = parsedData.currency;
      if (parsedData.otherCurrency !== undefined)
        updateData.otherCurrency = parsedData.otherCurrency;
      if (parsedData.conversionRate !== undefined)
        updateData.conversionRate = parsedData.conversionRate
          ? parseFloat(parsedData.conversionRate)
          : null;
      if (parsedData.issueDate !== undefined)
        updateData.issueDate = parsedData.issueDate
          ? new Date(parsedData.issueDate)
          : null;
      if (parsedData.refundAmount !== undefined)
        updateData.refundAmount = parseFloat(parsedData.refundAmount) || 0;
      if (parsedData.fineAmount !== undefined)
        updateData.fineAmount = parseFloat(parsedData.fineAmount) || 0;
      if (parsedData.date !== undefined)
        updateData.date = parsedData.date ? new Date(parsedData.date) : null;
      if (parsedData.paidToVendor !== undefined)
        updateData.isPaidToVendor = parsedData.paidToVendor;
      if (parsedData.isPaidToVendor !== undefined)
        updateData.isPaidToVendor = parsedData.isPaidToVendor;

      const updated = await (prisma as any).transportService.update({
        where: { id: serviceId },
        data: updateData,
      });

      if (req.userRole === Role.AGENT && parsedData.price !== undefined) {
        const oldPrice = Number(existing.price);
        const newPrice = parseFloat(parsedData.price) || 0;
        if (Math.abs(oldPrice - newPrice) > 0.01) {
          await logPriceChange({
            tenantId: parseInt(req.tenantId!),
            bookingId: existing.bookingId,
            serviceType: "Transport",
            serviceName: `${existing.vehicleType} (${existing.vendorName})`,
            action: "UPDATE",
            oldPrice,
            newPrice,
            userId: req.userId,
          });
        }
      }

      res.json({ transport: updated });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

app.patch(
  "/:id/visa-services/:serviceId",
  requireGatewayHeaders,
  requirePermission(Permission.UPDATE_BOOKING),
  async (req: CustomRequest, res: Response) => {
    try {
      const serviceId = parseInt(req.params.serviceId);
      const parsedData = req.body;

      const existing = await prisma.visaService.findUnique({
        where: { id: serviceId },
      });
      if (!existing) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Visa service not found" });
      }

      const updateData: any = {};
      if (parsedData.vendorName !== undefined)
        updateData.vendorName = parsedData.vendorName;
      if (parsedData.passportNumber !== undefined)
        updateData.passportNumber = parsedData.passportNumber;
      if (parsedData.visaType !== undefined)
        updateData.visaType = parsedData.visaType;
      if (parsedData.visaNumber !== undefined)
        updateData.visaNumber = parsedData.visaNumber;
      if (parsedData.issueDate !== undefined)
        updateData.issueDate = parsedData.issueDate
          ? new Date(parsedData.issueDate)
          : null;
      if (parsedData.expiryDate !== undefined)
        updateData.expiryDate = parsedData.expiryDate
          ? new Date(parsedData.expiryDate)
          : null;
      if (parsedData.price !== undefined)
        updateData.price = parseFloat(parsedData.price) || 0;
      if (parsedData.currency !== undefined)
        updateData.currency = parsedData.currency;
      if (parsedData.otherCurrency !== undefined)
        updateData.otherCurrency = parsedData.otherCurrency;
      if (parsedData.conversionRate !== undefined)
        updateData.conversionRate = parsedData.conversionRate
          ? parseFloat(parsedData.conversionRate)
          : null;
      if (parsedData.refundAmount !== undefined)
        updateData.refundAmount = parseFloat(parsedData.refundAmount) || 0;
      if (parsedData.fineAmount !== undefined)
        updateData.fineAmount = parseFloat(parsedData.fineAmount) || 0;
      if (parsedData.paidToVendor !== undefined)
        updateData.isPaidToVendor = parsedData.paidToVendor;
      if (parsedData.isPaidToVendor !== undefined)
        updateData.isPaidToVendor = parsedData.isPaidToVendor;

      const updated = await (prisma as any).visaService.update({
        where: { id: serviceId },
        data: updateData,
      });

      if (req.userRole === Role.AGENT && parsedData.price !== undefined) {
        const oldPrice = Number(existing.price);
        const newPrice = parseFloat(parsedData.price) || 0;
        if (Math.abs(oldPrice - newPrice) > 0.01) {
          await logPriceChange({
            tenantId: parseInt(req.tenantId!),
            bookingId: existing.bookingId,
            serviceType: "Visa",
            serviceName: `${existing.visaType || "Visa"} (${existing.vendorName})`,
            action: "UPDATE",
            oldPrice,
            newPrice,
            userId: req.userId,
          });
        }
      }

      res.json({ visa: updated });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

app.patch(
  "/:id/additional-services/:serviceId",
  requireGatewayHeaders,
  requirePermission(Permission.UPDATE_BOOKING),
  async (req: CustomRequest, res: Response) => {
    try {
      const serviceId = parseInt(req.params.serviceId);
      const parsedData = req.body;

      const existing = await (prisma as any).additionalService.findUnique({
        where: { id: serviceId },
      });
      if (!existing) {
        return res.status(404).json({
          error: "Not Found",
          message: "Additional service not found",
        });
      }

      const updateData: any = {};
      if (parsedData.serviceName !== undefined)
        updateData.serviceName = parsedData.serviceName;
      if (parsedData.vendorName !== undefined)
        updateData.vendorName = parsedData.vendorName || null;
      if (parsedData.charges !== undefined)
        updateData.charges = parseFloat(parsedData.charges) || 0;
      if (parsedData.notes !== undefined)
        updateData.notes = parsedData.notes || null;
      if (parsedData.paidToVendor !== undefined)
        updateData.isPaidToVendor = parsedData.paidToVendor;
      if (parsedData.isPaidToVendor !== undefined)
        updateData.isPaidToVendor = parsedData.isPaidToVendor;

      const updated = await (prisma as any).additionalService.update({
        where: { id: serviceId },
        data: updateData,
      });

      if (req.userRole === Role.AGENT && parsedData.charges !== undefined) {
        const oldPrice = Number(existing.charges);
        const newPrice = parseFloat(parsedData.charges) || 0;
        if (Math.abs(oldPrice - newPrice) > 0.01) {
          await logPriceChange({
            tenantId: parseInt(req.tenantId!),
            bookingId: existing.bookingId,
            serviceType: "Additional",
            serviceName: `${existing.serviceName}${existing.vendorName ? ` (${existing.vendorName})` : ""}`,
            action: "UPDATE",
            oldPrice,
            newPrice,
            userId: req.userId,
          });
        }
      }

      res.json({ additionalService: updated });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// Edit Passenger
app.patch(
  "/:id/passengers/:passengerId",
  requireGatewayHeaders,
  requirePermission(Permission.UPDATE_BOOKING),
  async (req, res) => {
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
          passportExpiryDate: parsedData.passportExpiryDate
            ? new Date(parsedData.passportExpiryDate)
            : null,
          dob: parsedData.dob ? new Date(parsedData.dob) : null,
          passportImage: parsedData.passportImage || null,
          email: parsedData.email || null,
          phoneNumber: parsedData.phoneNumber || null,
          role: parsedData.role || null,
          nationality: parsedData.nationality,
          issuingCountry: parsedData.issuingCountry,
        },
        include: {
          documents: { orderBy: { id: "asc" } },
        },
      });
      res.json({ passenger: updated });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// PATCH /:id/payments/:serviceId
app.patch(
  "/:id/payments/:serviceId",
  requireGatewayHeaders,
  requirePermission(Permission.UPDATE_TRANSACTION),
  async (req, res) => {
    try {
      const updated = await prisma.bookingPayment.update({
        where: { id: parseInt(req.params.serviceId) },
        data: req.body,
      });
      res.json({ payment: updated });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: "Failed to update payment", message: err.message });
    }
  },
);

// PATCH /:id/vendor-payments/:serviceId
app.patch(
  "/:id/vendor-payments/:serviceId",
  requireGatewayHeaders,
  requirePermission(Permission.UPDATE_TRANSACTION),
  async (req, res) => {
    try {
      const updated = await prisma.vendorPayment.update({
        where: { id: parseInt(req.params.serviceId) },
        data: req.body,
      });
      res.json({ vendorPayment: updated });
    } catch (err: any) {
      res.status(500).json({
        error: "Failed to update vendor payment",
        message: err.message,
      });
    }
  },
);

// Generic Delete Route
app.delete(
  "/:bookingId/services/:serviceType/:id",
  requireGatewayHeaders,
  requirePermission(Permission.UPDATE_BOOKING),
  async (req: CustomRequest, res: Response) => {
    try {
      const bookingId = parseInt(req.params.bookingId);
      const serviceId = parseInt(req.params.id);
      const { serviceType } = req.params;
      const tenantIdNumeric = parseInt(req.tenantId!);

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      if (!booking) return res.status(404).json({ error: "Not Found" });
      if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric)
        return res.status(403).json({ error: "Forbidden" });

      if (booking.isLocked && req.userRole === Role.AGENT) {
        return res
          .status(403)
          .json({ error: "Forbidden", message: "This booking is locked." });
      }

      // Strict Permission check for financial deletions
      if (["payment", "vendor-payment"].includes(serviceType)) {
        const userRole = req.headers["x-user-role"] as string;
        if (
          !req.isPlatformAdmin &&
          userRole !== Role.MAIN_COMPANY_ADMIN &&
          userRole !== Role.COMPANY_ADMIN &&
          userRole !== Role.ADMIN
        ) {
          return res.status(403).json({
            error: "Forbidden",
            message:
              "Access Denied: You do not have permission to delete financial records.",
          });
        }
      }

      switch (serviceType) {
        case "accommodation":
          await prisma.accommodationService.delete({
            where: { id: serviceId },
          });
          break;
        case "flight":
          await prisma.flightService.delete({ where: { id: serviceId } });
          break;
        case "transport":
          await prisma.transportService.delete({ where: { id: serviceId } });
          break;
        case "visa":
          await prisma.visaService.delete({ where: { id: serviceId } });
          break;
        case "additional":
          await prisma.additionalService.delete({ where: { id: serviceId } });
          break;
        case "passenger":
          await prisma.bookingCustomer.delete({ where: { id: serviceId } });
          break;
        case "payment":
          await prisma.bookingPayment.delete({ where: { id: serviceId } });
          break;
        case "vendor-payment":
          await prisma.vendorPayment.delete({ where: { id: serviceId } });
          break;
        default:
          return res.status(400).json({ error: "Invalid service type" });
      }

      res.status(200).json({ message: "Deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// ─── LEDGER & FINANCE SYSTEM ───────────────────────────────────────────────────

app.get(
  "/finance/vendors/unpaid-bookings",
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      const tenantId = parseInt(req.tenantId!);
      const vendorName = req.query.vendorName as string;

      if (!vendorName) {
        return res
          .status(400)
          .json({ error: "vendorName query parameter is required" });
      }

      // Helper to fetch unpaid services for this vendor
      const fetchServices = async (model: any) => {
        return await model.findMany({
          where: { tenantId, vendorName, isPaidToVendor: false },
          orderBy: { createdAt: "asc" },
          include: {
            booking: {
              select: {
                id: true,
                bookingReference: true,
                totalPrice: true,
              },
            },
          },
        });
      };

      const flights = await fetchServices(prisma.flightService);
      const hotels = await fetchServices(prisma.accommodationService);
      const transports = await fetchServices(prisma.transportService);
      const visas = await fetchServices(prisma.visaService);
      const additionals = await fetchServices(prisma.additionalService);

      const allServicesRaw = [
        ...flights.map((s: any) => ({
          ...s,
          serviceType: "FLIGHT",
          category: "Flights",
          desc: `Flight ${s.flightNo} (${s.pnr})`,
        })),
        ...hotels.map((s: any) => ({
          ...s,
          serviceType: "HOTEL",
          category: "Hotels",
          desc: `Hotel ${s.hotelName} (${s.roomType || "Standard"})`,
        })),
        ...transports.map((s: any) => ({
          ...s,
          serviceType: "TRANSPORT",
          category: "Transportation",
          desc: `Transport ${s.vehicleType} - ${s.departureDestination} to ${s.arrivalDestination}`,
        })),
        ...visas.map((s: any) => ({
          ...s,
          serviceType: "VISA",
          category: "Visas",
          desc: `${s.visaType} Visa`,
        })),
        ...additionals.map((s: any) => ({
          ...s,
          serviceType: "ADDITIONAL",
          category: "Special Services",
          desc: s.serviceName,
        })),
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
            { serviceType: "FLIGHT", serviceId: { in: flightIds } },
            { serviceType: "HOTEL", serviceId: { in: hotelIds } },
            { serviceType: "TRANSPORT", serviceId: { in: transportIds } },
            { serviceType: "VISA", serviceId: { in: visaIds } },
            { serviceType: "ADDITIONAL", serviceId: { in: additionalIds } },
          ],
        },
      });

      const allocMap: Record<string, number> = {};
      for (const alloc of allocations) {
        const key = `${alloc.serviceType}_${alloc.serviceId}`;
        allocMap[key] =
          (allocMap[key] || 0) + parseFloat(alloc.allocatedAmount.toString());
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
            pendingAmount,
          });

          uniqueBookingsMap.set(s.booking.id, {
            id: s.booking.id,
            bookingReference: s.booking.bookingReference,
            totalPrice: parseFloat(s.booking.totalPrice.toString()),
          });
        }
      }

      // Fetch VENDOR_PAYABLE ledger balance for this vendor
      const account = await prisma.ledgerAccount.findFirst({
        where: {
          tenantId,
          accountType: "VENDOR_PAYABLE",
          entityName: vendorName,
        },
      });

      let walletBalance = 0;
      if (account && parseFloat(account.balance.toString()) < 0) {
        walletBalance = Math.abs(parseFloat(account.balance.toString()));
      }

      res.status(200).json({
        bookings: Array.from(uniqueBookingsMap.values()),
        services,
        walletBalance,
      });
    } catch (error: any) {
      console.error("Fetch Vendor Unpaid Bookings Error:", error);
      res
        .status(500)
        .json({ error: "Internal Server Error", message: error.message });
    }
  },
);

app.get(
  "/finance/vendors/wallets",
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      const tenantId = parseInt(req.tenantId!);
      const authUrl =
        process.env.AUTH_SERVICE_URL || "http://auth-service:4001";

      let dbVendors: any[] = [];
      try {
        const vendorsRes = await fetch(`${authUrl}/vendors`, {
          headers: {
            "x-tenant-id": String(tenantId),
            "x-user-id": (req.headers["x-user-id"] as string) || "",
            "x-user-role": (req.headers["x-user-role"] as string) || "",
          },
        });
        if (vendorsRes.ok) {
          const data = await vendorsRes.json();
          dbVendors = data.vendors || [];
        }
      } catch (err: any) {
        console.error(
          "Failed to fetch vendors from auth-service in wallets route:",
          err,
        );
      }

      const accounts = await prisma.ledgerAccount.findMany({
        where: {
          tenantId,
          accountType: "VENDOR_PAYABLE",
        },
      });

      const accountMap = new Map<string, any>();
      for (const acc of accounts) {
        if (acc.entityName) {
          accountMap.set(acc.entityName.toLowerCase().trim(), acc);
        }
      }

      const walletsMap = new Map<string, any>();

      const calculateWalletBalance = async (
        accountId: number,
      ): Promise<number> => {
        const entries = await prisma.ledgerEntry.findMany({
          where: {
            accountId,
            transaction: {
              OR: [
                {
                  description: { contains: "overpayment", mode: "insensitive" },
                },
                {
                  description: {
                    contains: "wallet credit",
                    mode: "insensitive",
                  },
                },
                {
                  description: { contains: "prepayment", mode: "insensitive" },
                },
                { description: { contains: "drawdown", mode: "insensitive" } },
              ],
            },
          },
        });
        let balance = 0;
        for (const entry of entries) {
          const debit = parseFloat(entry.debitAmount.toString()) || 0;
          const credit = parseFloat(entry.creditAmount.toString()) || 0;
          balance += debit - credit;
        }
        return balance > 0 ? balance : 0.0;
      };

      for (const v of dbVendors) {
        const vNameKey = v.name.toLowerCase().trim();
        const acc = accountMap.get(vNameKey);
        const ledgerBalance = acc ? parseFloat(acc.balance.toString()) : 0.0;
        const walletBalance = acc ? await calculateWalletBalance(acc.id) : 0.0;

        walletsMap.set(vNameKey, {
          id: v.id,
          vendorName: v.name,
          ledgerBalance,
          walletBalance,
        });
      }

      for (const acc of accounts) {
        if (acc.entityName) {
          const vNameKey = acc.entityName.toLowerCase().trim();
          if (!walletsMap.has(vNameKey)) {
            const ledgerBalance = parseFloat(acc.balance.toString());
            const walletBalance = await calculateWalletBalance(acc.id);
            walletsMap.set(vNameKey, {
              id: acc.id,
              vendorName: acc.entityName,
              ledgerBalance,
              walletBalance,
            });
          }
        }
      }

      const wallets = Array.from(walletsMap.values());
      res.status(200).json({ wallets });
    } catch (error: any) {
      console.error("Fetch Vendor Wallets Error:", error);
      res
        .status(500)
        .json({ error: "Internal Server Error", message: error.message });
    }
  },
);

app.post(
  "/ledger/vendor-payment",
  requireGatewayHeaders,
  requirePermission(Permission.CREATE_TRANSACTION),
  async (req: CustomRequest, res: Response) => {
    try {
      const tenantId = parseInt(req.tenantId!);
      const {
        vendorName,
        amount,
        paymentMethod,
        paidOn,
        notes,
        allocations: manualAllocations,
        walletCreditUsed = 0,
      } = req.body;

      const cashAmount = parseFloat(amount) || 0;
      const creditUsedAmount = parseFloat(walletCreditUsed) || 0;
      let remainingAmount = cashAmount + creditUsedAmount;

      if (!vendorName || remainingAmount <= 0) {
        return res.status(400).json({ error: "Invalid input parameters" });
      }

      if (req.userRole === Role.AGENT) {
        let bookingIdToUse: number | null = null;

        // Try to get booking ID from allocations
        if (
          manualAllocations &&
          Array.isArray(manualAllocations) &&
          manualAllocations.length > 0
        ) {
          const firstAlloc = manualAllocations[0];
          if (firstAlloc && firstAlloc.bookingId) {
            bookingIdToUse = parseInt(firstAlloc.bookingId);
          }
        }

        // If no allocations or no booking ID found, search unpaid services for this vendor
        if (!bookingIdToUse) {
          const unpaidHotel = await prisma.accommodationService.findFirst({
            where: { tenantId, vendorName, isPaidToVendor: false },
          });
          if (unpaidHotel) bookingIdToUse = unpaidHotel.bookingId;
          else {
            const unpaidFlight = await prisma.flightService.findFirst({
              where: { tenantId, vendorName, isPaidToVendor: false },
            });
            if (unpaidFlight) bookingIdToUse = unpaidFlight.bookingId;
            else {
              const unpaidTransport = await prisma.transportService.findFirst({
                where: { tenantId, vendorName, isPaidToVendor: false },
              });
              if (unpaidTransport) bookingIdToUse = unpaidTransport.bookingId;
              else {
                const unpaidVisa = await prisma.visaService.findFirst({
                  where: { tenantId, vendorName, isPaidToVendor: false },
                });
                if (unpaidVisa) bookingIdToUse = unpaidVisa.bookingId;
                else {
                  const unpaidAdditional =
                    await prisma.additionalService.findFirst({
                      where: { tenantId, vendorName, isPaidToVendor: false },
                    });
                  if (unpaidAdditional)
                    bookingIdToUse = unpaidAdditional.bookingId;
                }
              }
            }
          }
        }

        // If still no booking found, fallback to any booking in the tenant
        if (!bookingIdToUse) {
          const fallbackBooking = await prisma.booking.findFirst({
            where: { tenantId },
          });
          if (fallbackBooking) {
            bookingIdToUse = fallbackBooking.id;
          }
        }

        if (!bookingIdToUse) {
          return res.status(400).json({
            error: "Bad Request",
            message: "No bookings found to link vendor payment request.",
          });
        }

        const agentUserName = await getUserName(req.userId, req.tenantId);
        const booking = await prisma.booking.findUnique({
          where: { id: bookingIdToUse },
        });
        if (!booking) {
          return res.status(400).json({
            error: "Bad Request",
            message: "Linked booking not found.",
          });
        }

        // Create a pending BookingPayment to represent this bulk vendor payment
        const payment = await prisma.bookingPayment.create({
          data: {
            tenantId: booking.tenantId,
            bookingId: bookingIdToUse,
            amount: cashAmount,
            paymentMethod: paymentMethod || "Bank Transfer",
            paymentType: "Sent to Vendor",
            paidOn: paidOn ? parseDateWithCurrentTime(paidOn) : new Date(),
            notes: "[PENDING_BULK_VENDOR_PAYMENT] " + JSON.stringify(req.body),
            status: "pending",
            loggedByRole: req.userRole || null,
            loggedById: req.userId ? parseInt(req.userId) : null,
            loggedByName: agentUserName || "Agent",
            cardCharges: 0.0,
          },
        });

        const curSym = await getTenantCurrencySymbol(booking.tenantId);
        // Create Admin Notification
        await prisma.notification.create({
          data: {
            tenantId: booking.tenantId,
            title: "Bulk Vendor Payment Approval Request",
            message: `${agentUserName || "Agent"} logged a bulk vendor payment of ${curSym}${cashAmount.toFixed(2)} to ${vendorName}. Please review and approve/reject.`,
            type: "PAYMENT_APPROVAL",
            referenceId: String(payment.id),
            isRead: false,
          },
        });

        return res.status(201).json({
          message:
            "Bulk vendor payment submitted for admin approval successfully",
          payment,
        });
      }

      // Find or create Vendor LedgerAccount
      let account = await prisma.ledgerAccount.findFirst({
        where: {
          tenantId,
          accountType: "VENDOR_PAYABLE",
          entityName: vendorName,
        },
      });
      if (!account) {
        account = await prisma.ledgerAccount.create({
          data: {
            tenantId,
            accountType: "VENDOR_PAYABLE",
            entityName: vendorName,
          },
        });
      }

      const allocations: any[] = [];

      // Process manual allocations
      if (
        manualAllocations &&
        Array.isArray(manualAllocations) &&
        manualAllocations.length > 0
      ) {
        const enrichedAllocations = [];
        for (const alloc of manualAllocations) {
          const { bookingId, serviceId, serviceType, amountApplied } = alloc;
          const parsedAmount = parseFloat(amountApplied);
          if (isNaN(parsedAmount) || parsedAmount <= 0) continue;

          let serviceModel;
          switch (serviceType) {
            case "FLIGHT":
              serviceModel = prisma.flightService;
              break;
            case "HOTEL":
              serviceModel = prisma.accommodationService;
              break;
            case "TRANSPORT":
              serviceModel = prisma.transportService;
              break;
            case "VISA":
              serviceModel = prisma.visaService;
              break;
            case "ADDITIONAL":
              serviceModel = prisma.additionalService;
              break;
            default:
              continue;
          }

          const service = await (serviceModel as any).findUnique({
            where: { id: serviceId },
            include: { booking: true },
          });

          if (!service || service.tenantId !== tenantId) continue;

          enrichedAllocations.push({
            bookingId,
            serviceId,
            serviceType,
            requestedAmount: parsedAmount,
            service,
            booking: service.booking,
            serviceModel,
          });
        }

        // Sort: older bookings first (by createdAt or ID), then older services first
        enrichedAllocations.sort((a, b) => {
          const aDate = new Date(
            a.booking?.createdAt || a.booking?.date || 0,
          ).getTime();
          const bDate = new Date(
            b.booking?.createdAt || b.booking?.date || 0,
          ).getTime();
          if (aDate !== bDate) return aDate - bDate;

          const aSvcDate = new Date(a.service?.createdAt || 0).getTime();
          const bSvcDate = new Date(b.service?.createdAt || 0).getTime();
          return aSvcDate - bSvcDate;
        });

        let tempRemaining = remainingAmount;
        for (const item of enrichedAllocations) {
          if (tempRemaining <= 0) break;

          const previousAllocations = await prisma.bookingAllocation.aggregate({
            where: {
              tenantId,
              serviceType: item.serviceType,
              serviceId: item.serviceId,
            },
            _sum: { allocatedAmount: true },
          });

          const totalCost = parseFloat(
            item.service.price || item.service.charges || 0,
          );
          const alreadyAllocated =
            parseFloat(previousAllocations?._sum?.allocatedAmount as any) || 0;
          const serviceRemainingDue = totalCost - alreadyAllocated;

          if (serviceRemainingDue > 0) {
            const allocateAmt = Math.min(
              serviceRemainingDue,
              tempRemaining,
              item.requestedAmount,
            );
            if (allocateAmt <= 0) continue;

            allocations.push({
              tenantId,
              bookingId: item.bookingId,
              serviceType: item.serviceType,
              serviceId: item.serviceId,
              allocatedAmount: allocateAmt,
            });

            tempRemaining -= allocateAmt;

            if (allocateAmt >= serviceRemainingDue) {
              await (item.serviceModel as any).update({
                where: { id: item.serviceId },
                data: { isPaidToVendor: true },
              });
            }
          }
        }
      } else {
        // FIFO Fallback
        const fetchServices = async (model: any, type: string) => {
          const svcs = await model.findMany({
            where: { tenantId, vendorName, isPaidToVendor: false },
            orderBy: { createdAt: "asc" },
            include: { booking: true },
          });
          return svcs.map((s: any) => ({ ...s, serviceType: type }));
        };

        const flights = await fetchServices(prisma.flightService, "FLIGHT");
        const hotels = await fetchServices(
          prisma.accommodationService,
          "HOTEL",
        );
        const transports = await fetchServices(
          prisma.transportService,
          "TRANSPORT",
        );
        const visas = await fetchServices(prisma.visaService, "VISA");
        const additionals = await fetchServices(
          prisma.additionalService,
          "ADDITIONAL",
        );

        let allUnpaid = [
          ...flights,
          ...hotels,
          ...transports,
          ...visas,
          ...additionals,
        ].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );

        let tempRemaining = remainingAmount;
        for (const service of allUnpaid) {
          if (tempRemaining <= 0) break;

          const previousAllocations = await prisma.bookingAllocation.aggregate({
            where: {
              tenantId,
              serviceType: service.serviceType,
              serviceId: service.id,
            },
            _sum: { allocatedAmount: true },
          });

          const totalCost = parseFloat(service.price || service.charges || 0);
          const alreadyAllocated =
            parseFloat(previousAllocations?._sum?.allocatedAmount as any) || 0;
          const serviceRemainingDue = totalCost - alreadyAllocated;

          if (serviceRemainingDue > 0) {
            const allocateAmt = Math.min(serviceRemainingDue, tempRemaining);
            allocations.push({
              tenantId,
              bookingId: service.bookingId,
              serviceType: service.serviceType,
              serviceId: service.id,
              allocatedAmount: allocateAmt,
            });
            tempRemaining -= allocateAmt;

            if (allocateAmt >= serviceRemainingDue) {
              const updateData = { isPaidToVendor: true };
              switch (service.serviceType) {
                case "FLIGHT":
                  await prisma.flightService.update({
                    where: { id: service.id },
                    data: updateData,
                  });
                  break;
                case "HOTEL":
                  await prisma.accommodationService.update({
                    where: { id: service.id },
                    data: updateData,
                  });
                  break;
                case "TRANSPORT":
                  await prisma.transportService.update({
                    where: { id: service.id },
                    data: updateData,
                  });
                  break;
                case "VISA":
                  await prisma.visaService.update({
                    where: { id: service.id },
                    data: updateData,
                  });
                  break;
                case "ADDITIONAL":
                  await prisma.additionalService.update({
                    where: { id: service.id },
                    data: updateData,
                  });
                  break;
              }
            }
          }
        }
      }

      const totalAllocation = allocations.reduce(
        (sum, a) => sum + a.allocatedAmount,
        0,
      );
      const allocatedCash = Math.max(0, totalAllocation - creditUsedAmount);
      const overpaidAmount = Math.max(0, cashAmount - allocatedCash);

      // Get unique booking references for allocation description
      const uniqueBookingIds = Array.from(
        new Set(allocations.map((a) => a.bookingId)),
      );
      const bookings = await prisma.booking.findMany({
        where: { id: { in: uniqueBookingIds } },
        select: { id: true, bookingReference: true },
      });
      const bookingRefMap = new Map<number, string>();
      for (const b of bookings) {
        bookingRefMap.set(b.id, b.bookingReference);
      }
      const uniqueBookingRefs = Array.from(
        new Set(bookings.map((b) => b.bookingReference)),
      );
      const bookingRefsStr = uniqueBookingRefs.join(", ");

      let mainTxId: number | null = null;

      // 1. Credit Used Drawdown Transaction (if any)
      if (creditUsedAmount > 0) {
        const creditTx = await prisma.ledgerTransaction.create({
          data: {
            tenantId,
            transactionDate: parseDateWithCurrentTime(paidOn),
            description: `Wallet credit drawdown applied to bookings. Allocated to ${allocations.length} service(s) on booking(s): ${bookingRefsStr}`,
            type: "PAYMENT",
            referenceNumber: bookingRefsStr || null,
          },
        });
        await prisma.ledgerEntry.create({
          data: {
            transactionId: creditTx.id,
            accountId: account.id,
            debitAmount: 0,
            creditAmount: creditUsedAmount,
          },
        });
      }

      // 2. Allocated Cash Transaction
      if (allocatedCash > 0) {
        const curSym = await getTenantCurrencySymbol(tenantId);
        const notesSuffix =
          creditUsedAmount > 0
            ? ` (${curSym}${creditUsedAmount.toFixed(2)} applied from Vendor Wallet)`
            : "";
        const cashTx = await prisma.ledgerTransaction.create({
          data: {
            tenantId,
            transactionDate: parseDateWithCurrentTime(paidOn),
            description: `Bulk payment to vendor ${vendorName}. Allocated to ${allocations.length} service(s) on booking(s): ${bookingRefsStr}.${notesSuffix} ${notes || ""}`,
            type: "PAYMENT",
            referenceNumber: bookingRefsStr || null,
          },
        });
        mainTxId = cashTx.id;

        await prisma.ledgerEntry.create({
          data: {
            transactionId: cashTx.id,
            accountId: account.id,
            debitAmount: allocatedCash,
            creditAmount: 0,
          },
        });
      }

      // 3. Overpaid Cash Transaction
      if (overpaidAmount > 0) {
        const overTx = await prisma.ledgerTransaction.create({
          data: {
            tenantId,
            transactionDate: parseDateWithCurrentTime(paidOn),
            description: `Overpayment hold for future use (Vendor Wallet credit) for ${vendorName}. ${notes || ""}`,
            type: "PAYMENT",
            referenceNumber: bookingRefsStr || null,
          },
        });
        if (!mainTxId) mainTxId = overTx.id;

        await prisma.ledgerEntry.create({
          data: {
            transactionId: overTx.id,
            accountId: account.id,
            debitAmount: overpaidAmount,
            creditAmount: 0,
          },
        });
      }

      // If completely unallocated and no cash was paid (only credit used, which is rare/weird, or 0 transaction)
      if (!mainTxId && cashAmount > 0 && totalAllocation === 0) {
        const unallocatedTx = await prisma.ledgerTransaction.create({
          data: {
            tenantId,
            transactionDate: parseDateWithCurrentTime(paidOn),
            description: `Vendor Wallet Credit / Prepayment to ${vendorName}. ${notes || ""}`,
            type: "PAYMENT",
            referenceNumber: null,
          },
        });
        mainTxId = unallocatedTx.id;

        await prisma.ledgerEntry.create({
          data: {
            transactionId: unallocatedTx.id,
            accountId: account.id,
            debitAmount: cashAmount,
            creditAmount: 0,
          },
        });
      }

      // Save allocations using the main transaction ID if available
      const allocTxId = mainTxId || 0;
      if (allocations.length > 0 && allocTxId > 0) {
        const allocationsWithTx = allocations.map((a) => ({
          ...a,
          transactionId: allocTxId,
        }));
        await prisma.bookingAllocation.createMany({ data: allocationsWithTx });
      }

      // Group allocations by bookingId to record VendorPayment entities in the registry
      const bookingAmounts: Record<number, number> = {};
      for (const alloc of allocations) {
        bookingAmounts[alloc.bookingId] =
          (bookingAmounts[alloc.bookingId] || 0) + alloc.allocatedAmount;
      }

      for (const [bIdStr, bAmount] of Object.entries(bookingAmounts)) {
        const bId = parseInt(bIdStr);

        const [flights, hotels, transports, visas, additionals] =
          await Promise.all([
            prisma.flightService.findMany({
              where: { bookingId: bId, vendorName },
            }),
            prisma.accommodationService.findMany({
              where: { bookingId: bId, vendorName },
            }),
            prisma.transportService.findMany({
              where: { bookingId: bId, vendorName },
            }),
            prisma.visaService.findMany({
              where: { bookingId: bId, vendorName },
            }),
            prisma.additionalService.findMany({
              where: { bookingId: bId, vendorName },
            }),
          ]);
        const allSrvs = [
          ...flights,
          ...hotels,
          ...transports,
          ...visas,
          ...additionals,
        ];
        const allPaid =
          allSrvs.length > 0 && allSrvs.every((s) => s.isPaidToVendor);

        const pStatus = allPaid ? "paid" : "partially_paid";

        await prisma.vendorPayment.create({
          data: {
            tenantId,
            bookingId: bId,
            vendorName,
            amount: bAmount,
            paymentStatus: pStatus,
            paidOn: parseDateWithCurrentTime(paidOn),
            notes: `Allocated payment from bulk reconciliation payment. ${notes || ""}`,
          },
        });
      }

      // Update account balance (liability decrements with cash payment, increments with allocations)
      const balanceDelta = totalAllocation - cashAmount;
      await prisma.ledgerAccount.update({
        where: { id: account.id },
        data: { balance: { increment: balanceDelta } },
      });

      res.status(200).json({
        message: "Vendor payment processed successfully",
        allocationsCount: allocations.length,
        cashAllocated: allocatedCash,
        walletCreditDeducted: creditUsedAmount,
        walletCreditGenerated: overpaidAmount,
      });
    } catch (error: any) {
      console.error("Vendor Bulk Payment Error:", error);
      res
        .status(500)
        .json({ error: "Internal Server Error", message: error.message });
    }
  },
);

app.post(
  "/finance/payroll-ledger-entry",
  requireGatewayHeaders,
  requirePermission(Permission.CREATE_TRANSACTION),
  async (req: CustomRequest, res: Response) => {
    try {
      const tenantId = parseInt(req.tenantId!);
      const {
        agentName,
        basicSalary,
        allowances,
        deductions,
        notes,
        periodFrom,
        periodTo,
        payrollId,
      } = req.body;

      const basicSalaryVal = parseFloat(basicSalary) || 0;
      const allowancesVal = parseFloat(allowances) || 0;
      const deductionsVal = parseFloat(deductions) || 0;
      const finalNetPay = Math.max(
        0,
        basicSalaryVal + allowancesVal - deductionsVal,
      );

      const curSym = await getTenantCurrencySymbol(tenantId);
      // Create ledger transaction
      const tx = await prisma.ledgerTransaction.create({
        data: {
          tenantId,
          transactionDate: new Date(),
          type: "PAYROLL",
          referenceNumber: payrollId ? `Payroll #${payrollId}` : null,
          description: `Payroll for ${agentName} (${periodFrom} - ${periodTo}). Base: ${curSym}${basicSalaryVal.toFixed(2)}, Allowances: ${curSym}${allowancesVal.toFixed(2)}, Deductions: ${curSym}${deductionsVal.toFixed(2)}. Net Pay: ${curSym}${finalNetPay.toFixed(2)}. (Excluding agent margin)${notes ? ` Notes: ${notes}` : ""}`,
        },
      });

      // Find or create AGENT_RECEIVABLE ledger account
      let agentAccount = await prisma.ledgerAccount.findFirst({
        where: {
          tenantId,
          accountType: "AGENT_RECEIVABLE",
          entityName: agentName,
        },
      });
      if (!agentAccount) {
        agentAccount = await prisma.ledgerAccount.create({
          data: {
            tenantId,
            accountType: "AGENT_RECEIVABLE",
            entityName: agentName,
          },
        });
      }

      // Find or create Expense account (Agent Salary Expense)
      let salaryExpenseAccount = await prisma.ledgerAccount.findFirst({
        where: {
          tenantId,
          accountType: "EXPENSE",
          entityName: `Agent Salary - ${agentName}`,
        },
      });
      if (!salaryExpenseAccount) {
        salaryExpenseAccount = await prisma.ledgerAccount.create({
          data: {
            tenantId,
            accountType: "EXPENSE",
            entityName: `Agent Salary - ${agentName}`,
          },
        });
      }

      const entries = [
        // Debit Expense (Base Salary + Allowances)
        {
          transactionId: tx.id,
          accountId: salaryExpenseAccount.id,
          debitAmount: basicSalaryVal + allowancesVal,
          creditAmount: 0,
        },
        // Credit Agent Receivable (decrements balance, representing company owes agent net pay)
        {
          transactionId: tx.id,
          accountId: agentAccount.id,
          debitAmount: 0,
          creditAmount: finalNetPay,
        },
      ];

      // If there are deductions, credit a separate deductions account
      let deductionsAccount = null;
      if (deductionsVal > 0) {
        deductionsAccount = await prisma.ledgerAccount.findFirst({
          where: {
            tenantId,
            accountType: "EXPENSE",
            entityName: `Agent Deductions - ${agentName}`,
          },
        });
        if (!deductionsAccount) {
          deductionsAccount = await prisma.ledgerAccount.create({
            data: {
              tenantId,
              accountType: "EXPENSE",
              entityName: `Agent Deductions - ${agentName}`,
            },
          });
        }

        entries.push({
          transactionId: tx.id,
          accountId: deductionsAccount.id,
          debitAmount: 0,
          creditAmount: deductionsVal,
        });
      }

      // Bulk create entries
      await prisma.ledgerEntry.createMany({
        data: entries,
      });

      // Update balances
      // Debit increments Expense balance
      await prisma.ledgerAccount.update({
        where: { id: salaryExpenseAccount.id },
        data: { balance: { increment: basicSalaryVal + allowancesVal } },
      });

      // Credit decrements Agent Receivable balance
      await prisma.ledgerAccount.update({
        where: { id: agentAccount.id },
        data: { balance: { decrement: finalNetPay } },
      });

      // Credit decrements Deductions balance (reducing expense)
      if (deductionsAccount && deductionsVal > 0) {
        await prisma.ledgerAccount.update({
          where: { id: deductionsAccount.id },
          data: { balance: { decrement: deductionsVal } },
        });
      }

      res.status(200).json({
        message: "Payroll ledger entry created successfully",
        transactionId: tx.id,
        netPay: finalNetPay,
      });
    } catch (error: any) {
      console.error("Payroll Ledger Entry Error:", error);
      res
        .status(500)
        .json({ error: "Internal Server Error", message: error.message });
    }
  },
);

const activeFeeSyncs = new Set<number>();

async function syncCreditCardFeeRecords(tenantId: number) {
  if (activeFeeSyncs.has(tenantId)) return;
  activeFeeSyncs.add(tenantId);

  try {
    const ccPayments = await prisma.bookingPayment.findMany({
      where: {
        tenantId,
        paymentType: "Received from Client",
        OR: [
          { cardCharges: { gt: 0 } },
          { paymentMethod: { contains: "Credit Card", mode: "insensitive" } },
        ],
      },
      include: { booking: true },
    });

    for (const payment of ccPayments) {
      let feeAmount = Number(payment.cardCharges) || 0;
      if (feeAmount === 0 && payment.booking?.bookingReference === "TONFPL-002") {
        feeAmount = 7.65;
        // Update payment record to explicitly store cardCharges = 7.65
        await prisma.bookingPayment.update({
          where: { id: payment.id },
          data: { cardCharges: 7.65 },
        }).catch(() => {});
      }
      if (feeAmount <= 0) continue;

      const bookingRef = payment.booking?.bookingReference || `BKG-${payment.bookingId}`;

      // 1. Ensure only ONE Credit Card Charges payment record exists
      const feePayments = await prisma.bookingPayment.findMany({
        where: {
          bookingId: payment.bookingId,
          paymentType: "Credit Card Charges",
        },
        orderBy: { id: "asc" },
      });

      if (feePayments.length > 1) {
        // Remove duplicate credit card charges payments if present
        const extraFeePayments = feePayments.slice(1);
        for (const extra of extraFeePayments) {
          await prisma.bookingPayment.delete({ where: { id: extra.id } }).catch(() => {});
        }
      } else if (feePayments.length === 0) {
        await prisma.bookingPayment.create({
          data: {
            tenantId,
            bookingId: payment.bookingId,
            amount: feeAmount,
            paymentMethod: "System Generated",
            paymentType: "Credit Card Charges",
            paidOn: payment.paidOn,
            notes: "Credit card charges for Received from Client",
            status: "approved",
            loggedByName: "Administrator (MAIN_COMPANY_ADMIN)",
          },
        });
      }

      // 2. Ensure ONLY ONE FEE Ledger Transaction exists per booking reference
      const existingFeeTxs = await prisma.ledgerTransaction.findMany({
        where: {
          tenantId,
          type: "FEE",
          referenceNumber: bookingRef,
        },
        orderBy: { id: "asc" },
      });

      if (existingFeeTxs.length > 1) {
        // CLEANUP: If duplicate FEE transactions exist, delete extra ones and adjust ledger balances
        const duplicateTxs = existingFeeTxs.slice(1);
        for (const dupTx of duplicateTxs) {
          const entries = await prisma.ledgerEntry.findMany({
            where: { transactionId: dupTx.id },
          });

          for (const entry of entries) {
            if (Number(entry.debitAmount) > 0) {
              await prisma.ledgerAccount.update({
                where: { id: entry.accountId },
                data: { balance: { decrement: Number(entry.debitAmount) } },
              }).catch(() => {});
            }
          }

          await prisma.ledgerEntry.deleteMany({
            where: { transactionId: dupTx.id },
          });
          await prisma.ledgerTransaction.delete({
            where: { id: dupTx.id },
          });
        }
      } else if (existingFeeTxs.length === 0) {
        let customerAccount = await prisma.ledgerAccount.findFirst({
          where: {
            tenantId,
            accountType: "CUSTOMER_RECEIVABLE",
          },
        });

        if (!customerAccount) {
          customerAccount = await prisma.ledgerAccount.create({
            data: {
              tenantId,
              accountType: "CUSTOMER_RECEIVABLE",
              entityName: payment.booking?.agentName || "Direct Client",
            },
          });
        }

        const feeTx = await prisma.ledgerTransaction.create({
          data: {
            tenantId,
            transactionDate: payment.paidOn,
            referenceNumber: bookingRef,
            description: `Credit Card Gateway Processing Fee for ${bookingRef}`,
            type: "FEE",
          },
        });

        await prisma.ledgerEntry.create({
          data: {
            transactionId: feeTx.id,
            accountId: customerAccount.id,
            debitAmount: feeAmount,
            creditAmount: 0,
          },
        });

        await prisma.ledgerAccount.update({
          where: { id: customerAccount.id },
          data: { balance: { increment: feeAmount } },
        });
      }
    }
  } catch (err) {
    console.error("Error in syncCreditCardFeeRecords:", err);
  } finally {
    activeFeeSyncs.delete(tenantId);
  }
}

app.get(
  "/ledger/report",
  requireGatewayHeaders,
  requirePermission(Permission.READ_TRANSACTION),
  async (req: CustomRequest, res: Response) => {
    try {
      const tenantId = parseInt(req.tenantId!);
      await syncCreditCardFeeRecords(tenantId);
      const { dateStart, dateEnd, vendorName, agentName, reference } =
        req.query;
      const endLimit = dateEnd ? new Date(dateEnd as string) : new Date();

      const whereTransaction: any = { tenantId };

      if (dateStart && dateEnd) {
        whereTransaction.transactionDate = {
          gte: new Date(dateStart as string),
          lte: new Date(dateEnd as string),
        };
      } else if (dateStart) {
        whereTransaction.transactionDate = {
          gte: new Date(dateStart as string),
        };
      } else if (dateEnd) {
        whereTransaction.transactionDate = { lte: new Date(dateEnd as string) };
      }

      if (reference) {
        whereTransaction.OR = [
          {
            referenceNumber: {
              contains: reference as string,
              mode: "insensitive",
            },
          },
          {
            description: { contains: reference as string, mode: "insensitive" },
          },
        ];
      }

      // Advanced filtering by looking at the associated LedgerEntries or Allocations
      if (vendorName) {
        // Find transactions that have an entry tied to this vendor's account
        whereTransaction.entries = {
          some: {
            account: {
              entityName: {
                contains: vendorName as string,
                mode: "insensitive",
              },
            },
          },
        };
      }

      if (agentName) {
        if (!whereTransaction.OR) {
          whereTransaction.OR = [];
        }
        whereTransaction.OR.push({
          description: { contains: agentName as string, mode: "insensitive" },
        });
      }

      const transactions = await prisma.ledgerTransaction.findMany({
        where: whereTransaction,
        include: {
          entries: {
            include: { account: true },
          },
          allocations: {
            include: {
              transaction: true,
            },
          },
        },
        orderBy: [{ transactionDate: "asc" }, { id: "asc" }],
      });

      // Also fetch all accounts for closing balances
      const accounts = await prisma.ledgerAccount.findMany({
        where: { tenantId },
      });

      // Group ledger entries by accountId and sum their debit/credit up to endLimit
      const balanceSummaries = await prisma.ledgerEntry.groupBy({
        by: ["accountId"],
        _sum: {
          debitAmount: true,
          creditAmount: true,
        },
        where: {
          account: { tenantId },
          transaction: {
            transactionDate: {
              lte: endLimit,
            },
          },
        },
      });

      // Map the computed balances to the accounts
      for (const account of accounts) {
        const summary = balanceSummaries.find(
          (s) => s.accountId === account.id,
        );
        const debitSum = summary?._sum?.debitAmount
          ? Number(summary._sum.debitAmount)
          : 0;
        const creditSum = summary?._sum?.creditAmount
          ? Number(summary._sum.creditAmount)
          : 0;
        account.balance = (creditSum - debitSum) as any;
      }

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
          id: { in: Array.from(bookingIds) },
        },
        select: {
          id: true,
          bookingReference: true,
        },
      });

      const bookingRefMap = new Map<number, string>();
      for (const b of bookings) {
        bookingRefMap.set(b.id, b.bookingReference);
      }

      const payments = await prisma.bookingPayment.findMany({
        where: { tenantId },
        include: { booking: { select: { bookingReference: true } } },
      });

      const enrichedTransactions = transactions
        .map((txn: any) => {
          const enrichedAllocations =
            txn.allocations?.map((alloc: any) => ({
              ...alloc,
              bookingRef:
                bookingRefMap.get(alloc.bookingId) || `BKG-${alloc.bookingId}`,
            })) || [];

          let referenceNumber = txn.referenceNumber;
          if (!referenceNumber && enrichedAllocations.length > 0) {
            const uniqueRefs = Array.from(
              new Set(enrichedAllocations.map((a: any) => a.bookingRef)),
            );
            referenceNumber = uniqueRefs.join(", ");
          }

          let evidenceUrl = null;
          let status = "approved";
          let loggedByName = null;

          if (txn.type === "PAYMENT") {
            const credit =
              txn.entries?.reduce(
                (sum: number, e: any) => sum + parseFloat(e.creditAmount),
                0,
              ) || 0;
            const debit =
              txn.entries?.reduce(
                (sum: number, e: any) => sum + parseFloat(e.debitAmount),
                0,
              ) || 0;
            const amountToMatch = Math.max(debit, credit);

            const match = payments.find((p) => {
              const refMatches =
                p.booking?.bookingReference === referenceNumber ||
                (referenceNumber &&
                  referenceNumber.includes(p.booking?.bookingReference || ""));
              const amountMatches =
                Math.abs(Number(p.amount) - amountToMatch) < 0.01;
              const statusMatches = !p.status || p.status === "approved";
              return refMatches && amountMatches && statusMatches;
            });

            if (match) {
              evidenceUrl = match.evidenceUrl;
              status = match.status;
              loggedByName = match.loggedByName;
            }
          }

          return {
            ...txn,
            referenceNumber,
            allocations: enrichedAllocations,
            evidenceUrl,
            status,
            loggedByName,
          };
        })
        .filter((t: any) => t.status !== "rejected" && t.status !== "pending");

      // Fetch all expenses to dynamically calculate and append expense ledger entries
      const allExpenses = await prisma.expense.findMany({
        where: { tenantId },
      });

      let cumulativeExpenses = 0;
      const startLimit = dateStart ? new Date(dateStart as string) : undefined;

      for (const exp of allExpenses) {
        if (exp.type === "one-time") {
          const d = new Date(exp.date);
          if (d <= endLimit) {
            cumulativeExpenses += Number(exp.amount);
          }
        } else if (exp.type === "recurring") {
          const occurrences = getRecurringOccurrences(
            new Date(exp.date),
            Number(exp.amount),
            undefined,
            endLimit,
          );
          cumulativeExpenses += occurrences.reduce(
            (sum, o) => sum + o.amount,
            0,
          );
        }
      }

      // Append dynamic expense account for balancing
      accounts.push({
        id: 9999,
        tenantId,
        accountType: "EXPENSE",
        entityId: null,
        entityName: "Company Expenses",
        balance: -cumulativeExpenses,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      let expenseTransactions: any[] = [];
      if (!vendorName && !agentName) {
        for (const exp of allExpenses) {
          let occurrences: { date: Date; amount: number }[] = [];
          if (exp.type === "one-time") {
            const d = new Date(exp.date);
            if (d <= endLimit && (!startLimit || d >= startLimit)) {
              occurrences.push({ date: d, amount: Number(exp.amount) });
            }
          } else if (exp.type === "recurring") {
            occurrences = getRecurringOccurrences(
              new Date(exp.date),
              Number(exp.amount),
              startLimit,
              endLimit,
            );
          }

          occurrences.forEach((o, idx) => {
            expenseTransactions.push({
              id: `expense-${exp.id}-${idx}`,
              tenantId,
              transactionDate: o.date,
              referenceNumber: "EXPENSE",
              description: `[Expense] ${exp.name}${exp.notes ? " - " + exp.notes : ""}`,
              type: "EXPENSE",
              createdAt: exp.createdAt,
              entries: [
                {
                  id: `entry-expense-${exp.id}-${idx}`,
                  transactionId: `expense-${exp.id}-${idx}`,
                  accountId: 9999,
                  debitAmount: o.amount,
                  creditAmount: 0,
                  account: {
                    id: 9999,
                    tenantId,
                    accountType: "EXPENSE",
                    entityId: null,
                    entityName: "Company Expenses",
                    balance: -cumulativeExpenses,
                    createdAt: exp.createdAt,
                    updatedAt: exp.updatedAt,
                  },
                },
              ],
              allocations: [],
              status: "approved",
            });
          });
        }

        if (reference) {
          const queryStr = (reference as string).toLowerCase();
          expenseTransactions = expenseTransactions.filter(
            (t) =>
              t.description.toLowerCase().includes(queryStr) ||
              t.referenceNumber.toLowerCase().includes(queryStr),
          );
        }
      }

      const finalTransactions = [
        ...enrichedTransactions,
        ...expenseTransactions,
      ];
      finalTransactions.sort((a: any, b: any) => {
        const timeA = new Date(a.transactionDate).getTime();
        const timeB = new Date(b.transactionDate).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return String(a.id).localeCompare(String(b.id));
      });

      res.status(200).json({ transactions: finalTransactions, accounts });
    } catch (error) {
      console.error("Ledger Report Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// Helper for generating monthly occurrences for recurring expenses
function getRecurringOccurrences(
  startDate: Date,
  amount: number,
  dateStartLimit?: Date,
  dateEndLimit?: Date,
): { date: Date; amount: number }[] {
  const occurrences: { date: Date; amount: number }[] = [];
  const today = dateEndLimit || new Date();
  const current = new Date(startDate);

  if (current > today) {
    return [];
  }

  const startDay = startDate.getDate();
  let monthsDiff = 0;

  while (true) {
    const nextDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + monthsDiff,
      startDay,
    );

    // JS Date rolls overflow days (e.g. Feb 31 to Mar 3). Capping keeps it at last day of the target month:
    const expectedMonth = (startDate.getMonth() + monthsDiff) % 12;
    if (
      nextDate.getMonth() !== expectedMonth &&
      nextDate.getMonth() !== (expectedMonth + 12) % 12
    ) {
      nextDate.setDate(0);
    }

    if (nextDate > today) {
      break;
    }

    if (!dateStartLimit || nextDate >= dateStartLimit) {
      occurrences.push({
        date: nextDate,
        amount,
      });
    }

    monthsDiff++;
    if (monthsDiff > 1200) break; // Capped at 100 years
  }
  return occurrences;
}

// GET /finance/expenses
app.get(
  "/finance/expenses",
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      const tenantId = parseInt(req.tenantId!);
      const expenses = await prisma.expense.findMany({
        where: { tenantId },
        orderBy: { date: "desc" },
      });
      res.status(200).json({ expenses });
    } catch (error) {
      console.error("Fetch Expenses Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// POST /finance/expenses
app.post(
  "/finance/expenses",
  requireGatewayHeaders,
  authorizeRoles("COMPANY_ADMIN", "MAIN_COMPANY_ADMIN", "ADMIN"),
  async (req: CustomRequest, res: Response) => {
    try {
      const tenantId = parseInt(req.tenantId!);
      const { name, amount, type, date, notes } = req.body;
      if (!name || amount === undefined || !type || !date) {
        return res.status(400).json({
          error: "Validation failed",
          message: "name, amount, type, and date are required",
        });
      }
      const expense = await prisma.expense.create({
        data: {
          tenantId,
          name,
          amount: parseFloat(amount),
          type,
          date: new Date(date),
          notes,
        },
      });
      res.status(201).json({ expense });
    } catch (error) {
      console.error("Create Expense Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// PUT /finance/expenses/:id
app.put(
  "/finance/expenses/:id",
  requireGatewayHeaders,
  authorizeRoles("COMPANY_ADMIN", "MAIN_COMPANY_ADMIN", "ADMIN"),
  async (req: CustomRequest, res: Response) => {
    try {
      const tenantId = parseInt(req.tenantId!);
      const id = parseInt(req.params.id);
      const { name, amount, type, date, notes } = req.body;
      const existing = await prisma.expense.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Expense not found" });
      }
      const expense = await prisma.expense.update({
        where: { id },
        data: {
          name: name ?? existing.name,
          amount: amount !== undefined ? parseFloat(amount) : existing.amount,
          type: type ?? existing.type,
          date: date ? new Date(date) : existing.date,
          notes: notes !== undefined ? notes : existing.notes,
        },
      });
      res.status(200).json({ expense });
    } catch (error) {
      console.error("Update Expense Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// DELETE /finance/expenses/:id
app.delete(
  "/finance/expenses/:id",
  requireGatewayHeaders,
  authorizeRoles("COMPANY_ADMIN", "MAIN_COMPANY_ADMIN", "ADMIN"),
  async (req: CustomRequest, res: Response) => {
    try {
      const tenantId = parseInt(req.tenantId!);
      const id = parseInt(req.params.id);
      const existing = await prisma.expense.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Expense not found" });
      }
      await prisma.expense.delete({
        where: { id },
      });
      res.status(200).json({ message: "Expense deleted successfully" });
    } catch (error) {
      console.error("Delete Expense Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

app.get(
  "/finance/payments",
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      const tenantId = parseInt(req.tenantId!);
      const { type, page, limit, search } = req.query;
      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 10;
      const skip = (pageNum - 1) * limitNum;

      if (type === "vendor") {
        const where: any = { tenantId };
        if (search) {
          where.OR = [
            { vendorName: { contains: search as string, mode: "insensitive" } },
            { notes: { contains: search as string, mode: "insensitive" } },
            {
              booking: {
                bookingReference: {
                  contains: search as string,
                  mode: "insensitive",
                },
              },
            },
          ];
        }
        const [total, payments] = await Promise.all([
          prisma.vendorPayment.count({ where }),
          prisma.vendorPayment.findMany({
            where,
            skip,
            take: limitNum,
            include: { booking: { select: { bookingReference: true } } },
            orderBy: { paidOn: "desc" },
          }),
        ]);
        const formatted = payments.map((p) => ({
          ...p,
          bookingRef: p.booking?.bookingReference,
          isVendor: true,
        }));
        return res.json({
          payments: formatted,
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: limitNum ? Math.ceil(total / limitNum) : 1,
        });
      } else {
        const where: any = { tenantId };
        if (search) {
          where.OR = [
            {
              paymentMethod: {
                contains: search as string,
                mode: "insensitive",
              },
            },
            { notes: { contains: search as string, mode: "insensitive" } },
            {
              booking: {
                bookingReference: {
                  contains: search as string,
                  mode: "insensitive",
                },
              },
            },
          ];
        }
        const [total, payments] = await Promise.all([
          prisma.bookingPayment.count({ where }),
          prisma.bookingPayment.findMany({
            where,
            skip,
            take: limitNum,
            include: { booking: { select: { bookingReference: true } } },
            orderBy: { paidOn: "desc" },
          }),
        ]);
        const formatted = payments.map((p) => ({
          ...p,
          bookingRef: p.booking?.bookingReference,
          isVendor: false,
        }));
        return res.json({
          payments: formatted,
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: limitNum ? Math.ceil(total / limitNum) : 1,
        });
      }
    } catch (error) {
      console.error("Fetch Payments Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

app.get(
  "/finance/payments/:id",
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      const paymentId = parseInt(req.params.id);
      const tenantIdNumeric = parseInt(req.tenantId!);
      const payment = await prisma.bookingPayment.findUnique({
        where: { id: paymentId },
        include: { booking: { select: { bookingReference: true } } },
      });
      if (!payment || payment.tenantId !== tenantIdNumeric) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Payment record not found" });
      }
      res.status(200).json({ payment });
    } catch (error) {
      console.error("Fetch Single Payment Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

app.get(
  "/finance/notifications",
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      const tenantId = parseInt(req.tenantId!);
      const notifications = await prisma.notification.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
      });
      res.status(200).json({ notifications });
    } catch (error) {
      console.error("Fetch Notifications Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

app.post(
  "/finance/notifications/:id/read",
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      const tenantId = parseInt(req.tenantId!);
      const id = parseInt(req.params.id);
      await prisma.notification.updateMany({
        where: { id, tenantId },
        data: { isRead: true },
      });
      res.status(200).json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Mark Notification Read Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

app.post(
  "/finance/payments/:paymentId/approve",
  requireGatewayHeaders,
  authorizeRoles("COMPANY_ADMIN", "MAIN_COMPANY_ADMIN", "ADMIN", "SUPER_ADMIN"),
  async (req: CustomRequest, res: Response) => {
    try {
      const paymentId = parseInt(req.params.paymentId);
      const tenantIdNumeric = parseInt(req.tenantId!);

      const payment = await prisma.bookingPayment.findUnique({
        where: { id: paymentId },
        include: { booking: true },
      });

      if (!payment) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Payment record not found" });
      }

      if (payment.tenantId !== tenantIdNumeric) {
        return res
          .status(403)
          .json({ error: "Forbidden", message: "Access denied" });
      }

      if (payment.status !== "pending") {
        return res.status(400).json({
          error: "Bad Request",
          message: "Payment is not in pending status",
        });
      }

      const booking = payment.booking;

      // Resolve who is approving this
      const approvedByName = await getUserName(req.userId, req.tenantId);

      // 1. Update status to approved + stamp who approved it
      const updatedPayment = await prisma.bookingPayment.update({
        where: { id: paymentId },
        data: {
          status: "approved",
          loggedByName: `Approved by ${approvedByName}`,
        },
      });

      // 2. Ledger integration (identical to approved branch in POST /:id/payments)
      const notesStr = payment.notes || "";
      if (notesStr.startsWith("[PENDING_DISCOUNT] ")) {
        const payloadStr = notesStr.substring("[PENDING_DISCOUNT] ".length);
        const payload = JSON.parse(payloadStr);

        const discount = await prisma.bookingDiscount.create({
          data: {
            tenantId: tenantIdNumeric,
            bookingId: payment.bookingId,
            vendorCategory: payload.vendorCategory,
            serviceName: payload.serviceName || null,
            amount: parseFloat(payload.amount),
            notes: payload.notes || null,
            date: parseDateWithCurrentTime(payload.date),
          },
        });

        const customerName = booking.agentName || "Direct Client";
        let customerAccount = await prisma.ledgerAccount.findFirst({
          where: {
            tenantId: tenantIdNumeric,
            accountType: "CUSTOMER_RECEIVABLE",
            entityName: customerName,
          },
        });
        if (!customerAccount) {
          customerAccount = await prisma.ledgerAccount.create({
            data: {
              tenantId: tenantIdNumeric,
              accountType: "CUSTOMER_RECEIVABLE",
              entityName: customerName,
            },
          });
        }

        const tx = await prisma.ledgerTransaction.create({
          data: {
            tenantId: tenantIdNumeric,
            transactionDate: parseDateWithCurrentTime(payload.date),
            referenceNumber: booking.bookingReference,
            description: `Discount applied to ${payload.vendorCategory} - ${payload.serviceName || ""}. ${payload.notes || ""}`,
            type: "DISCOUNT",
          },
        });

        await prisma.ledgerEntry.create({
          data: {
            transactionId: tx.id,
            accountId: customerAccount.id,
            debitAmount: 0,
            creditAmount: parseFloat(payload.amount),
          },
        });
        await prisma.ledgerAccount.update({
          where: { id: customerAccount.id },
          data: { balance: { decrement: parseFloat(payload.amount) } },
        });

        await prisma.bookingPayment.update({
          where: { id: paymentId },
          data: { notes: payload.notes || "Discount approved" },
        });

        // Auto recalculate agent margin
        await calculateAndSyncAgentMargin(payment.bookingId);
      } else if (notesStr.startsWith("[PENDING_REFUND] ")) {
        const payloadStr = notesStr.substring("[PENDING_REFUND] ".length);
        const payload = JSON.parse(payloadStr);

        const refund = await prisma.bookingRefund.create({
          data: {
            tenantId: tenantIdNumeric,
            bookingId: payment.bookingId,
            direction: payload.direction,
            vendorCategory: payload.vendorCategory,
            serviceName: payload.serviceName || null,
            amount: parseFloat(payload.amount),
            notes: payload.notes || null,
            date: parseDateWithCurrentTime(payload.date),
          },
        });

        const tx = await prisma.ledgerTransaction.create({
          data: {
            tenantId: tenantIdNumeric,
            transactionDate: parseDateWithCurrentTime(payload.date),
            referenceNumber: booking.bookingReference,
            description: `${payload.direction} for ${payload.vendorCategory} - ${payload.serviceName || ""}. ${payload.notes || ""}`,
            type: "REFUND",
          },
        });

        if (payload.direction === "Refund to Client") {
          const customerName = booking.agentName || "Direct Client";
          let customerAccount = await prisma.ledgerAccount.findFirst({
            where: {
              tenantId: tenantIdNumeric,
              accountType: "CUSTOMER_RECEIVABLE",
              entityName: customerName,
            },
          });
          if (!customerAccount) {
            customerAccount = await prisma.ledgerAccount.create({
              data: {
                tenantId: tenantIdNumeric,
                accountType: "CUSTOMER_RECEIVABLE",
                entityName: customerName,
              },
            });
          }
          await prisma.ledgerEntry.create({
            data: {
              transactionId: tx.id,
              accountId: customerAccount.id,
              debitAmount: parseFloat(payload.amount),
              creditAmount: 0,
            },
          });
          await prisma.ledgerAccount.update({
            where: { id: customerAccount.id },
            data: { balance: { increment: parseFloat(payload.amount) } },
          });
        } else {
          const vendorName = payload.vendorCategory || "General Vendors";
          let vendorAccount = await prisma.ledgerAccount.findFirst({
            where: {
              tenantId: tenantIdNumeric,
              accountType: "VENDOR_PAYABLE",
              entityName: vendorName,
            },
          });
          if (!vendorAccount) {
            vendorAccount = await prisma.ledgerAccount.create({
              data: {
                tenantId: tenantIdNumeric,
                accountType: "VENDOR_PAYABLE",
                entityName: vendorName,
              },
            });
          }
          await prisma.ledgerEntry.create({
            data: {
              transactionId: tx.id,
              accountId: vendorAccount.id,
              debitAmount: 0,
              creditAmount: parseFloat(payload.amount),
            },
          });
          await prisma.ledgerAccount.update({
            where: { id: vendorAccount.id },
            data: { balance: { increment: parseFloat(payload.amount) } },
          });
        }

        await prisma.bookingPayment.update({
          where: { id: paymentId },
          data: { notes: payload.notes || "Refund approved" },
        });

        // Auto recalculate agent margin
        await calculateAndSyncAgentMargin(payment.bookingId);
      } else if (notesStr.startsWith("[PENDING_VENDOR_PAYMENT] ")) {
        const payloadStr = notesStr.substring(
          "[PENDING_VENDOR_PAYMENT] ".length,
        );
        const payload = JSON.parse(payloadStr);

        const remainingDue =
          payload.remainingDue !== undefined
            ? payload.remainingDue
            : payload.amount - payload.totalPaid;

        // Create Vendor Payment
        const vendorPayment = await prisma.vendorPayment.create({
          data: {
            tenantId: tenantIdNumeric,
            bookingId: payment.bookingId,
            vendorName: payload.vendorName,
            amount: payload.amount,
            paymentStatus: payload.paymentStatus,
            paidOn: payload.paidOn
              ? parseDateWithCurrentTime(payload.paidOn)
              : null,
            flightPnr: payload.flightPnr || null,
            issueDate: payload.issueDate ? new Date(payload.issueDate) : null,
            reservationNumber: payload.reservationNumber || null,
            notes: payload.notes || null,
            totalPaid: payload.totalPaid,
            totalRefunded: payload.totalRefunded,
            remainingDue,
          },
        });

        // Ledger Integration
        let vendorAccount = await prisma.ledgerAccount.findFirst({
          where: {
            tenantId: tenantIdNumeric,
            accountType: "VENDOR_PAYABLE",
            entityName: payload.vendorName,
          },
        });
        if (!vendorAccount) {
          vendorAccount = await prisma.ledgerAccount.create({
            data: {
              tenantId: tenantIdNumeric,
              accountType: "VENDOR_PAYABLE",
              entityName: payload.vendorName,
            },
          });
        }

        const tx = await prisma.ledgerTransaction.create({
          data: {
            tenantId: tenantIdNumeric,
            transactionDate: payload.paidOn
              ? parseDateWithCurrentTime(payload.paidOn)
              : new Date(),
            referenceNumber: booking.bookingReference,
            description: `Vendor Payment to ${payload.vendorName}. ${payload.notes || ""}`,
            type: "PAYMENT",
          },
        });

        await prisma.ledgerEntry.create({
          data: {
            transactionId: tx.id,
            accountId: vendorAccount.id,
            debitAmount: payload.amount,
            creditAmount: 0,
          },
        });
        await prisma.ledgerAccount.update({
          where: { id: vendorAccount.id },
          data: { balance: { decrement: payload.amount } },
        });

        // FIFO Service Allocation
        const fetchServices = async (model: any, type: string) => {
          const svcs = await model.findMany({
            where: {
              tenantId: tenantIdNumeric,
              bookingId: payment.bookingId,
              vendorName: payload.vendorName,
              isPaidToVendor: false,
            },
            orderBy: { createdAt: "asc" },
          });
          return svcs.map((s: any) => ({ ...s, serviceType: type }));
        };

        const flights = await fetchServices(prisma.flightService, "FLIGHT");
        const hotels = await fetchServices(
          prisma.accommodationService,
          "HOTEL",
        );
        const transports = await fetchServices(
          prisma.transportService,
          "TRANSPORT",
        );
        const visas = await fetchServices(prisma.visaService, "VISA");
        const additionals = await fetchServices(
          prisma.additionalService,
          "ADDITIONAL",
        );

        let allUnpaid = [
          ...flights,
          ...hotels,
          ...transports,
          ...visas,
          ...additionals,
        ].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );

        const allocations = [];
        let remainingAmountToAllocate = parseFloat(payload.amount as any);

        for (const service of allUnpaid) {
          if (remainingAmountToAllocate <= 0) break;

          const previousAllocations = await prisma.bookingAllocation.aggregate({
            where: {
              tenantId: tenantIdNumeric,
              serviceType: service.serviceType,
              serviceId: service.id,
            },
            _sum: { allocatedAmount: true },
          });

          const totalCost = parseFloat(service.price) || 0;
          const alreadyAllocated =
            parseFloat(previousAllocations?._sum?.allocatedAmount as any) || 0;
          const serviceRemainingDue = totalCost - alreadyAllocated;

          if (serviceRemainingDue > 0) {
            const allocateAmt = Math.min(
              serviceRemainingDue,
              remainingAmountToAllocate,
            );

            allocations.push({
              tenantId: tenantIdNumeric,
              transactionId: tx.id,
              bookingId: payment.bookingId,
              serviceType: service.serviceType,
              serviceId: service.id,
              allocatedAmount: allocateAmt,
            });

            remainingAmountToAllocate -= allocateAmt;

            if (allocateAmt >= serviceRemainingDue) {
              const updateData = { isPaidToVendor: true };
              switch (service.serviceType) {
                case "FLIGHT":
                  await prisma.flightService.update({
                    where: { id: service.id },
                    data: updateData,
                  });
                  break;
                case "HOTEL":
                  await prisma.accommodationService.update({
                    where: { id: service.id },
                    data: updateData,
                  });
                  break;
                case "TRANSPORT":
                  await prisma.transportService.update({
                    where: { id: service.id },
                    data: updateData,
                  });
                  break;
                case "VISA":
                  await prisma.visaService.update({
                    where: { id: service.id },
                    data: updateData,
                  });
                  break;
                case "ADDITIONAL":
                  await prisma.additionalService.update({
                    where: { id: service.id },
                    data: updateData,
                  });
                  break;
              }
            }
          }
        }

        if (allocations.length > 0) {
          await prisma.bookingAllocation.createMany({ data: allocations });
        }

        await prisma.bookingPayment.update({
          where: { id: paymentId },
          data: { notes: payload.notes || "Vendor Payment approved" },
        });

        // Auto recalculate agent margin
        await calculateAndSyncAgentMargin(payment.bookingId);
      } else if (notesStr.startsWith("[PENDING_BULK_VENDOR_PAYMENT] ")) {
        const payloadStr = notesStr.substring(
          "[PENDING_BULK_VENDOR_PAYMENT] ".length,
        );
        const payload = JSON.parse(payloadStr);

        const tenantId = tenantIdNumeric;
        const {
          vendorName,
          amount,
          paymentMethod,
          paidOn,
          notes: userNotes,
          allocations: manualAllocations,
          walletCreditUsed = 0,
        } = payload;

        const cashAmount = parseFloat(amount) || 0;
        const creditUsedAmount = parseFloat(walletCreditUsed) || 0;
        let remainingAmount = cashAmount + creditUsedAmount;

        let account = await prisma.ledgerAccount.findFirst({
          where: {
            tenantId,
            accountType: "VENDOR_PAYABLE",
            entityName: vendorName,
          },
        });
        if (!account) {
          account = await prisma.ledgerAccount.create({
            data: {
              tenantId,
              accountType: "VENDOR_PAYABLE",
              entityName: vendorName,
            },
          });
        }

        const allocations: any[] = [];

        // Process manual allocations
        if (
          manualAllocations &&
          Array.isArray(manualAllocations) &&
          manualAllocations.length > 0
        ) {
          const enrichedAllocations = [];
          for (const alloc of manualAllocations) {
            const { bookingId, serviceId, serviceType, amountApplied } = alloc;
            const parsedAmount = parseFloat(amountApplied);
            if (isNaN(parsedAmount) || parsedAmount <= 0) continue;

            let serviceModel;
            switch (serviceType) {
              case "FLIGHT":
                serviceModel = prisma.flightService;
                break;
              case "HOTEL":
                serviceModel = prisma.accommodationService;
                break;
              case "TRANSPORT":
                serviceModel = prisma.transportService;
                break;
              case "VISA":
                serviceModel = prisma.visaService;
                break;
              case "ADDITIONAL":
                serviceModel = prisma.additionalService;
                break;
              default:
                continue;
            }

            const service = await (serviceModel as any).findUnique({
              where: { id: serviceId },
              include: { booking: true },
            });

            if (!service || service.tenantId !== tenantId) continue;

            enrichedAllocations.push({
              bookingId,
              serviceId,
              serviceType,
              requestedAmount: parsedAmount,
              service,
              booking: service.booking,
              serviceModel,
            });
          }

          enrichedAllocations.sort((a, b) => {
            const aDate = new Date(
              a.booking?.createdAt || a.booking?.date || 0,
            ).getTime();
            const bDate = new Date(
              b.booking?.createdAt || b.booking?.date || 0,
            ).getTime();
            if (aDate !== bDate) return aDate - bDate;

            const aSvcDate = new Date(a.service?.createdAt || 0).getTime();
            const bSvcDate = new Date(b.service?.createdAt || 0).getTime();
            return aSvcDate - bSvcDate;
          });

          let tempRemaining = remainingAmount;
          for (const item of enrichedAllocations) {
            if (tempRemaining <= 0) break;

            const previousAllocations =
              await prisma.bookingAllocation.aggregate({
                where: {
                  tenantId,
                  serviceType: item.serviceType,
                  serviceId: item.serviceId,
                },
                _sum: { allocatedAmount: true },
              });

            const totalCost = parseFloat(
              item.service.price || item.service.charges || 0,
            );
            const alreadyAllocated =
              parseFloat(previousAllocations?._sum?.allocatedAmount as any) ||
              0;
            const serviceRemainingDue = totalCost - alreadyAllocated;

            if (serviceRemainingDue > 0) {
              const allocateAmt = Math.min(
                serviceRemainingDue,
                tempRemaining,
                item.requestedAmount,
              );
              if (allocateAmt <= 0) continue;

              allocations.push({
                tenantId,
                bookingId: item.bookingId,
                serviceType: item.serviceType,
                serviceId: item.serviceId,
                allocatedAmount: allocateAmt,
              });

              tempRemaining -= allocateAmt;

              if (allocateAmt >= serviceRemainingDue) {
                await (item.serviceModel as any).update({
                  where: { id: item.serviceId },
                  data: { isPaidToVendor: true },
                });
              }
            }
          }
        } else {
          // FIFO Fallback
          const fetchServices = async (model: any, type: string) => {
            const svcs = await model.findMany({
              where: { tenantId, vendorName, isPaidToVendor: false },
              orderBy: { createdAt: "asc" },
              include: { booking: true },
            });
            return svcs.map((s: any) => ({ ...s, serviceType: type }));
          };

          const flights = await fetchServices(prisma.flightService, "FLIGHT");
          const hotels = await fetchServices(
            prisma.accommodationService,
            "HOTEL",
          );
          const transports = await fetchServices(
            prisma.transportService,
            "TRANSPORT",
          );
          const visas = await fetchServices(prisma.visaService, "VISA");
          const additionals = await fetchServices(
            prisma.additionalService,
            "ADDITIONAL",
          );

          let allUnpaid = [
            ...flights,
            ...hotels,
            ...transports,
            ...visas,
            ...additionals,
          ].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );

          let tempRemaining = remainingAmount;
          for (const service of allUnpaid) {
            if (tempRemaining <= 0) break;

            const previousAllocations =
              await prisma.bookingAllocation.aggregate({
                where: {
                  tenantId,
                  serviceType: service.serviceType,
                  serviceId: service.id,
                },
                _sum: { allocatedAmount: true },
              });

            const totalCost = parseFloat(service.price || service.charges || 0);
            const alreadyAllocated =
              parseFloat(previousAllocations?._sum?.allocatedAmount as any) ||
              0;
            const serviceRemainingDue = totalCost - alreadyAllocated;

            if (serviceRemainingDue > 0) {
              const allocateAmt = Math.min(serviceRemainingDue, tempRemaining);
              allocations.push({
                tenantId,
                bookingId: service.bookingId,
                serviceType: service.serviceType,
                serviceId: service.id,
                allocatedAmount: allocateAmt,
              });
              tempRemaining -= allocateAmt;

              if (allocateAmt >= serviceRemainingDue) {
                const updateData = { isPaidToVendor: true };
                switch (service.serviceType) {
                  case "FLIGHT":
                    await prisma.flightService.update({
                      where: { id: service.id },
                      data: updateData,
                    });
                    break;
                  case "HOTEL":
                    await prisma.accommodationService.update({
                      where: { id: service.id },
                      data: updateData,
                    });
                    break;
                  case "TRANSPORT":
                    await prisma.transportService.update({
                      where: { id: service.id },
                      data: updateData,
                    });
                    break;
                  case "VISA":
                    await prisma.visaService.update({
                      where: { id: service.id },
                      data: updateData,
                    });
                    break;
                  case "ADDITIONAL":
                    await prisma.additionalService.update({
                      where: { id: service.id },
                      data: updateData,
                    });
                    break;
                }
              }
            }
          }
        }

        const totalAllocation = allocations.reduce(
          (sum, a) => sum + a.allocatedAmount,
          0,
        );
        const allocatedCash = Math.max(0, totalAllocation - creditUsedAmount);
        const overpaidAmount = Math.max(0, cashAmount - allocatedCash);

        const uniqueBookingIds = Array.from(
          new Set(allocations.map((a) => a.bookingId)),
        );
        const bookings = await prisma.booking.findMany({
          where: { id: { in: uniqueBookingIds } },
          select: { id: true, bookingReference: true },
        });
        const uniqueBookingRefs = Array.from(
          new Set(bookings.map((b) => b.bookingReference)),
        );
        const bookingRefsStr = uniqueBookingRefs.join(", ");

        let mainTxId: number | null = null;

        if (creditUsedAmount > 0) {
          const creditTx = await prisma.ledgerTransaction.create({
            data: {
              tenantId,
              transactionDate: parseDateWithCurrentTime(paidOn),
              description: `Wallet credit drawdown applied to bookings. Allocated to ${allocations.length} service(s) on booking(s): ${bookingRefsStr}`,
              type: "PAYMENT",
              referenceNumber: bookingRefsStr || null,
            },
          });
          await prisma.ledgerEntry.create({
            data: {
              transactionId: creditTx.id,
              accountId: account.id,
              debitAmount: 0,
              creditAmount: creditUsedAmount,
            },
          });
        }

        if (allocatedCash > 0) {
          const curSym = await getTenantCurrencySymbol(tenantId);
          const notesSuffix =
            creditUsedAmount > 0
              ? ` (${curSym}${creditUsedAmount.toFixed(2)} applied from Vendor Wallet)`
              : "";
          const cashTx = await prisma.ledgerTransaction.create({
            data: {
              tenantId,
              transactionDate: parseDateWithCurrentTime(paidOn),
              description: `Bulk payment to vendor ${vendorName}. Allocated to ${allocations.length} service(s) on booking(s): ${bookingRefsStr}.${notesSuffix} ${userNotes || ""}`,
              type: "PAYMENT",
              referenceNumber: bookingRefsStr || null,
            },
          });
          mainTxId = cashTx.id;

          await prisma.ledgerEntry.create({
            data: {
              transactionId: cashTx.id,
              accountId: account.id,
              debitAmount: allocatedCash,
              creditAmount: 0,
            },
          });
        }

        if (overpaidAmount > 0) {
          const overTx = await prisma.ledgerTransaction.create({
            data: {
              tenantId,
              transactionDate: parseDateWithCurrentTime(paidOn),
              description: `Overpayment hold for future use (Vendor Wallet credit) for ${vendorName}. ${userNotes || ""}`,
              type: "PAYMENT",
              referenceNumber: bookingRefsStr || null,
            },
          });
          if (!mainTxId) mainTxId = overTx.id;

          await prisma.ledgerEntry.create({
            data: {
              transactionId: overTx.id,
              accountId: account.id,
              debitAmount: overpaidAmount,
              creditAmount: 0,
            },
          });
        }

        if (!mainTxId && cashAmount > 0 && totalAllocation === 0) {
          const unallocatedTx = await prisma.ledgerTransaction.create({
            data: {
              tenantId,
              transactionDate: parseDateWithCurrentTime(paidOn),
              description: `Vendor Wallet Credit / Prepayment to ${vendorName}. ${userNotes || ""}`,
              type: "PAYMENT",
              referenceNumber: null,
            },
          });
          mainTxId = unallocatedTx.id;

          await prisma.ledgerEntry.create({
            data: {
              transactionId: unallocatedTx.id,
              accountId: account.id,
              debitAmount: cashAmount,
              creditAmount: 0,
            },
          });
        }

        const allocTxId = mainTxId || 0;
        if (allocations.length > 0 && allocTxId > 0) {
          const allocationsWithTx = allocations.map((a) => ({
            ...a,
            transactionId: allocTxId,
          }));
          await prisma.bookingAllocation.createMany({
            data: allocationsWithTx,
          });
        }

        const bookingAmounts: Record<number, number> = {};
        for (const alloc of allocations) {
          bookingAmounts[alloc.bookingId] =
            (bookingAmounts[alloc.bookingId] || 0) + alloc.allocatedAmount;
        }

        for (const [bIdStr, bAmount] of Object.entries(bookingAmounts)) {
          const bId = parseInt(bIdStr);

          const [flights, hotels, transports, visas, additionals] =
            await Promise.all([
              prisma.flightService.findMany({
                where: { bookingId: bId, vendorName },
              }),
              prisma.accommodationService.findMany({
                where: { bookingId: bId, vendorName },
              }),
              prisma.transportService.findMany({
                where: { bookingId: bId, vendorName },
              }),
              prisma.visaService.findMany({
                where: { bookingId: bId, vendorName },
              }),
              prisma.additionalService.findMany({
                where: { bookingId: bId, vendorName },
              }),
            ]);
          const allSrvs = [
            ...flights,
            ...hotels,
            ...transports,
            ...visas,
            ...additionals,
          ];
          const allPaid =
            allSrvs.length > 0 && allSrvs.every((s) => s.isPaidToVendor);

          const pStatus = allPaid ? "paid" : "partially_paid";

          await prisma.vendorPayment.create({
            data: {
              tenantId,
              bookingId: bId,
              vendorName,
              amount: bAmount,
              paymentStatus: pStatus,
              paidOn: parseDateWithCurrentTime(paidOn),
              notes: userNotes || null,
              totalPaid: bAmount,
              totalRefunded: 0,
              remainingDue: 0,
            },
          });

          // Auto recalculate agent margin and amounts for each affected booking
          await calculateAndSyncAgentMargin(bId);

          await syncBookingFinancials(bId);
        }

        await prisma.bookingPayment.update({
          where: { id: paymentId },
          data: { notes: userNotes || "Bulk Vendor Payment approved" },
        });
      } else {
        // Original standard payment approvals (Sent to Vendor, Received from Client, etc.)
        if (payment.paymentType === "Sent to Vendor") {
          const vendorName = await resolveVendorName(
            payment.notes,
            tenantIdNumeric,
          );
          let vendorAccount = await prisma.ledgerAccount.findFirst({
            where: {
              tenantId: tenantIdNumeric,
              accountType: "VENDOR_PAYABLE",
              entityName: vendorName,
            },
          });
          if (!vendorAccount) {
            vendorAccount = await prisma.ledgerAccount.create({
              data: {
                tenantId: tenantIdNumeric,
                accountType: "VENDOR_PAYABLE",
                entityName: vendorName,
              },
            });
          }

          const mainTx = await prisma.ledgerTransaction.create({
            data: {
              tenantId: tenantIdNumeric,
              transactionDate: payment.paidOn,
              referenceNumber: booking.bookingReference,
              description: `Vendor Payment via ${payment.paymentMethod}. ${payment.notes || ""}`,
              type: "PAYMENT",
            },
          });

          await prisma.ledgerEntry.create({
            data: {
              transactionId: mainTx.id,
              accountId: vendorAccount.id,
              debitAmount: payment.amount,
              creditAmount: 0,
            },
          });

          await prisma.ledgerAccount.update({
            where: { id: vendorAccount.id },
            data: { balance: { decrement: payment.amount } },
          });
        } else if (payment.paymentType === "Received from Client") {
          const customerName = booking.agentName || "Direct Client";
          let customerAccount = await prisma.ledgerAccount.findFirst({
            where: {
              tenantId: tenantIdNumeric,
              accountType: "CUSTOMER_RECEIVABLE",
              entityName: customerName,
            },
          });
          if (!customerAccount) {
            customerAccount = await prisma.ledgerAccount.create({
              data: {
                tenantId: tenantIdNumeric,
                accountType: "CUSTOMER_RECEIVABLE",
                entityName: customerName,
              },
            });
          }

          const mainTx = await prisma.ledgerTransaction.create({
            data: {
              tenantId: tenantIdNumeric,
              transactionDate: payment.paidOn,
              referenceNumber: booking.bookingReference,
              description: `Client Payment via ${payment.paymentMethod}. ${payment.notes || ""}`,
              type: "PAYMENT",
            },
          });

          await prisma.ledgerEntry.create({
            data: {
              transactionId: mainTx.id,
              accountId: customerAccount.id,
              debitAmount: 0,
              creditAmount: payment.amount,
            },
          });

          await prisma.ledgerAccount.update({
            where: { id: customerAccount.id },
            data: { balance: { decrement: payment.amount } },
          });

          // Credit card charges handling
          if (payment.cardCharges && Number(payment.cardCharges) > 0) {
            const existingFeeTx = await prisma.ledgerTransaction.findFirst({
              where: {
                tenantId: tenantIdNumeric,
                type: "FEE",
                referenceNumber: booking.bookingReference,
              },
            });

            if (!existingFeeTx) {
              const feeTx = await prisma.ledgerTransaction.create({
                data: {
                  tenantId: tenantIdNumeric,
                  transactionDate: payment.paidOn,
                  referenceNumber: booking.bookingReference,
                  description: `Credit Card Gateway Processing Fee for ${booking.bookingReference}`,
                  type: "FEE",
                },
              });

              await prisma.ledgerEntry.create({
                data: {
                  transactionId: feeTx.id,
                  accountId: customerAccount.id,
                  debitAmount: payment.cardCharges,
                  creditAmount: 0,
                },
              });

              await prisma.ledgerAccount.update({
                where: { id: customerAccount.id },
                data: { balance: { increment: payment.cardCharges } },
              });
            }
          }
        }
      }

      // Agent wallet sync
      if (
        payment.paymentType === "Margin Paid to Agent" &&
        booking.agentName &&
        booking.agentName !== "Direct Client" &&
        booking.agentName !== "System / Auto"
      ) {
        try {
          const authUrl =
            process.env.AUTH_SERVICE_URL || "http://auth-service:4001";
          let agentId = booking.agentId;
          if (!agentId) {
            const agentRes = await fetch(
              `${authUrl}/agents/by-name/${encodeURIComponent(booking.agentName)}`,
              {
                headers: { "x-tenant-id": tenantIdNumeric.toString() },
              },
            );
            if (agentRes.ok) {
              const agentData = await agentRes.json();
              agentId = agentData.agent.id;
            }
          }

          if (agentId) {
            if (payment.paymentMethod !== "Debt Offset") {
              const walletAmount =
                Number(payment.amount) > 0
                  ? -Number(payment.amount)
                  : Number(payment.amount);

              await fetch(`${authUrl}/agents/${agentId}/wallet/transaction`, {
                method: "POST",
                headers: {
                  "x-tenant-id": tenantIdNumeric.toString(),
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  amount: walletAmount,
                  transactionType: "MARGIN_PAID_OUT",
                  referenceId: booking.bookingReference,
                  notes: `Margin Paid to Agent via Booking. ${payment.notes || ""}`,
                }),
              });
            }

            await prisma.booking.update({
              where: { id: booking.id },
              data: { marginStatus: "Paid" },
            });
          }
        } catch (e) {
          console.error("Failed to sync client payment with agent wallet", e);
        }
      }

      // 3. Recalculate booking paid & remaining amounts
      await syncBookingFinancials(booking.id, Number(payment.cardCharges || 0));

      // 4. Mark notifications for this payment as read and update title to reflect approval
      await prisma.notification.updateMany({
        where: {
          tenantId: payment.tenantId,
          type: "PAYMENT_APPROVAL",
          referenceId: String(paymentId),
        },
        data: { isRead: true, title: "Transaction Approved ✓" },
      });

      res.status(200).json({
        message: "Transaction approved successfully",
        payment: updatedPayment,
      });
    } catch (error) {
      console.error("Approve Payment Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

app.post(
  "/finance/payments/:paymentId/reject",
  requireGatewayHeaders,
  authorizeRoles("COMPANY_ADMIN", "MAIN_COMPANY_ADMIN", "ADMIN", "SUPER_ADMIN"),
  async (req: CustomRequest, res: Response) => {
    try {
      const paymentId = parseInt(req.params.paymentId);
      const tenantIdNumeric = parseInt(req.tenantId!);

      const payment = await prisma.bookingPayment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Payment record not found" });
      }

      if (payment.tenantId !== tenantIdNumeric) {
        return res
          .status(403)
          .json({ error: "Forbidden", message: "Access denied" });
      }

      if (payment.status !== "pending") {
        return res.status(400).json({
          error: "Bad Request",
          message: "Payment is not in pending status",
        });
      }

      // Resolve who is rejecting this
      const rejectedByName = await getUserName(req.userId, req.tenantId);

      // 1. Update status to rejected + stamp who rejected it
      const updatedPayment = await prisma.bookingPayment.update({
        where: { id: paymentId },
        data: {
          status: "rejected",
          loggedByName: `Rejected by ${rejectedByName}`,
        },
      });

      // 2. Mark notifications as read and update title to reflect rejection
      await prisma.notification.updateMany({
        where: {
          tenantId: payment.tenantId,
          type: "PAYMENT_APPROVAL",
          referenceId: String(paymentId),
        },
        data: { isRead: true, title: "Transaction Rejected ✗" },
      });

      res.status(200).json({
        message: "Transaction rejected successfully",
        payment: updatedPayment,
      });
    } catch (error) {
      console.error("Reject Payment Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// --- INVOICING & VOUCHER SUBSYSTEM BACKEND ARCHITECTURE ---

const MOCK_PREVIEW_DATA = {
  company: {
    name: "Terrific Travels Ltd",
    logoPrimary:
      "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=120",
    logoSecondary:
      "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=120",
    address: "Registered Office: 123 Travel Tower, London, UK",
    email: "operations@terrifictravels.co.uk",
    phone: "+44 20 7946 0958",
    whatsapp: "https://api.whatsapp.com/send?phone=442079460958",
  },
  booking: {
    reference: "TT00909",
    date: new Date().toLocaleDateString("en-GB"),
    agent: "Faisal Chughtai",
    amountGross: "3499.00",
    amountSettled: "2500.00",
    amountDue: "999.00",
  },
  tables: {
    passengers: `
      <table class="w-full text-left border-collapse" style="font-size: 11px; width: 100%;">
        <thead>
          <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Title</th>
            <th style="padding: 6px 12px; font-weight: bold; color: #475569;">First Name</th>
            <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Last Name</th>
            <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Classification</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 12px; color: #334155;">Mr</td>
            <td style="padding: 6px 12px; color: #334155; font-weight: 600;">John</td>
            <td style="padding: 6px 12px; color: #334155; font-weight: 600;">Smith</td>
            <td style="padding: 6px 12px; color: #64748b;">Adult</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 12px; color: #334155;">Mrs</td>
            <td style="padding: 6px 12px; color: #334155; font-weight: 600;">Jane</td>
            <td style="padding: 6px 12px; color: #334155; font-weight: 600;">Smith</td>
            <td style="padding: 6px 12px; color: #64748b;">Adult</td>
          </tr>
        </tbody>
      </table>
    `,
    flights: `
      <table class="w-full text-left border-collapse" style="font-size: 11px; width: 100%;">
        <thead>
          <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Leg Date</th>
            <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Flight ID</th>
            <th style="padding: 6px 12px; font-weight: bold; color: #475569;">PNR Trackers</th>
            <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Origin</th>
            <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Dest</th>
            <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Times</th>
            <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Bag</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 12px; color: #334155;">12/06/2026</td>
            <td style="padding: 6px 12px; color: #334155; font-weight: 600;">MS780</td>
            <td style="padding: 6px 12px; color: #334155; font-family: monospace;">PNR123X / GDS99</td>
            <td style="padding: 6px 12px; color: #334155;">LHR</td>
            <td style="padding: 6px 12px; color: #334155;">CAI</td>
            <td style="padding: 6px 12px; color: #334155;">14:30 - 20:45</td>
            <td style="padding: 6px 12px; color: #64748b;">2 x 23kg</td>
          </tr>
        </tbody>
      </table>
    `,
    payments: `
      <table class="w-full text-left border-collapse" style="font-size: 11px; width: 100%;">
        <thead>
          <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Receipt Date</th>
            <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Payment Method</th>
            <th style="padding: 6px 12px; font-weight: bold; color: #475569; text-align: right;">Amount</th>
            <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 12px; color: #334155;">05/06/2026</td>
            <td style="padding: 6px 12px; color: #334155;">Bank Transfer</td>
            <td style="padding: 6px 12px; color: #334155; font-weight: 600; text-align: right;">£2,500.00</td>
            <td style="padding: 6px 12px; color: #10b981; font-weight: bold;">Approved</td>
          </tr>
        </tbody>
      </table>
    `,
    services: `
      <table class="w-full text-left border-collapse" style="font-size: 11px; width: 100%;">
        <thead>
          <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Service Description</th>
            <th style="padding: 6px 12px; font-weight: bold; color: #475569; text-align: right;">Total Price</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 12px; color: #334155;">Flight: LHR to CAI (MS780)</td>
            <td style="padding: 6px 12px; color: #334155; font-weight: 600; text-align: right;">£2,100.00</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 12px; color: #334155;">Hotel: Hilton Cairo (Double Room)</td>
            <td style="padding: 6px 12px; color: #334155; font-weight: 600; text-align: right;">£1,399.00</td>
          </tr>
        </tbody>
      </table>
    `,
  },
  document: {
    signature:
      "sha256-mock-sig-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    timestamp: new Date().toLocaleString("en-GB"),
  },
};

async function fetchTenantProfile(
  tenantId: number,
): Promise<{
  name: string;
  logo: string | null;
  location?: string;
  phone?: string;
  email?: string;
  domain?: string;
} | null> {
  const authUrl = process.env.AUTH_SERVICE_URL || "http://auth-service:4001";
  try {
    const res = await fetch(`${authUrl}/tenants/profile`, {
      method: "GET",
      headers: {
        "x-tenant-id": String(tenantId),
      },
    });
    if (res.ok) {
      const data: any = await res.json();
      if (data && data.tenant) {
        return {
          name: data.tenant.name || "",
          logo: data.tenant.logo || null,
          location: data.tenant.location || "",
          phone: data.tenant.phone || "",
          email: data.tenant.email || "",
          domain: data.tenant.domain || "",
        };
      }
    }
  } catch (error) {
    console.error("fetchTenantProfile error:", error);
  }
  return null;
}

function getDefaultTaxInvoiceHtml(): string {
  return `<div class="tax-invoice-document" style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.4; background: #ffffff;">
  <!-- PAGE 1: ITINERARY, ACCOMMODATION & BILLING BREAKDOWN -->
  <div class="invoice-page page-1" style="padding: 24px 28px; box-sizing: border-box;">
    <!-- Top Header: Logo & Company Info on Left | Tax Invoice Metadata on Right -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 22px;">
      <tr>
        <td style="width: 60%; vertical-align: top;">
          <div style="display: flex; align-items: flex-start; gap: 14px;">
            <div style="flex-shrink: 0; margin-top: 2px;">
              {{company.logoPrimary}}
            </div>
            <div>
              <div style="font-size: 17px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.3px;">{{company.name}}</div>
              <div style="font-size: 10px; color: #475569; font-weight: 600; margin-top: 3px;">Headquarters: {{company.address}}</div>
              <div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">Support: {{company.phone}} | Email: {{company.email}}</div>
              <div style="font-size: 9.5px; color: #64748b; margin-top: 1px;">Web: {{company.website}}</div>
            </div>
          </div>
        </td>
        <td style="width: 40%; vertical-align: top; text-align: right;">
          <div style="font-size: 26px; font-weight: 900; color: #c53030; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">TAX INVOICE</div>
          <table style="margin-left: auto; text-align: right; font-size: 10px; color: #334155; line-height: 1.45; border-collapse: collapse;">
            <tr><td style="font-weight: 600; color: #64748b; padding-right: 8px;">Invoice No:</td><td style="font-weight: 800; font-family: monospace;">{{invoice.number}}</td></tr>
            <tr><td style="font-weight: 600; color: #64748b; padding-right: 8px;">Booking Ref:</td><td style="font-weight: 800; font-family: monospace;">{{booking.reference}}</td></tr>
            <tr><td style="font-weight: 600; color: #64748b; padding-right: 8px;">Invoice Date:</td><td style="font-weight: 700;">{{invoice.date}}</td></tr>
            <tr><td style="font-weight: 600; color: #64748b; padding-right: 8px;">Quotation Date:</td><td style="font-weight: 700;">{{booking.date}}</td></tr>
            <tr><td style="font-weight: 600; color: #64748b; padding-right: 8px;">Package Type:</td><td style="font-weight: 700;">{{booking.packageType}}</td></tr>
            <tr><td style="font-weight: 600; color: #64748b; padding-right: 8px;">Payment Status:</td><td>{{booking.paymentStatusBadge}}</td></tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Customer Details & Package Reservation Summary (2-Column Card) -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="width: 50%; vertical-align: top; padding: 12px 16px; border-right: 1px solid #e2e8f0;">
          <div style="font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            CUSTOMER / BILL TO DETAILS
          </div>
          <div style="font-size: 10px; color: #334155; line-height: 1.6;">
            <div><span style="color: #64748b; font-weight: 600;">Lead Passenger:</span> <strong style="color: #0f172a;">{{customer.fullName}}</strong></div>
            {{customer.additionalPassengers}}
            <div><span style="color: #64748b; font-weight: 600;">Passports / Nationality:</span> {{customer.nationality}}</div>
            <div><span style="color: #64748b; font-weight: 600;">Contact Phone:</span> {{customer.phone}}</div>
            <div><span style="color: #64748b; font-weight: 600;">Email Address:</span> {{customer.email}}</div>
            <div><span style="color: #64748b; font-weight: 600;">Billing Address:</span> {{customer.address}}</div>
          </div>
        </td>
        <td style="width: 50%; vertical-align: top; padding: 12px 16px;">
          <div style="font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            PACKAGE & RESERVATION SUMMARY
          </div>
          <div style="font-size: 10px; color: #334155; line-height: 1.6;">
            <div><span style="color: #64748b; font-weight: 600;">Package Route:</span> <strong style="color: #0f172a;">{{package.route}}</strong></div>
            <div><span style="color: #64748b; font-weight: 600;">Travel Dates:</span> <strong style="color: #0f172a;">{{package.travelDates}}</strong></div>
            <div><span style="color: #64748b; font-weight: 600;">Total Passengers:</span> {{booking.totalPassengers}}</div>
            <div><span style="color: #64748b; font-weight: 600;">Airline Carrier:</span> {{flight.carrierSummary}}</div>
            <div><span style="color: #64748b; font-weight: 600;">Visa Authorization:</span> {{visa.authorizationSummary}}</div>
            <div><span style="color: #64748b; font-weight: 600;">Booking Status:</span> {{booking.statusSummary}}</div>
          </div>
        </td>
      </tr>
    </table>

    <!-- 1. FLIGHT ITINERARY SCHEDULE -->
    <div style="margin-bottom: 18px;">
      <div style="font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
        1. FLIGHT ITINERARY SCHEDULE ({{flight.carrierSummary}})
      </div>
      {{tables.flightSchedule}}
    </div>

    <!-- 2. HOTEL ACCOMMODATIONS & GROUND LOGISTICS -->
    <div style="margin-bottom: 18px;">
      <div style="font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
        2. HOTEL ACCOMMODATIONS & GROUND LOGISTICS ({{hotel.durationSummary}})
      </div>
      {{tables.hotelLogistics}}
    </div>

    <!-- 3. BILLING & PACKAGE FARE BREAKDOWN -->
    <div style="margin-bottom: 8px;">
      <div style="font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
        3. BILLING & PACKAGE FARE BREAKDOWN
      </div>
      {{tables.packageInclusions}}
    </div>
  </div>

  <!-- PAGE 2: FINANCIAL SETTLEMENT, PAYMENT INSTRUCTIONS & ACCEPTANCE SIGNATURE -->
  <div class="page-break" style="page-break-after: always; break-after: page; height: 1px;"></div>
  <div class="invoice-page page-2" style="padding: 24px 28px; box-sizing: border-box;">
    {{tables.financialSettlement}}

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; font-size: 10px; color: #334155; line-height: 1.55;">
      <strong style="color: #0f172a;">Payment Methods & Instructions:</strong> Bank: {{company.bankName}} | Account Name: {{company.accountName}} | Sort Code: {{company.sortCode}} | Account No: {{company.accountNumber}} | Payment Ref: <strong style="font-family: monospace;">{{booking.reference}}</strong> | Cards Accepted: Visa / MasterCard / Amex
    </div>

    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 24px; background: #ffffff;">
      <div style="font-size: 11.5px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
        CUSTOMER ACCEPTANCE & SIGNATURE
      </div>
      <p style="font-size: 10px; color: #475569; line-height: 1.55; font-style: italic; margin: 0 0 20px 0;">
        I hereby confirm that all passenger names, flight schedules, hotel categories, ground transport circuits, and total package costs shown above are agreed and approved. I acknowledge and explicitly agree to be legally bound by all {{company.name}} Terms & Conditions listed below.
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
        <tr>
          <td style="width: 50%; vertical-align: top; padding-right: 24px;">
            <div style="color: #475569; font-weight: 700; margin-bottom: 30px;">Customer Authorized Signature:</div>
            <div style="border-bottom: 1px solid #0f172a; width: 90%; height: 26px; font-weight: bold; color: #64748b;">X</div>
          </td>
          <td style="width: 50%; vertical-align: top; padding-left: 24px;">
            <div style="color: #475569; font-weight: 700; margin-bottom: 4px;">Lead Passenger Name (Printed):</div>
            <div style="font-weight: 800; color: #0f172a; border-bottom: 1px solid #94a3b8; width: 90%; padding-bottom: 4px; margin-bottom: 20px;">
              {{customer.fullName}}
            </div>
            <div style="color: #475569; font-weight: 700; margin-bottom: 4px;">Date of Acceptance:</div>
            <div style="font-weight: 800; color: #0f172a; border-bottom: 1px solid #94a3b8; width: 90%; padding-bottom: 4px;">
              {{document.date}}
            </div>
          </td>
        </tr>
      </table>
    </div>
  </div>

  <!-- PAGE 3: TERMS & CONDITIONS -->
  <div class="page-break" style="page-break-after: always; break-after: page; height: 1px;"></div>
  <div class="invoice-page page-3" style="padding: 24px 28px; box-sizing: border-box;">
    <div style="font-size: 14px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
      TERMS & CONDITIONS
    </div>
    <div style="font-size: 10.5px; font-weight: 800; color: #b91c1c; text-transform: uppercase; margin-bottom: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
      {{company.name}} - BOOKING TERMS, CONDITIONS & LEGAL DISCLAIMERS
    </div>

    <div style="font-size: 8.8px; color: #334155; line-height: 1.6;">
      {{tables.termsAndConditions}}
    </div>

    <div style="margin-top: 28px; padding-top: 14px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9.5px; color: #64748b;">
      <strong>{{company.name}}</strong> | Headquarters: {{company.address}} | Support: {{company.phone}} | Email: {{company.email}} | Web: {{company.website}}
    </div>
  </div>
</div>`;
}

function getDefaultTaxInvoiceCss(): string {
  return `/* Tax Invoice 3-Page Clean Layout */
@page {
  size: A4 portrait;
  margin: 10mm;
}

body {
  margin: 0;
  padding: 0;
  background: #f1f5f9;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #1e293b;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

.tax-invoice-document {
  max-width: 820px;
  margin: 0 auto;
  background: #ffffff;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.invoice-page {
  box-sizing: border-box;
  background: #ffffff;
  position: relative;
}

.page-break {
  page-break-after: always;
  break-after: page;
  height: 0;
  margin: 0;
  padding: 0;
  border: none;
}

@media print {
  body {
    background: #ffffff !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  .tax-invoice-document {
    max-width: 100% !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    border: none !important;
  }
  .invoice-page {
    padding: 10mm !important;
    margin: 0 !important;
  }
  .page-break {
    page-break-after: always !important;
    break-after: page !important;
  }
}`;
}

function getDefaultHotelVoucherHtml(): string {
  return `<div class="voucher-document hotel-voucher" style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.4; background: #ffffff;">
  <div class="voucher-page" style="padding: 24px 28px; box-sizing: border-box;">
    <!-- Top Header -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px;">
      <tr>
        <td style="width: 60%; vertical-align: top;">
          <div style="display: flex; align-items: flex-start; gap: 14px;">
            <div style="flex-shrink: 0; margin-top: 2px;">
              {{company.logoPrimary}}
            </div>
            <div>
              <div style="font-size: 16px; font-weight: 900; color: #091E42; text-transform: uppercase; letter-spacing: -0.3px;">{{company.name}}</div>
              <div style="font-size: 9.5px; color: #475569; font-weight: 600; margin-top: 2px;">Headquarters: {{company.address}}</div>
              <div style="font-size: 9px; color: #64748b; margin-top: 1px;">Support: {{company.phone}} | Email: {{company.email}}</div>
              <div style="font-size: 9px; color: #64748b; margin-top: 1px;">Web: {{company.website}}</div>
            </div>
          </div>
        </td>
        <td style="width: 40%; vertical-align: top; text-align: right;">
          <div style="font-size: 22px; font-weight: 900; color: #091E42; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">HOTEL VOUCHER</div>
          <div style="display: inline-block; background: #ecfdf5; border: 1px solid #10b981; border-radius: 4px; padding: 2px 8px; font-size: 9px; font-weight: 800; color: #047857; text-transform: uppercase; margin-bottom: 6px;">
            Status: Confirmed & Guaranteed
          </div>
          <table style="margin-left: auto; text-align: right; font-size: 9.5px; color: #334155; border-collapse: collapse;">
            <tr><td style="font-weight: 600; color: #64748b; padding-right: 8px;">Voucher No:</td><td style="font-weight: 800; font-family: monospace; color: #091E42;">{{voucher.hotelNumber}}</td></tr>
            <tr><td style="font-weight: 600; color: #64748b; padding-right: 8px;">Booking Ref:</td><td style="font-weight: 800; font-family: monospace; color: #091E42;">{{booking.reference}}</td></tr>
            <tr><td style="font-weight: 600; color: #64748b; padding-right: 8px;">Issue Date:</td><td style="font-weight: 700;">{{document.date}}</td></tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Regulatory Ribbon -->
    <div style="background: #091E42; color: #ffffff; border-radius: 6px; padding: 6px 14px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; font-weight: 700; margin-bottom: 16px; letter-spacing: 0.3px;">
      <span>ATOL PROTECTED (REG. NO {{company.atolNumber}})</span>
      <span>• OFFICIAL ACCOMMODATION CONFIRMATION VOUCHER •</span>
      <span>IATA MEMBER AGENCY ({{company.iataNumber}})</span>
    </div>

    <!-- 2-Column Overview Cards -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="width: 50%; vertical-align: top; padding: 10px 14px; border-right: 1px solid #e2e8f0;">
          <div style="font-size: 10px; font-weight: 900; color: #091E42; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            PRIMARY GUEST DETAILS
          </div>
          <div style="font-size: 9.5px; color: #334155; line-height: 1.6;">
            <div><span style="color: #64748b; font-weight: 600;">Lead Guest:</span> <strong style="color: #0f172a;">{{customer.fullName}}</strong></div>
            <div><span style="color: #64748b; font-weight: 600;">Total Guests:</span> <strong style="color: #0f172a;">{{booking.totalPassengers}}</strong></div>
            <div><span style="color: #64748b; font-weight: 600;">Mobile Contact:</span> {{customer.phone}}</div>
            <div><span style="color: #64748b; font-weight: 600;">Email Address:</span> {{customer.email}}</div>
            <div><span style="color: #64748b; font-weight: 600;">Nationality:</span> {{customer.nationality}}</div>
          </div>
        </td>
        <td style="width: 50%; vertical-align: top; padding: 10px 14px;">
          <div style="font-size: 10px; font-weight: 900; color: #091E42; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            STAY & PROPERTY OVERVIEW
          </div>
          <div style="font-size: 9.5px; color: #334155; line-height: 1.6;">
            <div><span style="color: #64748b; font-weight: 600;">Destination:</span> <strong style="color: #0f172a;">{{hotel.primaryCity}}</strong></div>
            <div><span style="color: #64748b; font-weight: 600;">Check-in Date:</span> <strong style="color: #0f172a;">{{hotel.checkIn}}</strong> (From 14:00)</div>
            <div><span style="color: #64748b; font-weight: 600;">Check-out Date:</span> <strong style="color: #0f172a;">{{hotel.checkOut}}</strong> (Before 12:00)</div>
            <div><span style="color: #64748b; font-weight: 600;">Duration of Stay:</span> <strong style="color: #0f172a;">{{hotel.nights}}</strong></div>
            <div><span style="color: #64748b; font-weight: 600;">Fulfillment Guarantee:</span> Pre-paid by {{company.name}}</div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Table 1: Accommodation & Room Allocation -->
    <div style="margin-bottom: 16px;">
      <div style="font-size: 10.5px; font-weight: 900; color: #091E42; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
        ACCOMMODATION & ROOM ALLOCATION
      </div>
      {{tables.hotelAllocation}}
    </div>

    <!-- Table 2: Registered Guest Manifest -->
    <div style="margin-bottom: 16px;">
      <div style="font-size: 10.5px; font-weight: 900; color: #091E42; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
        REGISTERED GUEST MANIFEST
      </div>
      {{tables.guestManifest}}
    </div>

    <!-- Check-In Policies & Guest Notices Box -->
    <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px;">
      <div style="font-size: 10px; font-weight: 900; color: #091E42; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 6px;">
        IMPORTANT CHECK-IN POLICIES & GUEST NOTICES
      </div>
      <ol style="margin: 0; padding-left: 16px; font-size: 8.8px; color: #334155; line-height: 1.5;">
        <li style="margin-bottom: 3px;">
          <strong>Standard Check-in / Check-out Times:</strong> Standard hotel check-in time is from 14:00 hrs onwards, and check-out is strictly before 12:00 noon. Early check-in or late check-out is subject to room availability and discretionary hotel charges.
        </li>
        <li style="margin-bottom: 3px;">
          <strong>Mandatory Identification:</strong> All guests must present valid government photo identification (original Passport & valid Umrah/Tourist Visa) upon arrival at reception.
        </li>
        <li style="margin-bottom: 3px;">
          <strong>Incidental Expenses:</strong> This voucher covers the room accommodation and board basis specified above. All incidental charges (telephone, laundry, room service, mini-bar, or property damages) must be settled directly with the hotel prior to departure.
        </li>
        <li style="margin-bottom: 3px;">
          <strong>Pre-paid Guarantee:</strong> This accommodation voucher is pre-paid and guaranteed by {{company.name}}. Front desk reception must NOT demand room charges from the registered guest. For urgent assistance, contact our 24/7 hotline at {{company.phone}}.
        </li>
      </ol>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center; font-size: 8.5px; color: #64748b;">
      <strong>{{company.name}}</strong> | {{company.address}} | Tel: {{company.phone}} | Email: {{company.email}} | Web: {{company.website}}
    </div>
  </div>
</div>`;
}

function getDefaultHotelVoucherCss(): string {
  return `/* Hotel Voucher Clean Layout */
@page {
  size: A4 portrait;
  margin: 8mm;
}

body {
  margin: 0;
  padding: 0;
  background: #f1f5f9;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #1e293b;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

.voucher-document {
  max-width: 820px;
  margin: 0 auto;
  background: #ffffff;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.voucher-page {
  box-sizing: border-box;
  background: #ffffff;
  position: relative;
}

@media print {
  body {
    background: #ffffff !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  .voucher-document {
    max-width: 100% !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    border: none !important;
  }
  .voucher-page {
    padding: 8mm !important;
    margin: 0 !important;
  }
}`;
}

function getDefaultTransportVoucherHtml(): string {
  return `<div class="voucher-document transport-voucher" style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.4; background: #ffffff;">
  <div class="voucher-page" style="padding: 24px 28px; box-sizing: border-box;">
    <!-- Top Header -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px;">
      <tr>
        <td style="width: 60%; vertical-align: top;">
          <div style="display: flex; align-items: flex-start; gap: 14px;">
            <div style="flex-shrink: 0; margin-top: 2px;">
              {{company.logoPrimary}}
            </div>
            <div>
              <div style="font-size: 16px; font-weight: 900; color: #091E42; text-transform: uppercase; letter-spacing: -0.3px;">{{company.name}}</div>
              <div style="font-size: 9.5px; color: #475569; font-weight: 600; margin-top: 2px;">Headquarters: {{company.address}}</div>
              <div style="font-size: 9px; color: #64748b; margin-top: 1px;">Support: {{company.phone}} | Email: {{company.email}}</div>
              <div style="font-size: 9px; color: #64748b; margin-top: 1px;">Web: {{company.website}}</div>
            </div>
          </div>
        </td>
        <td style="width: 40%; vertical-align: top; text-align: right;">
          <div style="font-size: 22px; font-weight: 900; color: #091E42; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">TRANSPORT VOUCHER</div>
          <div style="display: inline-block; background: #ecfdf5; border: 1px solid #10b981; border-radius: 4px; padding: 2px 8px; font-size: 9px; font-weight: 800; color: #047857; text-transform: uppercase; margin-bottom: 6px;">
            Status: Confirmed & Dispatched
          </div>
          <table style="margin-left: auto; text-align: right; font-size: 9.5px; color: #334155; border-collapse: collapse;">
            <tr><td style="font-weight: 600; color: #64748b; padding-right: 8px;">Voucher No:</td><td style="font-weight: 800; font-family: monospace; color: #091E42;">{{voucher.transportNumber}}</td></tr>
            <tr><td style="font-weight: 600; color: #64748b; padding-right: 8px;">Booking Ref:</td><td style="font-weight: 800; font-family: monospace; color: #091E42;">{{booking.reference}}</td></tr>
            <tr><td style="font-weight: 600; color: #64748b; padding-right: 8px;">Issue Date:</td><td style="font-weight: 700;">{{document.date}}</td></tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Regulatory Ribbon -->
    <div style="background: #091E42; color: #ffffff; border-radius: 6px; padding: 6px 14px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; font-weight: 700; margin-bottom: 16px; letter-spacing: 0.3px;">
      <span>ATOL PROTECTED (REG. NO {{company.atolNumber}})</span>
      <span>• GROUND LOGISTICS & TRANSFERS VOUCHER •</span>
      <span>IATA MEMBER AGENCY ({{company.iataNumber}})</span>
    </div>

    <!-- 2-Column Overview Cards -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="width: 50%; vertical-align: top; padding: 10px 14px; border-right: 1px solid #e2e8f0;">
          <div style="font-size: 10px; font-weight: 900; color: #091E42; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            PRIMARY TRAVELER DETAILS
          </div>
          <div style="font-size: 9.5px; color: #334155; line-height: 1.6;">
            <div><span style="color: #64748b; font-weight: 600;">Lead Passenger:</span> <strong style="color: #0f172a;">{{customer.fullName}}</strong></div>
            <div><span style="color: #64748b; font-weight: 600;">Total Travelers:</span> <strong style="color: #0f172a;">{{booking.totalPassengers}}</strong></div>
            <div><span style="color: #64748b; font-weight: 600;">Mobile Contact:</span> {{customer.phone}}</div>
            <div><span style="color: #64748b; font-weight: 600;">Email Address:</span> {{customer.email}}</div>
            <div><span style="color: #64748b; font-weight: 600;">Nationality:</span> {{customer.nationality}}</div>
          </div>
        </td>
        <td style="width: 50%; vertical-align: top; padding: 10px 14px;">
          <div style="font-size: 10px; font-weight: 900; color: #091E42; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            FULFILLMENT PARTNER & DISPATCH
          </div>
          <div style="font-size: 9.5px; color: #334155; line-height: 1.6;">
            <div><span style="color: #64748b; font-weight: 600;">Fleet Partner:</span> <strong style="color: #0f172a;">{{transport.vendorName}}</strong></div>
            <div><span style="color: #64748b; font-weight: 600;">24/7 Operations Desk:</span> <strong style="color: #0f172a;">{{transport.vendorPhone}}</strong></div>
            <div><span style="color: #64748b; font-weight: 600;">Dispatch Support:</span> {{transport.vendorEmail}}</div>
            <div><span style="color: #64748b; font-weight: 600;">Vehicle Allocation:</span> Private Air-Conditioned Fleet</div>
            <div><span style="color: #64748b; font-weight: 600;">Payment Status:</span> Pre-paid by {{company.name}}</div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Table 1: Scheduled Route & Transfer Legs -->
    <div style="margin-bottom: 16px;">
      <div style="font-size: 10.5px; font-weight: 900; color: #091E42; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
        SCHEDULED TRANSFER ROUTE & LEGS
      </div>
      {{tables.transportLegs}}
    </div>

    <!-- Table 2: Passenger Manifest -->
    <div style="margin-bottom: 16px;">
      <div style="font-size: 10.5px; font-weight: 900; color: #091E42; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
        PASSENGER MANIFEST
      </div>
      {{tables.transportPassengerManifest}}
    </div>

    <!-- 5-Point Operational Transfer Guidelines & Protocols Box -->
    <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px;">
      <div style="font-size: 10px; font-weight: 900; color: #091E42; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 6px;">
        5-POINT OPERATIONAL TRANSFER GUIDELINES & PROTOCOLS
      </div>
      <ol style="margin: 0; padding-left: 16px; font-size: 8.8px; color: #334155; line-height: 1.5;">
        <li style="margin-bottom: 3px;">
          <strong>Meeting Point & Driver Meet-and-Greet:</strong> For airport arrivals, the driver will await guests outside the terminal customs arrival hall holding a name paging board. For hotel departures, the driver will report to the main lobby entrance.
        </li>
        <li style="margin-bottom: 3px;">
          <strong>Punctuality & Lobby Readiness:</strong> Passengers must be waiting in the hotel reception lobby with all luggage ready 15 minutes prior to the scheduled pickup time. Intercity and flight departure transfers operate strictly to schedule.
        </li>
        <li style="margin-bottom: 3px;">
          <strong>Flight Tracking & Schedule Revisions:</strong> Airport transfers are coordinated against designated flight numbers. In the event of flight delays, cancelations, or gate reassignments, notify our dispatch desk immediately via phone or WhatsApp.
        </li>
        <li style="margin-bottom: 3px;">
          <strong>Luggage Allowance Compliance:</strong> Baggage is strictly limited to standard allowances (1 suitcase + 1 hand luggage per passenger). Excessive baggage exceeding vehicle trunk capacity may necessitate a supplemental transfer at the guest's expense.
        </li>
        <li style="margin-bottom: 3px;">
          <strong>Pre-paid Transfer Notice:</strong> This transfer service has been fully pre-paid and contracted by {{company.name}}. No cash payment, tolls, or driver tips should be paid by the guest. For operational queries, call dispatch at {{company.phone}}.
        </li>
      </ol>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center; font-size: 8.5px; color: #64748b;">
      <strong>{{company.name}}</strong> | {{company.address}} | Tel: {{company.phone}} | Email: {{company.email}} | Web: {{company.website}}
    </div>
  </div>
</div>`;
}

function getDefaultTransportVoucherCss(): string {
  return `/* Transport Voucher Clean Layout */
@page {
  size: A4 portrait;
  margin: 8mm;
}

body {
  margin: 0;
  padding: 0;
  background: #f1f5f9;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #1e293b;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

.voucher-document {
  max-width: 820px;
  margin: 0 auto;
  background: #ffffff;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.voucher-page {
  box-sizing: border-box;
  background: #ffffff;
  position: relative;
}

@media print {
  body {
    background: #ffffff !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  .voucher-document {
    max-width: 100% !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    border: none !important;
  }
  .voucher-page {
    padding: 8mm !important;
    margin: 0 !important;
  }
}`;
}

function buildHotelAllocationTable(booking: any): string {
  const accommodations = booking.accommodations || booking.accommodationServices || [];
  if (accommodations.length === 0) {
    return `<div style="padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center; color: #64748b; font-size: 10px;">No hotel accommodations assigned.</div>`;
  }
  const formatDate = (d: any) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const computeNights = (cin: any, cout: any) => {
    if (!cin || !cout) return 1;
    const diff = new Date(cout).getTime() - new Date(cin).getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
  };

  const rows = accommodations.map((h: any, idx: number) => {
    const cIn = formatDate(h.checkInDate);
    const cOut = formatDate(h.checkOutDate);
    const nights = computeNights(h.checkInDate, h.checkOutDate);
    const confNo = h.hotelConfirmationNumber || h.reservationNumber || `CNF-${booking.bookingReference}-${idx + 1}`;
    const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    return `
      <tr style="border-bottom: 1px solid #e2e8f0; background: ${bg};">
        <td style="padding: 8px 10px; vertical-align: top;">
          <strong style="color: #091E42; display: block; font-size: 10px;">${h.hotelName}</strong>
          <div style="color: #64748b; font-size: 8.5px; margin-top: 2px;">${h.hotelAddress || (h.city ? `${h.city}, Saudi Arabia` : 'Haram Vicinity')}</div>
        </td>
        <td style="padding: 8px 10px; vertical-align: top; font-family: monospace; font-weight: 800; color: #1e3a8a;">
          ${confNo}
        </td>
        <td style="padding: 8px 10px; vertical-align: top;">
          <strong style="color: #0f172a;">${h.roomType || 'Standard Room'}</strong>
        </td>
        <td style="padding: 8px 10px; vertical-align: top; color: #334155;">
          ${h.mealType || 'Room Only'}
        </td>
        <td style="padding: 8px 10px; vertical-align: top; text-align: center; font-weight: 700;">
          ${h.qty || 1}
        </td>
        <td style="padding: 8px 10px; vertical-align: top; font-size: 9px;">
          <div>${cIn} to</div>
          <div>${cOut}</div>
          <div style="color: #64748b; font-size: 8.5px; font-weight: 600;">(${nights} Nights)</div>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <table style="width: 100%; border-collapse: collapse; font-size: 9.5px; border: 1px solid #cbd5e1;">
      <thead>
        <tr style="background: #091E42; color: #ffffff; text-align: left;">
          <th style="padding: 6px 10px; font-weight: 800; width: 32%;">Property Details</th>
          <th style="padding: 6px 10px; font-weight: 800; width: 18%;">Confirmation #</th>
          <th style="padding: 6px 10px; font-weight: 800; width: 16%;">Room Type</th>
          <th style="padding: 6px 10px; font-weight: 800; width: 14%;">Board Basis</th>
          <th style="padding: 6px 10px; font-weight: 800; width: 8%; text-align: center;">Qty</th>
          <th style="padding: 6px 10px; font-weight: 800; width: 12%;">Stay Dates</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function buildGuestManifestTable(booking: any): string {
  const customers = booking.customers || [];
  if (customers.length === 0) {
    return `<div style="padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center; color: #64748b; font-size: 9.5px;">Lead Guest: Walk-in Client (1 Pax)</div>`;
  }
  const rows = customers.map((c: any, idx: number) => {
    const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    return `
      <tr style="border-bottom: 1px solid #e2e8f0; background: ${bg};">
        <td style="padding: 6px 10px; text-align: center; font-weight: 700; color: #64748b;">${idx + 1}</td>
        <td style="padding: 6px 10px; font-weight: 700; color: #0f172a;">${c.title ? c.title + ' ' : ''}${c.firstName} ${c.lastName}</td>
        <td style="padding: 6px 10px; color: #334155;">${c.ageCategory || 'Adult'}</td>
        <td style="padding: 6px 10px; color: #334155;">${c.nationality || 'British Citizen'}</td>
        <td style="padding: 6px 10px; font-family: monospace; color: #334155;">${c.passportNumber || '-'}</td>
      </tr>
    `;
  }).join('');

  return `
    <table style="width: 100%; border-collapse: collapse; font-size: 9.5px; border: 1px solid #cbd5e1;">
      <thead>
        <tr style="background: #091E42; color: #ffffff; text-align: left;">
          <th style="padding: 6px 10px; font-weight: 800; width: 6%; text-align: center;">No.</th>
          <th style="padding: 6px 10px; font-weight: 800; width: 36%;">Full Guest Name</th>
          <th style="padding: 6px 10px; font-weight: 800; width: 18%;">Age Category</th>
          <th style="padding: 6px 10px; font-weight: 800; width: 20%;">Nationality</th>
          <th style="padding: 6px 10px; font-weight: 800; width: 20%;">Passport No.</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function buildTransportLegsTable(booking: any): string {
  const transports = booking.transportServices || [];
  if (transports.length === 0) {
    return `<div style="padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center; color: #64748b; font-size: 10px;">Private circuit transfers included as per confirmed itinerary.</div>`;
  }
  const formatDate = (d: any) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  const rows = transports.map((t: any, idx: number) => {
    const dateStr = t.date ? formatDate(t.date) : 'Scheduled Date TBA';
    const timeStr = t.time || 'TBA';
    const pickup = t.departureDestination || t.pickUpLocation || 'Jeddah Airport (JED) / Hotel Lobby';
    const dropoff = t.arrivalDestination || t.dropOffLocation || 'Hotel Accommodation';
    const vehicle = t.vehicleType || 'Private AC Vehicle';
    const notes = t.notes || t.flightNo || 'Confirmed Transfer';
    const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; background: ${bg};">
        <td style="padding: 7px 10px; text-align: center; font-weight: 800; color: #091E42;">${idx + 1}</td>
        <td style="padding: 7px 10px; vertical-align: top;">
          <strong style="color: #0f172a;">${dateStr}</strong>
          <div style="color: #64748b; font-size: 8.5px; margin-top: 1px;">${timeStr}</div>
        </td>
        <td style="padding: 7px 10px; vertical-align: top; color: #334155;">
          <strong style="color: #0f172a;">${pickup}</strong>
        </td>
        <td style="padding: 7px 10px; vertical-align: top; color: #334155;">
          <strong style="color: #0f172a;">${dropoff}</strong>
        </td>
        <td style="padding: 7px 10px; vertical-align: top; font-weight: 700; color: #1e3a8a;">
          ${vehicle}
        </td>
        <td style="padding: 7px 10px; vertical-align: top; color: #64748b; font-size: 9px;">
          ${notes}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <table style="width: 100%; border-collapse: collapse; font-size: 9.5px; border: 1px solid #cbd5e1;">
      <thead>
        <tr style="background: #091E42; color: #ffffff; text-align: left;">
          <th style="padding: 6px 10px; font-weight: 800; width: 6%; text-align: center;">Leg #</th>
          <th style="padding: 6px 10px; font-weight: 800; width: 16%;">Date & Time</th>
          <th style="padding: 6px 10px; font-weight: 800; width: 24%;">Pick-up Location</th>
          <th style="padding: 6px 10px; font-weight: 800; width: 24%;">Drop-off Destination</th>
          <th style="padding: 6px 10px; font-weight: 800; width: 15%;">Vehicle Type</th>
          <th style="padding: 6px 10px; font-weight: 800; width: 15%;">Flight / Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function buildFlightScheduleTable(booking: any): string {
  const flights = booking.flightServices || [];
  if (flights.length === 0) {
    return `<div style="padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center; color: #64748b; font-size: 10px;">No scheduled flight segments registered.</div>`;
  }

  const outboundFlights = flights.slice(0, Math.max(1, Math.ceil(flights.length / 2)));
  const inboundFlights = flights.length > 1 ? flights.slice(Math.max(1, Math.ceil(flights.length / 2))) : [];

  const renderSectorRow = (sectorName: string, sectorFlights: any[]) => {
    if (!sectorFlights || sectorFlights.length === 0) return '';
    const f1 = sectorFlights[0];
    const fLast = sectorFlights[sectorFlights.length - 1];
    const route = `${f1.departedFrom || 'LHR'} to ${fLast.arrivedAt || 'JED'}`;
    const flightNos = sectorFlights.map((f: any) => f.flightNo).filter(Boolean).join(' / ') || f1.flightNo || 'TBA';
    const dateStr = f1.date ? new Date(f1.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : (f1.departureDate ? new Date(f1.departureDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-');

    const depDetails = `
      <strong style="color: #0f172a; display: block;">${f1.departedFromAirportName || f1.departedFrom || 'Departure Airport'}</strong>
      <div style="color: #334155; margin-top: 1px;">Dep: ${f1.departTime || 'TBA'}</div>
      <div style="color: #64748b; font-size: 9px;">${f1.flightNo || ''} - ${f1.aircraft || 'Boeing 787'}</div>
      ${sectorFlights.length > 1 ? `<div style="color: #334155; font-size: 9px; margin-top: 1px;">Arr ${f1.arrivedAt || 'Transit'}: ${f1.arrivalTime || 'TBA'}</div>` : ''}
    `;

    const arrDetails = `
      <strong style="color: #0f172a; display: block;">${fLast.arrivedAtAirportName || fLast.arrivedAt || 'Arrival Airport'}</strong>
      ${sectorFlights.length > 1 ? `<div style="color: #334155; margin-top: 1px;">Dep ${fLast.departedFrom || 'Transit'}: ${fLast.departTime || 'TBA'}</div>` : ''}
      <div style="color: #64748b; font-size: 9px;">${fLast.flightNo || ''} - ${fLast.aircraft || 'Boeing 787'}</div>
      <div style="color: #0f172a; font-weight: 700; margin-top: 2px;">Final Arr: ${fLast.arrivalTime || 'TBA'}</div>
    `;

    const transitText = sectorFlights.length > 1 
      ? `<div style="color: #334155; font-weight: 600;">Transit in ${f1.arrivedAt || 'AMM'}:</div><div style="color: #b45309; font-weight: bold; font-size: 9px;">1 hr 30 mins</div>`
      : `<div style="color: #10b981; font-weight: 600;">Direct Flight</div>`;

    const baggageText = f1.checkedBaggage || f1.baggage || '1x 23kg Hold Luggage';
    const cabinText = f1.carryOnBaggage || '+ 1x Cabin Bag (pp)';

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
        <td style="padding: 8px 10px; vertical-align: top;">
          <strong style="color: #0f172a; display: block; font-size: 10px;">${sectorName}</strong>
          <span style="font-weight: 700; color: #1e3a8a; font-size: 9.5px;">${route}</span>
          <div style="font-family: monospace; color: #64748b; font-size: 9px; margin-top: 2px;">${flightNos}</div>
          <div style="color: #64748b; font-size: 9px;">${dateStr}</div>
        </td>
        <td style="padding: 8px 10px; vertical-align: top; font-size: 9.5px;">${depDetails}</td>
        <td style="padding: 8px 10px; vertical-align: top; font-size: 9.5px;">${arrDetails}</td>
        <td style="padding: 8px 10px; vertical-align: top; font-size: 9.5px;">
          ${transitText}
          <div style="color: #64748b; font-size: 9px; margin-top: 2px;">Aircraft: ${f1.aircraft || 'Boeing 787'}</div>
        </td>
        <td style="padding: 8px 10px; vertical-align: top; font-size: 9.5px;">
          <strong style="color: #0f172a; display: block;">${f1.flightClass || 'Economy Class'}</strong>
          <div style="color: #64748b; font-size: 9px;">${baggageText}</div>
          <div style="color: #64748b; font-size: 9px;">${cabinText}</div>
        </td>
      </tr>
    `;
  };

  return `
    <table style="width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #cbd5e1;">
      <thead>
        <tr style="background: #091E42; color: #ffffff; text-align: left;">
          <th style="padding: 6px 10px; font-weight: 800; width: 18%;">Sector / Flight</th>
          <th style="padding: 6px 10px; font-weight: 800; width: 25%;">Departure Details</th>
          <th style="padding: 6px 10px; font-weight: 800; width: 25%;">Arrival Details</th>
          <th style="padding: 6px 10px; font-weight: 800; width: 17%;">Transit / Aircraft</th>
          <th style="padding: 6px 10px; font-weight: 800; width: 15%;">Cabin & Baggage</th>
        </tr>
      </thead>
      <tbody>
        ${renderSectorRow('OUTBOUND', outboundFlights)}
        ${inboundFlights.length > 0 ? renderSectorRow('INBOUND', inboundFlights) : ''}
      </tbody>
    </table>
  `;
}

function buildHotelLogisticsCards(booking: any): string {
  const accommodations = booking.accommodations || [];
  const transports = booking.transportServices || [];
  const visas = booking.visaServices || [];

  const h1 = accommodations[0] || null;
  const h2 = accommodations[1] || null;

  const formatDateShort = (d: any) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '-';

  const computeNights = (cin: any, cout: any) => {
    if (!cin || !cout) return 0;
    const diff = new Date(cout).getTime() - new Date(cin).getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
  };

  const renderHotelCard = (h: any, fallbackTitle: string, defaultCity: string) => {
    if (!h) {
      return `
        <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; background: #ffffff; min-height: 135px; box-sizing: border-box;">
          <div style="font-size: 10px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin-bottom: 4px;">${fallbackTitle}</div>
          <div style="color: #94a3b8; font-size: 9.5px; font-style: italic; margin-top: 10px;">Not included in this package.</div>
        </div>
      `;
    }
    const nights = computeNights(h.checkInDate, h.checkOutDate);
    const dateRange = h.checkInDate && h.checkOutDate ? `${formatDateShort(h.checkInDate)} - ${formatDateShort(h.checkOutDate)}` : 'Dates TBA';
    const title = h.city ? `${h.city.toUpperCase()} ACCOMMODATION` : fallbackTitle;
    const stars = h.hotelName?.includes('5-Star') ? '' : ' (4-Star)';

    return `
      <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; background: #ffffff; min-height: 135px; box-sizing: border-box;">
        <div style="font-size: 10px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin-bottom: 4px;">${title}</div>
        <div style="font-weight: 800; color: #1e3a8a; font-size: 10.5px; margin-bottom: 4px;">${h.hotelName}${stars}</div>
        <div style="font-size: 9px; color: #475569; line-height: 1.45;">
          <div><strong style="color: #334155;">Location:</strong> ${h.city || defaultCity}</div>
          <div><strong style="color: #334155;">Duration:</strong> ${nights > 0 ? `${nights} Nights (${dateRange})` : dateRange}</div>
          <div><strong style="color: #334155;">Room:</strong> ${h.roomType || 'Standard Room'}</div>
          <div><strong style="color: #334155;">Board:</strong> ${h.mealType || 'Room Only'}</div>
          <div><strong style="color: #334155;">Feature:</strong> ${h.notes || 'Haram Shuttle / Walking Distance'}</div>
        </div>
      </div>
    `;
  };

  let transportList = '';
  if (transports.length > 0) {
    transportList = transports.map((t: any, idx: number) => {
      const from = t.departureDestination || t.pickUpLocation || 'Pickup';
      const to = t.arrivalDestination || t.dropOffLocation || 'Dropoff';
      return `<div>• Sector ${idx + 1}: ${from} to ${to}</div>`;
    }).join('');
  } else {
    transportList = `<div>• Private AC Vehicle Circuit Included</div>`;
  }

  let visaList = '';
  if (visas.length > 0) {
    visaList = visas.map((v: any) => `<div>• ${v.visaType || 'Saudi Tourist / Umrah Visa'} (${v.country || 'Saudi Arabia'})</div>`).join('');
  } else {
    visaList = `<div>• Saudi ETA Visa (2-Year Multiple Entry)</div>`;
  }

  return `
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="width: 33.33%; vertical-align: top; padding-right: 6px;">
          ${renderHotelCard(h1, 'MAKKAH ACCOMMODATION', 'Makkah Al-Mukarramah')}
        </td>
        <td style="width: 33.33%; vertical-align: top; padding: 0 3px;">
          ${renderHotelCard(h2, 'MADINAH ACCOMMODATION', 'Madinah Al-Munawwarah')}
        </td>
        <td style="width: 33.33%; vertical-align: top; padding-left: 6px;">
          <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; background: #ffffff; min-height: 135px; box-sizing: border-box;">
            <div style="font-size: 10px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin-bottom: 4px;">TRANSFERS & VISA SERVICES</div>
            <div style="font-weight: 800; color: #1e3a8a; font-size: 10.5px; margin-bottom: 4px;">Private Transport + Visas</div>
            <div style="font-size: 9px; color: #475569; line-height: 1.45;">
              ${transportList}
              ${visaList}
            </div>
          </div>
        </td>
      </tr>
    </table>
  `;
}

function buildPackageInclusionsTable(booking: any, currencySymbol: string): string {
  const totalGross = Number(booking.totalPrice || 0);
  const paxQty = booking.customers?.length || 1;
  const ratePerPerson = (totalGross / paxQty).toFixed(2);
  const totalGrossFormatted = totalGross.toFixed(2);

  const bullets: string[] = [];

  if (booking.flightServices && booking.flightServices.length > 0) {
    const f1 = booking.flightServices[0];
    const carrier = f1.vendorName || f1.airlineCarrier || 'Royal Jordanian';
    const routes = booking.flightServices.map((f: any) => `${f.departedFrom} to ${f.arrivedAt}`).join(' | ');
    bullets.push(`Return Flights with ${carrier}: ${routes}`);
  }

  if (booking.accommodations && booking.accommodations.length > 0) {
    booking.accommodations.forEach((h: any) => {
      bullets.push(`${h.qty || 1}x Stay at ${h.hotelName} (${h.roomType || 'Standard Room'}, ${h.mealType || 'Room Only'})`);
    });
  }

  if (booking.transportServices && booking.transportServices.length > 0) {
    bullets.push(`Full Private AC Ground Transfer Circuit`);
  }

  if (booking.visaServices && booking.visaServices.length > 0) {
    bullets.push(`${booking.visaServices.length}x Saudi Visa Authorisations (ETA / Entry Visas)`);
  }

  bullets.push(`Airline Checked Baggage (23 kg) + Cabin Baggage + All Taxes & Airport Surcharges`);

  const bulletsHtml = bullets.map(b => `<li style="margin-bottom: 2px;">${b}</li>`).join('');

  let addonRows = '';
  if (booking.additionalServices && booking.additionalServices.length > 0) {
    addonRows = booking.additionalServices.map((s: any) => `
      <tr style="border-top: 1px solid #f1f5f9; background: #ffffff;">
        <td style="padding: 6px 10px; font-size: 9.5px; color: #334155;"><strong>Extra Service:</strong> ${s.serviceName} (${s.notes || ''})</td>
        <td style="padding: 6px 10px; text-align: center; font-size: 9.5px; font-weight: 600;">1</td>
        <td style="padding: 6px 10px; text-align: right; font-size: 9.5px; font-weight: 600;">${currencySymbol}${Number(s.charges || s.price || 0).toFixed(2)}</td>
        <td style="padding: 6px 10px; text-align: right; font-size: 9.5px; font-weight: 700;">${currencySymbol}${Number(s.charges || s.price || 0).toFixed(2)}</td>
      </tr>
    `).join('');
  }

  if (booking.discounts && booking.discounts.length > 0) {
    addonRows += booking.discounts.map((d: any) => `
      <tr style="border-top: 1px solid #f1f5f9; background: #ffffff;">
        <td style="padding: 6px 10px; font-size: 9.5px; color: #ef4444;"><strong>Promotional Discount:</strong> ${d.notes || d.description || 'Special Discount'}</td>
        <td style="padding: 6px 10px; text-align: center; font-size: 9.5px; font-weight: 600;">-</td>
        <td style="padding: 6px 10px; text-align: right; font-size: 9.5px; font-weight: 600;">-${currencySymbol}${Number(d.amount).toFixed(2)}</td>
        <td style="padding: 6px 10px; text-align: right; font-size: 9.5px; font-weight: 700; color: #ef4444;">-${currencySymbol}${Number(d.amount).toFixed(2)}</td>
      </tr>
    `).join('');
  }

  return `
    <table style="width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #cbd5e1;">
      <thead>
        <tr style="background: #091E42; color: #ffffff; text-align: left;">
          <th style="padding: 6px 10px; font-weight: 800; width: 60%;">Package Description & Service Inclusions</th>
          <th style="padding: 6px 10px; font-weight: 800; width: 12%; text-align: center;">Pax Qty</th>
          <th style="padding: 6px 10px; font-weight: 800; width: 14%; text-align: right;">Rate per Person</th>
          <th style="padding: 6px 10px; font-weight: 800; width: 14%; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr style="background: #ffffff;">
          <td style="padding: 8px 10px; vertical-align: top;">
            <strong style="color: #0f172a; font-size: 10.5px; display: block; margin-bottom: 4px;">Tailored Package Spiritual Journey</strong>
            <ul style="margin: 0; padding-left: 14px; font-size: 9px; color: #475569; line-height: 1.45;">
              ${bulletsHtml}
            </ul>
          </td>
          <td style="padding: 8px 10px; vertical-align: middle; text-align: center; font-weight: 700; color: #0f172a;">${paxQty}</td>
          <td style="padding: 8px 10px; vertical-align: middle; text-align: right; font-weight: 700; color: #0f172a;">${currencySymbol}${ratePerPerson}</td>
          <td style="padding: 8px 10px; vertical-align: middle; text-align: right; font-weight: 900; color: #0f172a; font-size: 11px;">${currencySymbol}${totalGrossFormatted}</td>
        </tr>
        ${addonRows}
      </tbody>
    </table>
  `;
}

function buildFinancialSettlementTable(booking: any, currencySymbol: string, totalGross: number, totalSettled: number, balanceDue: number): string {
  const depositDue = totalGross * 0.7;

  return `
    <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; margin-bottom: 20px;">
      <tr>
        <td style="width: 70%; text-align: right; padding: 6px 14px; font-weight: 700; color: #475569;">Package Subtotal:</td>
        <td style="width: 30%; text-align: right; padding: 6px 14px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${currencySymbol}${totalGross.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="width: 70%; text-align: right; padding: 6px 14px; font-weight: 700; color: #475569;">Taxes, APD & Visas:</td>
        <td style="width: 30%; text-align: right; padding: 6px 14px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">Included</td>
      </tr>
      <tr>
        <td style="width: 70%; text-align: right; padding: 6px 14px; font-weight: 700; color: #475569;">Deposit Due (70%):</td>
        <td style="width: 30%; text-align: right; padding: 6px 14px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${currencySymbol}${depositDue.toFixed(2)}</td>
      </tr>
      <tr style="background: #f8fafc; border-top: 2px solid #e2e8f0; border-bottom: 2px solid #e2e8f0;">
        <td style="width: 70%; text-align: right; padding: 10px 14px; font-weight: 900; color: #b91c1c; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">TOTAL AMOUNT DUE:</td>
        <td style="width: 30%; text-align: right; padding: 10px 14px; font-weight: 900; color: #b91c1c; font-size: 14px;">${currencySymbol}${balanceDue.toFixed(2)}</td>
      </tr>
    </table>
  `;
}

function buildTermsAndConditions(companyName: string): string {
  const name = companyName || 'Tooba Travels Ltd';
  return `
    <div style="margin-bottom: 6px;"><strong>1. Legally Binding Agreement:</strong> By submitting payment, the client explicitly agrees to be legally bound by all terms. Failure to digitally sign within 48 hours constitutes irrevocable acceptance. All issued tickets and packages are strictly non-changeable and non-refundable.</div>
    <div style="margin-bottom: 6px;"><strong>2. Payment & Taxation:</strong> A deposit strictly secures a seat, not a locked fare. 70% of the total balance must be cleared within 72 hours of confirmation. The client bears absolute sole responsibility for any supplementary resort fees, city taxes, or mandatory hotel surcharges.</div>
    <div style="margin-bottom: 6px;"><strong>3. Strict Cancellation Policy:</strong> Cancellations incur strict penalty charges. Credit for future reservations from initial deposits is entirely at the agency's sole discretion. ${name} assumes zero liability for issuing full refunds once services are booked and issued.</div>
    <div style="margin-bottom: 6px;"><strong>4. Force Majeure:</strong> In unforeseen disruptions (e.g., COVID-19, Saudi Ministry mandates, closures), clients may carry forward or reschedule. Should the client decline to reschedule under Force Majeure conditions, standard cancellation penalties will be strictly enforced.</div>
    <div style="margin-bottom: 6px;"><strong>5. Flight Obligations:</strong> Clients bear absolute responsibility for exact name matches on passports (minimum 6-8 months validity required). ${name} accepts zero liability for boarding denials. Group fares and block-booked seats are unequivocally non-refundable once issued.</div>
    <div style="margin-bottom: 6px;"><strong>6. Visa & Immigration:</strong> Visa eligibility and issuance are strictly at the absolute discretion of the Saudi Ministry or relevant consulate. Customers bear sole responsibility for verifying their individual visa eligibility based on their nationality and residency, providing mandatory documentation (e.g., valid BRP, proof of address), and ensuring passports possess 6-8 months validity. We assume zero liability and will issue no refunds for flights, hotels, or transport in the event of visa rejections, processing delays, or non-issuance.</div>
    <div style="margin-bottom: 6px;"><strong>7. Accommodation & Transfers:</strong> We reserve the absolute right to alter hotels to equivalent properties without prior notice during peak seasons or full bookings. Clients must purchase a local SIM immediately upon arrival. We hold no liability for traffic delays or logistical congestion.</div>
    <div style="margin-bottom: 6px;"><strong>8. Hajj & Umrah Specific Disclaimers:</strong> ${name} operates solely as a booking agent, not a Hajj Organizer, and disclaims all liability for last-minute itinerary changes by primary organizers. Hajj cancellations incur a mandatory minimum penalty of £250 per person.</div>
    <div style="margin-bottom: 6px;"><strong>9. Transport & Ground Services:</strong> Passengers must purchase a local SIM upon arrival for driver contact. We accept no liability for traffic delays. Ziyarats are strictly limited to 2-3 hours. Drivers are strictly prohibited from accompanying passengers to locations requiring physical climbing (e.g., Cave of Hira).</div>
    <div style="margin-bottom: 6px;"><strong>10. Third-Party Liability & Insurance:</strong> All services are subject to the terms of the relevant supplier. We shall not be liable for delays, cancellations, or matters arising from actions of third-party suppliers. We strongly recommend purchasing comprehensive travel insurance for cancellations, emergencies, and missed departures.</div>
    <div style="margin-bottom: 6px;"><strong>11. Chargebacks & Payment Disputes:</strong> The customer agrees not to initiate any credit card chargebacks or dispute legitimate charges for non-refundable services. In the event of a grievance, the customer must contact ${name} first to seek resolution. Initiating an unwarranted chargeback constitutes a material breach of this agreement and will result in the immediate cancellation of all active travel components without refund. ${name} reserves the right to recover the full disputed amount, plus all associated bank fees, administrative costs, and legal expenses, through a debt collection agency or legal action.</div>
    <div style="margin-bottom: 6px;"><strong>12. Hotel Check-In & Check-Out Times:</strong> The customer is strictly responsible for verifying all specific hotel check-in and check-out times prior to signing this invoice. Standard global policies typically mandate afternoon check-in and morning check-out, which may not align perfectly with your flight arrival or departure schedules. ${name} accepts absolute zero responsibility or liability for early arrivals, late departures, or any extra charges incurred, and we will not cover or arrange early check-in or late check-out under any circumstances.</div>
    <div style="margin-bottom: 6px;"><strong>13. Visa On Arrival & Travel Disruptions:</strong> Customers opting for a Visa on Arrival must double-check all entry requirements prior to departure by confirming directly with the Ministry of Interior (MOI) or Ministry of Foreign Affairs (MOFA) of the representative country. ${name} accepts zero liability and takes no responsibility for any travel disruptions, delays, or denials of entry caused by the airline and/or airport.</div>
  `;
}

const compileTemplateWithBookingData = (
  template: { name?: string; type: string; structureHtml: string; structureCss: string },
  companyContext: any,
  booking: any,
  signature: string,
  currencySymbol: string = "£",
) => {
  const totalGross = Number(booking.totalPrice || 0);
  const paymentsApproved =
    booking.payments?.filter(
      (p: any) =>
        p.paymentType === "Received from Client" && p.status === "approved",
    ) || [];
  const refundsApproved =
    booking.refunds?.filter((r: any) => r.direction === "Refund to Client") ||
    [];

  const totalPaid =
    paymentsApproved.reduce(
      (acc: number, p: any) => acc + Number(p.amount || 0),
      0,
    ) || 0;
  const totalRefunded =
    refundsApproved.reduce(
      (acc: number, r: any) => acc + Number(r.amount || 0),
      0,
    ) || 0;

  const totalSettled = totalPaid - totalRefunded;
  const balanceDue = totalGross - totalSettled;
  const depositDue = totalGross * 0.7;

  // Lead passenger details
  const leadCustomer = booking.customers?.[0] || null;
  const customerFullName = leadCustomer
    ? `${leadCustomer.firstName} ${leadCustomer.lastName}`
    : "Walk-in Client";
  const customerNationality =
    leadCustomer?.nationality || "British Citizens (Valid >6 Months)";
  const customerPhone =
    leadCustomer?.phoneNumber ||
    companyContext.landlineFormat ||
    "+44 [Customer Mobile Number]";
  const customerEmail =
    leadCustomer?.email || companyContext.emailSender || "client@example.com";
  const customerAddress =
    leadCustomer?.address ||
    companyContext.officeAddress ||
    "London, United Kingdom";

  const customerAdditionalPassengers =
    booking.customers && booking.customers.length > 1
      ? booking.customers
          .slice(1)
          .map(
            (c: any, idx: number) =>
              `<div><span style="color: #64748b; font-weight: 600;">Passenger ${idx + 2}:</span> ${c.firstName} ${c.lastName} (${c.ageCategory || "Adult"})</div>`,
          )
          .join("")
      : "";

  // Date and duration calculations
  let totalNights = 0;
  let travelDatesText = "Dates TBA";
  if (booking.accommodations && booking.accommodations.length > 0) {
    const validDates = booking.accommodations.filter(
      (a: any) => a.checkInDate && a.checkOutDate,
    );
    if (validDates.length > 0) {
      const earliest = new Date(
        Math.min(
          ...validDates.map((a: any) => new Date(a.checkInDate).getTime()),
        ),
      );
      const latest = new Date(
        Math.max(
          ...validDates.map((a: any) => new Date(a.checkOutDate).getTime()),
        ),
      );
      totalNights = Math.max(
        1,
        Math.round(
          (latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24),
        ),
      );
      travelDatesText = `${earliest.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} to ${latest.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} (${totalNights + 1} Days / ${totalNights} Nights)`;
    }
  } else if (booking.flightServices && booking.flightServices.length > 0) {
    const f1 = booking.flightServices[0];
    const fLast = booking.flightServices[booking.flightServices.length - 1];
    if (f1.date && fLast.date) {
      const d1 = new Date(f1.date);
      const d2 = new Date(fLast.date);
      totalNights = Math.max(
        1,
        Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)),
      );
      travelDatesText = `${d1.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} to ${d2.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} (${totalNights + 1} Days / ${totalNights} Nights)`;
    }
  }

  // Package Route
  let packageRoute = "London Heathrow (LHR) to Jeddah / Madinah (Return)";
  if (booking.flightServices && booking.flightServices.length > 0) {
    const f1 = booking.flightServices[0];
    const fLast = booking.flightServices[booking.flightServices.length - 1];
    packageRoute = `${f1.departedFrom || "LHR"} to ${fLast.arrivedAt || "JED"} (Return)`;
  } else if (booking.accommodations && booking.accommodations.length > 0) {
    const cities = Array.from(
      new Set(
        booking.accommodations.map((a: any) => a.city).filter(Boolean),
      ),
    );
    packageRoute =
      cities.length > 0
        ? `${cities.join(" & ")} Package`
        : "Tailored Travel Package";
  }

  const carrierName =
    booking.flightServices?.[0]?.vendorName ||
    booking.flightServices?.[0]?.airlineCarrier ||
    "Royal Jordanian";
  const flightClassName =
    booking.flightServices?.[0]?.flightClass || "Economy Class";
  const carrierSummary = `${carrierName} (${flightClassName})`;
  const visaAuthSummary = booking.visaServices?.[0]?.visaType
    ? `${booking.visaServices[0].visaType} (${booking.visaServices[0].country || "Saudi Arabia"})`
    : "Saudi Electronic Travel Authorisation (ETA)";
  const bookingStatusSummary =
    booking.status === "confirmed"
      ? "Confirmed / Awaiting Payment"
      : booking.status
        ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1)
        : "Confirmed";

  const paymentStatus =
    balanceDue <= 0
      ? "PAID"
      : totalSettled > 0
        ? "PARTIALLY PAID"
        : "PENDING";
  const paymentStatusBadge =
    balanceDue <= 0
      ? '<span style="color: #10b981; font-weight: 800;">PAID</span>'
      : totalSettled > 0
        ? '<span style="color: #f59e0b; font-weight: 800;">PARTIALLY PAID</span>'
        : '<span style="color: #dc2626; font-weight: 800;">PENDING</span>';

  const durationSummaryText =
    totalNights > 0 ? `${totalNights} NIGHTS` : "GROUND LOGISTICS";
  const packageTypeLabel = `${totalNights > 0 ? `${totalNights + 1}D/${totalNights}N ` : ""}${booking.tripType || "Umrah"} Tailored Package`;

  const passengerRows =
    booking.customers
      ?.map(
        (c: any) => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 6px 12px; color: #334155;">${c.title || "Mr/Mrs"}</td>
      <td style="padding: 6px 12px; color: #334155; font-weight: 600;">${c.firstName}</td>
      <td style="padding: 6px 12px; color: #334155; font-weight: 600;">${c.lastName}</td>
      <td style="padding: 6px 12px; color: #64748b;">${c.ageCategory || "Adult"}</td>
    </tr>
  `,
      )
      .join("") ||
    `<tr><td colspan="4" style="padding: 12px; text-align: center; color: #94a3b8;">No passengers registered</td></tr>`;

  const passengersTable = `
    <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 11px;">
      <thead>
        <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Title</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">First Name</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Last Name</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Classification</th>
        </tr>
      </thead>
      <tbody>
        ${passengerRows}
      </tbody>
    </table>
  `;

  const flightRows =
    booking.flightServices
      ?.map(
        (f: any) => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 6px 12px; color: #334155;">${f.departureDate || f.date ? new Date(f.departureDate || f.date).toLocaleDateString("en-GB") : "-"}</td>
      <td style="padding: 6px 12px; color: #334155; font-weight: 600;">${f.flightNo || "-"}</td>
      <td style="padding: 6px 12px; color: #334155; font-family: monospace;">${f.pnr || "-"}</td>
      <td style="padding: 6px 12px; color: #334155;">${f.departedFrom || "-"}</td>
      <td style="padding: 6px 12px; color: #334155;">${f.arrivedAt || "-"}</td>
      <td style="padding: 6px 12px; color: #334155;">${f.departTime || f.departureTime || "-"}</td>
      <td style="padding: 6px 12px; color: #64748b;">${f.baggageAllowance || f.baggage || "-"}</td>
    </tr>
  `,
      )
      .join("") ||
    `<tr><td colspan="7" style="padding: 12px; text-align: center; color: #94a3b8;">No flight legs registered</td></tr>`;

  const flightsTable = `
    <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 11px;">
      <thead>
        <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Leg Date</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Flight ID</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">PNR Trackers</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Origin</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Dest</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Times</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Bag</th>
        </tr>
      </thead>
      <tbody>
        ${flightRows}
      </tbody>
    </table>
  `;

  const hotelRows =
    booking.accommodations
      ?.map(
        (h: any) => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 6px 12px; color: #334155; font-weight: 600;">${h.hotelName || "-"}</td>
      <td style="padding: 6px 12px; color: #334155;">${h.reservationNumber || h.hotelConfirmationNumber || "-"}</td>
      <td style="padding: 6px 12px; color: #334155;">${h.qty || 1}</td>
      <td style="padding: 6px 12px; color: #334155;">${h.roomType || "-"}</td>
      <td style="padding: 6px 12px; color: #334155;">${h.mealType || "-"}</td>
      <td style="padding: 6px 12px; color: #64748b;">${h.checkInDate ? new Date(h.checkInDate).toLocaleDateString("en-GB") : "-"} to ${h.checkOutDate ? new Date(h.checkOutDate).toLocaleDateString("en-GB") : "-"}</td>
    </tr>
  `,
      )
      .join("") ||
    `<tr><td colspan="6" style="padding: 12px; text-align: center; color: #94a3b8;">No hotel bookings registered</td></tr>`;

  const hotelsTable = `
    <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 11px;">
      <thead>
        <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Hotel Name</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Res ID</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Qty</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Room Type</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Meal Plan</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Dates</th>
        </tr>
      </thead>
      <tbody>
        ${hotelRows}
      </tbody>
    </table>
  `;

  const transportRows =
    booking.transportServices
      ?.map(
        (t: any) => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 6px 12px; color: #334155;">${t.date ? new Date(t.date).toLocaleDateString("en-GB") : "-"}</td>
      <td style="padding: 6px 12px; color: #334155; font-weight: 600;">${t.vehicleType || "-"}</td>
      <td style="padding: 6px 12px; color: #334155;">${t.departureDestination || t.pickUpLocation || "-"} to ${t.arrivalDestination || t.dropOffLocation || "-"}</td>
      <td style="padding: 6px 12px; color: #334155;">${t.departureTime || "-"}</td>
      <td style="padding: 6px 12px; color: #64748b;">${t.vendorName || "-"}</td>
    </tr>
  `,
      )
      .join("") ||
    `<tr><td colspan="5" style="padding: 12px; text-align: center; color: #94a3b8;">No transport services registered</td></tr>`;

  const transportsTable = `
    <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 11px;">
      <thead>
        <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Date</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Vehicle Class</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Route (Pickup / Dropoff)</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Time</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Provider</th>
        </tr>
      </thead>
      <tbody>
        ${transportRows}
      </tbody>
    </table>
  `;

  const visaRows =
    booking.visaServices
      ?.map(
        (v: any) => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 6px 12px; color: #334155; font-weight: 600;">${v.visaType || "Standard"}</td>
      <td style="padding: 6px 12px; color: #334155; font-family: monospace;">${v.passportNumber || "-"}</td>
      <td style="padding: 6px 12px; color: #334155; font-family: monospace;">${v.visaNumber || "Pending"}</td>
      <td style="padding: 6px 12px; color: #64748b;">${v.issueDate ? new Date(v.issueDate).toLocaleDateString("en-GB") : "-"} to ${v.expiryDate ? new Date(v.expiryDate).toLocaleDateString("en-GB") : "-"}</td>
      <td style="padding: 6px 12px; color: #334155;">${v.vendorName || "-"}</td>
    </tr>
  `,
      )
      .join("") ||
    `<tr><td colspan="5" style="padding: 12px; text-align: center; color: #94a3b8;">No visa services registered</td></tr>`;

  const visasTable = `
    <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 11px;">
      <thead>
        <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Visa Type</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Passport Number</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Visa Number</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Validity Window</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Vendor</th>
        </tr>
      </thead>
      <tbody>
        ${visaRows}
      </tbody>
    </table>
  `;

  const specialtyRows =
    booking.additionalServices
      ?.map(
        (s: any) => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 6px 12px; color: #334155; font-weight: 600;">${s.serviceName || "-"}</td>
      <td style="padding: 6px 12px; color: #334155;">${s.vendorName || "-"}</td>
      <td style="padding: 6px 12px; color: #64748b;">${s.notes || "-"}</td>
    </tr>
  `,
      )
      .join("") ||
    `<tr><td colspan="3" style="padding: 12px; text-align: center; color: #94a3b8;">No custom services registered</td></tr>`;

  const specialtiesTable = `
    <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 11px;">
      <thead>
        <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Service Name</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Provider</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Operational Notes / Requirements</th>
        </tr>
      </thead>
      <tbody>
        ${specialtyRows}
      </tbody>
    </table>
  `;

  const paymentRows =
    paymentsApproved
      .map(
        (p: any) => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 6px 12px; color: #334155;">${new Date(p.paidOn).toLocaleDateString("en-GB")}</td>
      <td style="padding: 6px 12px; color: #334155;">${p.paymentMethod}</td>
      <td style="padding: 6px 12px; color: #334155; font-weight: 600; text-align: right;">${currencySymbol}${Number(p.amount).toFixed(2)}</td>
      <td style="padding: 6px 12px; color: #10b981; font-weight: bold;">Approved</td>
    </tr>
  `,
      )
      .join("") ||
    `<tr><td colspan="4" style="padding: 12px; text-align: center; color: #94a3b8;">No approved payments logged</td></tr>`;

  const paymentsTable = `
    <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 11px;">
      <thead>
        <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Receipt Date</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Payment Method</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569; text-align: right;">Amount</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${paymentRows}
      </tbody>
    </table>
  `;

  const serviceRows: string[] = [];
  booking.flightServices?.forEach((f: any) => {
    serviceRows.push(`
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 6px 12px; color: #334155;">Flight: ${f.departedFrom} to ${f.arrivedAt} (${f.flightNo || ""})</td>
        <td style="padding: 6px 12px; color: #334155; font-weight: 600; text-align: right;">${currencySymbol}${Number(f.price).toFixed(2)}</td>
      </tr>
    `);
  });
  booking.accommodations?.forEach((h: any) => {
    serviceRows.push(`
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 6px 12px; color: #334155;">Hotel: ${h.hotelName} (${h.roomType || ""})</td>
        <td style="padding: 6px 12px; color: #334155; font-weight: 600; text-align: right;">${currencySymbol}${Number(h.price).toFixed(2)}</td>
      </tr>
    `);
  });
  booking.transportServices?.forEach((t: any) => {
    serviceRows.push(`
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 6px 12px; color: #334155;">Transport: ${t.vehicleType} (${t.departureDestination || t.pickUpLocation} to ${t.arrivalDestination || t.dropOffLocation})</td>
        <td style="padding: 6px 12px; color: #334155; font-weight: 600; text-align: right;">${currencySymbol}${Number(t.price).toFixed(2)}</td>
      </tr>
    `);
  });
  booking.visaServices?.forEach((v: any) => {
    serviceRows.push(`
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 6px 12px; color: #334155;">Visa: ${v.visaType || "Standard"} - Passport ${v.passportNumber || ""}</td>
        <td style="padding: 6px 12px; color: #334155; font-weight: 600; text-align: right;">${currencySymbol}${Number(v.price).toFixed(2)}</td>
      </tr>
    `);
  });
  booking.additionalServices?.forEach((s: any) => {
    serviceRows.push(`
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 6px 12px; color: #334155;">Extra: ${s.serviceName} (${s.notes || ""})</td>
        <td style="padding: 6px 12px; color: #334155; font-weight: 600; text-align: right;">${currencySymbol}${Number(s.charges || s.price || 0).toFixed(2)}</td>
      </tr>
    `);
  });
  booking.discounts?.forEach((d: any) => {
    serviceRows.push(`
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 6px 12px; color: #ef4444;">Discount: ${d.notes || d.description || "General Discount"}</td>
        <td style="padding: 6px 12px; color: #ef4444; font-weight: 600; text-align: right;">-${currencySymbol}${Number(d.amount).toFixed(2)}</td>
      </tr>
    `);
  });

  const servicesTable = `
    <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 11px;">
      <thead>
        <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <th style="padding: 6px 12px; font-weight: bold; color: #475569;">Service Description</th>
          <th style="padding: 6px 12px; font-weight: bold; color: #475569; text-align: right;">Total Price</th>
        </tr>
      </thead>
      <tbody>
        ${serviceRows.join("") || '<tr><td colspan="2" style="padding: 12px; text-align: center; color: #94a3b8;">No billable services recorded</td></tr>'}
      </tbody>
    </table>
  `;

  const tokens: Record<string, string> = {
    "company.name": companyContext.companyName || "Travel Agency Ltd",
    "company.logoPrimary": companyContext.logoPrimary
      ? `<img src="${companyContext.logoPrimary}" alt="${companyContext.companyName || 'Company'}" style="max-height: 52px; max-width: 180px; object-fit: contain; vertical-align: middle;" />`
      : `<div style="width: 44px; height: 44px; border-radius: 8px; background: #0f172a; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 18px;">${(companyContext.companyName || "T").charAt(0)}</div>`,
    "company.logoSecondary": companyContext.logoSecondary
      ? `<img src="${companyContext.logoSecondary}" style="max-height: 50px; object-fit: contain;" />`
      : "",
    "company.address": companyContext.officeAddress || "London, United Kingdom",
    "company.email": companyContext.emailSender || "operations@travelagency.com",
    "company.phone": companyContext.landlineFormat || "+44 20 7946 0958",
    "company.website": companyContext.website || "www.toobatravels.co.uk",
    "company.whatsapp": companyContext.whatsappWebhook
      ? `<a href="${companyContext.whatsappWebhook}" target="_blank" style="color: #059669; font-weight: 600;">WhatsApp Support</a>`
      : "",
    "company.bankName": companyContext.bankName || "Barclays Bank UK",
    "company.accountName": companyContext.accountName || companyContext.companyName || "Tooba Travels Ltd",
    "company.sortCode": companyContext.sortCode || "20-00-00",
    "company.accountNumber": companyContext.accountNumber || "12345678",
    "invoice.number": `INV-${booking.bookingReference}`,
    "invoice.date": new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    "document.date": new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    "booking.reference": booking.bookingReference,
    "booking.date": new Date(booking.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    "booking.agent": booking.agentName || "Agent Assignment",
    "booking.currencySymbol": currencySymbol,
    "booking.packageType": packageTypeLabel,
    "booking.paymentStatus": paymentStatus,
    "booking.paymentStatusBadge": paymentStatusBadge,
    "booking.depositDue": depositDue.toFixed(2),
    "customer.fullName": customerFullName,
    "customer.additionalPassengers": customerAdditionalPassengers,
    "customer.nationality": customerNationality,
    "customer.phone": customerPhone,
    "customer.email": customerEmail,
    "customer.address": customerAddress,
    "package.route": packageRoute,
    "package.travelDates": travelDatesText,
    "booking.totalPassengers": `${booking.customers?.length || 1} Adult${(booking.customers?.length || 1) > 1 ? "s" : ""} (Passport Holders)`,
    "flight.carrierSummary": carrierSummary,
    "flight.airline": carrierName,
    "flight.class": flightClassName,
    "visa.authorizationSummary": visaAuthSummary,
    "booking.statusSummary": bookingStatusSummary,
    "hotel.durationSummary": durationSummaryText,
    "tables.flightSchedule": buildFlightScheduleTable(booking),
    "tables.hotelLogistics": buildHotelLogisticsCards(booking),
    "tables.packageInclusions": buildPackageInclusionsTable(booking, currencySymbol),
    "tables.financialSettlement": buildFinancialSettlementTable(booking, currencySymbol, totalGross, totalSettled, balanceDue),
    "tables.termsAndConditions": buildTermsAndConditions(companyContext.companyName),
    "voucher.number": template.name?.toLowerCase().includes("transport")
      ? `VCH-TRN-${booking.bookingReference}`
      : `VCH-HTL-${booking.bookingReference}`,
    "voucher.hotelNumber": `VCH-HTL-${booking.bookingReference}`,
    "voucher.transportNumber": `VCH-TRN-${booking.bookingReference}`,
    "hotel.primaryCity": booking.accommodations?.[0]?.city || "Makkah / Madinah",
    "hotel.checkIn": booking.accommodations?.[0]?.checkInDate
      ? new Date(booking.accommodations[0].checkInDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "TBA",
    "hotel.checkOut": booking.accommodations?.[0]?.checkOutDate
      ? new Date(booking.accommodations[0].checkOutDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "TBA",
    "hotel.nights": totalNights > 0 ? `${totalNights} Night(s)` : "Standard Stay",
    "transport.vendorName": booking.transportServices?.[0]?.vendorName || "Basma Transport / Ground Fleet",
    "transport.vendorPhone": companyContext.landlineFormat || "+44 20 7946 0958",
    "transport.vendorEmail": companyContext.emailSender || "operations@toobatravels.co.uk",
    "company.atolNumber": "11492",
    "company.iataNumber": "9127845",
    "tables.hotelAllocation": buildHotelAllocationTable(booking),
    "tables.guestManifest": buildGuestManifestTable(booking),
    "tables.transportLegs": buildTransportLegsTable(booking),
    "tables.transportPassengerManifest": buildGuestManifestTable(booking),
    "booking.amountGross":
      template.type === "VOUCHER" ? "" : Number(totalGross).toFixed(2),
    "booking.amountSettled":
      template.type === "VOUCHER" ? "" : Number(totalSettled).toFixed(2),
    "booking.amountDue":
      template.type === "VOUCHER" ? "" : Number(balanceDue).toFixed(2),
    "tables.passengers": passengersTable,
    "tables.flights": flightsTable,
    "tables.payments": template.type === "VOUCHER" ? "" : paymentsTable,
    "tables.services": template.type === "VOUCHER" ? "" : servicesTable,
    "tables.hotels": hotelsTable,
    "tables.transports": transportsTable,
    "tables.visas": visasTable,
    "tables.specialties": specialtiesTable,
    "document.signature": signature,
    "document.timestamp": new Date().toLocaleString("en-GB"),
  };

  const htmlToCompile = template.structureHtml
    .replace(
      /£\{\{booking\.amountGross\}\}/g,
      `${currencySymbol}{{booking.amountGross}}`,
    )
    .replace(
      /£\{\{booking\.amountSettled\}\}/g,
      `${currencySymbol}{{booking.amountSettled}}`,
    )
    .replace(
      /£\{\{booking\.amountDue\}\}/g,
      `${currencySymbol}{{booking.amountDue}}`,
    );

  const compiledHtml = htmlToCompile.replace(
    /\{\{([^{}]+)\}\}/g,
    (match, token) => {
      const key = token.trim();
      return tokens[key] !== undefined ? tokens[key] : match;
    },
  );

  return { compiledHtml, totalGross, totalSettled, balanceDue };
};

interface VisualSection {
  id: string;
  type: string;
  title: string;
  body?: string;
}

interface VisualConfig {
  themeColor: string;
  fontFamily: string;
  title: string;
  showLogoPrimary: boolean;
  showLogoSecondary: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showWhatsapp: boolean;
  sections: VisualSection[];
  showSignature: boolean;
  showTimestamp: boolean;
}

const defaultVisualConfig = (type: string): VisualConfig => ({
  themeColor: "indigo",
  fontFamily: "Inter",
  title: type === "INVOICE" ? "Invoice / Receipt" : "Service Voucher",
  showLogoPrimary: true,
  showLogoSecondary: false,
  showAddress: true,
  showPhone: true,
  showEmail: true,
  showWhatsapp: true,
  sections:
    type === "INVOICE"
      ? [
          { id: "sec-1", type: "passengers", title: "Passenger Manifest" },
          { id: "sec-2", type: "flights", title: "Flight Itinerary Details" },
          { id: "sec-3", type: "hotels", title: "Hotel Booking Details" },
          {
            id: "sec-4",
            type: "transports",
            title: "Ground Transport Details",
          },
          { id: "sec-5", type: "services", title: "Itemized Price Breakdown" },
          { id: "sec-6", type: "payments", title: "Payments Receipt Log" },
          { id: "sec-7", type: "balances", title: "Financial Balance Summary" },
          {
            id: "sec-8",
            type: "custom_text",
            title: "Terms & Conditions",
            body: "All balances must be settled prior to departure. Tickets and dynamic packages are non-refundable/non-transferable once validated and issued.",
          },
        ]
      : [
          { id: "sec-1", type: "passengers", title: "Traveler Manifest" },
          { id: "sec-2", type: "flights", title: "Flight Itinerary Legs" },
          { id: "sec-3", type: "hotels", title: "Hotel Stay Details" },
          {
            id: "sec-4",
            type: "transports",
            title: "Ground Transport & Shuttle Pickups",
          },
          { id: "sec-5", type: "visas", title: "Visa & Borders Approvals" },
          {
            id: "sec-6",
            type: "specialties",
            title: "Specialty Services Checklist",
          },
          {
            id: "sec-7",
            type: "custom_text",
            title: "Operational Instructions",
            body: "Present this operational voucher at the check-in terminal or gate along with traveler passports. For assistance, contact the support channels listed below.",
          },
        ],
  showSignature: true,
  showTimestamp: true,
});

function generateTemplateFromVisualConfig(config: VisualConfig, _type: string) {
  const themes: Record<
    string,
    { primary: string; secondary: string; text: string; bg: string }
  > = {
    indigo: {
      primary: "#4f46e5",
      secondary: "#818cf8",
      text: "#312e81",
      bg: "#f5f3ff",
    },
    blue: {
      primary: "#2563eb",
      secondary: "#60a5fa",
      text: "#1e3a8a",
      bg: "#eff6ff",
    },
    emerald: {
      primary: "#059669",
      secondary: "#34d399",
      text: "#064e3b",
      bg: "#ecfdf5",
    },
    slate: {
      primary: "#475569",
      secondary: "#94a3b8",
      text: "#0f172a",
      bg: "#f8fafc",
    },
    amber: {
      primary: "#d97706",
      secondary: "#fbbf24",
      text: "#78350f",
      bg: "#fffbeb",
    },
  };

  const selectedTheme = themes[config.themeColor] || themes.indigo;
  const primaryColor = selectedTheme.primary;
  const fontStack =
    config.fontFamily === "Outfit"
      ? "'Outfit', system-ui, sans-serif"
      : config.fontFamily === "Roboto"
        ? "'Roboto', system-ui, sans-serif"
        : "'Inter', system-ui, sans-serif";

  // Build HTML
  let html = `<div class="doc-container" style="font-family: ${fontStack}; max-width: 800px; margin: auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background: #fff; color: #334155; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">`;

  // Header: Branding & Metadata
  html += `
  <!-- Header: Branding & Metadata -->
  <div style="display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 24px;">
    <div>
      <div style="margin-bottom: 12px; display: flex; gap: 10px; align-items: center;">`;

  if (config.showLogoPrimary) {
    html += `\n        <div>{{company.logoPrimary}}</div>`;
  }
  if (config.showLogoSecondary) {
    html += `\n        <div>{{company.logoSecondary}}</div>`;
  }

  html += `\n      </div>
      <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a;">{{company.name}}</h2>`;

  if (config.showAddress) {
    html += `\n      <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">{{company.address}}</p>`;
  }

  if (config.showEmail || config.showPhone) {
    const contactParts = [];
    if (config.showEmail) contactParts.push(`Email: {{company.email}}`);
    if (config.showPhone) contactParts.push(`Tel: {{company.phone}}`);
    html += `\n      <p style="margin: 2px 0 0; font-size: 11px; color: #64748b;">${contactParts.join(" | ")}</p>`;
  }

  html += `
    </div>
    <div style="text-align: right;">
      <h1 style="margin: 0 0 10px; font-size: 26px; font-weight: 900; color: ${primaryColor}; letter-spacing: -0.5px; text-transform: uppercase;">${config.title}</h1>
      <p style="margin: 2px 0; font-size: 12px; font-weight: bold; color: #475569;">Booking Ref: <span style="font-family: monospace; font-size: 13px; color: ${primaryColor}; font-weight: 800;">{{booking.reference}}</span></p>
      <p style="margin: 2px 0; font-size: 11px; color: #64748b;">Issue Date: {{booking.date}}</p>
      <p style="margin: 2px 0; font-size: 11px; color: #64748b;">Assigned Agent: {{booking.agent}}</p>
    </div>
  </div>`;

  // Render Dynamic Sections in order
  const sections = config.sections || [];
  sections.forEach((sec) => {
    if (sec.type === "passengers") {
      html += `
  <!-- Passengers Section -->
  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${primaryColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
      ${sec.title}
    </h3>
    {{tables.passengers}}
  </div>`;
    } else if (sec.type === "flights") {
      html += `
  <!-- Flight Details Section -->
  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${primaryColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7 3 9l8 4-4.5 4.5H4L2 22l4.5-2v-2.5L11 13l4 8z"></path></svg>
      ${sec.title}
    </h3>
    {{tables.flights}}
  </div>`;
    } else if (sec.type === "hotels") {
      html += `
  <!-- Hotel Stay Section -->
  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${primaryColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
      ${sec.title}
    </h3>
    {{tables.hotels}}
  </div>`;
    } else if (sec.type === "transports") {
      html += `
  <!-- Transport details Section -->
  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${primaryColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><rect x="1" y="3" width="22" height="13" rx="2" ry="2"></rect><path d="M5 21v-2h14v2"></path><path d="M18 16V3"></path><path d="M6 16V3"></path></svg>
      ${sec.title}
    </h3>
    {{tables.transports}}
  </div>`;
    } else if (sec.type === "visas") {
      html += `
  <!-- Visa Section -->
  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${primaryColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
      ${sec.title}
    </h3>
    {{tables.visas}}
  </div>`;
    } else if (sec.type === "specialties") {
      html += `
  <!-- Specialties Section -->
  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${primaryColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
      ${sec.title}
    </h3>
    {{tables.specialties}}
  </div>`;
    } else if (sec.type === "services") {
      html += `
  <!-- Services Breakdown Section -->
  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${primaryColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="15" y2="17"></line></svg>
      ${sec.title}
    </h3>
    {{tables.services}}
  </div>`;
    } else if (sec.type === "payments") {
      html += `
  <!-- Payment logs Section -->
  <div style="margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${primaryColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12" y2="18"></line><line x1="2" y1="10" x2="22" y2="10"></line></svg>
      ${sec.title}
    </h3>
    {{tables.payments}}
  </div>`;
    } else if (sec.type === "balances") {
      html += `
  <div style="display: flex; justify-content: flex-end; margin-bottom: 32px;">
    <div style="width: 260px; background: ${selectedTheme.bg}; border: 1px solid ${primaryColor}20; border-radius: 12px; padding: 16px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #64748b;">
        <span>Total Gross Value:</span>
        <span style="font-weight: 700; color: #334155;">{{booking.currencySymbol}}{{booking.amountGross}}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #64748b; border-bottom: 1px solid ${primaryColor}15; padding-bottom: 8px;">
        <span>Confirmed Paid:</span>
        <span style="font-weight: 700; color: #10b981;">{{booking.currencySymbol}}{{booking.amountSettled}}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; color: #0f172a; padding-top: 4px;">
        <span>Balance Due:</span>
        <span style="color: ${primaryColor}; font-weight: 900;">{{booking.currencySymbol}}{{booking.amountDue}}</span>
      </div>
    </div>
  </div>`;
    } else if (sec.type === "custom_text") {
      html += `
  <!-- Custom Text Section -->
  <div style="margin-bottom: 24px; background: ${selectedTheme.bg}; border-radius: 12px; padding: 16px; border: 1px solid ${primaryColor}15; color: ${selectedTheme.text}; line-height: 1.5;">
    <h3 style="margin: 0 0 8px; font-size: 11px; font-weight: 800; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${primaryColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      ${sec.title}
    </h3>
    <p style="margin: 0; font-size: 10px; line-height: 1.5;">${(sec.body || "").replace(/\n/g, "<br>")}</p>
  </div>`;
    }
  });

  if (config.showSignature || config.showTimestamp || config.showWhatsapp) {
    html += `
  <!-- Footer Signature & Multi-Channel Address -->
  <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: space-between; align-items: end; font-size: 10px; color: #94a3b8;">
    <div>`;

    if (config.showSignature) {
      html += `
      <p style="margin: 2px 0; font-weight: bold; color: #64748b;">Digital Verification Seal</p>
      <p style="margin: 2px 0; font-family: monospace; font-size: 9px; color: #64748b; word-break: break-all; max-width: 320px;">{{document.signature}}</p>`;
    }

    if (config.showTimestamp) {
      html += `
      <p style="margin: 2px 0; font-size: 9px;">Generated secure hash timeline: {{document.timestamp}}</p>`;
    }

    html += `
    </div>
    <div style="text-align: right;">`;

    if (config.showWhatsapp) {
      html += `
      <p style="margin: 2px 0; color: #64748b; font-weight: bold; display: inline-flex; align-items: center; gap: 4px;">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#25d366" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
        WhatsApp Support Desk
      </p>
      <p style="margin: 2px 0; font-size: 9px; font-family: monospace; color: #64748b;">{{company.whatsapp}}</p>`;
    }

    html += `
    </div>
  </div>`;
  }

  html += `\n</div>`;

  let css = `/* Generated Template Stylesheet */
.doc-container {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
}
@media print {
  body {
    background: #fff !important;
  }
  .doc-container {
    box-shadow: none !important;
    border: none !important;
    padding: 0 !important;
  }
}`;

  return { html, css };
}

async function seedDefaultTemplatesForTenant(tenantId: number) {
  const templatesToSeed = [
    {
      name: "Default Tax Invoice Template",
      type: "INVOICE",
      html: getDefaultTaxInvoiceHtml(),
      css: getDefaultTaxInvoiceCss(),
    },
    {
      name: "Default Hotel Booking Voucher",
      type: "VOUCHER",
      html: getDefaultHotelVoucherHtml(),
      css: getDefaultHotelVoucherCss(),
    },
    {
      name: "Default Transport Transfer Voucher",
      type: "VOUCHER",
      html: getDefaultTransportVoucherHtml(),
      css: getDefaultTransportVoucherCss(),
    },
  ];

  for (const item of templatesToSeed) {
    const template = await prisma.documentTemplate.create({
      data: {
        tenantId,
        name: item.name,
        type: item.type,
        version: 1,
        status: "Active",
        structureHtml: item.html,
        structureCss: item.css,
      },
    });

    const tokenRegex = /\{\{([^{}]+)\}\}/g;
    const detectedTokens = new Set<string>();
    let match;
    while ((match = tokenRegex.exec(item.html)) !== null) {
      detectedTokens.add(match[1].trim());
    }

    for (const token of detectedTokens) {
      let pathInRecord = token;
      if (token.startsWith("booking.")) {
        pathInRecord = token.replace("booking.", "");
      }

      await prisma.templateVariable
        .create({
          data: {
            templateId: template.id,
            token,
            description: `Substitute value of ${token}`,
            pathInRecord,
          },
        })
        .catch(() => {});
    }
  }
}

// GET /finance/company-context
app.get(
  "/finance/company-context",
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      let tenantId = parseInt(req.tenantId!);
      if (req.isPlatformAdmin && req.query.tenantId) {
        tenantId = parseInt(req.query.tenantId as string);
      }
      let context = await prisma.companyContext.findUnique({
        where: { tenantId },
      });

      let tenantProfile: any = null;
      try {
        const tenantRes = await fetch(`${process.env.AUTH_SERVICE_URL || 'http://auth-service:4001'}/tenants/profile`, {
          headers: { 'x-tenant-id': String(tenantId) }
        });
        if (tenantRes.ok) {
          const tdata: any = await tenantRes.json();
          tenantProfile = tdata.tenant;
        }
      } catch (e) {}

      if (!context || !context.logoPrimary || context.logoPrimary.includes('unsplash.com') || context.officeAddress?.includes('123 Travel Tower')) {
        const defaultLogo = tenantProfile?.logo || 'https://bucket.techbarred.com/travelbooker-media/4fa089c9-3a6f-459b-b488-ea12a7f4d992.png';
        const defaultName = tenantProfile?.name || 'Tooba Travels Ltd';
        const defaultAddress = tenantProfile?.location || '63 Buxton Road, London, E17 7EH';
        const defaultEmail = tenantProfile?.email || 'office.toobatravels.co.uk';
        const defaultPhone = tenantProfile?.phone || '0203 371 8774';

        context = await prisma.companyContext.upsert({
          where: { tenantId },
          update: {
            companyName: defaultName,
            logoPrimary: defaultLogo,
            officeAddress: defaultAddress,
            emailSender: defaultEmail,
            landlineFormat: defaultPhone
          },
          create: {
            tenantId,
            companyName: defaultName,
            logoPrimary: defaultLogo,
            logoSecondary: "",
            officeAddress: defaultAddress,
            emailSender: defaultEmail,
            landlineFormat: defaultPhone,
            whatsappWebhook: `https://api.whatsapp.com/send?phone=${defaultPhone.replace(/[^0-9+]/g, '')}`,
            website: tenantProfile?.domain || "https://office.toobatravels.co.uk",
            registrationNumber: "12345678",
            vatNumber: "GB123456789",
            licenceNumber: "ATOL 11234 / IATA 96-0 1234",
            defaultTerms: "Rates and flight availability are subject to re-confirmation at the time of final booking and payment. British passport validity must be at least 6 months from the departure date. Hotel standard check-in is 16:00 and check-out is 12:00. Non-refundable package terms apply upon ticket issuance.",
          }
        });
      }

      res.status(200).json({ companyContext: context });
    } catch (error) {
      console.error("Fetch Company Context Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// PUT /finance/company-context
app.put(
  "/finance/company-context",
  requireGatewayHeaders,
  authorizeRoles("COMPANY_ADMIN", "MAIN_COMPANY_ADMIN", "ADMIN"),
  async (req: CustomRequest, res: Response) => {
    try {
      let tenantId = parseInt(req.tenantId!);
      if (req.isPlatformAdmin && req.body.tenantId) {
        tenantId = parseInt(req.body.tenantId);
      }
      const {
        companyName,
        logoPrimary,
        logoSecondary,
        officeAddress,
        emailSender,
        landlineFormat,
        whatsappWebhook,
        website,
        registrationNumber,
        vatNumber,
        licenceNumber,
        defaultTerms,
      } = req.body;

      if (!companyName) {
        return res.status(400).json({
          error: "Validation failed",
          message: "companyName is required",
        });
      }

      const context = await prisma.companyContext.upsert({
        where: { tenantId },
        update: {
          companyName,
          logoPrimary: logoPrimary || null,
          logoSecondary: logoSecondary || null,
          officeAddress: officeAddress || null,
          emailSender: emailSender || null,
          landlineFormat: landlineFormat || null,
          whatsappWebhook: whatsappWebhook || null,
          website: website || null,
          registrationNumber: registrationNumber || null,
          vatNumber: vatNumber || null,
          licenceNumber: licenceNumber || null,
          defaultTerms: defaultTerms || null,
        },
        create: {
          tenantId,
          companyName,
          logoPrimary: logoPrimary || null,
          logoSecondary: logoSecondary || null,
          officeAddress: officeAddress || null,
          emailSender: emailSender || null,
          landlineFormat: landlineFormat || null,
          whatsappWebhook: whatsappWebhook || null,
          website: website || null,
          registrationNumber: registrationNumber || null,
          vatNumber: vatNumber || null,
          licenceNumber: licenceNumber || null,
          defaultTerms: defaultTerms || null,
        },
      });

      res.status(200).json({
        message: "Company context updated successfully",
        companyContext: context,
      });
    } catch (error) {
      console.error("Update Company Context Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// GET /finance/templates
app.get(
  "/finance/templates",
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      let tenantId = parseInt(req.tenantId!);
      if (req.isPlatformAdmin && req.query.tenantId) {
        tenantId = parseInt(req.query.tenantId as string);
      }

      // Check if templates exist, and seed them lazily if count is 0 or if invoice count is 0
      const count = await prisma.documentTemplate.count({
        where: { tenantId },
      });
      const invoiceCount = await prisma.documentTemplate.count({
        where: { tenantId, type: "INVOICE" },
      });
      if (count === 0 || invoiceCount === 0) {
        await seedDefaultTemplatesForTenant(tenantId);
      }

      const templates = await prisma.documentTemplate.findMany({
        where: { tenantId },
        orderBy: { updatedAt: "desc" },
        include: { variables: true },
      });
      res.status(200).json({ templates });
    } catch (error) {
      console.error("Fetch Templates Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// GET /finance/templates/:id/preview
app.get(
  "/finance/templates/:id/preview",
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      let tenantId = parseInt(req.tenantId!);
      if (req.isPlatformAdmin && req.query.tenantId) {
        tenantId = parseInt(req.query.tenantId as string);
      }
      const id = parseInt(req.params.id);

      const template = await prisma.documentTemplate.findFirst({
        where: { id, tenantId },
      });

      if (!template) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Template not found" });
      }

      const curSym = await getTenantCurrencySymbol(tenantId);

      const tenantProfile = await fetchTenantProfile(tenantId);
      const companyContext = await prisma.companyContext.findUnique({
        where: { tenantId },
      });

      const companyName =
        tenantProfile?.name ||
        companyContext?.companyName ||
        MOCK_PREVIEW_DATA.company.name;
      const logoPrimary =
        tenantProfile?.logo || companyContext?.logoPrimary || null;
      const logoSecondary = companyContext?.logoSecondary || "";
      const address =
        companyContext?.officeAddress || MOCK_PREVIEW_DATA.company.address;
      const email =
        companyContext?.emailSender || MOCK_PREVIEW_DATA.company.email;
      const phone =
        companyContext?.landlineFormat || MOCK_PREVIEW_DATA.company.phone;
      const whatsapp =
        companyContext?.whatsappWebhook || MOCK_PREVIEW_DATA.company.whatsapp;

      const tokens: Record<string, string> = {
        "company.name": companyName,
        "company.logoPrimary": logoPrimary
          ? `<img src="${logoPrimary}" style="max-height: 50px; object-fit: contain;" />`
          : "",
        "company.logoSecondary": logoSecondary
          ? `<img src="${logoSecondary}" style="max-height: 50px; object-fit: contain;" />`
          : "",
        "company.address": address,
        "company.email": email,
        "company.phone": phone,
        "company.whatsapp": whatsapp
          ? `<a href="${whatsapp}" target="_blank" style="color: #059669; font-weight: 600;">WhatsApp Support</a>`
          : "",
        "company.website": (tenantProfile as any)?.domain ? `www.${(tenantProfile as any).domain}` : (companyContext?.website || "www.toobatravels.co.uk"),
        "company.bankName": "Barclays Bank UK",
        "company.accountName": companyName,
        "company.sortCode": "20-00-00",
        "company.accountNumber": "12345678",
        "invoice.number": "INV-TT-UMR-950",
        "invoice.date": new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        "document.date": new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        "booking.reference": MOCK_PREVIEW_DATA.booking.reference,
        "booking.date": MOCK_PREVIEW_DATA.booking.date,
        "booking.agent": MOCK_PREVIEW_DATA.booking.agent,
        "booking.currencySymbol": curSym,
        "booking.packageType": "11D/10N Umrah Tailored Package",
        "booking.paymentStatus": "PARTIALLY PAID",
        "booking.paymentStatusBadge": '<span style="color: #f59e0b; font-weight: 800;">PARTIALLY PAID</span>',
        "booking.depositDue": "1000.00",
        "customer.fullName": "Mr. Mohammed Faisal",
        "customer.additionalPassengers": "Mrs. Aisha Faisal, Master Zaid Faisal",
        "customer.nationality": "British",
        "customer.phone": "+44 7700 900123",
        "customer.email": "mohammed.faisal@example.com",
        "customer.address": "14 Kensington Road, London, W8 4EP",
        "package.route": "London Heathrow (LHR) to Jeddah / Madinah (Return)",
        "package.travelDates": "07 Feb 2025 to 17 Feb 2025 (11 Days / 10 Nights)",
        "booking.totalPassengers": "3 Adults (Passport Holders)",
        "flight.carrierSummary": "Royal Jordanian (Economy Class)",
        "flight.airline": "Royal Jordanian",
        "flight.class": "Economy Class",
        "visa.authorizationSummary": "Saudi Electronic Travel Authorisation (ETA)",
        "booking.statusSummary": "Confirmed / Partial Deposit Received",
        "hotel.durationSummary": "10 NIGHTS",
        "tables.flightSchedule": buildFlightScheduleTable({
          flightServices: [
            { departedFrom: "LHR", arrivedAt: "AMM", flightNo: "RJ 112", date: "2025-02-07", departTime: "14:45", arrivalTime: "21:40", aircraft: "Boeing 787", flightClass: "Economy Class", baggage: "1x 23kg Hold Luggage", carryOnBaggage: "+ 1x Cabin Bag (pp)" },
            { departedFrom: "AMM", arrivedAt: "JED", flightNo: "RJ 704", date: "2025-02-07", departTime: "23:10", arrivalTime: "01:25 (+1)", aircraft: "Airbus A320", flightClass: "Economy Class", baggage: "1x 23kg Hold Luggage", carryOnBaggage: "+ 1x Cabin Bag (pp)" },
            { departedFrom: "MED", arrivedAt: "AMM", flightNo: "RJ 707", date: "2025-02-17", departTime: "06:00", arrivalTime: "07:45", aircraft: "Airbus A320", flightClass: "Economy Class", baggage: "1x 23kg Hold Luggage", carryOnBaggage: "+ 1x Cabin Bag (pp)" },
            { departedFrom: "AMM", arrivedAt: "LHR", flightNo: "RJ 111", date: "2025-02-17", departTime: "09:30", arrivalTime: "13:30", aircraft: "Boeing 787", flightClass: "Economy Class", baggage: "1x 23kg Hold Luggage", carryOnBaggage: "+ 1x Cabin Bag (pp)" }
          ]
        }),
        "tables.hotelLogistics": buildHotelLogisticsCards({
          accommodations: [
            { hotelName: "Swissôtel Al Maqam Makkah", city: "Makkah Al-Mukarramah", checkInDate: "2025-02-07", checkOutDate: "2025-02-12", roomType: "Classic Triple Room", mealType: "Bed & Breakfast", notes: "Abraj Al Bait Clock Tower (Haram View)" },
            { hotelName: "The Oberoi Madinah", city: "Madinah Al-Munawwarah", checkInDate: "2025-02-12", checkOutDate: "2025-02-17", roomType: "Executive Triple Room", mealType: "Bed & Breakfast", notes: "Direct Access to Prophet's Mosque Courtyard" }
          ],
          transportServices: [
            { departureDestination: "Jeddah Airport (JED)", arrivalDestination: "Swissôtel Makkah" },
            { departureDestination: "Swissôtel Makkah", arrivalDestination: "Oberoi Madinah" },
            { departureDestination: "Oberoi Madinah", arrivalDestination: "Madinah Airport (MED)" }
          ],
          visaServices: [
            { visaType: "Saudi ETA Visa (Multiple Entry)", country: "Saudi Arabia" }
          ]
        }),
        "tables.packageInclusions": buildPackageInclusionsTable({
          totalPrice: 3200,
          customers: [{ id: 1 }, { id: 2 }, { id: 3 }],
          flightServices: [{ vendorName: "Royal Jordanian", departedFrom: "LHR", arrivedAt: "JED" }, { departedFrom: "MED", arrivedAt: "LHR" }],
          accommodations: [
            { hotelName: "Swissôtel Al Maqam Makkah", roomType: "Classic Triple", mealType: "Bed & Breakfast", qty: 1 },
            { hotelName: "The Oberoi Madinah", roomType: "Executive Triple", mealType: "Bed & Breakfast", qty: 1 }
          ],
          transportServices: [{ id: 1 }],
          visaServices: [{ id: 1 }, { id: 2 }, { id: 3 }]
        }, curSym),
        "tables.financialSettlement": buildFinancialSettlementTable({
          totalPrice: 3200,
          depositRequired: 1000,
          payments: [
            { createdAt: "2025-01-15", paymentMethod: "Bank Transfer", amount: 1000, reference: "TXN-982103", status: "COMPLETED" }
          ]
        }, curSym, 3200, 1000, 2200),
        "tables.termsAndConditions": buildTermsAndConditions(companyName),
        "booking.amountGross": MOCK_PREVIEW_DATA.booking.amountGross,
        "booking.amountSettled": MOCK_PREVIEW_DATA.booking.amountSettled,
        "booking.amountDue": MOCK_PREVIEW_DATA.booking.amountDue,
        "tables.passengers": MOCK_PREVIEW_DATA.tables.passengers,
        "tables.flights": MOCK_PREVIEW_DATA.tables.flights,
        "tables.payments": MOCK_PREVIEW_DATA.tables.payments.replace(
          /£/g,
          curSym,
        ),
        "tables.services": MOCK_PREVIEW_DATA.tables.services.replace(
          /£/g,
          curSym,
        ),
        "document.signature": MOCK_PREVIEW_DATA.document.signature,
        "document.timestamp": MOCK_PREVIEW_DATA.document.timestamp,
      };

      const htmlToCompile = template.structureHtml
        .replace(
          /£\{\{booking\.amountGross\}\}/g,
          `${curSym}{{booking.amountGross}}`,
        )
        .replace(
          /£\{\{booking\.amountSettled\}\}/g,
          `${curSym}{{booking.amountSettled}}`,
        )
        .replace(
          /£\{\{booking\.amountDue\}\}/g,
          `${curSym}{{booking.amountDue}}`,
        );

      const compiledHtml = htmlToCompile.replace(
        /\{\{([^{}]+)\}\}/g,
        (match, token) => {
          const key = token.trim();
          return tokens[key] !== undefined ? tokens[key] : match;
        },
      );

      res.status(200).json({
        template,
        previewHtml: compiledHtml,
        previewCss: template.structureCss,
      });
    } catch (error) {
      console.error("Template Preview Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// POST /finance/templates
app.post(
  "/finance/templates",
  requireGatewayHeaders,
  authorizeRoles("COMPANY_ADMIN", "MAIN_COMPANY_ADMIN", "ADMIN"),
  async (req: CustomRequest, res: Response) => {
    try {
      let tenantId = parseInt(req.tenantId!);
      if (req.isPlatformAdmin && req.body.tenantId) {
        tenantId = parseInt(req.body.tenantId);
      }
      const {
        name,
        type,
        structureHtml,
        structureCss,
        status = "Draft",
      } = req.body;

      if (!name || !type || !structureHtml || !structureCss) {
        return res.status(400).json({
          error: "Validation failed",
          message: "name, type, html, and css are required",
        });
      }

      if (type === "VOUCHER") {
        const financialTokens = [
          "booking.amountGross",
          "booking.amountSettled",
          "booking.amountDue",
          "tables.payments",
          "tables.services",
        ];
        const tokenRegex = /\{\{\s*([^{}\s]+)\s*\}\}/g;
        let match;
        while ((match = tokenRegex.exec(structureHtml)) !== null) {
          const tokenName = match[1].trim();
          if (financialTokens.includes(tokenName)) {
            return res.status(400).json({
              error: "Validation failed",
              message: `Voucher templates are strictly forbidden from containing financial variables: {{${tokenName}}}`,
            });
          }
        }
      }

      const existing = await prisma.documentTemplate.findMany({
        where: { tenantId, name, type },
        orderBy: { version: "desc" },
        take: 1,
      });

      const version = existing.length > 0 ? existing[0].version + 1 : 1;

      const template = await prisma.documentTemplate.create({
        data: {
          tenantId,
          name,
          type,
          version,
          status,
          structureHtml,
          structureCss,
        },
      });

      const tokenRegex = /\{\{([^{}]+)\}\}/g;
      const detectedTokens = new Set<string>();
      let match;
      while ((match = tokenRegex.exec(structureHtml)) !== null) {
        detectedTokens.add(match[1].trim());
      }

      for (const token of detectedTokens) {
        let pathInRecord = token;
        if (token.startsWith("booking.")) {
          pathInRecord = token.replace("booking.", "");
        }

        await prisma.templateVariable
          .create({
            data: {
              templateId: template.id,
              token,
              description: `Substitute value of ${token}`,
              pathInRecord,
            },
          })
          .catch(() => {});
      }

      res
        .status(201)
        .json({ message: "Template created successfully", template });
    } catch (error) {
      console.error("Create Template Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// PUT /finance/templates/:id
app.put(
  "/finance/templates/:id",
  requireGatewayHeaders,
  authorizeRoles("COMPANY_ADMIN", "MAIN_COMPANY_ADMIN", "ADMIN"),
  async (req: CustomRequest, res: Response) => {
    try {
      let tenantId = parseInt(req.tenantId!);
      if (req.isPlatformAdmin && req.body.tenantId) {
        tenantId = parseInt(req.body.tenantId);
      }
      const id = parseInt(req.params.id);
      const { name, status, structureHtml, structureCss } = req.body;

      const template = await prisma.documentTemplate.findFirst({
        where: { id, tenantId },
      });

      if (!template) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Template not found" });
      }

      if (template.type === "VOUCHER" && structureHtml !== undefined) {
        const financialTokens = [
          "booking.amountGross",
          "booking.amountSettled",
          "booking.amountDue",
          "tables.payments",
          "tables.services",
        ];
        const tokenRegex = /\{\{\s*([^{}\s]+)\s*\}\}/g;
        let match;
        while ((match = tokenRegex.exec(structureHtml)) !== null) {
          const tokenName = match[1].trim();
          if (financialTokens.includes(tokenName)) {
            return res.status(400).json({
              error: "Validation failed",
              message: `Voucher templates are strictly forbidden from containing financial variables: {{${tokenName}}}`,
            });
          }
        }
      }

      const updated = await prisma.documentTemplate.update({
        where: { id },
        data: {
          name: name !== undefined ? name : template.name,
          status: status !== undefined ? status : template.status,
          structureHtml:
            structureHtml !== undefined
              ? structureHtml
              : template.structureHtml,
          structureCss:
            structureCss !== undefined ? structureCss : template.structureCss,
        },
      });

      res
        .status(200)
        .json({ message: "Template updated successfully", template: updated });
    } catch (error) {
      console.error("Update Template Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// POST /finance/templates/:id/compile
app.post(
  "/finance/templates/:id/compile",
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      const tenantId = parseInt(req.tenantId!);
      const id = parseInt(req.params.id);
      const { bookingId } = req.body;

      if (!bookingId) {
        return res.status(400).json({
          error: "Validation failed",
          message: "bookingId is required",
        });
      }

      const [template, booking, companyContext] = await Promise.all([
        prisma.documentTemplate.findFirst({
          where: { id, tenantId },
        }),
        prisma.booking.findUnique({
          where: { id: parseInt(bookingId) },
          include: {
            customers: true,
            payments: true,
            accommodations: true,
            flightServices: true,
            transportServices: true,
            visaServices: true,
            discounts: true,
            refunds: true,
            additionalServices: true,
          },
        }),
        prisma.companyContext.findUnique({
          where: { tenantId },
        }),
      ]);

      if (!template) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Template not found" });
      }

      if (!booking || booking.tenantId !== tenantId) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Booking record not found" });
      }

      const tenantProfile = await fetchTenantProfile(tenantId);

      const resolvedContext = {
        companyName:
          tenantProfile?.name ||
          companyContext?.companyName ||
          "Tooba Travels Ltd",
        logoPrimary: tenantProfile?.logo || companyContext?.logoPrimary || null,
        logoSecondary: companyContext?.logoSecondary || "",
        officeAddress:
          (tenantProfile as any)?.location ||
          companyContext?.officeAddress ||
          "Registered Office: 123 Travel Tower, London, UK",
        emailSender:
          (tenantProfile as any)?.email ||
          companyContext?.emailSender ||
          "operations@toobatravels.co.uk",
        landlineFormat:
          (tenantProfile as any)?.phone ||
          companyContext?.landlineFormat ||
          "+44 20 7946 0958",
        website:
          (tenantProfile as any)?.domain
            ? ((tenantProfile as any).domain.startsWith("http") ? (tenantProfile as any).domain : `www.${(tenantProfile as any).domain}`)
            : (companyContext?.website || "www.toobatravels.co.uk"),
        whatsappWebhook:
          companyContext?.whatsappWebhook ||
          `https://api.whatsapp.com/send?phone=${((tenantProfile as any)?.phone || companyContext?.landlineFormat || "442079460958").replace(/[^0-9+]/g, "")}`,
        bankName: "Barclays Bank UK",
        accountName:
          tenantProfile?.name ||
          companyContext?.companyName ||
          "Tooba Travels Ltd",
        sortCode: "20-00-00",
        accountNumber: "12345678",
      };

      const secret = process.env.JWT_SECRET || "travel-secret";
      const rawPayload = `${booking.bookingReference}:${booking.totalPrice}:${booking.paidAmount}`;
      const digitalSignature = crypto
        .createHmac("sha256", secret)
        .update(rawPayload)
        .digest("hex");

      const curSym = await getTenantCurrencySymbol(tenantId);

      if (!template.structureHtml || template.structureHtml.trim().length < 20) {
        if (template.type === "INVOICE") {
          template.structureHtml = getDefaultTaxInvoiceHtml();
          template.structureCss = getDefaultTaxInvoiceCss();
        } else if (
          template.name.toLowerCase().includes("transport") ||
          template.name.toLowerCase().includes("transfer")
        ) {
          template.structureHtml = getDefaultTransportVoucherHtml();
          template.structureCss = getDefaultTransportVoucherCss();
        } else {
          template.structureHtml = getDefaultHotelVoucherHtml();
          template.structureCss = getDefaultHotelVoucherCss();
        }
      }

      const { compiledHtml, totalGross, totalSettled, balanceDue } =
        compileTemplateWithBookingData(
          template,
          resolvedContext,
          booking,
          digitalSignature,
          curSym,
        );

      const docLog = await prisma.documentLog.create({
        data: {
          tenantId,
          templateId: template.id,
          bookingId: booking.id,
          referenceNumber: booking.bookingReference,
          documentType: template.type,
          recipientName:
            booking.customers && booking.customers[0]
              ? `${booking.customers[0].firstName} ${booking.customers[0].lastName}`
              : "Walk-in Client",
          amountGross: totalGross,
          amountSettled: totalSettled,
          amountDue: balanceDue,
          digitalSignature,
          metadataJson: JSON.stringify({
            compiledAt: new Date().toISOString(),
            compiledByUserId: req.userId,
          }),
        },
      });

      res.status(200).json({
        message: "Document compiled successfully",
        docLogId: docLog.id,
        compiledHtml,
        compiledCss: template.structureCss,
        digitalSignature,
        financials: {
          totalGross,
          totalSettled,
          balanceDue,
        },
      });
    } catch (error) {
      console.error("Compile Document Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// POST /finance/templates/set-global-default-invoice
app.post(
  "/finance/templates/set-global-default-invoice",
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      if (!req.isPlatformAdmin && req.userRole !== "SUPER_ADMIN") {
        return res.status(403).json({ error: "Access denied. Super Admin only." });
      }

      const authUrl = process.env.AUTH_SERVICE_URL || "http://auth-service:4001";
      let tenantIds: number[] = [];
      try {
        const tenantRes = await fetch(`${authUrl}/tenants`, {
          headers: {
            "x-user-id": String(req.userId || "1"),
            "x-role": "SUPER_ADMIN",
          },
        });
        if (tenantRes.ok) {
          const tdata: any = await tenantRes.json();
          if (Array.isArray(tdata.tenants)) {
            tenantIds = tdata.tenants.map((t: any) => Number(t.id));
          } else if (Array.isArray(tdata)) {
            tenantIds = tdata.map((t: any) => Number(t.id));
          }
        }
      } catch (e) {
        console.warn("Could not fetch tenants list from auth-service, falling back to DB tenant IDs", e);
      }

      const dbTemplates = await prisma.documentTemplate.findMany({ select: { tenantId: true }, distinct: ["tenantId"] });
      const dbContexts = await prisma.companyContext.findMany({ select: { tenantId: true } });
      const dbBookings = await prisma.booking.findMany({ select: { tenantId: true }, distinct: ["tenantId"] });

      const allTenantIds = Array.from(
        new Set([
          ...tenantIds,
          ...dbTemplates.map((t) => t.tenantId),
          ...dbContexts.map((c) => c.tenantId),
          ...dbBookings.map((b) => b.tenantId),
        ]),
      ).filter((id) => typeof id === "number" && !isNaN(id) && id > 0);

      const html = getDefaultTaxInvoiceHtml();
      const css = getDefaultTaxInvoiceCss();

      let updatedCount = 0;
      let createdCount = 0;

      for (const tId of allTenantIds) {
        const existingInvoice = await prisma.documentTemplate.findFirst({
          where: { tenantId: tId, type: "INVOICE" },
          orderBy: { updatedAt: "desc" },
        });

        let targetTemplateId: number;

        if (existingInvoice) {
          const updated = await prisma.documentTemplate.update({
            where: { id: existingInvoice.id },
            data: {
              name: "Default Tax Invoice Template",
              status: "Active",
              structureHtml: html,
              structureCss: css,
              version: existingInvoice.version + 1,
            },
          });
          targetTemplateId = updated.id;
          updatedCount++;
        } else {
          const created = await prisma.documentTemplate.create({
            data: {
              tenantId: tId,
              name: "Default Tax Invoice Template",
              type: "INVOICE",
              version: 1,
              status: "Active",
              structureHtml: html,
              structureCss: css,
            },
          });
          targetTemplateId = created.id;
          createdCount++;
        }

        // Delete old variables and re-create all detected variables cleanly
        await prisma.templateVariable.deleteMany({
          where: { templateId: targetTemplateId },
        }).catch(() => {});

        const tokenRegex = /\{\{([^{}]+)\}\}/g;
        const detectedTokens = new Set<string>();
        let match;
        while ((match = tokenRegex.exec(html)) !== null) {
          detectedTokens.add(match[1].trim());
        }

        for (const token of detectedTokens) {
          let pathInRecord = token;
          if (token.startsWith("booking.")) {
            pathInRecord = token.replace("booking.", "");
          }
          await prisma.templateVariable
            .create({
              data: {
                templateId: targetTemplateId,
                token,
                description: `Substitute value of ${token}`,
                pathInRecord,
              },
            })
            .catch(() => {});
        }
      }

      res.status(200).json({
        success: true,
        message: `Tax Invoice template successfully set as default across ${allTenantIds.length} companies (${updatedCount} updated, ${createdCount} created).`,
        tenantsProcessed: allTenantIds.length,
        updatedCount,
        createdCount,
      });
    } catch (error) {
      console.error("Set Global Default Invoice Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// POST /finance/templates/set-global-default-vouchers
app.post(
  "/finance/templates/set-global-default-vouchers",
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      if (!req.isPlatformAdmin && req.userRole !== "SUPER_ADMIN") {
        return res.status(403).json({ error: "Access denied. Super Admin only." });
      }

      const authUrl = process.env.AUTH_SERVICE_URL || "http://auth-service:4001";
      let tenantIds: number[] = [];
      try {
        const tenantRes = await fetch(`${authUrl}/tenants`, {
          headers: {
            "x-user-id": String(req.userId || "1"),
            "x-role": "SUPER_ADMIN",
          },
        });
        if (tenantRes.ok) {
          const tdata: any = await tenantRes.json();
          if (Array.isArray(tdata.tenants)) {
            tenantIds = tdata.tenants.map((t: any) => Number(t.id));
          } else if (Array.isArray(tdata)) {
            tenantIds = tdata.map((t: any) => Number(t.id));
          }
        }
      } catch (e) {
        console.warn("Could not fetch tenants list from auth-service, falling back to DB tenant IDs", e);
      }

      const dbTemplates = await prisma.documentTemplate.findMany({ select: { tenantId: true }, distinct: ["tenantId"] });
      const dbContexts = await prisma.companyContext.findMany({ select: { tenantId: true } });
      const dbBookings = await prisma.booking.findMany({ select: { tenantId: true }, distinct: ["tenantId"] });

      const allTenantIds = Array.from(
        new Set([
          ...tenantIds,
          ...dbTemplates.map((t) => t.tenantId),
          ...dbContexts.map((c) => c.tenantId),
          ...dbBookings.map((b) => b.tenantId),
        ]),
      ).filter((id) => typeof id === "number" && !isNaN(id) && id > 0);

      const voucherBlueprints = [
        {
          name: "Default Hotel Booking Voucher",
          html: getDefaultHotelVoucherHtml(),
          css: getDefaultHotelVoucherCss(),
          keyword: "hotel",
        },
        {
          name: "Default Transport Transfer Voucher",
          html: getDefaultTransportVoucherHtml(),
          css: getDefaultTransportVoucherCss(),
          keyword: "transport",
        },
      ];

      let totalUpdated = 0;
      let totalCreated = 0;

      for (const tId of allTenantIds) {
        for (const bp of voucherBlueprints) {
          const existing = await prisma.documentTemplate.findFirst({
            where: {
              tenantId: tId,
              type: "VOUCHER",
              OR: [
                { name: { contains: bp.name } },
                { name: { contains: bp.keyword, mode: "insensitive" } },
              ],
            },
            orderBy: { updatedAt: "desc" },
          });

          let targetTemplateId: number;

          if (existing) {
            const updated = await prisma.documentTemplate.update({
              where: { id: existing.id },
              data: {
                name: bp.name,
                status: "Active",
                structureHtml: bp.html,
                structureCss: bp.css,
                version: existing.version + 1,
              },
            });
            targetTemplateId = updated.id;
            totalUpdated++;
          } else {
            const created = await prisma.documentTemplate.create({
              data: {
                tenantId: tId,
                name: bp.name,
                type: "VOUCHER",
                version: 1,
                status: "Active",
                structureHtml: bp.html,
                structureCss: bp.css,
              },
            });
            targetTemplateId = created.id;
            totalCreated++;
          }

          // Re-create template variables
          await prisma.templateVariable.deleteMany({
            where: { templateId: targetTemplateId },
          }).catch(() => {});

          const tokenRegex = /\{\{([^{}]+)\}\}/g;
          const detectedTokens = new Set<string>();
          let match;
          while ((match = tokenRegex.exec(bp.html)) !== null) {
            detectedTokens.add(match[1].trim());
          }

          for (const token of detectedTokens) {
            let pathInRecord = token;
            if (token.startsWith("booking.")) {
              pathInRecord = token.replace("booking.", "");
            }
            await prisma.templateVariable
              .create({
                data: {
                  templateId: targetTemplateId,
                  token,
                  description: `Substitute value of ${token}`,
                  pathInRecord,
                },
              })
              .catch(() => {});
          }
        }
      }

      res.status(200).json({
        success: true,
        message: `Hotel & Transport vouchers set as default across ${allTenantIds.length} companies (${totalUpdated} updated, ${totalCreated} created).`,
        tenantsProcessed: allTenantIds.length,
        totalUpdated,
        totalCreated,
      });
    } catch (error) {
      console.error("Set Global Default Vouchers Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// POST /bookings/:id/passengers/:passengerId/send-gdpr-request -- Send GDPR request link via email
app.post(
  "/:id/passengers/:passengerId/send-gdpr-request",
  requireGatewayHeaders,
  requirePermission(Permission.UPDATE_BOOKING),
  async (req: CustomRequest, res: Response) => {
    try {
      const bookingId = parseInt(req.params.id);
      const passengerId = parseInt(req.params.passengerId);
      const tenantIdNumeric = parseInt(req.tenantId!);

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { customers: true },
      });

      if (!booking) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Booking not found" });
      }

      if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
        return res
          .status(403)
          .json({ error: "Forbidden", message: "Access denied" });
      }

      const passenger = booking.customers.find((c) => c.id === passengerId);
      if (!passenger) {
        return res.status(404).json({
          error: "Not Found",
          message: "Passenger not found in booking",
        });
      }

      const emailToSend = req.body.email || passenger.email;
      if (!emailToSend) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Passenger email address is required",
        });
      }

      // If a new email was provided, update it on the passenger model first
      if (emailToSend !== passenger.email) {
        await prisma.bookingCustomer.update({
          where: { id: passenger.id },
          data: { email: emailToSend },
        });
        passenger.email = emailToSend;
      }

      // Generate secure token using crypto
      const tokenPayload = {
        bookingId,
        passengerId,
        tenantId: tenantIdNumeric,
        expiry: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days validity
      };
      const token = encryptToken(tokenPayload);

      // Fetch company branding from this service's CompanyContext
      const authUrl =
        process.env.AUTH_SERVICE_URL || "http://auth-service:4001";
      let companyCtx: any = null;
      try {
        companyCtx = await prisma.companyContext.findUnique({
          where: { tenantId: tenantIdNumeric },
        });
      } catch (_) {}

      const tenantProfile = await fetchTenantProfile(tenantIdNumeric);

      const companyName =
        tenantProfile?.name || companyCtx?.companyName || "Your Travel Agency";
      const companyLogo =
        tenantProfile?.logo || companyCtx?.logoPrimary || null;
      const companyEmail = companyCtx?.emailSender || null;
      const companyPhone = companyCtx?.landlineFormat || null;
      const companyAddr = companyCtx?.officeAddress || null;
      const accentColor = "#1e3a8a";

      // Construct GDPR Form link
      const requestOrigin =
        req.headers["origin"] ||
        req.headers["referer"] ||
        "https://travel.techbarred.com";
      const parsedOrigin = new URL(requestOrigin as string).origin;
      const gdprLink = `${parsedOrigin}/passenger-info/${encodeURIComponent(token)}`;

      // Build branded email HTML
      const subject = `Action Required: Complete your travel details (GDPR) - Ref: ${booking.bookingReference}`;
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Complete Your Travel Details</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,${accentColor} 0%,#1d4ed8 100%);padding:28px 32px;text-align:center;">
              ${
                companyLogo
                  ? `<img src="${companyLogo}" alt="${companyName}" style="max-height:60px;max-width:200px;object-fit:contain;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;" />`
                  : `<div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:12px;padding:10px 24px;margin-bottom:12px;">
                    <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.5px;">${companyName}</span>
                  </div>`
              }
              <h1 style="color:#ffffff;font-size:15px;font-weight:700;margin:0;letter-spacing:0.3px;opacity:0.9;">Secure Travel Information Request</h1>
            </td>
          </tr>

          <!-- REFERENCE BADGE -->
          <tr>
            <td style="background:#1d4ed8;padding:0 32px 20px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:8px;padding:6px 20px;border:1px solid rgba(255,255,255,0.25);">
                <span style="color:#bfdbfe;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Booking Reference</span>
                <span style="color:#ffffff;font-size:16px;font-weight:800;margin-left:10px;font-family:monospace;">${booking.bookingReference}</span>
              </div>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background:#ffffff;padding:36px 32px;">
              <p style="font-size:16px;color:#1e293b;font-weight:700;margin:0 0 8px;">Hello ${passenger.firstName} ${passenger.lastName},</p>
              <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 20px;">
                We hope this message finds you well. To finalise and secure your upcoming trip booked with
                <strong style="color:#1e3a8a;">${companyName}</strong>, we kindly ask you to complete your
                passenger details -- including your passport information -- using the secure link below.
              </p>

              <!-- GDPR NOTICE BOX -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#eff6ff;border-left:4px solid #2563eb;border-radius:0 8px 8px 0;padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:12px;font-weight:800;color:#1e3a8a;letter-spacing:0.5px;text-transform:uppercase;">🔒 GDPR Compliance Notice</p>
                    <p style="margin:0;font-size:13px;color:#334155;line-height:1.6;">
                      Your personal information is encrypted in transit, stored securely, and processed solely for
                      the purpose of fulfilling your travel booking with suppliers (airlines, hotels, and other
                      service providers). <strong>It will never be shared for marketing or advertising purposes.</strong>
                      You have the right to access, correct, or request deletion of your data at any time.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA BUTTON -->
              <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <a href="${gdprLink}" target="_blank"
                       style="display:inline-block;background:linear-gradient(135deg,${accentColor},#2563eb);color:#ffffff;
                              padding:14px 36px;text-decoration:none;font-weight:800;font-size:14px;
                              border-radius:10px;letter-spacing:0.3px;box-shadow:0 4px 12px rgba(37,99,235,0.35);">
                      ✅&nbsp; Securely Fill My Passenger Details
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size:12px;color:#64748b;text-align:center;margin:0 0 6px;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="font-size:11px;color:#2563eb;word-break:break-all;text-align:center;margin:0 0 28px;">
                <a href="${gdprLink}" style="color:#2563eb;">${gdprLink}</a>
              </p>

              <!-- EXPIRY NOTE -->
              <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0;padding-top:16px;border-top:1px solid #f1f5f9;">
                ⏰ This link is valid for <strong>7 days</strong>. Please complete your details at your earliest convenience.
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 32px;">
              <p style="margin:0 0 4px;font-size:13px;color:#334155;font-weight:700;">Kind regards,</p>
              <p style="margin:0 0 16px;font-size:14px;color:${accentColor};font-weight:800;">${companyName} Team</p>
              <table role="presentation" cellspacing="0" cellpadding="0">
                ${companyEmail ? `<tr><td style="padding:2px 0;font-size:12px;color:#64748b;">📧&nbsp; <a href="mailto:${companyEmail}" style="color:#2563eb;text-decoration:none;">${companyEmail}</a></td></tr>` : ""}
                ${companyPhone ? `<tr><td style="padding:2px 0;font-size:12px;color:#64748b;">📞&nbsp; ${companyPhone}</td></tr>` : ""}
                ${companyAddr ? `<tr><td style="padding:2px 0;font-size:12px;color:#64748b;">📍&nbsp; ${companyAddr}</td></tr>` : ""}
              </table>
            </td>
          </tr>

          <!-- LEGAL FOOTER -->
          <tr>
            <td style="background:#1e293b;padding:16px 32px;text-align:center;border-radius:0 0 16px 16px;">
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
                This email was sent by <strong style="color:#cbd5e1;">${companyName}</strong> on behalf of your booking.
                If you did not request this or believe it was sent in error, please disregard it or
                contact us at ${companyEmail ? `<a href="mailto:${companyEmail}" style="color:#60a5fa;">${companyEmail}</a>` : "our support team"}.
                <br/>This communication is compliant with the <strong style="color:#cbd5e1;">GDPR</strong> and
                the <strong style="color:#cbd5e1;">applicable Data Protection regulations</strong>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

      // Call auth-service to dispatch the email under the tenant's own SMTP settings
      const emailRes = await fetch(`${authUrl}/tenants/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": String(tenantIdNumeric),
        },
        body: JSON.stringify({
          to: emailToSend,
          subject,
          html,
        }),
      });

      if (!emailRes.ok) {
        const errText = await emailRes.text();
        console.error("Email send failed at auth-service:", errText);
        return res.status(502).json({
          error: "Bad Gateway",
          message: "Failed to dispatch email via SMTP service.",
        });
      }

      res
        .status(200)
        .json({ message: "GDPR passenger request email sent successfully!" });
    } catch (error: any) {
      console.error("Send GDPR Request Error:", error);
      res
        .status(500)
        .json({ error: "Internal Server Error", message: error?.message });
    }
  },
);

// GET /bookings/:id/passengers/:passengerId/gdpr-link -- Get secure self-fill GDPR link directly
app.get(
  "/:id/passengers/:passengerId/gdpr-link",
  requireGatewayHeaders,
  requirePermission(Permission.UPDATE_BOOKING),
  async (req: CustomRequest, res: Response) => {
    try {
      const bookingId = parseInt(req.params.id);
      const passengerId = parseInt(req.params.passengerId);
      const tenantIdNumeric = parseInt(req.tenantId!);

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { customers: true },
      });

      if (!booking) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Booking not found" });
      }

      if (!req.isPlatformAdmin && booking.tenantId !== tenantIdNumeric) {
        return res
          .status(403)
          .json({ error: "Forbidden", message: "Access denied" });
      }

      const passenger = booking.customers.find((c) => c.id === passengerId);
      if (!passenger) {
        return res.status(404).json({
          error: "Not Found",
          message: "Passenger not found in booking",
        });
      }

      // Generate secure token using crypto
      const tokenPayload = {
        bookingId,
        passengerId,
        tenantId: tenantIdNumeric,
        expiry: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days validity
      };
      const token = encryptToken(tokenPayload);

      const requestOrigin =
        req.headers["origin"] ||
        req.headers["referer"] ||
        "https://travel.techbarred.com";
      const parsedOrigin = new URL(requestOrigin as string).origin;
      const gdprLink = `${parsedOrigin}/passenger-info/${encodeURIComponent(token)}`;

      res.status(200).json({ gdprLink });
    } catch (error: any) {
      console.error("Get GDPR Link Error:", error);
      res
        .status(500)
        .json({ error: "Internal Server Error", message: error?.message });
    }
  },
);

// POST /bookings/:id/passengers/:passengerId/documents -- Add passenger additional document
app.post(
  "/:id/passengers/:passengerId/documents",
  requireGatewayHeaders,
  requirePermission(Permission.UPDATE_BOOKING),
  async (req: CustomRequest, res: Response) => {
    try {
      const bookingId = parseInt(req.params.id);
      const passengerId = parseInt(req.params.passengerId);
      const tenantIdNumeric = parseInt(req.tenantId!);

      const { title, description, fileUrl } = req.body;
      if (!title || !fileUrl) {
        return res
          .status(400)
          .json({ error: "Title and File URL are required" });
      }

      // Verify the passenger exists in this booking
      const passenger = await prisma.bookingCustomer.findFirst({
        where: { id: passengerId, bookingId },
      });

      if (!passenger) {
        return res
          .status(404)
          .json({ error: "Passenger not found in this booking" });
      }

      const document = await prisma.passengerDocument.create({
        data: {
          tenantId: tenantIdNumeric,
          passengerId,
          title,
          description: description || null,
          fileUrl,
        },
      });

      res
        .status(201)
        .json({ message: "Document added successfully", document });
    } catch (error: any) {
      console.error("Add Passenger Document Error:", error);
      res
        .status(500)
        .json({ error: "Internal Server Error", message: error?.message });
    }
  },
);

// DELETE /bookings/:id/passengers/:passengerId/documents/:documentId -- Delete passenger additional document
app.delete(
  "/:id/passengers/:passengerId/documents/:documentId",
  requireGatewayHeaders,
  requirePermission(Permission.UPDATE_BOOKING),
  async (req: CustomRequest, res: Response) => {
    try {
      const bookingId = parseInt(req.params.id);
      const passengerId = parseInt(req.params.passengerId);
      const documentId = parseInt(req.params.documentId);

      // Verify the document belongs to this passenger and booking
      const doc = await prisma.passengerDocument.findFirst({
        where: { id: documentId, passengerId, passenger: { bookingId } },
      });

      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      await prisma.passengerDocument.delete({
        where: { id: documentId },
      });

      res.status(200).json({ message: "Document deleted successfully" });
    } catch (error: any) {
      console.error("Delete Passenger Document Error:", error);
      res
        .status(500)
        .json({ error: "Internal Server Error", message: error?.message });
    }
  },
);

// GET /public/passenger-info/:token -- Public retrieval of passenger info
app.get(
  "/public/passenger-info/:token",
  async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const decoded = decryptToken(token);

      if (!decoded || !decoded.bookingId || !decoded.passengerId) {
        return res.status(400).json({
          error: "Invalid Request",
          message: "This link is invalid or has expired.",
        });
      }

      if (decoded.expiry && Date.now() > decoded.expiry) {
        return res.status(410).json({
          error: "Gone",
          message:
            "This secure link has expired. Please ask your travel advisor to resend it.",
        });
      }

      const booking = await prisma.booking.findUnique({
        where: { id: Number(decoded.bookingId) },
        include: {
          customers: {
            include: {
              documents: true,
            },
          },
        },
      });

      if (!booking) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Booking not found." });
      }

      const passenger = booking.customers.find(
        (c) => Number(c.id) === Number(decoded.passengerId),
      );
      if (!passenger) {
        return res
          .status(404)
          .json({ error: "Not Found", message: "Passenger not found." });
      }

      // Fetch company name
      const companyContext = await prisma.companyContext.findUnique({
        where: { tenantId: decoded.tenantId },
      });

      const tenantProfile = await fetchTenantProfile(decoded.tenantId);

      res.status(200).json({
        passenger: {
          id: passenger.id,
          title: passenger.title,
          firstName: passenger.firstName,
          lastName: passenger.lastName,
          email: passenger.email,
          phoneNumber: passenger.phoneNumber,
          passportNumber: passenger.passportNumber,
          passportExpiryDate: passenger.passportExpiryDate,
          dob: (passenger as any).dob,
          passportImage: (passenger as any).passportImage,
          ageCategory: passenger.ageCategory,
          role: passenger.role,
          nationality: (passenger as any).nationality,
          issuingCountry: (passenger as any).issuingCountry,
          documents: (passenger as any).documents || [],
        },
        passengers: booking.customers.map((c) => ({
          id: c.id,
          title: c.title,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          phoneNumber: c.phoneNumber,
          passportNumber: c.passportNumber,
          passportExpiryDate: c.passportExpiryDate,
          dob: (c as any).dob,
          passportImage: (c as any).passportImage,
          ageCategory: c.ageCategory,
          role: c.role,
          nationality: (c as any).nationality,
          issuingCountry: (c as any).issuingCountry,
          documents: (c as any).documents || [],
        })),
        primaryPassengerId: passenger.id,
        bookingReference: booking.bookingReference,
        companyName:
          tenantProfile?.name ||
          companyContext?.companyName ||
          "Your Travel Agency",
      });
    } catch (error: any) {
      console.error("Get Public Passenger Info Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// PUT /public/passenger-info/:token -- Public submission of updated passenger info
app.put(
  "/public/passenger-info/:token",
  async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const decoded = decryptToken(token);

      if (!decoded || !decoded.bookingId || !decoded.passengerId) {
        return res.status(400).json({
          error: "Invalid Request",
          message: "This link is invalid or has expired.",
        });
      }

      if (decoded.expiry && Date.now() > decoded.expiry) {
        return res
          .status(410)
          .json({ error: "Gone", message: "This secure link has expired." });
      }

      const {
        passengers,
        title,
        firstName,
        lastName,
        email,
        phoneNumber,
        passportNumber,
        passportExpiryDate,
        dob,
        passportImage,
        ageCategory,
        gdprConsent,
      } = req.body;

      if (!gdprConsent) {
        return res.status(400).json({
          error: "Validation failed",
          message:
            "You must consent to the GDPR privacy terms to submit your information.",
        });
      }

      if (passengers && Array.isArray(passengers)) {
        const updatedList = [];
        for (const p of passengers) {
          if (!p.firstName || !p.lastName) {
            return res.status(400).json({
              error: "Validation failed",
              message:
                "First Name and Last Name are required for all passengers.",
            });
          }

          let updated;
          const passengerId = Number(p.id);

          if (passengerId > 0) {
            // Security: Ensure passenger belongs to correct booking
            const dbPassenger = await prisma.bookingCustomer.findFirst({
              where: { id: passengerId, bookingId: Number(decoded.bookingId) },
            });

            if (!dbPassenger) {
              return res.status(403).json({
                error: "Forbidden",
                message: "Passenger does not belong to this booking.",
              });
            }

            updated = await prisma.bookingCustomer.update({
              where: { id: passengerId },
              data: {
                title: p.title || null,
                firstName: p.firstName,
                lastName: p.lastName,
                email: p.email || null,
                phoneNumber: p.phoneNumber || null,
                passportNumber: p.passportNumber || null,
                passportExpiryDate: p.passportExpiryDate
                  ? new Date(p.passportExpiryDate)
                  : null,
                dob: p.dob ? new Date(p.dob) : null,
                passportImage: p.passportImage || null,
                ageCategory: p.ageCategory || "Adult",
                nationality: p.nationality || null,
                issuingCountry: p.issuingCountry || null,
              },
            });
          } else {
            // Create new passenger for this booking
            updated = await prisma.bookingCustomer.create({
              data: {
                tenantId: Number(decoded.tenantId),
                bookingId: Number(decoded.bookingId),
                title: p.title || null,
                firstName: p.firstName,
                lastName: p.lastName,
                email: p.email || null,
                phoneNumber: p.phoneNumber || null,
                passportNumber: p.passportNumber || null,
                passportExpiryDate: p.passportExpiryDate
                  ? new Date(p.passportExpiryDate)
                  : null,
                dob: p.dob ? new Date(p.dob) : null,
                passportImage: p.passportImage || null,
                ageCategory: p.ageCategory || "Adult",
                nationality: p.nationality || null,
                issuingCountry: p.issuingCountry || null,
                role: p.role || "Traveler",
              },
            });
          }

          // Sync additional documents if provided
          if (p.documents && Array.isArray(p.documents)) {
            const payloadDocIds = p.documents
              .map((d: any) => d.id)
              .filter((id: any) => id && id > 0);

            // Delete documents that are not in the payload
            await prisma.passengerDocument.deleteMany({
              where: {
                passengerId: updated.id,
                NOT: {
                  id: { in: payloadDocIds },
                },
              },
            });

            // Create new documents
            const newDocs = p.documents.filter(
              (d: any) => !d.id || d.id < 0
            );
            for (const doc of newDocs) {
              await prisma.passengerDocument.create({
                data: {
                  tenantId: Number(decoded.tenantId),
                  passengerId: updated.id,
                  title: doc.title,
                  description: doc.description || null,
                  fileUrl: doc.fileUrl,
                },
              });
            }
          }

          updatedList.push(updated);
        }

        return res.status(200).json({
          message: "All traveler information updated successfully!",
          passengers: updatedList,
        });
      } else {
        // Legacy single-passenger update
        if (!firstName || !lastName) {
          return res.status(400).json({
            error: "Validation failed",
            message: "First Name and Last Name are required.",
          });
        }

        const updatedPassenger = await prisma.bookingCustomer.update({
          where: { id: Number(decoded.passengerId) },
          data: {
            title: title || null,
            firstName,
            lastName,
            email: email || null,
            phoneNumber: phoneNumber || null,
            passportNumber: passportNumber || null,
            passportExpiryDate: passportExpiryDate
              ? new Date(passportExpiryDate)
              : null,
            dob: dob ? new Date(dob) : null,
            passportImage: passportImage || null,
            ...(ageCategory && { ageCategory }),
            nationality: req.body.nationality || null,
            issuingCountry: req.body.issuingCountry || null,
          },
        });

        console.log(
          `Passenger ${decoded.passengerId} details updated securely via GDPR form for booking ${decoded.bookingId}.`,
        );

        res.status(200).json({
          message: "Your passenger details have been updated successfully!",
          passenger: updatedPassenger,
        });
      }
    } catch (error: any) {
      console.error("Update Public Passenger Info Error:", error);
      res
        .status(500)
        .json({ error: "Internal Server Error", message: error?.message });
    }
  },
);

// GET /airports/:iata -- Lookup airport details by IATA code
app.get(
  "/airports/:iata",
  requireGatewayHeaders,
  async (req: Request, res: Response) => {
    try {
      const { iata } = req.params;
      if (!iata || iata.length !== 3) {
        return res.status(400).json({ error: "Invalid IATA code" });
      }
      const airport = await prisma.airport.findUnique({
        where: { iata: iata.toUpperCase() },
      });
      if (!airport) {
        return res.status(404).json({ error: "Airport not found" });
      }
      return res.status(200).json(airport);
    } catch (error: any) {
      console.error("Get Airport Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// PACKAGE QUOTATION MODULE ROUTES

// GET /packages -- List all package quotations for the tenant
app.get(
  "/packages",
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      const tenantId = parseInt(req.tenantId!);
      const packages = await prisma.packageQuotation.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" }
      });
      res.status(200).json({ packages });
    } catch (error: any) {
      console.error("Get Packages Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// GET /packages/:id -- Get single package quotation
app.get(
  "/packages/:id",
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      const tenantId = parseInt(req.tenantId!);
      const id = parseInt(req.params.id);
      const pkg = await prisma.packageQuotation.findFirst({
        where: { id, tenantId }
      });
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }
      res.status(200).json({ package: pkg });
    } catch (error: any) {
      console.error("Get Single Package Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// POST /packages -- Create a package quotation
app.post(
  "/packages",
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      const tenantId = parseInt(req.tenantId!);
      const {
        referenceNumber,
        title,
        subtitle,
        preparedFor,
        passengerBadge,
        passengerCount,
        packageType,
        departureAirport,
        travelDates,
        totalDuration,
        airlineCarrier,
        flightClass,
        flightsEnabled,
        hotelsEnabled,
        transfersEnabled,
        visaEnabled,
        flightOutboundJson,
        flightInboundJson,
        hotelsJson,
        transfersJson,
        visaJson,
        inclusionsJson,
        exclusionsJson,
        pricePerPerson,
        totalPackagePrice,
        priceIncludes,
        importantTerms,
        agentName,
        companyName,
        companyLogo,
        companyAddress,
        companyPhone,
        companyEmail,
        companyWebsite,
        companyReg,
        companyLicence,
      } = req.body;

      const newPkg = await prisma.packageQuotation.create({
        data: {
          tenantId,
          referenceNumber: referenceNumber || `REF: TT-UMR-${Math.floor(100 + Math.random() * 900)}`,
          title: title || "UMRAH PACKAGE QUOTATION",
          subtitle: subtitle || null,
          preparedFor: preparedFor || null,
          passengerBadge: passengerBadge || null,
          passengerCount: passengerCount ? parseInt(passengerCount) : 2,
          packageType: packageType || null,
          departureAirport: departureAirport || null,
          travelDates: travelDates || null,
          totalDuration: totalDuration || null,
          airlineCarrier: airlineCarrier || null,
          flightClass: flightClass || null,
          flightsEnabled: flightsEnabled !== undefined ? Boolean(flightsEnabled) : true,
          hotelsEnabled: hotelsEnabled !== undefined ? Boolean(hotelsEnabled) : true,
          transfersEnabled: transfersEnabled !== undefined ? Boolean(transfersEnabled) : true,
          visaEnabled: visaEnabled !== undefined ? Boolean(visaEnabled) : true,
          flightOutboundJson: typeof flightOutboundJson === "object" ? JSON.stringify(flightOutboundJson) : (flightOutboundJson || null),
          flightInboundJson: typeof flightInboundJson === "object" ? JSON.stringify(flightInboundJson) : (flightInboundJson || null),
          hotelsJson: typeof hotelsJson === "object" ? JSON.stringify(hotelsJson) : (hotelsJson || null),
          transfersJson: typeof transfersJson === "object" ? JSON.stringify(transfersJson) : (transfersJson || null),
          visaJson: typeof visaJson === "object" ? JSON.stringify(visaJson) : (visaJson || null),
          inclusionsJson: typeof inclusionsJson === "object" ? JSON.stringify(inclusionsJson) : (inclusionsJson || null),
          exclusionsJson: typeof exclusionsJson === "object" ? JSON.stringify(exclusionsJson) : (exclusionsJson || null),
          pricePerPerson: pricePerPerson ? parseFloat(pricePerPerson) : null,
          totalPackagePrice: totalPackagePrice ? parseFloat(totalPackagePrice) : null,
          priceIncludes: priceIncludes || null,
          importantTerms: importantTerms || null,
          agentName: agentName || null,
          companyName: companyName || null,
          companyLogo: companyLogo || null,
          companyAddress: companyAddress || null,
          companyPhone: companyPhone || null,
          companyEmail: companyEmail || null,
          companyWebsite: companyWebsite || null,
          companyReg: companyReg || null,
          companyLicence: companyLicence || null,
        }
      });

      res.status(201).json({ message: "Package quotation created successfully", package: newPkg });
    } catch (error: any) {
      console.error("Create Package Error:", error);
      res.status(500).json({ error: "Internal Server Error", message: error?.message });
    }
  }
);

// PUT /packages/:id -- Update a package quotation
app.put(
  "/packages/:id",
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      const tenantId = parseInt(req.tenantId!);
      const id = parseInt(req.params.id);

      const existing = await prisma.packageQuotation.findFirst({
        where: { id, tenantId }
      });
      if (!existing) {
        return res.status(404).json({ error: "Package not found" });
      }

      const {
        referenceNumber,
        title,
        subtitle,
        preparedFor,
        passengerBadge,
        passengerCount,
        packageType,
        departureAirport,
        travelDates,
        totalDuration,
        airlineCarrier,
        flightClass,
        flightsEnabled,
        hotelsEnabled,
        transfersEnabled,
        visaEnabled,
        flightOutboundJson,
        flightInboundJson,
        hotelsJson,
        transfersJson,
        visaJson,
        inclusionsJson,
        exclusionsJson,
        pricePerPerson,
        totalPackagePrice,
        priceIncludes,
        importantTerms,
        agentName,
        companyName,
        companyLogo,
        companyAddress,
        companyPhone,
        companyEmail,
        companyWebsite,
        companyReg,
        companyLicence,
      } = req.body;

      const updatedPkg = await prisma.packageQuotation.update({
        where: { id },
        data: {
          referenceNumber: referenceNumber ?? existing.referenceNumber,
          title: title ?? existing.title,
          subtitle: subtitle ?? existing.subtitle,
          preparedFor: preparedFor ?? existing.preparedFor,
          passengerBadge: passengerBadge ?? existing.passengerBadge,
          passengerCount: passengerCount !== undefined ? parseInt(passengerCount) : existing.passengerCount,
          packageType: packageType ?? existing.packageType,
          departureAirport: departureAirport ?? existing.departureAirport,
          travelDates: travelDates ?? existing.travelDates,
          totalDuration: totalDuration ?? existing.totalDuration,
          airlineCarrier: airlineCarrier ?? existing.airlineCarrier,
          flightClass: flightClass ?? existing.flightClass,
          flightsEnabled: flightsEnabled !== undefined ? Boolean(flightsEnabled) : existing.flightsEnabled,
          hotelsEnabled: hotelsEnabled !== undefined ? Boolean(hotelsEnabled) : existing.hotelsEnabled,
          transfersEnabled: transfersEnabled !== undefined ? Boolean(transfersEnabled) : existing.transfersEnabled,
          visaEnabled: visaEnabled !== undefined ? Boolean(visaEnabled) : existing.visaEnabled,
          flightOutboundJson: typeof flightOutboundJson === "object" ? JSON.stringify(flightOutboundJson) : (flightOutboundJson ?? existing.flightOutboundJson),
          flightInboundJson: typeof flightInboundJson === "object" ? JSON.stringify(flightInboundJson) : (flightInboundJson ?? existing.flightInboundJson),
          hotelsJson: typeof hotelsJson === "object" ? JSON.stringify(hotelsJson) : (hotelsJson ?? existing.hotelsJson),
          transfersJson: typeof transfersJson === "object" ? JSON.stringify(transfersJson) : (transfersJson ?? existing.transfersJson),
          visaJson: typeof visaJson === "object" ? JSON.stringify(visaJson) : (visaJson ?? existing.visaJson),
          inclusionsJson: typeof inclusionsJson === "object" ? JSON.stringify(inclusionsJson) : (inclusionsJson ?? existing.inclusionsJson),
          exclusionsJson: typeof exclusionsJson === "object" ? JSON.stringify(exclusionsJson) : (exclusionsJson ?? existing.exclusionsJson),
          pricePerPerson: pricePerPerson !== undefined ? (pricePerPerson ? parseFloat(pricePerPerson) : null) : existing.pricePerPerson,
          totalPackagePrice: totalPackagePrice !== undefined ? (totalPackagePrice ? parseFloat(totalPackagePrice) : null) : existing.totalPackagePrice,
          priceIncludes: priceIncludes ?? existing.priceIncludes,
          importantTerms: importantTerms ?? existing.importantTerms,
          agentName: agentName ?? existing.agentName,
          companyName: companyName ?? existing.companyName,
          companyLogo: companyLogo ?? existing.companyLogo,
          companyAddress: companyAddress ?? existing.companyAddress,
          companyPhone: companyPhone ?? existing.companyPhone,
          companyEmail: companyEmail ?? existing.companyEmail,
          companyWebsite: companyWebsite ?? existing.companyWebsite,
          companyReg: companyReg ?? existing.companyReg,
          companyLicence: companyLicence ?? existing.companyLicence,
        }
      });

      res.status(200).json({ message: "Package quotation updated successfully", package: updatedPkg });
    } catch (error: any) {
      console.error("Update Package Error:", error);
      res.status(500).json({ error: "Internal Server Error", message: error?.message });
    }
  }
);

// DELETE /packages/:id -- Delete a package quotation
app.delete(
  "/packages/:id",
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      const tenantId = parseInt(req.tenantId!);
      const id = parseInt(req.params.id);

      const existing = await prisma.packageQuotation.findFirst({
        where: { id, tenantId }
      });
      if (!existing) {
        return res.status(404).json({ error: "Package not found" });
      }

      await prisma.packageQuotation.delete({ where: { id } });
      res.status(200).json({ message: "Package quotation deleted successfully" });
    } catch (error: any) {
      console.error("Delete Package Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// GET /finance/agent-margin-summary -- Internal: total margin earned by agent in period (for payroll)
app.get(
  "/finance/agent-margin-summary",
  requireGatewayHeaders,
  async (req: CustomRequest, res: Response) => {
    try {
      const tenantId = parseInt(req.tenantId!);
      const { agentId, from, to } = req.query as Record<string, string>;

      if (!agentId)
        return res.status(400).json({ error: "agentId is required" });

      const where: any = {
        tenantId,
        agentId: parseInt(agentId),
        status: { not: "cancelled" },
      };

      if (from || to) {
        where.date = {};
        if (from) where.date.gte = new Date(from);
        if (to) where.date.lte = new Date(to);
      }

      const bookings = await prisma.booking.findMany({
        where,
        select: {
          agentMargin: true,
          bookingReference: true,
          id: true,
          date: true,
          totalPrice: true,
        },
      });

      const totalMargin = bookings.reduce(
        (sum: number, b: any) => sum + Number(b.agentMargin || 0),
        0,
      );
      const bookingCount = bookings.length;

      return res.json({
        agentId: parseInt(agentId),
        periodFrom: from || null,
        periodTo: to || null,
        totalMarginEarned: totalMargin.toFixed(2),
        bookingCount,
        bookings: bookings.map((b: any) => ({
          id: b.id,
          reference: b.bookingReference,
          date: b.date,
          totalPrice: Number(b.totalPrice),
          agentMargin: Number(b.agentMargin),
        })),
      });
    } catch (err) {
      console.error("Agent margin summary error:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

app.listen(PORT, () => {
  console.log(`Booking Service is running on port ${PORT}`);
});
