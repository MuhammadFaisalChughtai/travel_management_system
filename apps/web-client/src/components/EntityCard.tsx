import { Phone, Mail } from 'lucide-react';

export interface EntityCardProps {
  name: string;
  badge?: string;
  phone?: string | null;
  email?: string | null;
  balance?: number;
  currencySymbol?: string;
  onClick?: () => void;
  customFooter?: React.ReactNode;
}

export function EntityCard({
  name,
  badge,
  phone,
  email,
  balance,
  currencySymbol = '£',
  onClick,
  customFooter
}: EntityCardProps) {
  const initial = name ? name.charAt(0).toUpperCase() : '?';

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden bg-white border border-slate-200 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-all duration-300 group ${onClick ? 'cursor-pointer hover:border-primary-300 hover:shadow-md' : ''}`}
    >
      <div className="absolute right-0 top-0 w-24 h-24 bg-primary-50 rounded-bl-full z-0 opacity-50 group-hover:scale-110 transition-transform duration-500" />
      
      <div className="relative z-10 flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-[#E6F3FF] text-[#0273B9] flex items-center justify-center font-black text-xl shrink-0">
          {initial}
        </div>
        <div className="flex flex-col justify-center min-h-[48px]">
          <h3 className="font-bold text-[#0A1A2A] text-[17px] leading-tight mb-1">
            {name}
          </h3>
          {badge && (
            <div className="flex">
              <span className="bg-[#F1F5F9] text-[#475569] text-[10px] font-bold uppercase px-2 py-0.5 rounded shadow-sm">
                {badge}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 space-y-2 mb-4">
        {phone ? (
          <div className="flex items-center gap-2.5 text-[#334155] text-[13px] font-medium">
            <Phone className="w-3.5 h-3.5 text-[#64748B]" />
            <span className="truncate">{phone}</span>
          </div>
        ) : null}
        {email ? (
          <div className="flex items-center gap-2.5 text-[#334155] text-[13px] font-medium">
            <Mail className="w-3.5 h-3.5 text-[#64748B]" />
            <span className="truncate">{email}</span>
          </div>
        ) : null}
      </div>

      {(balance !== undefined) && (
        <div className="relative z-10">
          <hr className="border-t border-slate-100 my-4" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
              BALANCE
            </span>
            <span className="text-[#059669] font-bold text-[16px]">
              {currencySymbol}{balance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      {customFooter && (
        <div className="relative z-10">
          <hr className="border-t border-slate-100 my-4" />
          {customFooter}
        </div>
      )}
    </div>
  );
}
