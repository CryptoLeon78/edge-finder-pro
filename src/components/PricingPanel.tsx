import { motion } from 'framer-motion';
import { Check, X, Zap, Crown, Building2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { PLANS, PLAN_PRICES, PLAN_NAMES, type SubscriptionPlan } from '@/lib/subscriptions';
import { Button } from '@/components/ui/button';

const PLAN_ICONS = {
  free: Zap,
  pro: Crown,
  enterprise: Building2,
};

const PLAN_COLORS = {
  free: 'text-muted-foreground',
  pro: 'text-primary',
  enterprise: 'text-warning',
};

const PLAN_BG_COLORS = {
  free: '',
  pro: 'bg-primary/10 border-primary',
  enterprise: 'bg-warning/10 border-warning',
};

interface FeatureRowProps {
  feature: string;
  free?: boolean;
  pro?: boolean;
  enterprise?: boolean;
}

function FeatureRow({ feature, free, pro, enterprise }: FeatureRowProps) {
  return (
    <tr className="border-b border-border">
      <td className="py-3 px-4 text-sm text-foreground">{feature}</td>
      <td className="py-3 px-4 text-center">
        {free ? <Check className="w-4 h-4 text-success inline" /> : <X className="w-4 h-4 text-muted-foreground inline" />}
      </td>
      <td className="py-3 px-4 text-center">
        {pro ? <Check className="w-4 h-4 text-success inline" /> : <X className="w-4 h-4 text-muted-foreground inline" />}
      </td>
      <td className="py-3 px-4 text-center">
        {enterprise ? <Check className="w-4 h-4 text-success inline" /> : <X className="w-4 h-4 text-muted-foreground inline" />}
      </td>
    </tr>
  );
}

export function PricingPanel() {
  const { subscriptionPlan, setSubscriptionPlan } = useAppStore();

  const features = [
    { feature: 'Estrategias análisis', free: '3', pro: '20', enterprise: 'Ilimitado' },
    { feature: 'Simulaciones Monte Carlo', free: '100', pro: '1000', enterprise: '5000+' },
    { feature: 'Análisis Walk-Forward', free: false, pro: true, enterprise: true },
    { feature: 'Análisis de Portfolio', free: false, pro: true, enterprise: true },
    { feature: 'Simulación de Ruina', free: false, pro: true, enterprise: true },
    { feature: 'Export PDF', free: false, pro: true, enterprise: true },
    { feature: 'Soporte por email', free: false, pro: true, enterprise: true },
    { feature: 'API Access', free: false, pro: false, enterprise: true },
    { feature: 'Soporte 24/7', free: false, pro: false, enterprise: true },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="space-y-6"
    >
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-2">Planes de Suscripción</h2>
        <p className="text-sm text-muted-foreground">
          Elige el plan que mejor se adapte a tus necesidades de análisis.
        </p>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['free', 'pro', 'enterprise'] as SubscriptionPlan[]).map((plan) => {
          const Icon = PLAN_ICONS[plan];
          const isCurrentPlan = subscriptionPlan === plan;
          
          return (
            <div 
              key={plan} 
              className={`glass-card p-6 border-2 ${isCurrentPlan ? PLAN_BG_COLORS[plan] : 'border-border'} relative`}
            >
              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-xs px-3 py-1 rounded-full">
                  Actual
                </div>
              )}
              
              <div className="flex items-center gap-2 mb-4">
                <Icon className={`w-5 h-5 ${PLAN_COLORS[plan]}`} />
                <h3 className="text-lg font-semibold">{PLAN_NAMES[plan]}</h3>
              </div>
              
              <div className="mb-4">
                <span className="text-3xl font-bold">${PLAN_PRICES[plan]}</span>
                <span className="text-muted-foreground">/mes</span>
              </div>
              
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-success" />
                  {PLANS[plan].maxStrategies === -1 ? 'Ilimitado' : PLANS[plan].maxStrategies} estrategias
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-success" />
                  {PLANS[plan].monteCarloIterations} simulaciones MC
                </li>
                {PLANS[plan].walkForward && (
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    Walk-Forward
                  </li>
                )}
                {PLANS[plan].portfolioAnalysis && (
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    Análisis de Portfolio
                  </li>
                )}
              </ul>
              
              <Button 
                variant={isCurrentPlan ? 'secondary' : 'default'}
                className="w-full"
                onClick={() => setSubscriptionPlan(plan)}
              >
                {isCurrentPlan ? 'Plan Actual' : 'Seleccionar'}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Feature Table */}
      <div className="glass-card p-6">
        <h3 className="text-md font-semibold mb-4">Comparativa de Funcionalidades</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 px-4 text-left text-muted-foreground">Función</th>
                <th className="py-3 px-4 text-center text-muted-foreground">Básico</th>
                <th className="py-3 px-4 text-center text-muted-foreground">Pro</th>
                <th className="py-3 px-4 text-center text-muted-foreground">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <FeatureRow 
                  key={i}
                  feature={f.feature}
                  free={typeof f.free === 'string' ? undefined : f.free}
                  pro={typeof f.pro === 'string' ? undefined : f.pro}
                  enterprise={typeof f.enterprise === 'string' ? undefined : f.enterprise}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}