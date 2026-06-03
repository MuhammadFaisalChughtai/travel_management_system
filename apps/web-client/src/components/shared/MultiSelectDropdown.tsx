import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  id: string | number;
  label: string;
}

interface MultiSelectDropdownProps {
  options: Option[];
  selectedIds: (string | number)[];
  onChange: (selectedIds: (string | number)[]) => void;
  placeholder?: string;
  label: string;
}

export function MultiSelectDropdown({ options, selectedIds, onChange, placeholder = 'Select...', label }: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (id: string | number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectedCount = selectedIds.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-white border ${isOpen ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-slate-200'} rounded-xl px-4 py-2.5 flex items-center justify-between cursor-pointer transition-all`}
      >
        <span className={`text-[13px] truncate ${selectedCount === 0 ? 'text-slate-400' : 'text-slate-800 font-medium'}`}>
          {selectedCount === 0 
            ? placeholder 
            : selectedCount === 1 
              ? options.find(o => o.id === selectedIds[0])?.label 
              : `${selectedCount} selected`}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="p-3 text-center text-[12px] text-slate-500">No options available</div>
          ) : (
            options.map(option => {
              const isSelected = selectedIds.includes(option.id);
              return (
                <div 
                  key={option.id}
                  onClick={() => toggleOption(option.id)}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className={`text-[13px] flex-1 truncate ${isSelected ? 'font-bold text-indigo-900' : 'text-slate-700'}`}>
                    {option.label}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
