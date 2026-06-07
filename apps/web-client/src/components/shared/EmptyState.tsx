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
      whileHover={{ y: -3 }}
      className={`relative flex flex-col items-center justify-center text-center w-full mx-auto overflow-hidden transition-all duration-300 ${
        transparent 
          ? 'bg-transparent' 
          : 'bg-white/80 backdrop-blur-md rounded-[3rem] border border-slate-100/90 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.02)] hover:shadow-[0_30px_70px_-10px_rgba(0,0,0,0.05)]'
      } ${isSm ? 'p-10 my-4 min-h-[320px]' : 'p-20 md:p-28 my-10 min-h-[540px]'}`}
    >
      
      {/* Decorative premium backdrop meshes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        {/* Soft glowing mesh circles */}
        <div className="absolute -top-1/4 -left-1/4 w-[70%] h-[70%] bg-gradient-to-tr from-primary-400/15 to-indigo-500/5 blur-[140px] rounded-full"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-[70%] h-[70%] bg-gradient-to-tr from-violet-400/15 to-primary-500/5 blur-[140px] rounded-full"></div>
        
        {/* Abstract vector grid pattern with radial fade */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04] stroke-slate-900" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
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
        <div className="relative mb-10 flex items-center justify-center">
          
          {/* Pulsing deep aura behind the icon */}
          <div className={`absolute rounded-full bg-gradient-to-tr from-primary-500/15 to-indigo-500/10 blur-3xl animate-pulse ${
            isSm ? 'w-36 h-36' : 'w-48 h-48'
          }`}></div>
          
          {/* Rotating particle rings */}
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
            className={`absolute border border-dashed border-primary-200/50 rounded-full ${
              isSm ? 'w-32 h-32' : 'w-44 h-44'
            }`}
          ></motion.div>
          <motion.div 
            animate={{ rotate: -360 }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            className={`absolute border border-dashed border-indigo-200/40 rounded-full ${
              isSm ? 'w-28 h-28' : 'w-36 h-36'
            }`}
          ></motion.div>

          {/* Floating small stars / sparkles */}
          <motion.span 
            animate={{ y: [0, -8, 0], scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            className={`absolute text-primary-400 font-bold ${
              isSm ? '-top-2 -right-1 text-base' : '-top-4 -right-4 text-xl'
            }`}
          >
            ✦
          </motion.span>
          <motion.span 
            animate={{ y: [0, 8, 0], scale: [1, 1.1, 1], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
            className={`absolute text-indigo-400 font-bold ${
              isSm ? '-bottom-1 -left-2 text-xs' : '-bottom-3 -left-5 text-base'
            }`}
          >
            ✦
          </motion.span>

          {/* Core premium container */}
          <div className={`relative flex items-center justify-center rounded-[2.2rem] bg-gradient-to-b from-white to-slate-50 border border-slate-200/80 shadow-[0_16px_36px_rgba(0,0,0,0.05)] ${
            isSm ? 'w-24 h-24' : 'w-32 h-32'
          }`}>
            {/* Glossy overlay */}
            <div className="absolute inset-[1px] rounded-[2rem] bg-gradient-to-tr from-white/0 via-white/50 to-white/90 pointer-events-none"></div>
            
            {/* The Icon */}
            <Icon className={`${isSm ? 'w-10 h-10' : 'w-14 h-14'} text-primary-500 relative z-10 drop-shadow-[0_2px_6px_rgba(99,102,241,0.15)]`} />
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 12 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5, delay: 0.15 }}
          className="flex flex-col items-center"
        >
          <h3 className={`${isSm ? 'text-xl' : 'text-2xl sm:text-3xl'} font-black text-slate-800 tracking-tight mb-4`}>
            {title}
          </h3>
          <p className={`text-slate-500 font-semibold leading-relaxed max-w-md mb-10 ${
            isSm ? 'text-[13px] px-2' : 'text-[14px] sm:text-[15px]'
          }`}>
            {description}
          </p>
          
          {action && (
            <motion.div 
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="relative mt-2"
            >
              {action}
            </motion.div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
