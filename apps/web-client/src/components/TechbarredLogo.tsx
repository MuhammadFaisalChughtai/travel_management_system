

export function TechbarredLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1 opacity-70 hover:opacity-100 transition-opacity ${className}`}>
      <span className="text-[9px] uppercase tracking-[0.2em] text-slate-400 font-bold">Designed & Developed by</span>
      <div className="flex items-center scale-110 mt-1">
        <span className="text-lg font-extrabold tracking-tight" style={{ color: '#0a1d37', fontFamily: 'Montserrat, system-ui, sans-serif' }}>tech</span>
        <span className="text-lg font-normal tracking-tight flex items-center" style={{ color: '#0a1d37', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          <span className="w-px h-5 bg-[#0a1d37] opacity-60 mx-0.5"></span>b
          <span className="w-px h-5 bg-[#0a1d37] opacity-60 mx-0.5"></span>a
          <span className="w-px h-5 bg-[#0a1d37] opacity-60 mx-0.5"></span>r
          <span className="w-px h-5 bg-[#0a1d37] opacity-60 mx-0.5"></span>r
          <span className="w-px h-5 bg-[#0a1d37] opacity-60 mx-0.5"></span>e
          <span className="w-px h-5 bg-[#0a1d37] opacity-60 mx-0.5"></span>d
          <span className="w-px h-5 bg-[#0a1d37] opacity-60 mx-0.5"></span>
        </span>
      </div>
    </div>
  );
}
