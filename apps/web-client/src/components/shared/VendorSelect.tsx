import { useEffect, useState } from 'react';
import { api } from '../../api/axios';

interface Vendor {
  id: string | number;
  name: string;
}

interface VendorSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  category?: string; // Optional: To filter vendors by category if the API supports it
}

export function VendorSelect({ value, onChange, className, placeholder = 'Select a vendor...', category }: VendorSelectProps) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const query = category ? `?category=${category}` : '';
        const res = await api.get(`/vendors${query}`);
        
        // Handle different possible response structures
        if (Array.isArray(res.data)) {
          setVendors(res.data);
        } else if (res.data.vendors && Array.isArray(res.data.vendors)) {
          setVendors(res.data.vendors);
        } else if (res.data.data && Array.isArray(res.data.data)) {
          setVendors(res.data.data);
        } else {
          // Fallback if API response is not an array
          setVendors([]);
        }
      } catch (err) {
        console.error('Failed to fetch vendors:', err);
        // Fallback or leave empty
        setVendors([]);
      } finally {
        setLoading(false);
      }
    };

    fetchVendors();
  }, [category]);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className || "w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"}
      disabled={loading}
    >
      <option value="" disabled>{loading ? 'Loading vendors...' : placeholder}</option>
      {vendors.map((v) => (
        <option key={v.id} value={v.name}>
          {v.name}
        </option>
      ))}
      {/* If a value is selected but not in the list (e.g., historical data), we still want to show it */}
      {value && !vendors.find(v => v.name === value) && !loading && (
        <option value={value}>{value} (Legacy/Custom)</option>
      )}
    </select>
  );
}
