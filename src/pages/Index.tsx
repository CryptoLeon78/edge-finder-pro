import { motion } from 'framer-motion';
import { Activity, BarChart3, Shield } from 'lucide-react';
import { FileUploader, StrategyList } from '@/components/FileUploader';
import { DatasetUploader } from '@/components/DatasetUploader';
import { DashboardSummary } from '@/components/Dashboard';
import { MetricsGrid } from '@/components/MetricsPanel';
import { MonteCarloChart, FitnessRadar, OOSComparison, StrategyComparisonScatter, EdgeDistribution } from '@/components/Charts';
import { StrategyDetails } from '@/components/StrategyDetails';
import { EquityCurveChart } from '@/components/EquityCurve';
import { TradesTable } from '@/components/TradesTable';
import { RandomnessPanel } from '@/components/RandomnessCharts';
import { StrategyComparisonTable } from '@/components/StrategyComparison';
import { DrawdownPanel } from '@/components/DrawdownAnalysis';
import { WalkForwardPanel } from '@/components/WalkForwardPanel';
import { CorrelationPanel } from '@/components/CorrelationAnalysis';
import { MonteCarloAdvancedPanel } from '@/components/MonteCarloAdvanced';
import { PDFExportButton } from '@/components/PDFExport';
import { AccessBanner, useAccessCheck } from '@/components/AccessGate';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAppStore } from '@/lib/store';

const Index = () => {
  const { strategies } = useAppStore();
  const hasStrategies = strategies.length > 0;
  const access = useAccessCheck();


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-surface-1/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight">EdgeValidator</h1>
              <p className="text-xs text-muted-foreground">¿Azar o Ventaja Empírica?</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <AccessBanner expiresAt={access.expiresAt} subscriptionEnd={access.subscriptionEnd} />
            {hasStrategies && <PDFExportButton />}
            <div className="flex items-center gap-1.5">
              <Activity className="w-3 h-3" />
              <span>{strategies.length} estrategia(s)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <BarChart3 className="w-3 h-3" />
              <span>SQX Build 139</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {!hasStrategies ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto animate-pulse-glow">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">EdgeValidator</h2>
              <p className="text-muted-foreground max-w-md">
                Determina si tus estrategias de trading operan con una ventaja empírica real
                o si son indistinguibles del azar.
              </p>
            </motion.div>
            <div className="w-full max-w-lg">
              <FileUploader />
            </div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="grid grid-cols-3 gap-6 text-center max-w-lg">
              {[
                { label: 'Monte Carlo', desc: 'Simulaciones estadísticas' },
                { label: 'IS/OOS', desc: 'Validación cruzada' },
                { label: 'Edge Score', desc: 'Puntuación compuesta' },
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-xs font-semibold text-primary">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </motion.div>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            {/* Left sidebar */}
            <div className="col-span-12 lg:col-span-3 space-y-4">
              <FileUploader />
              <StrategyList />
              <DatasetUploader />
            </div>

            {/* Main content with tabs */}
            <div className="col-span-12 lg:col-span-9 space-y-4">
              {/* Dashboard KPIs always visible */}
              <DashboardSummary />

              <Tabs defaultValue="resumen" className="w-full">
                <TabsList className="w-full justify-start bg-surface-1 border border-border/50 h-auto flex-wrap p-1 gap-1">
                  <TabsTrigger value="resumen" className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                    Resumen
                  </TabsTrigger>
                  <TabsTrigger value="equity" className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                    Equity & Drawdown
                  </TabsTrigger>
                  <TabsTrigger value="montecarlo" className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                    Monte Carlo
                  </TabsTrigger>
                  <TabsTrigger value="aleatoriedad" className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                    Aleatoriedad
                  </TabsTrigger>
                  <TabsTrigger value="walkforward" className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                    Walk-Forward
                  </TabsTrigger>
                  <TabsTrigger value="comparacion" className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                    Comparación
                  </TabsTrigger>
                  <TabsTrigger value="correlacion" className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                    Correlación
                  </TabsTrigger>
                  <TabsTrigger value="trades" className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                    Trades
                  </TabsTrigger>
                  <TabsTrigger value="detalle" className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                    Detalle
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="resumen" className="space-y-4 mt-4">
                  <MetricsGrid />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <MonteCarloChart />
                    <FitnessRadar />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <OOSComparison />
                    <StrategyComparisonScatter />
                  </div>
                  <EdgeDistribution />
                </TabsContent>

                <TabsContent value="equity" className="space-y-4 mt-4">
                  <EquityCurveChart />
                  <DrawdownPanel />
                </TabsContent>

                <TabsContent value="montecarlo" className="space-y-4 mt-4">
                  <MonteCarloAdvancedPanel />
                </TabsContent>

                <TabsContent value="aleatoriedad" className="space-y-4 mt-4">
                  <RandomnessPanel />
                </TabsContent>

                <TabsContent value="walkforward" className="space-y-4 mt-4">
                  <WalkForwardPanel />
                </TabsContent>

                <TabsContent value="comparacion" className="space-y-4 mt-4">
                  <StrategyComparisonTable />
                </TabsContent>

                <TabsContent value="correlacion" className="space-y-4 mt-4">
                  <CorrelationPanel />
                </TabsContent>

                <TabsContent value="trades" className="space-y-4 mt-4">
                  <TradesTable />
                </TabsContent>

                <TabsContent value="detalle" className="space-y-4 mt-4">
                  <StrategyDetails />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border/30 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">
            EdgeValidator • Análisis de ventaja estadística para estrategias de trading
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
