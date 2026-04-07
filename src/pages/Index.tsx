import { useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, BarChart3, Shield, CreditCard, Loader2, ExternalLink } from 'lucide-react';
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
import { PricingPanel } from '@/components/PricingPanel';
import { AccessBanner, useAccessCheck } from '@/components/AccessGate';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const { strategies } = useAppStore();
  const hasStrategies = strategies.length > 0;
  const access = useAccessCheck();
  const [portalLoading, setPortalLoading] = useState(false);
  const { toast } = useToast();

  const handleManageSubscription = async () => {
    if (!access.email) return;
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        body: { email: access.email },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank');
    } catch {
      toast({ title: 'Error', description: 'No se pudo abrir el portal de suscripción.', variant: 'destructive' });
    }
    setPortalLoading(false);
  };


  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-border/50 bg-surface-1/50 backdrop-blur-sm sticky top-0 z-50 shrink-0">
        <div className="max-w-[1920px] mx-auto px-4 py-3 flex items-center justify-between">
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
            {access.status === 'subscribed' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="gap-1.5 text-xs h-7"
              >
                {portalLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />}
                Gestionar Suscripción
                <ExternalLink className="w-2.5 h-2.5" />
              </Button>
            )}
            {hasStrategies && <PDFExportButton />}
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto px-4 py-6 overflow-x-auto">
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
          <div className="grid grid-cols-12 gap-4 min-h-0">
            {/* Left sidebar */}
            <div className="col-span-12 lg:col-span-3 space-y-4 overflow-y-auto max-h-[calc(100vh-140px)] pr-1">
              <div className="glass-card p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Cargar Estrategias
                </h3>
                <FileUploader />
              </div>
              <div className="glass-card p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Datasets
                </h3>
                <DatasetUploader />
              </div>
              <StrategyList />
            </div>

            {/* Main content with tabs */}
            <div className="col-span-12 lg:col-span-9 space-y-4 min-h-0">
              {/* Header section */}
              <div className="glass-card p-4 shrink-0">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-sm font-semibold">Análisis de Estrategias</h2>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Activity className="w-3 h-3" />
                      <span>{strategies.length} estrategia(s) cargada(s)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <BarChart3 className="w-3 h-3" />
                      {(() => {
                        const versions = [...new Set(strategies.map(s => s.appVersion).filter(v => v && v !== 'Unknown'))];
                        if (versions.length === 0) return <span>SQX</span>;
                        if (versions.length === 1) return <span>{versions[0]}</span>;
                        return (
                          <span className="flex gap-1">
                            {versions.slice(0, 3).map((v, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-surface-2 rounded text-[10px]">{v}</span>
                            ))}
                            {versions.length > 3 && <span>+{versions.length - 3}</span>}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="resumen" className="w-full min-w-0">
                <TabsList className="w-full justify-start bg-surface-1 border border-border/50 h-auto flex-wrap p-1 gap-1 overflow-x-auto">
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
                  <TabsTrigger value="precios" className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                    Precios
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="resumen" className="space-y-4 mt-4">
                  <DashboardSummary />
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

                <TabsContent value="precios" className="space-y-4 mt-4">
                  <PricingPanel />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border/30 py-4 mt-8 shrink-0">
        <div className="max-w-[1920px] mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">
            EdgeValidator • Análisis de ventaja estadística para estrategias de trading
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
