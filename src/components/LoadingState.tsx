import { Loader2 } from 'lucide-react';

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-gray-500 dark:text-gray-400">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
