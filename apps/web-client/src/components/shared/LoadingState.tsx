import { motion } from 'framer-motion';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'default';
  transparent?: boolean;
}

export function LoadingState({ message = "Loading data...", size = 'default', transparent = false }: LoadingStateProps) {
  const isSm = size === 'sm';
  return (
    <div className={`relative flex flex-col items-center justify-center text-center w-full mx-auto overflow-hidden ${
      transparent 
        ? '' 
        : 'bg-white rounded-[2rem] border border-slate-100 shadow-sm'
    } ${isSm ? 'p-8 my-4 min-h-[300px]' : 'p-16 my-8 min-h-[400px]'}`}>
      
      {/* Premium subtle background accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none overflow-hidden rounded-[2rem] z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary-500/5 blur-[100px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/5 blur-[100px] rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(248,250,252,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(248,250,252,0.5)_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_20%,transparent_100%)] opacity-50"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Glowing Spinner Wrapper */}
        <div className={`relative flex items-center justify-center rounded-full bg-gradient-to-b from-white to-slate-50 border border-slate-100 shadow-xl shadow-slate-200/50 mb-6 ${
          isSm ? 'w-16 h-16' : 'w-24 h-24'
        }`}>
          <div className="absolute inset-0 rounded-full bg-primary-500/10 blur-xl opacity-50 animate-pulse"></div>
          <div className={`${isSm ? 'w-6 h-6 border-2' : 'w-10 h-10 border-4'} border-primary-500/20 border-t-primary-500 rounded-full animate-spin relative z-10`} />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 5 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center"
        >
          <h3 className={`${isSm ? 'text-lg' : 'text-xl'} font-black text-slate-800 tracking-tight mb-2`}>{message}</h3>
          <p className="text-slate-400 font-medium text-[13px] max-w-xs">Please wait a moment while we retrieve your information.</p>
        </motion.div>
      </div>
    </div>
  );
}
