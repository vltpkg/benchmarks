import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Loading } from "@/components/loading";
import { ErrorDisplay } from "@/components/error";
import { ErrorBoundary } from "@/components/error-boundary";
import { useChartData } from "@/hooks/use-chart-data";
import { sortVariations } from "@/lib/utils";

const App = () => {
  const { chartData, loading, error } = useChartData();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (chartData && location.pathname === "/") {
      const sortedVariations = sortVariations([...chartData.chartData.variations]);
      const firstVariation = sortedVariations[0];
      navigate(`/${firstVariation}`, { replace: true });
    }
  }, [chartData, location.pathname, navigate]);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <div className="min-h-screen gradient-bg">
          <Header chartData={chartData} />

          <main className="max-w-7xl mx-auto px-6 py-12">
            {loading && <Loading />}
            {error && <ErrorDisplay message={error} />}
            {chartData && <Outlet context={{ chartData }} />}
          </main>
          <Footer />
        </div>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
