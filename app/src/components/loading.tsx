import { LOADING_MESSAGES } from "@/constants";

interface LoadingProps {
  message?: string;
}

export const Loading = ({
  message = LOADING_MESSAGES.CHART_DATA,
}: LoadingProps) => {
  return (
    <div className="flex items-center justify-center h-svh py-24">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto"></div>
        <p className="text-muted-foreground font-medium">{message}</p>
      </div>
    </div>
  );
};
