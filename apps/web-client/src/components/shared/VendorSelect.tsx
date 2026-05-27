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

  const [isOther, setIsOther] = useState(false);

  useEffect(() => {
    // If we have a value that is not in the list (after loading is done), it's a custom value
    if (!loading && value && !vendors.find(v => v.name === value)) {
      setIsOther(true);
    }
  }, [loading, value, vendors]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__OTHER__') {
      setIsOther(true);
      onChange('');
    } else {
      setIsOther(false);
      onChange(val);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <select
        value={isOther ? '__OTHER__' : value}
        onChange={handleSelectChange}
        className={className || "w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"}
        disabled={loading}
      >
        <option value="" disabled>{loading ? 'Loading vendors...' : placeholder}</option>
        {vendors.map((v) => (
          <option key={v.id} value={v.name}>
            {v.name}
          </option>
        ))}
        <option value="__OTHER__">Other (Manual Entry)</option>
      </select>
      
      {isOther && (
        <input 
          type="text" 
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          placeholder="Type vendor name..." 
          className={className || "w-full border border-slate-200 bg-white/70 rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-semibold text-slate-700"}
          autoFocus
        />
      )}
    </div>
  );
}
