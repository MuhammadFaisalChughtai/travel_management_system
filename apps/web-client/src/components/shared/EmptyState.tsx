import { ReactNode, ElementType } from 'react';

interface EmptyStateProps {
  icon: ElementType;
  title: string;
  description: string;
  action?: ReactNode;
  size?: 'sm' | 'default';
}

export function EmptyState({ icon: Icon, title, description, action, size = 'default' }: EmptyStateProps) {
  const isSm = size === 'sm';
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 text-center shadow-sm w-full mx-auto ${isSm ? 'p-6 max-w-lg my-4' : 'p-12 max-w-3xl my-8'}`}>
      <Icon className={`${isSm ? 'w-8 h-8 mb-3' : 'w-12 h-12 mb-4'} text-slate-300 mx-auto`} />
      <h3 className={`${isSm ? 'text-base' : 'text-lg'} font-bold text-slate-800`}>{title}</h3>
      <p className={`text-slate-500 ${isSm ? 'text-xs mt-1 mb-4' : 'text-sm mt-1 mb-6'}`}>{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
