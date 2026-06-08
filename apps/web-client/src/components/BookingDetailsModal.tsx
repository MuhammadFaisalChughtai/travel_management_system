import toast from "react-hot-toast";
import { useEffect, useState } from "react";
import {
  X,
  Plane,
  Users,
  Hotel,
  Car,
  FileText,
  Calculator,
  Plus,
  Loader2,
  RefreshCcw,
  History,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api/axios";
import type { BookingDetail } from "../types/booking";
import { useAuthStore } from "../store/authStore";

import { AccordionSection } from "./AccordionSection";
import { SummaryLedgerSection } from "./booking-sections/SummaryLedgerSection";
import { TransactionsSection } from "./booking-sections/TransactionsSection";
import { PassengersSection } from "./booking-sections/PassengersSection";
import { FlightServicesSection } from "./booking-sections/FlightServicesSection";
import { StaysSection } from "./booking-sections/StaysSection";
import { TransportServicesSection } from "./booking-sections/TransportServicesSection";
import { VisaServicesSection } from "./booking-sections/VisaServicesSection";
import { AdditionalServicesSection } from "./booking-sections/AdditionalServicesSection";

import { AddFlightModal } from "./booking-modals/AddFlightModal";
import { AddPassengerModal } from "./booking-modals/AddPassengerModal";
import { AddTransportModal } from "./booking-modals/AddTransportModal";
import { AddAccommodationModal } from "./booking-modals/AddAccommodationModal";
import { AddVisaModal } from "./booking-modals/AddVisaModal";
import { AddAdditionalServiceModal } from "./booking-modals/AddAdditionalServiceModal";
import { LogTransactionModal } from "./booking-modals/LogTransactionModal";
import { LogRefundModal } from "./booking-modals/LogRefundModal";
import { AddDiscountModal } from "./booking-modals/AddDiscountModal";
import { DeleteConfirmationModal } from "./booking-modals/DeleteConfirmationModal";
import { DebtOffsetModal } from "./booking-modals/DebtOffsetModal";
import { InvoiceTemplate } from "./documents/InvoiceTemplate";
import { VoucherTemplate } from "./documents/VoucherTemplate";
import { generateInvoicePDF, printCompiledTemplate } from "../utils/pdfGenerator";

interface BookingDetailsModalProps {
  bookingId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export function BookingDetailsModal({
  bookingId,
  isOpen,
  onClose,
  onUpdate,
}: BookingDetailsModalProps) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { user } = useAuthStore();

  const hasPermission = (permission: string) => {
    if (!user) return false;
    if (user.role === "SUPER_ADMIN" || user.role === "MAIN_COMPANY_ADMIN" || user.role === "ADMIN") return true;
    if (user.permissions) {
      return user.permissions.includes(permission);
    }
    const defaults: Record<string, string[]> = {
      AGENT: [
        "CREATE_BOOKING", "READ_BOOKING", "UPDATE_BOOKING",
        "CREATE_CLIENT", "READ_CLIENT", "UPDATE_CLIENT",
        "READ_VENDOR", "READ_TRANSACTION"
      ],
      COMPANY_ADMIN: [
        "CREATE_BOOKING", "READ_BOOKING", "UPDATE_BOOKING", "DELETE_BOOKING",
        "CREATE_CLIENT", "READ_CLIENT", "UPDATE_CLIENT", "DELETE_CLIENT",
        "CREATE_VENDOR", "READ_VENDOR", "UPDATE_VENDOR", "DELETE_VENDOR",
        "READ_DASHBOARD",
        "CREATE_USER", "READ_USER", "UPDATE_USER", "DELETE_USER",
        "CREATE_TRANSACTION", "READ_TRANSACTION", "UPDATE_TRANSACTION", "DELETE_TRANSACTION"
      ]
    };
    return defaults[user.role || ""]?.includes(permission) || false;
  };

  const canUpdateBooking = hasPermission("UPDATE_BOOKING");
  const canCreateTransaction = hasPermission("CREATE_TRANSACTION");
  const canUpdateTransaction = hasPermission("UPDATE_TRANSACTION");

  // Accordion state
  const [openSections, setOpenSections] = useState<string[]>(["summary"]);

  const toggleSection = (section: string) => {
    setOpenSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section],
    );
  };

  // Nested Modal States
  const [showAddPassenger, setShowAddPassenger] = useState(false);

  const [editingFlight, setEditingFlight] = useState<any>(null);
  const [editingAccommodation, setEditingAccommodation] = useState<any>(null);
  const [editingTransport, setEditingTransport] = useState<any>(null);
  const [editingVisa, setEditingVisa] = useState<any>(null);
  const [editingAdditionalService, setEditingAdditionalService] =
    useState<any>(null);
  const [editingPassenger, setEditingPassenger] = useState<any>(null);

  const [showAddFlight, setShowAddFlight] = useState(false);
  const [showAddHotel, setShowAddHotel] = useState(false);
  const [showAddTransport, setShowAddTransport] = useState(false);
  const [showAddVisa, setShowAddVisa] = useState(false);
  const [showAddAdditionalService, setShowAddAdditionalService] =
    useState(false);
  const [showLogTransaction, setShowLogTransaction] = useState(false);
  const [showAddDiscount, setShowAddDiscount] = useState(false);
  const [showLogRefund, setShowLogRefund] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingHotelVoucher, setIsGeneratingHotelVoucher] =
    useState(false);
  const [isGeneratingTransportVoucher, setIsGeneratingTransportVoucher] =
    useState(false);
  const [voucherTemplates, setVoucherTemplates] = useState<any[]>([]);
  const [showVoucherDropdown, setShowVoucherDropdown] = useState(false);
  const [isGeneratingVoucher, setIsGeneratingVoucher] = useState(false);
  const [deleteConfig, setDeleteConfig] = useState<{
    isOpen: boolean;
    serviceType: string;
    id: number;
  } | null>(null);

  const [agentDebt, setAgentDebt] = useState<number>(0);
  const [showDebtOffset, setShowDebtOffset] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<any>(null);

  const handleDeleteService = async (serviceType: string, id: number) => {
    setDeleteConfig({ isOpen: true, serviceType, id });
  };

  const confirmDelete = async () => {
    if (!deleteConfig) return;
    try {
      const typeMap: any = {
        passenger: "passengers",
        flight: "flight-services",
        accommodation: "accommodations",
        transport: "transport-services",
        visa: "visa-services",
        additional: "additional-services",
      };
      const endpoint = typeMap[deleteConfig.serviceType];
      if (!endpoint) throw new Error("Invalid service type");

      await api.delete(`/bookings/${bookingId}/${endpoint}/${deleteConfig.id}`);
      import("react-hot-toast").then((m) =>
        m.default.success("Deleted successfully"),
      );
      await fetchDetails();
      onUpdate?.();
    } catch (err: any) {
      import("react-hot-toast").then((m) =>
        m.default.error(
          err?.response?.data?.error || err?.message || "Failed to delete",
        ),
      );
    } finally {
      setDeleteConfig(null);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!booking) return;
    setIsGeneratingPDF(true);
    try {
      const templatesRes = await api.get('/finance/templates');
      const activeTemplate = templatesRes.data.templates?.find(
        (t: any) => t.type === 'INVOICE' && t.status === 'Active'
      );

      if (activeTemplate) {
        const compileRes = await api.post(`/finance/templates/${activeTemplate.id}/compile`, {
          bookingId: booking.id
        });
        printCompiledTemplate(
          compileRes.data.compiledHtml,
          compileRes.data.compiledCss,
          `Invoice_${booking.bookingReference}.pdf`
        );
      } else {
        await generateInvoicePDF(
          "invoice-template",
          `Invoice_${booking.bookingReference}.pdf`,
        );
      }
    } catch (err) {
      console.error("Failed to generate custom invoice:", err);
      try {
        await generateInvoicePDF(
          "invoice-template",
          `Invoice_${booking.bookingReference}.pdf`,
        );
      } catch (fallbackErr) {
        console.error("Fallback invoice generation failed:", fallbackErr);
      }
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const fetchVoucherTemplates = async () => {
    try {
      const res = await api.get('/finance/templates');
      const activeVouchers = res.data.templates?.filter(
        (t: any) => t.type === 'VOUCHER' && t.status === 'Active'
      ) || [];
      setVoucherTemplates(activeVouchers);
    } catch (err) {
      console.error('Failed to fetch voucher templates:', err);
    }
  };

  const handleGenerateCustomVoucher = async (template: any) => {
    if (!booking) return;
    setIsGeneratingVoucher(true);
    try {
      const compileRes = await api.post(`/finance/templates/${template.id}/compile`, {
        bookingId: booking.id
      });
      printCompiledTemplate(
        compileRes.data.compiledHtml,
        compileRes.data.compiledCss,
        `${template.name.replace(/\s+/g, '_')}_${booking.bookingReference}.pdf`
      );
      toast.success("Voucher generated successfully");
    } catch (err) {
      console.error("Failed to generate custom voucher:", err);
      toast.error("Failed to generate custom voucher");
    } finally {
      setIsGeneratingVoucher(false);
    }
  };

  const handleGenerateHotelVoucher = async () => {
    if (
      !booking ||
      !booking.accommodations ||
      booking.accommodations.length === 0
    )
      return;
    setIsGeneratingHotelVoucher(true);
    try {
      const templatesRes = await api.get('/finance/templates');
      const activeTemplate = templatesRes.data.templates?.find(
        (t: any) => t.type === 'VOUCHER' && t.status === 'Active'
      );

      if (activeTemplate) {
        const compileRes = await api.post(`/finance/templates/${activeTemplate.id}/compile`, {
          bookingId: booking.id
        });
        printCompiledTemplate(
          compileRes.data.compiledHtml,
          compileRes.data.compiledCss,
          `HotelVoucher_${booking.bookingReference}.pdf`
        );
      } else {
        await generateInvoicePDF(
          "hotel-voucher-template",
          `HotelVoucher_${booking.bookingReference}.pdf`,
        );
      }
    } catch (err) {
      console.error("Failed to generate custom hotel voucher:", err);
      try {
        await generateInvoicePDF(
          "hotel-voucher-template",
          `HotelVoucher_${booking.bookingReference}.pdf`,
        );
      } catch (fallbackErr) {
        console.error("Fallback hotel voucher failed:", fallbackErr);
      }
    } finally {
      setIsGeneratingHotelVoucher(false);
    }
  };

  const handleGenerateTransportVoucher = async () => {
    if (
      !booking ||
      !booking.transportServices ||
      booking.transportServices.length === 0
    )
      return;
    setIsGeneratingTransportVoucher(true);
    try {
      const templatesRes = await api.get('/finance/templates');
      const activeTemplate = templatesRes.data.templates?.find(
        (t: any) => t.type === 'VOUCHER' && t.status === 'Active'
      );

      if (activeTemplate) {
        const compileRes = await api.post(`/finance/templates/${activeTemplate.id}/compile`, {
          bookingId: booking.id
        });
        printCompiledTemplate(
          compileRes.data.compiledHtml,
          compileRes.data.compiledCss,
          `TransportVoucher_${booking.bookingReference}.pdf`
        );
      } else {
        await generateInvoicePDF(
          "transport-voucher-template",
          `TransportVoucher_${booking.bookingReference}.pdf`,
        );
      }
    } catch (err) {
      console.error("Failed to generate custom transport voucher:", err);
      try {
        await generateInvoicePDF(
          "transport-voucher-template",
          `TransportVoucher_${booking.bookingReference}.pdf`,
        );
      } catch (fallbackErr) {
        console.error("Fallback transport voucher failed:", fallbackErr);
      }
    } finally {
      setIsGeneratingTransportVoucher(false);
    }
  };

  const fetchDetails = async () => {
    if (!bookingId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/bookings/${bookingId}`);
      const bData = res.data.booking;
      let resolvedAgentId = bData?.agentId;
      if (!resolvedAgentId && bData?.agentName && bData.agentName !== 'System / Auto' && bData.agentName !== 'Any') {
        try {
          const agentRes = await api.get(`/agents/by-name/${encodeURIComponent(bData.agentName)}`);
          resolvedAgentId = agentRes.data?.agent?.id;
        } catch (e) {
          console.error("Failed to fetch agent by name", e);
        }
      }

      if (resolvedAgentId) {
        try {
          const debtRes = await api.get(`/agents/${resolvedAgentId}/wallet/debt`);
          setAgentDebt(debtRes.data.debt || 0);
        } catch (e) {
          console.error("Failed to fetch agent debt", e);
        }
      }
      setBooking(bData);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Failed to load booking details.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTransaction = async (data: any) => {
    if (!bookingId) return;

    if (data.paymentType === "Margin Paid to Agent" && agentDebt > 0) {
      setPendingTransaction(data);
      setShowDebtOffset(true);
      return; // Pause execution until offset is handled
    }

    await submitTransaction(data, 0);
  };

  const submitTransaction = async (data: any, offsetAmount: number) => {
    try {
      const finalAmount = Math.max(0, parseFloat(data.amount) - offsetAmount);
      
      // If there's an offset, log it separately
      if (offsetAmount > 0) {
        await api.post(`/bookings/${bookingId}/payments`, {
          amount: offsetAmount,
          paymentMethod: "System Offset",
          paymentType: "Margin Paid to Agent",
          paidOn: data.paidOn || data.date,
          notes: `Debt Settlement Offset. ${data.notes || ''}`
        });
      }

      if (finalAmount > 0) {
        await api.post(`/bookings/${bookingId}/payments`, {
          amount: finalAmount,
          paymentMethod: data.paymentMethod,
          paymentType: data.paymentType,
          paidOn: data.paidOn || data.date,
          notes: data.notes || null,
          evidenceUrl: data.evidenceUrl || undefined,
          loggedByName: user?.name || undefined,
        });
      }

      if (
        data.paymentType === "Sent to Vendor" &&
        data.serviceId &&
        data.serviceCategory &&
        data.serviceCategory !== "Other"
      ) {
        let endpoint = '';
        if (data.serviceCategory === 'Flight') endpoint = `/bookings/${bookingId}/flight-services/${data.serviceId}`;
        else if (data.serviceCategory === 'Accommodation') endpoint = `/bookings/${bookingId}/accommodations/${data.serviceId}`;
        else if (data.serviceCategory === 'Transportation') endpoint = `/bookings/${bookingId}/transport-services/${data.serviceId}`;
        else if (data.serviceCategory === 'Visa') endpoint = `/bookings/${bookingId}/visa-services/${data.serviceId}`;
        else endpoint = `/bookings/${bookingId}/additional-services/${data.serviceId}`;

        if (endpoint) {
          await api.patch(endpoint, { isPaidToVendor: true });
        }
      }
      if (
        data.paymentMethod === "Credit Card" &&
        data.ccCharges &&
        parseFloat(data.ccCharges) > 0
      ) {
        await api.post(`/bookings/${bookingId}/payments`, {
          amount: parseFloat(data.ccCharges),
          paymentMethod: "System Generated",
          paymentType: "Credit Card Charges",
          paidOn: data.paidOn || data.date,
          notes: `Credit card charges for ${data.paymentType}${data.serviceName ? ` (${data.serviceName})` : ""}`,
        });
      }
      fetchDetails();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.details ||
        err?.message ||
        "Failed to save transaction.";
      console.error("Transaction error:", err?.response?.data || err);
      toast.error(`Transaction Error: ${msg}`);
    }
  };

  const handleSaveDiscount = async (data: any) => {
    if (!bookingId) return;
    try {
      await api.post(`/bookings/${bookingId}/discounts`, {
        vendorCategory: data.vendorCategory,
        serviceName: data.serviceName || null,
        amount: parseFloat(data.amount),
        notes: data.notes || null,
        date: data.date,
      });
      if (
        data.paymentMethod === "Credit Card" &&
        data.ccCharges &&
        parseFloat(data.ccCharges) > 0
      ) {
        await api.post(`/bookings/${bookingId}/payments`, {
          amount: parseFloat(data.ccCharges),
          paymentMethod: "System Generated",
          paymentType: "Credit Card Charges",
          paidOn: data.date,
          notes: `Credit card charges for discount applied${data.serviceName ? ` to ${data.serviceName}` : ""}`,
        });
      }
      fetchDetails();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.details ||
        err?.message ||
        "Failed to save discount.";
      console.error("Discount error:", err?.response?.data || err);
      toast.error(`Discount Error: ${msg}`);
    }
  };

  const handleSaveRefund = async (data: any) => {
    if (!bookingId) return;
    try {
      await api.post(`/bookings/${bookingId}/refunds`, {
        direction: data.direction,
        vendorCategory: data.vendorCategory,
        serviceName: data.serviceName || null,
        amount: parseFloat(data.amount),
        notes: data.notes || null,
        date: data.date,
      });
      if (
        data.paymentMethod === "Credit Card" &&
        data.ccCharges &&
        parseFloat(data.ccCharges) > 0
      ) {
        await api.post(`/bookings/${bookingId}/payments`, {
          amount: parseFloat(data.ccCharges),
          paymentMethod: "System Generated",
          paymentType: "Credit Card Charges",
          paidOn: data.date,
          notes: `Credit card charges for ${data.direction}${data.serviceName ? ` on ${data.serviceName}` : ""}`,
        });
      }
      fetchDetails();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.details ||
        err?.message ||
        "Failed to log refund.";
      console.error("Refund error:", err?.response?.data || err);
      toast.error(`Refund Error: ${msg}`);
    }
  };

  const handleClawbackMargin = async (data: any) => {
    if (!bookingId) return;
    try {
      await api.post(`/bookings/${bookingId}/clawback-margin`, {
        amount: parseFloat(data.amount),
        reason: data.reason || null,
      });
      fetchDetails();
      toast.success("Margin clawback successful");
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.details ||
        err?.message ||
        "Failed to clawback margin.";
      console.error("Clawback error:", err?.response?.data || err);
      toast.error(`Clawback Error: ${msg}`);
    }
  };

  const handleFinalizeMargin = async (data: any) => {
    if (!bookingId) return;
    try {
      await api.post(`/bookings/${bookingId}/finalize-margin`, {
        amount: parseFloat(data.amount),
        notes: data.notes || null,
      });
      fetchDetails();
      toast.success("Margin finalized successfully");
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.details ||
        err?.message ||
        "Failed to finalize margin.";
      console.error("Finalize error:", err?.response?.data || err);
      toast.error(`Finalize Error: ${msg}`);
    }
  };


  const handleSavePassenger = async (data: any) => {
    if (!bookingId) return;
    try {
      data.id
        ? await api.patch(`/bookings/${bookingId}/passengers/${data.id}`, data)
        : await api.post(`/bookings/${bookingId}/passengers`, data);
      fetchDetails();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to save passenger.";
      console.error("Passenger error:", err?.response?.data || err);
      toast.error(`Passenger Error: ${msg}`);
    }
  };

  const handleSaveFlight = async (data: any) => {
    if (!bookingId) return;
    try {
      data.id
        ? await api.patch(
            `/bookings/${bookingId}/flight-services/${data.id}`,
            data,
          )
        : await api.post(`/bookings/${bookingId}/flight-services`, data);
      fetchDetails();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to save flight.";
      console.error("Flight error:", err?.response?.data || err);
      toast.error(`Flight Error: ${msg}`);
    }
  };

  const handleSaveAccommodation = async (data: any) => {
    if (!bookingId) return;
    try {
      data.id
        ? await api.patch(
            `/bookings/${bookingId}/accommodations/${data.id}`,
            data,
          )
        : await api.post(`/bookings/${bookingId}/accommodations`, data);
      fetchDetails();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to save accommodation.";
      console.error("Hotel error:", err?.response?.data || err);
      toast.error(`Hotel Error: ${msg}`);
    }
  };

  const handleSaveTransport = async (data: any) => {
    if (!bookingId) return;
    try {
      data.id
        ? await api.patch(
            `/bookings/${bookingId}/transport-services/${data.id}`,
            data,
          )
        : await api.post(`/bookings/${bookingId}/transport-services`, data);
      fetchDetails();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to save transport.";
      console.error("Transport error:", err?.response?.data || err);
      toast.error(`Transport Error: ${msg}`);
    }
  };

  const handleSaveVisa = async (data: any) => {
    if (!bookingId) return;
    try {
      data.id
        ? await api.patch(
            `/bookings/${bookingId}/visa-services/${data.id}`,
            data,
          )
        : await api.post(`/bookings/${bookingId}/visa-services`, data);
      fetchDetails();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || "Failed to save visa.";
      console.error("Visa error:", err?.response?.data || err);
      toast.error(`Visa Error: ${msg}`);
    }
  };

  const handleSaveAdditionalService = async (data: any) => {
    if (!bookingId) return;
    try {
      data.id
        ? await api.patch(
            `/bookings/${bookingId}/additional-services/${data.id}`,
            data,
          )
        : await api.post(`/bookings/${bookingId}/additional-services`, data);
      fetchDetails();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to save additional service.";
      console.error("Additional service error:", err?.response?.data || err);
      toast.error(`Service Error: ${msg}`);
    }
  };

  const handleUpdateCoreField = async (field: string, value: string) => {
    if (!bookingId) return;
    try {
      const numericFields = ['totalPrice', 'paidAmount', 'refundAmount', 'cardPaymentCharges', 'cancellationCharges', 'remainingAmount'];
      const parsedValue = numericFields.includes(field) ? parseFloat(value) : value;

      await api.patch(`/bookings/${bookingId}`, {
        [field]: parsedValue,
      });
      fetchDetails();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        `Failed to update ${field}.`;
      console.error(`Update ${field} error:`, err?.response?.data || err);
      toast.error(`Update Error: ${msg}`);
    }
  };

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchDetails();
      fetchVoucherTemplates();
    } else {
      setBooking(null);
      setVoucherTemplates([]);
      setShowVoucherDropdown(false);
    }
  }, [isOpen, bookingId]);

  if (!isOpen) return null;

  const hasVoucherOptions = (voucherTemplates && voucherTemplates.length > 0) || 
    (booking?.accommodations && booking.accommodations.length > 0) || 
    (booking?.transportServices && booking.transportServices.length > 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Background Dimmer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Main Modal Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="relative w-full max-w-[95vw] xl:max-w-7xl h-[90vh] bg-slate-50 shadow-2xl flex flex-col z-10 rounded-2xl overflow-hidden"
      >
        <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-8 py-6 flex justify-between items-center shadow-lg relative z-20">
          {/* Background Decorative Circles clipped by wrapper */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-20 w-40 h-40 bg-indigo-500/20 rounded-full blur-2xl -mb-10"></div>
          </div>

          <div className="relative z-10 flex flex-col">
            <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
              Booking Workspace
              {booking && (
                <span className="bg-white/20 px-3 py-1 rounded-lg text-sm font-mono tracking-widest backdrop-blur-md border border-white/20">
                  {booking.bookingReference}
                </span>
              )}
            </h2>
            <p className="text-indigo-200 text-xs mt-1 font-medium">
              Complete overview and administration
            </p>
          </div>
          <div className="relative z-10 flex items-center gap-4">
            {/* Generate Vouchers Dropdown */}
            {booking && hasVoucherOptions && (
              <div className="relative">
                <button
                  onClick={() => setShowVoucherDropdown(!showVoucherDropdown)}
                  disabled={isGeneratingVoucher || isGeneratingHotelVoucher || isGeneratingTransportVoucher}
                  className="flex items-center gap-2 bg-indigo-500/30 hover:bg-indigo-500/50 text-white px-4 py-2 rounded-xl text-[11px] font-bold transition-all uppercase tracking-wide border border-indigo-400/30 shadow-lg"
                >
                  <FileText className="w-4 h-4" />
                  <span>
                    {isGeneratingVoucher || isGeneratingHotelVoucher || isGeneratingTransportVoucher
                      ? "Generating..."
                      : "Generate Voucher"}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                </button>
                
                {showVoucherDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowVoucherDropdown(false)}
                    />
                    <div className="absolute right-0 mt-2 w-64 bg-slate-900/95 border border-slate-800 rounded-xl shadow-2xl py-1 z-50 backdrop-blur-md">
                      {voucherTemplates.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 border-b border-slate-800 text-[9px] uppercase tracking-wider text-slate-400 font-extrabold">Custom Templates</div>
                          {voucherTemplates.map((t: any) => (
                            <button
                              key={t.id}
                              onClick={() => {
                                handleGenerateCustomVoucher(t);
                                setShowVoucherDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2 text-xs hover:bg-white/10 text-white font-semibold transition-colors flex items-center justify-between"
                            >
                              <span className="truncate mr-2">{t.name}</span>
                              <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono">v{t.version}</span>
                            </button>
                          ))}
                        </>
                      )}
                      
                      {((booking.accommodations && booking.accommodations.length > 0) || 
                        (booking.transportServices && booking.transportServices.length > 0)) && (
                        <>
                          <div className="px-3 py-1.5 border-t border-slate-800 border-b text-[9px] uppercase tracking-wider text-slate-400 font-extrabold">Default Vouchers</div>
                          {booking.accommodations && booking.accommodations.length > 0 && (
                            <button
                              onClick={() => {
                                handleGenerateHotelVoucher();
                                setShowVoucherDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2 text-xs hover:bg-white/10 text-white font-semibold transition-colors flex items-center justify-between"
                            >
                              <span>Hotel Stay Voucher</span>
                            </button>
                          )}
                          {booking.transportServices && booking.transportServices.length > 0 && (
                            <button
                              onClick={() => {
                                handleGenerateTransportVoucher();
                                setShowVoucherDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2 text-xs hover:bg-white/10 text-white font-semibold transition-colors flex items-center justify-between"
                            >
                              <span>Transport Voucher</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {booking && (
              <button
                onClick={handleGenerateInvoice}
                disabled={isGeneratingPDF}
                className="flex items-center gap-2 bg-indigo-500/30 hover:bg-indigo-500/50 text-white px-4 py-2 rounded-xl text-[11px] font-bold transition-all uppercase tracking-wide border border-indigo-400/30 shadow-lg"
              >
                {isGeneratingPDF ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                {isGeneratingPDF ? "Generating..." : "Generate Invoice"}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-100/50 to-transparent pointer-events-none"></div>

          {loading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="w-10 h-10 text-primary-500 animate-spin mb-4" />
              <p className="text-slate-500 font-semibold text-sm">
                Loading workspace data...
              </p>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 flex flex-col items-center text-center">
              <X className="w-10 h-10 mb-2" />
              <p className="font-bold">{error}</p>
            </div>
          ) : booking ? (
            <div className="relative z-10 max-w-full mx-auto space-y-4">
              {hasPermission("READ_TRANSACTION") && (
                <AccordionSection
                  title="Financial Dashboard & Ledger"
                  icon={<Calculator className="w-4 h-4" />}
                  isOpen={openSections.includes("summary")}
                  onToggle={() => toggleSection("summary")}
                  action={
                    canCreateTransaction ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowLogRefund(true)}
                          className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-md transition-all uppercase tracking-wide"
                        >
                          <RefreshCcw className="w-3 h-3" /> Refund
                        </button>
                        <button
                          onClick={() => setShowAddDiscount(true)}
                          className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-md transition-all uppercase tracking-wide"
                        >
                          <Plus className="w-3 h-3" /> Discount
                        </button>
                        <button
                          onClick={() => setShowLogTransaction(true)}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-md transition-all uppercase tracking-wide"
                        >
                          <Plus className="w-3 h-3" /> Log Transaction
                        </button>
                      </div>
                    ) : undefined
                  }
                >
                  <div className="space-y-4">
                    <SummaryLedgerSection
                      booking={booking || undefined}
                      onUpdate={canUpdateBooking ? handleUpdateCoreField : undefined}
                    />
                    <TransactionsSection
                      booking={booking || undefined}
                      onAddDiscount={canCreateTransaction ? () => setShowAddDiscount(true) : undefined}
                      onLogRefund={canCreateTransaction ? handleSaveRefund : undefined}
                      onClawbackMargin={user?.role !== "AGENT" && canUpdateTransaction ? handleClawbackMargin : undefined}
                      onFinalizeMargin={user?.role !== "AGENT" && canCreateTransaction ? handleFinalizeMargin : undefined}
                      onUpdateInvoicePrice={canUpdateTransaction ? (price) => handleUpdateCoreField("totalPrice", price) : undefined}
                    />
                  </div>
                </AccordionSection>
              )}

              <AccordionSection
                title="Passengers"
                icon={<Users className="w-4 h-4" />}
                isOpen={openSections.includes("passengers")}
                onToggle={() => toggleSection("passengers")}
                action={
                  canUpdateBooking ? (
                    <button
                      onClick={() => setShowAddPassenger(true)}
                      className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-md transition-all uppercase tracking-wide"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  ) : undefined
                }
              >
                <PassengersSection
                  passengers={booking.customers}
                  onAdd={canUpdateBooking ? () => setShowAddPassenger(true) : undefined}
                  onEdit={canUpdateBooking ? (p) => setEditingPassenger(p) : undefined}
                  onDelete={canUpdateBooking ? (s: any) => handleDeleteService("passenger", s.id) : undefined}
                  onSendGdprRequest={async (passenger) => {
                    let emailToSend = passenger.email;
                    if (!emailToSend) {
                      const updatedEmail = window.prompt(
                        `The passenger "${passenger.firstName} ${passenger.lastName}" does not have an email address set.\n\nPlease enter an email address to send the GDPR travel information request to:`
                      );
                      if (updatedEmail === null) {
                        return; // Admin cancelled
                      }
                      if (!updatedEmail.trim() || !updatedEmail.includes("@")) {
                        toast.error("Invalid email address provided.");
                        return;
                      }
                      emailToSend = updatedEmail.trim();
                    }

                    const promise = api.post(`/bookings/${booking.id}/passengers/${passenger.id}/send-gdpr-request`, {
                      email: emailToSend
                    });

                    toast.promise(promise, {
                      loading: "Sending GDPR information request email...",
                      success: () => {
                        if (emailToSend !== passenger.email) {
                          fetchDetails();
                        }
                        return "GDPR request email dispatched successfully!";
                      },
                      error: (err: any) => {
                        const errMsg = err?.response?.data?.message || err?.message || "Failed to send email.";
                        return `Error: ${errMsg}`;
                      }
                    });
                  }}
                />
              </AccordionSection>

              <AccordionSection
                title="Flight Services"
                icon={<Plane className="w-4 h-4" />}
                isOpen={openSections.includes("flights")}
                onToggle={() => toggleSection("flights")}
                action={
                  canUpdateBooking ? (
                    <button
                      onClick={() => setShowAddFlight(true)}
                      className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-md transition-all uppercase tracking-wide"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  ) : undefined
                }
              >
                <FlightServicesSection
                  flights={booking.flightServices}
                  onEdit={canUpdateBooking ? setEditingFlight : undefined}
                  onAdd={canUpdateBooking ? () => setShowAddFlight(true) : undefined}
                  onDelete={canUpdateBooking ? (s: any) => handleDeleteService("flight", s.id) : undefined}
                />
              </AccordionSection>

              <AccordionSection
                title="Accommodations & Stays"
                icon={<Hotel className="w-4 h-4" />}
                isOpen={openSections.includes("stays")}
                onToggle={() => toggleSection("stays")}
                action={
                  canUpdateBooking ? (
                    <button
                      onClick={() => setShowAddHotel(true)}
                      className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-md transition-all uppercase tracking-wide"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  ) : undefined
                }
              >
                <StaysSection
                  stays={booking.accommodations}
                  onAdd={canUpdateBooking ? () => setShowAddHotel(true) : undefined}
                  onEdit={canUpdateBooking ? (s: any) => setEditingAccommodation(s) : undefined}
                  onDelete={canUpdateBooking ? (s: any) => handleDeleteService("accommodation", s.id) : undefined}
                />
              </AccordionSection>

              <AccordionSection
                title="Transport Services"
                icon={<Car className="w-4 h-4" />}
                isOpen={openSections.includes("transport")}
                onToggle={() => toggleSection("transport")}
                action={
                  canUpdateBooking ? (
                    <button
                      onClick={() => setShowAddTransport(true)}
                      className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-md transition-all uppercase tracking-wide"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  ) : undefined
                }
              >
                <TransportServicesSection
                  transports={booking.transportServices}
                  onEdit={canUpdateBooking ? setEditingTransport : undefined}
                  onAdd={canUpdateBooking ? () => setShowAddTransport(true) : undefined}
                  onDelete={canUpdateBooking ? (s: any) => handleDeleteService("transport", s.id) : undefined}
                />
              </AccordionSection>

              <AccordionSection
                title="Visa Services"
                icon={<FileText className="w-4 h-4" />}
                isOpen={openSections.includes("visas")}
                onToggle={() => toggleSection("visas")}
                action={
                  canUpdateBooking ? (
                    <button
                      onClick={() => setShowAddVisa(true)}
                      className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-md transition-all uppercase tracking-wide"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  ) : undefined
                }
              >
                <VisaServicesSection
                  visas={booking.visaServices}
                  onEdit={canUpdateBooking ? setEditingVisa : undefined}
                  onAdd={canUpdateBooking ? () => setShowAddVisa(true) : undefined}
                  onDelete={canUpdateBooking ? (s: any) => handleDeleteService("visa", s.id) : undefined}
                />
              </AccordionSection>

              <AccordionSection
                title="Additional Services"
                icon={<Plus className="w-4 h-4" />}
                isOpen={openSections.includes("additional")}
                onToggle={() => toggleSection("additional")}
                action={
                  canUpdateBooking ? (
                    <button
                      onClick={() => setShowAddAdditionalService(true)}
                      className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-md transition-all uppercase tracking-wide"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  ) : undefined
                }
              >
                <AdditionalServicesSection
                  services={booking.additionalServices}
                  onEdit={canUpdateBooking ? setEditingAdditionalService : undefined}
                  onAdd={canUpdateBooking ? () => setShowAddAdditionalService(true) : undefined}
                  onDelete={canUpdateBooking ? (s: any) => handleDeleteService("additional", s.id) : undefined}
                />
              </AccordionSection>

              {user?.role !== "AGENT" && (
                <AccordionSection
                  title="Service Price Audit Logs (Admin Only)"
                  icon={<History className="w-4 h-4" />}
                  isOpen={openSections.includes("priceLogs")}
                  onToggle={() => toggleSection("priceLogs")}
                >
                  <div className="space-y-4 p-4 bg-slate-50/50 rounded-xl border border-slate-200/50">
                    {!booking.priceLogs || booking.priceLogs.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-sm font-medium">
                        No service price additions or modifications logged for this booking.
                      </div>
                    ) : (
                      <div className="flow-root">
                        <ul className="-mb-8">
                          {booking.priceLogs.map((log, logIdx) => {
                            const isAdd = log.action === 'ADD';
                            const oldP = parseFloat(log.oldPrice) || 0;
                            const newP = parseFloat(log.newPrice) || 0;
                            const diff = newP - oldP;
                            const isDecrease = diff < 0;

                            return (
                              <li key={log.id}>
                                <div className="relative pb-8">
                                  {logIdx !== booking.priceLogs!.length - 1 ? (
                                    <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                                  ) : null}
                                  <div className="relative flex space-x-3">
                                    <div>
                                      <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                                        isAdd 
                                          ? 'bg-emerald-50 text-emerald-600' 
                                          : isDecrease 
                                            ? 'bg-rose-50 text-rose-600' 
                                            : 'bg-amber-50 text-amber-600'
                                      }`}>
                                        <History className="h-4 w-4" />
                                      </span>
                                    </div>
                                    <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                                      <div>
                                        <p className="text-sm text-slate-700 font-medium">
                                          <span className="font-semibold text-slate-900">{log.loggedByName}</span>{' '}
                                          {isAdd ? 'added price for' : 'updated price for'}{' '}
                                          <span className="font-semibold text-indigo-600">{log.serviceType}</span> service ({log.serviceName})
                                        </p>
                                        <div className="mt-1 flex items-center gap-2">
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                            isAdd 
                                              ? 'bg-emerald-100 text-emerald-800' 
                                              : isDecrease 
                                                ? 'bg-rose-100 text-rose-800' 
                                                : 'bg-amber-100 text-amber-800'
                                          }`}>
                                            {isAdd ? 'ADD' : isDecrease ? 'DECREASE' : 'INCREASE'}
                                          </span>
                                          <span className="text-slate-600 text-sm font-semibold font-mono">
                                            {isAdd ? (
                                              `£${newP.toFixed(2)}`
                                            ) : (
                                              <>
                                                £{oldP.toFixed(2)} → £{newP.toFixed(2)} 
                                                <span className={`ml-1 font-bold ${isDecrease ? 'text-rose-600' : 'text-amber-600'}`}>
                                                  ({isDecrease ? '-' : '+'}£{Math.abs(diff).toFixed(2)})
                                                </span>
                                              </>
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="text-right text-xs whitespace-nowrap text-slate-400 pt-0.5">
                                        <time dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString()}</time>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </AccordionSection>
              )}
            </div>
          ) : null}
        </div>
      </motion.div>

      {/* Nested Popup Modals - Rendered at z-[70] internally */}
      <AnimatePresence>
        {/* Delete Confirmation Modal */}
        <DeleteConfirmationModal
          isOpen={!!deleteConfig?.isOpen}
          onClose={() => setDeleteConfig(null)}
          onConfirm={confirmDelete}
        />
        {(showAddPassenger || !!editingPassenger) && (
          <AddPassengerModal
            isOpen={showAddPassenger || !!editingPassenger}
            onClose={() => {
              setShowAddPassenger(false);
              setEditingPassenger(null);
            }}
            onSubmit={handleSavePassenger}
            initialData={editingPassenger}
          />
        )}
        {(showAddFlight || !!editingFlight) && (
          <AddFlightModal
            isOpen={showAddFlight || !!editingFlight}
            onClose={() => {
              setShowAddFlight(false);
              setEditingFlight(null);
            }}
            onSubmit={handleSaveFlight}
            initialData={editingFlight}
          />
        )}
        {(showAddHotel || !!editingAccommodation) && (
          <AddAccommodationModal
            isOpen={showAddHotel || !!editingAccommodation}
            onClose={() => {
              setShowAddHotel(false);
              setEditingAccommodation(null);
            }}
            onSubmit={handleSaveAccommodation}
            initialData={editingAccommodation}
          />
        )}
        {(showAddTransport || !!editingTransport) && (
          <AddTransportModal
            isOpen={showAddTransport || !!editingTransport}
            onClose={() => {
              setShowAddTransport(false);
              setEditingTransport(null);
            }}
            onSubmit={handleSaveTransport}
            flights={booking?.flightServices || []}
            initialData={editingTransport}
          />
        )}
        {(showAddVisa || !!editingVisa) && (
          <AddVisaModal
            isOpen={showAddVisa || !!editingVisa}
            onClose={() => {
              setShowAddVisa(false);
              setEditingVisa(null);
            }}
            onSubmit={handleSaveVisa}
            initialData={editingVisa}
            passengers={booking?.customers || []}
          />
        )}
        {(showAddAdditionalService || !!editingAdditionalService) && (
          <AddAdditionalServiceModal
            isOpen={showAddAdditionalService || !!editingAdditionalService}
            onClose={() => {
              setShowAddAdditionalService(false);
              setEditingAdditionalService(null);
            }}
            onSubmit={handleSaveAdditionalService}
            initialData={editingAdditionalService}
          />
        )}
        {showLogTransaction && (
          <LogTransactionModal
            booking={booking!}
            isOpen={showLogTransaction}
            onClose={() => setShowLogTransaction(false)}
            onSubmit={handleSaveTransaction}
          />
        )}
        {showDebtOffset && booking?.agentId && pendingTransaction && (
          <DebtOffsetModal
            isOpen={showDebtOffset}
            agentName={booking.agentName || "Agent"}
            debtAmount={agentDebt}
            newPayoutAmount={parseFloat(pendingTransaction.amount)}
            onClose={() => {
              setShowDebtOffset(false);
              setPendingTransaction(null);
            }}
            onSubmit={async (offsetAmount) => {
              setShowDebtOffset(false);
              await submitTransaction(pendingTransaction, offsetAmount);
              setPendingTransaction(null);
            }}
          />
        )}
        {showAddDiscount && (
          <AddDiscountModal
            booking={booking!}
            isOpen={showAddDiscount}
            onClose={() => setShowAddDiscount(false)}
            onSubmit={handleSaveDiscount}
          />
        )}
        {showLogRefund && (
          <LogRefundModal
            booking={booking!}
            isOpen={showLogRefund}
            onClose={() => setShowLogRefund(false)}
            onSubmit={handleSaveRefund}
          />
        )}
      </AnimatePresence>

      {/* Hidden Templates for PDF Generation */}
      {booking && (
        <div
          style={{
            position: "absolute",
            top: "-9999px",
            left: "-9999px",
            opacity: 0,
            pointerEvents: "none",
          }}
        >
          <div id="invoice-template">
            <InvoiceTemplate
              booking={booking}
              companyInfo={{
                name: "TravelBooker Workspace",
                location: "London, UK",
                phone: "+44 20 7946 0958",
                email: "operations@travelbooker.co.uk",
              }}
            />
          </div>
          {booking.accommodations && booking.accommodations.length > 0 && (
            <div id="hotel-voucher-template">
              <VoucherTemplate
                booking={booking}
                type="hotel"
                companyInfo={{
                  name: "TravelBooker Workspace",
                  phone: "+44 20 7946 0958",
                  email: "operations@travelbooker.co.uk",
                }}
              />
            </div>
          )}
          {booking.transportServices &&
            booking.transportServices.length > 0 && (
              <div id="transport-voucher-template">
                <VoucherTemplate
                  booking={booking}
                  type="transport"
                  companyInfo={{
                    name: "TravelBooker Workspace",
                    phone: "+44 20 7946 0958",
                    email: "operations@travelbooker.co.uk",
                  }}
                />
              </div>
            )}
        </div>
      )}
    </div>
  );
}
