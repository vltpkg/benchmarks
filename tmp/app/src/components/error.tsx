interface ErrorDisplayProps {
  message: string;
}

export const ErrorDisplay = ({ message }: ErrorDisplayProps) => {
  return (
    <div className="bg-card card-shadow border border-destructive/20 text-destructive px-6 py-4 rounded-xl mb-8">
      <div className="flex items-start gap-3">
        <div className="w-5 h-5 rounded-full bg-destructive/10 flex items-center justify-center mt-0.5">
          <div className="w-2 h-2 rounded-full bg-destructive"></div>
        </div>
        <div>
          <span className="font-semibold">Error occurred</span>
          <p className="text-sm mt-1 opacity-90">{message}</p>
        </div>
      </div>
    </div>
  );
};
