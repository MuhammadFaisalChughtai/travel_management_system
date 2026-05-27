interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading data..." }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 w-full">
      <div className="w-10 h-10 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin mb-4" />
      <p className="text-slate-500 font-medium">{message}</p>
    </div>
  );
}
