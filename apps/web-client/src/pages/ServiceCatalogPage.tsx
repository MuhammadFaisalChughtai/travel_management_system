import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Tag, ServerCrash, X, Plane } from 'lucide-react';
import { api as axios } from '../api/axios';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { VendorSelect } from '../components/shared/VendorSelect';
import { EmptyState } from '../components/shared/EmptyState';
import { LoadingState } from '../components/shared/LoadingState';
import { Pagination } from '../components/shared/Pagination';

interface CatalogItem {
  id: number;
  serviceType: string;
  name: string;
  unitPrice: number;
  currency: string;
  metadata: any;
  isActive: boolean;
}

export function ServiceCatalogPage() {
  const { user } = useAuthStore();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);

  const [form, setForm] = useState<Partial<CatalogItem>>({
    serviceType: 'VISA',
    name: '',
    unitPrice: 0,
    currency: 'GBP',
    metadata: { 
      vendorName: '', 
      vehicles: [
        { type: 'CAR (Saloon)', capacity: 3, price: '' },
        { type: 'H1', capacity: 7, price: '' },
        { type: 'GMC', capacity: 7, price: '' },
        { type: 'HIACE', capacity: 10, price: '' },
        { type: 'COASTER', capacity: 20, price: '' },
        { type: 'BUS', capacity: 49, price: '' }
      ]
    }
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', itemsPerPage.toString());

      const res = await axios.get(`/catalog?${params.toString()}`);
      setItems(res.data.items || res.data.catalog || (Array.isArray(res.data) ? res.data : []));
      setTotalItems(res.data.total || (res.data.items ? res.data.items.length : (res.data.catalog ? res.data.catalog.length : res.data.length)));
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch catalog items.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role !== 'AGENT') {
      fetchCatalog();
    }
  }, [user, currentPage]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await axios.patch(`/catalog/${editingItem.id}`, form);
      } else {
        await axios.post('/catalog', form);
      }
      setIsModalOpen(false);
      setEditingItem(null);
      toast.success(editingItem ? 'Service updated successfully!' : 'Service created successfully!');
      fetchCatalog();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save catalog item.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    try {
      await axios.delete(`/catalog/${id}`);
      fetchCatalog();
      toast.success('Service deleted successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete item.');
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setForm({
      serviceType: 'VISA',
      name: '',
      unitPrice: 0,
      currency: 'GBP',
      metadata: { 
      vendorName: '', 
      vehicles: [
        { type: 'CAR (Saloon)', capacity: 3, price: '' },
        { type: 'H1', capacity: 7, price: '' },
        { type: 'GMC', capacity: 7, price: '' },
        { type: 'HIACE', capacity: 10, price: '' },
        { type: 'COASTER', capacity: 20, price: '' },
        { type: 'BUS', capacity: 49, price: '' }
      ]
    }
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: CatalogItem) => {
    setEditingItem(item);
    setForm({
      ...item,
      metadata: {
        ...item.metadata,
        vendorName: item.metadata?.vendorName || '',
        vehicles: Array.isArray(item.metadata?.vehicles) ? item.metadata.vehicles : (item.metadata?.vehicles ? Object.keys(item.metadata.vehicles).map(k => ({ type: k, capacity: 4, price: item.metadata!.vehicles[k] })) : [
          { type: 'CAR (Saloon)', capacity: 3, price: '' },
          { type: 'H1', capacity: 7, price: '' },
          { type: 'GMC', capacity: 7, price: '' },
          { type: 'HIACE', capacity: 10, price: '' },
          { type: 'COASTER', capacity: 20, price: '' },
          { type: 'BUS', capacity: 49, price: '' }
        ]),
        hotelRooms: Array.isArray(item.metadata?.hotelRooms) ? item.metadata.hotelRooms : [
          { roomName: 'Standard', fromDate: '', toDate: '', dbl: '', trp: '', quad: '', meals: 'Room Only', iftar: '', sehor: '' }
        ]
      }
    });
    setIsModalOpen(true);
  };

  if (user?.role === 'AGENT') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <ServerCrash className="w-16 h-16 mb-4 text-slate-300" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p>You do not have permission to view the Service Catalog.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Service Catalog</h1>
            <p className="text-slate-500 font-semibold mt-1">Manage fixed-price templates for standard services.</p>
          </div>
          <button onClick={openAddModal} className="bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Service
          </button>
        </div>

        {loading ? (
          <LoadingState message="Loading catalog..." />
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-600 rounded-xl font-bold">{error}</div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <EmptyState
              icon={Tag}
              title="No services found"
              description="No services defined yet."
              size="sm"
              transparent={true}
            />
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-extrabold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Service Name</th>
                    <th className="px-6 py-4 text-right">Fixed Price</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {items.map((item, index) => (
                    <tr key={item.id || `item-${index}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-[10px] font-black tracking-wide uppercase">
                          {item.serviceType}
                        </span>
                      </td>
                      <td className="px-6 py-4">{item.name}</td>
                      <td className="px-6 py-4 text-right text-emerald-600 font-black">
                        {item.currency} {Number(item.unitPrice).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEditModal(item)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {items.length > 0 && (
              <Pagination 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                itemsPerPage={itemsPerPage}
                totalItems={totalItems}
              />
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] relative z-10 overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-primary-900 to-indigo-900 text-white px-6 py-4 flex justify-between items-center shadow-inner">
              <div className="flex items-center gap-3">
                <Tag className="h-5 w-5 text-indigo-300" />
                <h3 className="font-bold text-[14px] tracking-wide uppercase">{editingItem ? 'Edit' : 'Add'} Service</h3>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-white/60 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Service Type</label>
                <select disabled={!!editingItem} value={form.serviceType} onChange={e => setForm({...form, serviceType: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[12px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700 disabled:opacity-60 disabled:cursor-not-allowed">
                  <option value="VISA">Visa</option>
                  <option value="TRANSPORT">Transport</option>
                  <option value="HOTEL">Hotel</option>
                  <option value="FLIGHT">Flight</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Service Name</label>
                <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[12px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" placeholder="e.g. 5-Star Makkah Hotel, MOFA Umrah Visa" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Provider (Vendor)</label>
                <VendorSelect 
                  category={form.serviceType?.toLowerCase() || 'visa'} 
                  value={form.metadata?.vendorName || ''} 
                  onChange={val => setForm({...form, metadata: {...form.metadata, vendorName: val}})} 
                />
              </div>
              {form.serviceType?.toUpperCase() === 'TRANSPORT' ? (
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 mb-2">
                  <div className="flex justify-between mb-3">
                    <label className="block text-[10px] font-extrabold text-indigo-800 uppercase tracking-wide">Vehicle Pricing Matrix</label>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase">Currency</label>
                      <input type="text" required value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} className="w-16 border border-slate-200 bg-white rounded px-2 py-1 text-[10px] outline-none font-bold text-slate-700 uppercase" maxLength={3} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-12 gap-2 px-2">
                      <div className="col-span-5 text-[9px] font-bold text-slate-500 uppercase tracking-wide">Vehicle Type</div>
                      <div className="col-span-3 text-[9px] font-bold text-slate-500 uppercase tracking-wide">Max Pax</div>
                      <div className="col-span-3 text-[9px] font-bold text-slate-500 uppercase tracking-wide">Price</div>
                      <div className="col-span-1"></div>
                    </div>
                    {(form.metadata?.vehicles || []).map((v: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-5">
                          <input type="text" value={v.type} onChange={e => {
                            const newVehicles = [...(form.metadata?.vehicles || [])];
                            newVehicles[idx].type = e.target.value;
                            setForm({...form, metadata: {...form.metadata, vehicles: newVehicles}});
                          }} className="w-full border border-slate-200 bg-white rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 font-semibold text-slate-700" placeholder="e.g. CAR" />
                        </div>
                        <div className="col-span-3">
                          <input type="number" min="1" value={v.capacity || ''} onChange={e => {
                            const newVehicles = [...(form.metadata?.vehicles || [])];
                            newVehicles[idx].capacity = parseInt(e.target.value) || 1;
                            setForm({...form, metadata: {...form.metadata, vehicles: newVehicles}});
                          }} className="w-full border border-slate-200 bg-white rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 font-semibold text-slate-700" placeholder="Pax" />
                        </div>
                        <div className="col-span-3">
                          <input type="number" min="0" value={v.price || ''} onChange={e => {
                            const newVehicles = [...(form.metadata?.vehicles || [])];
                            newVehicles[idx].price = e.target.value;
                            setForm({...form, metadata: {...form.metadata, vehicles: newVehicles}});
                          }} className="w-full border border-slate-200 bg-white rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 font-semibold text-slate-700" placeholder="Price" />
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <button type="button" onClick={() => {
                            const newVehicles = (form.metadata?.vehicles || []).filter((_: any, i: number) => i !== idx);
                            setForm({...form, metadata: {...form.metadata, vehicles: newVehicles}});
                          }} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => {
                      const newVehicles = [...(form.metadata?.vehicles || []), { type: '', capacity: 4, price: '' }];
                      setForm({...form, metadata: {...form.metadata, vehicles: newVehicles}});
                    }} className="mt-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-white/50 w-fit px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-white transition-all">
                      <Plus className="w-3 h-3" /> Add Vehicle Type
                    </button>
                  </div>
                </div>
              ) : form.serviceType?.toUpperCase() === 'HOTEL' ? (
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 mb-2">
                  <div className="flex justify-between mb-3">
                    <label className="block text-[10px] font-extrabold text-indigo-800 uppercase tracking-wide flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-indigo-500" /> Hotel Pricing Matrix</label>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase">Currency</label>
                      <input type="text" required value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} className="w-16 border border-slate-200 bg-white rounded px-2 py-1 text-[10px] outline-none font-bold text-slate-700 uppercase" maxLength={3} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-[2fr_1.5fr_1.5fr_1fr_1fr_1fr_1.5fr_1fr_1fr_0.5fr] gap-1 px-1">
                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Category</div>
                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">From</div>
                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">To</div>
                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">DBL</div>
                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">TRP</div>
                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">QUAD</div>
                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Meals</div>
                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Iftar</div>
                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Sehor</div>
                      <div></div>
                    </div>
                    {(form.metadata?.hotelRooms || []).map((room: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-[2fr_1.5fr_1.5fr_1fr_1fr_1fr_1.5fr_1fr_1fr_0.5fr] gap-1 items-center">
                        <div>
                          <input type="text" value={room.roomName} onChange={e => {
                            const newRooms = [...(form.metadata?.hotelRooms || [])];
                            newRooms[idx].roomName = e.target.value;
                            setForm({...form, metadata: {...form.metadata, hotelRooms: newRooms}});
                          }} className="w-full border border-slate-200 bg-white rounded-md px-2 py-1.5 text-[11px] outline-none focus:border-primary-500 font-semibold text-slate-700" placeholder="e.g. Standard" />
                        </div>
                        <div>
                          <input type="date" value={room.fromDate || ''} onChange={e => {
                            const newRooms = [...(form.metadata?.hotelRooms || [])];
                            newRooms[idx].fromDate = e.target.value;
                            setForm({...form, metadata: {...form.metadata, hotelRooms: newRooms}});
                          }} className="w-full border border-slate-200 bg-white rounded-md px-1 py-1.5 text-[11px] outline-none focus:border-primary-500 font-semibold text-slate-700" />
                        </div>
                        <div>
                          <input type="date" value={room.toDate || ''} onChange={e => {
                            const newRooms = [...(form.metadata?.hotelRooms || [])];
                            newRooms[idx].toDate = e.target.value;
                            setForm({...form, metadata: {...form.metadata, hotelRooms: newRooms}});
                          }} className="w-full border border-slate-200 bg-white rounded-md px-1 py-1.5 text-[11px] outline-none focus:border-primary-500 font-semibold text-slate-700" />
                        </div>
                        <div>
                          <input type="number" min="0" value={room.dbl || ''} onChange={e => {
                            const newRooms = [...(form.metadata?.hotelRooms || [])];
                            newRooms[idx].dbl = e.target.value;
                            setForm({...form, metadata: {...form.metadata, hotelRooms: newRooms}});
                          }} className="w-full border border-slate-200 bg-white rounded-md px-1 py-1.5 text-[11px] outline-none focus:border-primary-500 font-semibold text-slate-700" placeholder="DBL" />
                        </div>
                        <div>
                          <input type="number" min="0" value={room.trp || ''} onChange={e => {
                            const newRooms = [...(form.metadata?.hotelRooms || [])];
                            newRooms[idx].trp = e.target.value;
                            setForm({...form, metadata: {...form.metadata, hotelRooms: newRooms}});
                          }} className="w-full border border-slate-200 bg-white rounded-md px-1 py-1.5 text-[11px] outline-none focus:border-primary-500 font-semibold text-slate-700" placeholder="TRP" />
                        </div>
                        <div>
                          <input type="number" min="0" value={room.quad || ''} onChange={e => {
                            const newRooms = [...(form.metadata?.hotelRooms || [])];
                            newRooms[idx].quad = e.target.value;
                            setForm({...form, metadata: {...form.metadata, hotelRooms: newRooms}});
                          }} className="w-full border border-slate-200 bg-white rounded-md px-1 py-1.5 text-[11px] outline-none focus:border-primary-500 font-semibold text-slate-700" placeholder="QUAD" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <select value={room.meals} onChange={e => {
                            const newRooms = [...(form.metadata?.hotelRooms || [])];
                            newRooms[idx].meals = e.target.value;
                            setForm({...form, metadata: {...form.metadata, hotelRooms: newRooms}});
                          }} className="w-full border border-slate-200 bg-white rounded-md px-1 py-1.5 text-[10px] outline-none focus:border-primary-500 font-semibold text-slate-700">
                            <option value="Room Only">Room Only</option>
                            <option value="BB">BB (Breakfast)</option>
                            <option value="HB">HB (Half Board)</option>
                            <option value="FB">FB (Full Board)</option>
                          </select>
                          {room.meals && room.meals !== 'Room Only' && (
                            <input type="number" min="0" value={room.mealPrice || ''} onChange={e => {
                              const newRooms = [...(form.metadata?.hotelRooms || [])];
                              newRooms[idx].mealPrice = e.target.value;
                              setForm({...form, metadata: {...form.metadata, hotelRooms: newRooms}});
                            }} className="w-full border border-emerald-200 bg-emerald-50 rounded-md px-1 py-1 text-[9px] outline-none focus:border-emerald-500 font-semibold text-emerald-700 placeholder:text-emerald-300" placeholder="Meal £" />
                          )}
                        </div>
                        <div>
                          <input type="number" min="0" value={room.iftar || ''} onChange={e => {
                            const newRooms = [...(form.metadata?.hotelRooms || [])];
                            newRooms[idx].iftar = e.target.value;
                            setForm({...form, metadata: {...form.metadata, hotelRooms: newRooms}});
                          }} className="w-full border border-slate-200 bg-white rounded-md px-1 py-1.5 text-[11px] outline-none focus:border-primary-500 font-semibold text-slate-700" placeholder="Iftar" />
                        </div>
                        <div>
                          <input type="number" min="0" value={room.sehor || ''} onChange={e => {
                            const newRooms = [...(form.metadata?.hotelRooms || [])];
                            newRooms[idx].sehor = e.target.value;
                            setForm({...form, metadata: {...form.metadata, hotelRooms: newRooms}});
                          }} className="w-full border border-slate-200 bg-white rounded-md px-1 py-1.5 text-[11px] outline-none focus:border-primary-500 font-semibold text-slate-700" placeholder="Sehor" />
                        </div>
                        <div className="flex justify-center">
                          <button type="button" onClick={() => {
                            const newRooms = (form.metadata?.hotelRooms || []).filter((_: any, i: number) => i !== idx);
                            setForm({...form, metadata: {...form.metadata, hotelRooms: newRooms}});
                          }} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => {
                      const newRooms = [...(form.metadata?.hotelRooms || []), { roomName: '', dbl: '', trp: '', quad: '', meals: 'Room Only', iftar: '', sehor: '' }];
                      setForm({...form, metadata: {...form.metadata, hotelRooms: newRooms}});
                    }} className="mt-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-white/50 w-fit px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-white transition-all">
                      <Plus className="w-3 h-3" /> Add Room Category
                    </button>
                  </div>
                </div>
              ) : form.serviceType?.toUpperCase() === 'FLIGHT' ? (
                <div className="bg-sky-50/50 p-4 rounded-xl border border-sky-100 mb-2">
                  <div className="flex justify-between mb-3">
                    <label className="block text-[10px] font-extrabold text-sky-800 uppercase tracking-wide flex items-center gap-1.5">
                      <Plane className="w-3.5 h-3.5 text-sky-500" /> Flight Block Details
                    </label>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Flight Segments / Itinerary (Raw PNR)</label>
                      <textarea rows={5} value={form.metadata?.flightItinerary || ''} onChange={e => setForm({...form, metadata: {...form.metadata, flightItinerary: e.target.value}})} className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-[11px] font-mono outline-none focus:border-sky-500 text-slate-700" placeholder="Paste GDS routing here...&#10;1  MS 780 G 18DEC LHRCAI HK30 2230 0510&#10;2  MS 695 G 19DEC CAIMED HK30 0655 0940" />
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-1">
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Total Seats</label>
                        <input type="number" min="1" value={form.metadata?.totalSeats || ''} onChange={e => setForm({...form, metadata: {...form.metadata, totalSeats: e.target.value}})} className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-[11px] outline-none focus:border-sky-500 font-semibold text-slate-700" placeholder="e.g. 30" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Price per Seat</label>
                        <input type="number" required min="0" step="0.01" value={form.unitPrice} onChange={e => setForm({...form, unitPrice: parseFloat(e.target.value)})} className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-[11px] outline-none focus:border-sky-500 font-semibold text-slate-700" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Currency</label>
                        <input type="text" required value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-[11px] outline-none focus:border-sky-500 font-semibold text-slate-700 uppercase" maxLength={3} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Unit Price</label>
                    <input type="number" required min="0" step="0.01" value={form.unitPrice} onChange={e => setForm({...form, unitPrice: parseFloat(e.target.value)})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[12px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Currency</label>
                    <input type="text" required value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} className="w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[12px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700 uppercase" maxLength={3} />
                  </div>
                </div>
              )}
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl text-[11px] font-bold text-slate-600 hover:bg-slate-200/50 transition-colors">Cancel</button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-[11px] font-bold shadow-md shadow-indigo-200 transition-all uppercase tracking-wide">Save Service</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
