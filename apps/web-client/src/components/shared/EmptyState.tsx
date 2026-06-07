import type { ReactNode, ElementType } from 'react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  icon: ElementType;
  title: string;
  description: string;
  action?: ReactNode;
  size?: 'sm' | 'default';
  transparent?: boolean;
}

export function EmptyState({ icon: Icon, title, description, action, size = 'default', transparent = false }: EmptyStateProps) {
  const isSm = size === 'sm';
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={`relative flex flex-col items-center justify-center text-center w-full mx-auto overflow-hidden ${
        transparent 
          ? 'bg-transparent border-none shadow-none' 
          : `bg-white/85 backdrop-blur-md border border-slate-100/90 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.02)] ${isSm ? 'rounded-2xl' : 'rounded-[3rem]'}`
      } ${isSm ? 'p-6 my-2 min-h-[160px]' : 'p-20 md:p-28 my-10 min-h-[540px]'}`}
    >
      
      {/* Decorative premium backdrop meshes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        {/* Soft glowing mesh circles */}
        <div className="absolute -top-1/4 -left-1/4 w-[70%] h-[70%] bg-gradient-to-tr from-primary-400/15 to-indigo-500/5 blur-[140px] rounded-full"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-[70%] h-[70%] bg-gradient-to-tr from-violet-400/15 to-primary-500/5 blur-[140px] rounded-full"></div>
        
        {/* Abstract vector grid pattern with radial fade */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03] stroke-slate-900" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
          <defs>
            <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" fill="none" strokeWidth="1"/>
            </pattern>
            <radialGradient id="fade" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
            <mask id="grid-mask">
              <rect width="100%" height="100%" fill="url(#fade)" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" mask="url(#grid-mask)" />
        </svg>
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-xl">
        {/* Layered illustration container */}
        <div className={`relative flex items-center justify-center ${isSm ? 'mb-3' : 'mb-10'}`}>
          
          {/* Deep aura behind the icon */}
          <div className={`absolute rounded-full bg-gradient-to-tr from-primary-500/10 to-indigo-500/5 blur-3xl ${
            isSm ? 'w-20 h-20' : 'w-48 h-48'
          }`}></div>
          
          {/* Static neat background ring */}
          <div className={`absolute border border-slate-100 rounded-full ${
            isSm ? 'w-14 h-14' : 'w-40 h-40'
          }`}></div>

          {/* Core premium container */}
          <div className={`relative flex items-center justify-center rounded-[1rem] bg-gradient-to-b from-white to-slate-50 border border-slate-200/80 shadow-[0_12px_28px_rgba(0,0,0,0.02)] ${
            isSm ? 'w-11 h-11' : 'w-32 h-32'
          }`}>
            {/* Glossy overlay */}
            <div className={`absolute inset-[1px] bg-gradient-to-tr from-white/0 via-white/50 to-white/90 pointer-events-none ${isSm ? 'rounded-[0.8rem]' : 'rounded-[2rem]'}`}></div>
            
            {/* The Icon */}
            <Icon className={`${isSm ? 'w-5 h-5' : 'w-14 h-14'} text-primary-500 relative z-10 drop-shadow-[0_2px_4px_rgba(99,102,241,0.1)]`} />
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col items-center"
        >
          <h3 className={`${isSm ? 'text-[13px] mb-1' : 'text-2xl sm:text-3xl mb-4'} font-black text-slate-800 tracking-tight`}>
            {title}
          </h3>
          <p className={`text-slate-500 font-semibold leading-relaxed max-w-md ${
            isSm ? 'text-[11px] px-2 mb-2' : 'text-[14px] sm:text-[15px] mb-10'
          }`}>
            {description}
          </p>
          
          {action && (
            <motion.div 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="relative mt-1"
            >
              {action}
            </motion.div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
