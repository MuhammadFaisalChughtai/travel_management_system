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
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className={`relative flex flex-col items-center justify-center text-center w-full mx-auto overflow-hidden transition-all duration-300 ${
        transparent 
          ? 'bg-transparent' 
          : 'bg-white/80 backdrop-blur-md rounded-[2.5rem] border border-slate-100 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)]'
      } ${isSm ? 'p-8 my-4 min-h-[300px]' : 'p-16 my-8 min-h-[440px]'}`}
    >
      
      {/* Decorative premium backdrop meshes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        {/* Soft glowing mesh circles */}
        <div className="absolute -top-1/4 -left-1/4 w-[60%] h-[60%] bg-gradient-to-tr from-primary-400/10 to-indigo-500/5 blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-[60%] h-[60%] bg-gradient-to-tr from-violet-400/10 to-primary-500/5 blur-[120px] rounded-full"></div>
        
        {/* Abstract vector grid pattern with radial fade */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03] stroke-slate-900" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
          <defs>
            <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" strokeWidth="1"/>
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

      <div className="relative z-10 flex flex-col items-center max-w-md">
        {/* Layered illustration container */}
        <div className="relative mb-8 flex items-center justify-center">
          
          {/* Pulsing deep aura behind the icon */}
          <div className="absolute w-28 h-28 rounded-full bg-gradient-to-tr from-primary-500/10 to-indigo-500/10 blur-2xl animate-pulse"></div>
          
          {/* Rotating particle rings */}
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="absolute w-28 h-28 border border-dashed border-primary-200/40 rounded-full"
          ></motion.div>
          <motion.div 
            animate={{ rotate: -360 }}
            transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
            className="absolute w-24 h-24 border border-dashed border-indigo-200/30 rounded-full"
          ></motion.div>

          {/* Floating small stars / sparkles */}
          <motion.span 
            animate={{ y: [0, -6, 0], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-3 -right-2 text-primary-400 text-lg font-bold"
          >
            ✦
          </motion.span>
          <motion.span 
            animate={{ y: [0, 6, 0], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="absolute -bottom-2 -left-3 text-indigo-400 text-sm font-bold"
          >
            ✦
          </motion.span>

          {/* Core premium container */}
          <div className={`relative flex items-center justify-center rounded-3xl bg-gradient-to-b from-white to-slate-50 border border-slate-200/80 shadow-[0_12px_30px_rgba(0,0,0,0.04)] ${
            isSm ? 'w-20 h-20' : 'w-24 h-24'
          }`}>
            {/* Glossy overlay */}
            <div className="absolute inset-[1px] rounded-[1.4rem] bg-gradient-to-tr from-white/0 via-white/50 to-white/90 pointer-events-none"></div>
            
            {/* The Icon */}
            <Icon className={`${isSm ? 'w-8 h-8' : 'w-10 h-10'} text-primary-500 relative z-10 drop-shadow-[0_2px_4px_rgba(99,102,241,0.1)]`} />
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col items-center"
        >
          <h3 className={`${isSm ? 'text-lg' : 'text-xl'} font-black text-slate-800 tracking-tight mb-2.5`}>
            {title}
          </h3>
          <p className="text-slate-500 font-medium text-[13px] leading-relaxed max-w-sm mb-8">
            {description}
          </p>
          
          {action && (
            <motion.div 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
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
