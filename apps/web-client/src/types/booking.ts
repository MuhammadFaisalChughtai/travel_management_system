export interface Passenger {
  id: number;
  title: string | null;
  firstName: string;
  lastName: string;
  ageCategory: string;
  email: string | null;
  phoneNumber: string | null;
  passportNumber: string | null;
  passportExpiryDate: string | null;
  dob?: string | null;
  passportImage?: string | null;
  role: string | null;
}

export interface Payment {
  id: number;
  amount: string;
  paymentMethod: string;
  paymentType: 'Received from Client' | 'Sent to Vendor' | 'Margin Paid to Agent' | string;
  paidOn: string;
  notes: string | null;
  status?: 'pending' | 'approved' | 'rejected' | string;
  evidenceUrl?: string | null;
  loggedByRole?: string | null;
  loggedById?: number | null;
  loggedByName?: string | null;
  cardCharges?: string | null;
}

export interface Discount {
  id: number;
  vendorCategory: 'Hotel' | 'Flight' | 'Accommodation' | 'Transportation' | 'Visa' | 'Other';
  serviceName?: string;
  amount: string;
  notes: string | null;
  date: string;
}

export interface Refund {
  id: number;
  direction: 'Refund to Client' | 'Refund from Vendor';
  vendorCategory: 'Hotel' | 'Flight' | 'Accommodation' | 'Transportation' | 'Visa' | 'Other';
  serviceName?: string;
  amount: string;
  notes: string | null;
  date: string;
}

export interface VendorPayment {
  id: number;
  vendorName: string;
  amount: string;
  paymentStatus: string;
  paidOn: string | null;
  flightPnr: string | null;
  issueDate: string | null;
  reservationNumber: string | null;
  notes: string | null;
  totalPaid: string;
  totalRefunded: string;
  remainingDue: string;
}

export interface Accommodation {
  id: number;
  vendorName: string;
  hotelName: string;
  city?: string | null;
  roomType: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  mealType: string | null;
  reservationNumber: string | null;
  qty: number;
  price: string;
  currency: string | null;
  otherCurrency: string | null;
  conversionRate: string | null;
  issueDate: string | null;
  refundAmount: string;
  fineAmount: string;
  hotelConfirmationNumber: string | null;
  hotelAddress: string | null;
  lastCancellationDate: string | null;
  isPaidToVendor?: boolean;
}

export interface Sector {
  departure: string;
  arrival: string;
  departureTime: string;
  arrivalTime: string;
}

export interface FlightService {
  id: number;
  date: string | null;
  vendorName: string;
  flightNo: string;
  pnr: string;
  departedFrom: string;
  arrivedAt: string;
  departTime: string | null;
  arrivalTime: string | null;
  qty?: number;
  unitPrice?: string;
  price: string;
  currency: string | null;
  otherCurrency?: string | null;
  conversionRate?: string | null;
  issueDate: string | null;
  refundAmount: string;
  fineAmount: string;
  baggage: string | null;
  carryOnBaggage: string | null;
  checkedBaggage: string | null;
  flightClass: string | null;
  
  // Enhanced Fields
  airline?: string;
  ticketNumber?: string;
  passengerIds?: number[];
  fareDetails?: string;
  sectors?: Sector[];
  isPaidToVendor?: boolean;
}

export interface TransportService {
  id: number;
  vendorName: string;
  vehicleType: string;
  departureDestination: string;
  arrivalDestination: string;
  date: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  flightNo: string | null;
  qty?: number;
  unitPrice?: string;
  price: string;
  currency: string | null;
  otherCurrency: string | null;
  conversionRate: string | null;
  issueDate: string | null;
  refundAmount: string;
  fineAmount: string;
  isPaidToVendor?: boolean;
}

export interface VisaService {
  id: number;
  vendorName: string;
  passportNumber: string;
  visaType: string;
  visaNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  qty?: number;
  unitPrice?: string;
  price: string;
  currency: string | null;
  otherCurrency: string | null;
  conversionRate: string | null;
  refundAmount: string;
  fineAmount: string;
  isPaidToVendor?: boolean;
}

export interface AdditionalService {
  id: number;
  serviceName: string;
  charges: string;
  currency?: string | null;
  otherCurrency?: string | null;
  conversionRate?: string | null;
  notes: string | null;
  isPaidToVendor?: boolean;
  vendorName?: string;
}

export interface BookingPriceLog {
  id: number;
  tenantId: number;
  bookingId: number;
  serviceType: string;
  serviceName: string;
  action: 'ADD' | 'UPDATE' | string;
  oldPrice: string;
  newPrice: string;
  loggedByName: string;
  loggedById: number | null;
  createdAt: string;
}

export interface BookingDetail {
  id: number;
  bookingReference: string;
  date: string;
  departureDate: string | null;
  agentName: string | null;
  totalPrice: string;
  paidAmount: string;
  refundAmount: string;
  cardPaymentCharges: string;
  cancellationCharges: string;
  remainingAmount: string;
  status: string;
  paymentStatus: string;
  isLocked: boolean;
  customers: Passenger[];
  payments: Payment[];
  vendorPayments: VendorPayment[];
  accommodations: Accommodation[];
  flightServices: FlightService[];
  transportServices: TransportService[];
  visaServices: VisaService[];
  additionalServices?: AdditionalService[];
  discounts: Discount[];
  refunds?: Refund[];
  marginStatus?: string;
  agentId?: number | null;
  priceLogs?: BookingPriceLog[];
}

