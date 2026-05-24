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
  role: string | null;
}

export interface Payment {
  id: number;
  amount: string;
  paymentMethod: string;
  paymentType: 'Received from Client' | 'Sent to Vendor';
  paidOn: string;
  notes: string | null;
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
  lockedStatus: string;
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
}
