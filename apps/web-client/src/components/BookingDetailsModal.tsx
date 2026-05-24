import toast from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { X, Plane, Users, Hotel, Car, FileText, Calculator, Plus, Loader2, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/axios';
import type { BookingDetail, } from '../types/booking';

import { AccordionSection } from './AccordionSection';
import { SummaryLedgerSection } from './booking-sections/SummaryLedgerSection';
import { TransactionsSection } from './booking-sections/TransactionsSection';
import { PassengersSection } from './booking-sections/PassengersSection';
import { FlightServicesSection } from './booking-sections/FlightServicesSection';
import { StaysSection } from './booking-sections/StaysSection';
import { TransportServicesSection } from './booking-sections/TransportServicesSection';
import { VisaServicesSection } from './booking-sections/VisaServicesSection';
import { AdditionalServicesSection } from './booking-sections/AdditionalServicesSection';

import { AddFlightModal } from './booking-modals/AddFlightModal';
import { AddPassengerModal } from './booking-modals/AddPassengerModal';
import { AddTransportModal } from './booking-modals/AddTransportModal';
import { AddAccommodationModal } from './booking-modals/AddAccommodationModal';
import { AddVisaModal } from './booking-modals/AddVisaModal';
import { AddAdditionalServiceModal } from './booking-modals/AddAdditionalServiceModal';
import { LogTransactionModal } from './booking-modals/LogTransactionModal';
import { AddDiscountModal } from './booking-modals/AddDiscountModal';
import { LogRefundModal } from './booking-modals/LogRefundModal';
import { InvoiceTemplate } from './invoice/InvoiceTemplate';
import { generateInvoicePDF } from '../utils/pdfGenerator';

interface BookingDetailsModalProps {
  bookingId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export function BookingDetailsModal({ bookingId, isOpen, onClose, onUpdate }: BookingDetailsModalProps) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Accordion state
  const [openSections, setOpenSections] = useState<string[]>(['summary']);

  const toggleSection = (section: string) => {
    setOpenSections(prev => 
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  // Nested Modal States
  const [showAddPassenger, setShowAddPassenger] = useState(false);
  
  const [editingFlight, setEditingFlight] = useState<any>(null);
  const [editingAccommodation, setEditingAccommodation] = useState<any>(null);
  const [editingTransport, setEditingTransport] = useState<any>(null);
  const [editingVisa, setEditingVisa] = useState<any>(null);
  const [editingAdditionalService, setEditingAdditionalService] = useState<any>(null);
  const [editingPassenger, setEditingPassenger] = useState<any>(null);

  const [showAddFlight, setShowAddFlight] = useState(false);
  const [showAddHotel, setShowAddHotel] = useState(false);
  const [showAddTransport, setShowAddTransport] = useState(false);
  const [showAddVisa, setShowAddVisa] = useState(false);
  const [showAddAdditionalService, setShowAddAdditionalService] = useState(false);
  const [showLogTransaction, setShowLogTransaction] = useState(false);
  const [showAddDiscount, setShowAddDiscount] = useState(false);
  const [showLogRefund, setShowLogRefund] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  
  const handleDeleteService = async (serviceType: string, id: number) => {
    if (!window.confirm("Are you sure you want to delete this? This action cannot be undone.")) return;
    try {
      await api.delete(`/bookings/${bookingId}/services/${serviceType}/${id}`);
      import('react-hot-toast').then(m => m.default.success('Deleted successfully'));
      onUpdate?.();
    } catch (err: any) {
      import('react-hot-toast').then(m => m.default.error(err?.response?.data?.error || 'Failed to delete'));
    }
  };

  const handleGenerateInvoice = async () => {
    if (!booking) return;
    setIsGeneratingPDF(true);
    try {
      await generateInvoicePDF('invoice-template', `Invoice_${booking.bookingReference}.pdf`);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const fetchDetails = async () => {
    if (!bookingId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/bookings/${bookingId}`);
      setBooking(res.data.booking);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load booking details.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTransaction = async (data: any) => {
    if (!bookingId) return;
    try {
      await api.post(`/bookings/${bookingId}/payments`, {
        amount: parseFloat(data.amount),
        paymentMethod: data.paymentMethod,
        paymentType: data.paymentType,
        paidOn: data.paidOn,
        notes: data.notes || null
      });
      fetchDetails();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.details || err?.message || 'Failed to save transaction.';
      console.error('Transaction error:', err?.response?.data || err);
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
        date: data.date
      });
      fetchDetails();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.details || err?.message || 'Failed to save discount.';
      console.error('Discount error:', err?.response?.data || err);
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
        date: data.date
      });
      fetchDetails();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.details || err?.message || 'Failed to log refund.';
      console.error('Refund error:', err?.response?.data || err);
      toast.error(`Refund Error: ${msg}`);
    }
  };

  const handleSavePassenger = async (data: any) => {
    if (!bookingId) return;
    try {
      data.id ? await api.patch(`/bookings/${bookingId}/passengers/${data.id}`, data) : await api.post(`/bookings/${bookingId}/passengers`, data);
      fetchDetails();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to save passenger.';
      console.error('Passenger error:', err?.response?.data || err);
      toast.error(`Passenger Error: ${msg}`);
    }
  };

  const handleSaveFlight = async (data: any) => {
    if (!bookingId) return;
    try {
      data.id ? await api.patch(`/bookings/${bookingId}/flight-services/${data.id}`, data) : await api.post(`/bookings/${bookingId}/flight-services`, data);
      fetchDetails();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to save flight.';
      console.error('Flight error:', err?.response?.data || err);
      toast.error(`Flight Error: ${msg}`);
    }
  };

  const handleSaveAccommodation = async (data: any) => {
    if (!bookingId) return;
    try {
      data.id ? await api.patch(`/bookings/${bookingId}/accommodations/${data.id}`, data) : await api.post(`/bookings/${bookingId}/accommodations`, data);
      fetchDetails();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to save accommodation.';
      console.error('Hotel error:', err?.response?.data || err);
      toast.error(`Hotel Error: ${msg}`);
    }
  };

  const handleSaveTransport = async (data: any) => {
    if (!bookingId) return;
    try {
      data.id ? await api.patch(`/bookings/${bookingId}/transport-services/${data.id}`, data) : await api.post(`/bookings/${bookingId}/transport-services`, data);
      fetchDetails();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to save transport.';
      console.error('Transport error:', err?.response?.data || err);
      toast.error(`Transport Error: ${msg}`);
    }
  };

  const handleSaveVisa = async (data: any) => {
    if (!bookingId) return;
    try {
      data.id ? await api.patch(`/bookings/${bookingId}/visa-services/${data.id}`, data) : await api.post(`/bookings/${bookingId}/visa-services`, data);
      fetchDetails();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to save visa.';
      console.error('Visa error:', err?.response?.data || err);
      toast.error(`Visa Error: ${msg}`);
    }
  };

  const handleSaveAdditionalService = async (data: any) => {
    if (!bookingId) return;
    try {
      data.id ? await api.patch(`/bookings/${bookingId}/additional-services/${data.id}`, data) : await api.post(`/bookings/${bookingId}/additional-services`, data);
      fetchDetails();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to save additional service.';
      console.error('Additional service error:', err?.response?.data || err);
      toast.error(`Service Error: ${msg}`);
    }
  };

  const handleUpdateCoreField = async (field: string, value: string) => {
    if (!bookingId) return;
    try {
      await api.patch(`/bookings/${bookingId}`, {
        [field]: value
      });
      fetchDetails();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || `Failed to update ${field}.`;
      console.error(`Update ${field} error:`, err?.response?.data || err);
      toast.error(`Update Error: ${msg}`);
    }
  };

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchDetails();
    } else {
      setBooking(null);
    }
  }, [isOpen, bookingId]);

  if (!isOpen) return null;

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
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full max-w-[95vw] xl:max-w-7xl h-[96vh] bg-slate-50 shadow-2xl flex flex-col z-10 rounded-2xl overflow-hidden"
      >
        {/* Premium Header */}
        <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-8 py-6 flex justify-between items-center shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-20 w-40 h-40 bg-indigo-500/20 rounded-full blur-2xl -mb-10"></div>
          
          <div className="relative z-10 flex flex-col">
            <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
              Booking Workspace 
              {booking && (
                <span className="bg-white/20 px-3 py-1 rounded-lg text-sm font-mono tracking-widest backdrop-blur-md border border-white/20">
                  {booking.bookingReference}
                </span>
              )}
            </h2>
            <p className="text-indigo-200 text-xs mt-1 font-medium">Complete overview and administration</p>
          </div>
          <div className="relative z-10 flex items-center gap-4">
            {booking && (
              <button 
                onClick={handleGenerateInvoice} 
                disabled={isGeneratingPDF}
                className="flex items-center gap-2 bg-indigo-500/30 hover:bg-indigo-500/50 text-white px-4 py-2 rounded-xl text-[11px] font-bold transition-all uppercase tracking-wide border border-indigo-400/30 shadow-lg"
              >
                {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {isGeneratingPDF ? 'Generating...' : 'Generate Invoice'}
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white">
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
              <p className="text-slate-500 font-semibold text-sm">Loading workspace data...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 flex flex-col items-center text-center">
              <X className="w-10 h-10 mb-2" />
              <p className="font-bold">{error}</p>
            </div>
          ) : booking ? (
            <div className="relative z-10 max-w-6xl mx-auto space-y-4">
              
              <AccordionSection 
                title="Financial Dashboard & Ledger" 
                icon={<Calculator className="w-4 h-4" />}
                isOpen={openSections.includes('summary')} 
                onToggle={() => toggleSection('summary')}
                action={
                  <div className="flex gap-2">
                    <button onClick={() => setShowLogRefund(true)} className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-md transition-all uppercase tracking-wide">
                      <RefreshCcw className="w-3 h-3" /> Refund
                    </button>
                    <button onClick={() => setShowAddDiscount(true)} className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-md transition-all uppercase tracking-wide">
                      <Plus className="w-3 h-3" /> Discount
                    </button>
                    <button onClick={() => setShowLogTransaction(true)} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-md transition-all uppercase tracking-wide">
                      <Plus className="w-3 h-3" /> Log Transaction
                    </button>
                  </div>
                }
              >
                <div className="space-y-4">
                  <SummaryLedgerSection booking={booking || undefined} onUpdate={handleUpdateCoreField} />
                  <TransactionsSection booking={booking || undefined} onAddDiscount={() => setShowAddDiscount(true)} onLogRefund={() => setShowLogRefund(true)} />
                </div>
              </AccordionSection>

              <AccordionSection 
                title="Passengers" 
                icon={<Users className="w-4 h-4" />}
                isOpen={openSections.includes('passengers')} 
                onToggle={() => toggleSection('passengers')}
                action={
                  <button onClick={() => setShowAddPassenger(true)} className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-md transition-all uppercase tracking-wide">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                }
              >
                <PassengersSection passengers={booking.customers} onAdd={() => setShowAddPassenger(true)} onEdit={(p) => setEditingPassenger(p)} onDelete={(s: any) => handleDeleteService('passenger', s.id)} />
              </AccordionSection>

              <AccordionSection 
                title="Flight Services" 
                icon={<Plane className="w-4 h-4" />}
                isOpen={openSections.includes('flights')} 
                onToggle={() => toggleSection('flights')}
                action={
                  <button onClick={() => setShowAddFlight(true)} className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-md transition-all uppercase tracking-wide">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                }
              >
                <FlightServicesSection flights={booking.flightServices} onEdit={setEditingFlight} onAdd={() => setShowAddFlight(true)} />
              </AccordionSection>

              <AccordionSection 
                title="Accommodations & Stays" 
                icon={<Hotel className="w-4 h-4" />}
                isOpen={openSections.includes('stays')} 
                onToggle={() => toggleSection('stays')}
                action={
                  <button onClick={() => setShowAddHotel(true)} className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-md transition-all uppercase tracking-wide">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                }
              >
                <StaysSection stays={booking.accommodations} onAdd={() => setShowAddHotel(true)} onDelete={(s: any) => handleDeleteService('accommodation', s.id)} />
              </AccordionSection>

              <AccordionSection 
                title="Transport Services" 
                icon={<Car className="w-4 h-4" />}
                isOpen={openSections.includes('transport')} 
                onToggle={() => toggleSection('transport')}
                action={
                  <button onClick={() => setShowAddTransport(true)} className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-md transition-all uppercase tracking-wide">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                }
              >
                <TransportServicesSection transports={booking.transportServices} onEdit={setEditingTransport} onAdd={() => setShowAddTransport(true)} />
              </AccordionSection>

              <AccordionSection 
                title="Visa Services" 
                icon={<FileText className="w-4 h-4" />}
                isOpen={openSections.includes('visas')} 
                onToggle={() => toggleSection('visas')}
                action={
                  <button onClick={() => setShowAddVisa(true)} className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-md transition-all uppercase tracking-wide">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                }
              >
                <VisaServicesSection visas={booking.visaServices} onEdit={setEditingVisa} onAdd={() => setShowAddVisa(true)} />
              </AccordionSection>

              <AccordionSection 
                title="Additional Services" 
                icon={<Plus className="w-4 h-4" />}
                isOpen={openSections.includes('additional')} 
                onToggle={() => toggleSection('additional')}
                action={
                  <button onClick={() => setShowAddAdditionalService(true)} className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-md transition-all uppercase tracking-wide">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                }
              >
                <AdditionalServicesSection services={booking.additionalServices} onEdit={setEditingAdditionalService} onAdd={() => setShowAddAdditionalService(true)} onDelete={(s: any) => handleDeleteService('additional', s.id)} />
              </AccordionSection>

            </div>
          ) : null}
        </div>
      </motion.div>

      {/* Nested Popup Modals - Rendered at z-[70] internally */}
      <AnimatePresence>
        {(showAddPassenger || !!editingPassenger) && (
          <AddPassengerModal 
            isOpen={showAddPassenger || !!editingPassenger} 
            onClose={() => { setShowAddPassenger(false); setEditingPassenger(null); }} 
            onSubmit={handleSavePassenger}
            initialData={editingPassenger}
          />
        )}
        {(showAddFlight || !!editingFlight) && (
          <AddFlightModal 
            isOpen={showAddFlight || !!editingFlight} 
            onClose={() => { setShowAddFlight(false); setEditingFlight(null); }} 
            onSubmit={handleSaveFlight}
            initialData={editingFlight}
          />
        )}
        {(showAddHotel || !!editingAccommodation) && (
          <AddAccommodationModal 
            isOpen={showAddHotel || !!editingAccommodation} 
            onClose={() => { setShowAddHotel(false); setEditingAccommodation(null); }} 
            onSubmit={handleSaveAccommodation}
            initialData={editingAccommodation}
          />
        )}
        {(showAddTransport || !!editingTransport) && (
          <AddTransportModal 
            isOpen={showAddTransport || !!editingTransport} 
            onClose={() => { setShowAddTransport(false); setEditingTransport(null); }} 
            onSubmit={handleSaveTransport}
            flights={booking?.flightServices || []}
            initialData={editingTransport}
          />
        )}
        {(showAddVisa || !!editingVisa) && (
          <AddVisaModal 
            isOpen={showAddVisa || !!editingVisa} 
            onClose={() => { setShowAddVisa(false); setEditingVisa(null); }} 
            onSubmit={handleSaveVisa}
            initialData={editingVisa}
          />
        )}
        {(showAddAdditionalService || !!editingAdditionalService) && (
          <AddAdditionalServiceModal 
            isOpen={showAddAdditionalService || !!editingAdditionalService} 
            onClose={() => { setShowAddAdditionalService(false); setEditingAdditionalService(null); }} 
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

      {/* Hidden Invoice Template for PDF Generation */}
      {booking && <InvoiceTemplate booking={booking!} />}

    </div>
  );
}
