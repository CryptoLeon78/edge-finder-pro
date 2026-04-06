import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Shield, Mail, Clock, XCircle, Loader2, AlertTriangle, CreditCard, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type AccessStatus = 'loading' | 'no_request' | 'pending' | 'approved' | 'expired' | 'rejected' | 'subscribed';

interface AccessState {
  status: AccessStatus;
  email: string | null;
  expiresAt: string | null;
  subscriptionEnd: string | null;
}

const STORAGE_KEY = 'edgevalidator_access_email';
const SUPERUSER_EMAILS = ['ivanaza8@gmail.com'];

function getDaysRemaining(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export function AccessBanner({ expiresAt, subscriptionEnd }: { expiresAt: string | null; subscriptionEnd?: string | null }) {
  const dateStr = subscriptionEnd || expiresAt;
  if (!dateStr) return null;
  const days = getDaysRemaining(dateStr);
  const isUrgent = days <= 5;
  const label = subscriptionEnd ? 'Suscripción' : 'Acceso válido';

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono ${
      isUrgent ? 'bg-destructive/20 text-destructive' : 'bg-success/10 text-success'
    }`}>
      {subscriptionEnd ? <CreditCard className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
      <span>{label} hasta {formatDate(dateStr)} ({days} días)</span>
      {isUrgent && <AlertTriangle className="w-3 h-3" />}
    </div>
  );
}

export function useAccessCheck() {
  const [access, setAccess] = useState<AccessState>({
    status: 'loading', email: null, expiresAt: null, subscriptionEnd: null,
  });

  const checkAccess = useCallback(async () => {
    const email = localStorage.getItem(STORAGE_KEY);
    if (!email) {
      setAccess({ status: 'no_request', email: null, expiresAt: null, subscriptionEnd: null });
      return;
    }

    // Superuser bypass
    if (SUPERUSER_EMAILS.includes(email.toLowerCase())) {
      setAccess({ status: 'approved', email, expiresAt: null, subscriptionEnd: null });
      return;
    }

    try {
      // Check Stripe subscription first
      const { data: subData } = await supabase.functions.invoke('check-subscription', {
        body: { email: email.toLowerCase() },
      });

      if (subData?.subscribed) {
        setAccess({ status: 'subscribed', email, expiresAt: null, subscriptionEnd: subData.subscription_end });
        return;
      }
    } catch {
      // Subscription check failed, fall through to manual access check
    }

    try {
      const { data, error } = await supabase
        .from('access_requests')
        .select('status, expires_at')
        .eq('email', email)
        .in('status', ['pending', 'approved', 'rejected'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !data?.length) {
        setAccess({ status: 'no_request', email, expiresAt: null, subscriptionEnd: null });
        return;
      }

      const req = data[0];
      if (req.status === 'approved' && req.expires_at) {
        const expired = new Date(req.expires_at) < new Date();
        setAccess({ status: expired ? 'expired' : 'approved', email, expiresAt: req.expires_at, subscriptionEnd: null });
      } else if (req.status === 'pending') {
        setAccess({ status: 'pending', email, expiresAt: null, subscriptionEnd: null });
      } else if (req.status === 'rejected') {
        setAccess({ status: 'rejected', email, expiresAt: null, subscriptionEnd: null });
      } else {
        setAccess({ status: 'no_request', email, expiresAt: null, subscriptionEnd: null });
      }
    } catch {
      setAccess({ status: 'no_request', email, expiresAt: null, subscriptionEnd: null });
    }
  }, []);

  useEffect(() => {
    checkAccess();
    const interval = setInterval(checkAccess, 60000);
    return () => clearInterval(interval);
  }, [checkAccess]);

  return { ...access, refresh: checkAccess };
}

export function AccessGate({ children }: { children: React.ReactNode }) {
  const access = useAccessCheck();

  if (access.status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (access.status === 'approved' || access.status === 'subscribed') {
    return <>{children}</>;
  }

  return <AccessRequestScreen access={access} />;
}

function AccessRequestScreen({ access }: { access: ReturnType<typeof useAccessCheck> }) {
  const [email, setEmail] = useState(access.email || '');
  const [sending, setSending] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) return;

    // Superuser bypass — just save and refresh
    if (SUPERUSER_EMAILS.includes(trimmed)) {
      localStorage.setItem(STORAGE_KEY, trimmed);
      access.refresh();
      return;
    }

    setSending(true);
    try {
      const { data: existing } = await supabase
        .from('access_requests')
        .select('id, status')
        .eq('email', trimmed)
        .in('status', ['pending', 'approved'])
        .limit(1);

      if (existing?.length && existing[0].status === 'pending') {
        toast({ title: 'Solicitud ya enviada', description: 'Tu solicitud está pendiente de aprobación.' });
        localStorage.setItem(STORAGE_KEY, trimmed);
        access.refresh();
        setSending(false);
        return;
      }

      const { error } = await supabase
        .from('access_requests')
        .insert({ email: trimmed });

      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Solicitud existente', description: 'Ya tienes una solicitud activa.' });
        } else {
          throw error;
        }
      } else {
        try {
          await supabase.functions.invoke('request-access', { body: { email: trimmed } });
        } catch { /* request saved even if email fails */ }
        toast({ title: 'Solicitud enviada', description: 'El administrador recibirá tu solicitud por correo.' });
      }

      localStorage.setItem(STORAGE_KEY, trimmed);
      access.refresh();
    } catch {
      toast({ title: 'Error', description: 'No se pudo enviar la solicitud.', variant: 'destructive' });
    }
    setSending(false);
  };

  const handleRenew = async () => {
    const trimmed = email.trim().toLowerCase();
    setSending(true);
    try {
      const { error } = await supabase
        .from('access_requests')
        .insert({ email: trimmed });

      if (error && error.code === '23505') {
        await supabase.functions.invoke('request-access', { body: { email: trimmed, renew: true } });
      } else if (!error) {
        await supabase.functions.invoke('request-access', { body: { email: trimmed } });
      }

      toast({ title: 'Renovación solicitada', description: 'El administrador recibirá tu solicitud de renovación.' });
      access.refresh();
    } catch {
      toast({ title: 'Error', description: 'No se pudo enviar la renovación.', variant: 'destructive' });
    }
    setSending(false);
  };

  const handleSubscribe = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      toast({ title: 'Email requerido', description: 'Introduce tu correo antes de suscribirte.' });
      return;
    }
    setCheckingOut(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { email: trimmed },
      });
      if (error) throw error;
      if (data?.url) {
        localStorage.setItem(STORAGE_KEY, trimmed);
        window.open(data.url, '_blank');
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo iniciar el pago.', variant: 'destructive' });
    }
    setCheckingOut(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 max-w-md w-full space-y-6"
      >
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto animate-pulse-glow">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold">EdgeValidator</h1>
          <p className="text-sm text-muted-foreground">
            Acceso restringido. Solicita acceso gratuito o suscríbete.
          </p>
        </div>

        {access.status === 'pending' && (
          <div className="flex items-center gap-3 p-4 bg-warning/10 rounded-lg">
            <Clock className="w-5 h-5 text-warning flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-warning">Solicitud pendiente</p>
              <p className="text-muted-foreground text-xs">
                Tu solicitud está siendo revisada. Mientras tanto puedes suscribirte para acceso inmediato.
              </p>
            </div>
          </div>
        )}

        {access.status === 'expired' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg">
              <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-destructive">Acceso caducado</p>
                <p className="text-muted-foreground text-xs">
                  Tu acceso expiró el {access.expiresAt ? formatDate(access.expiresAt) : '—'}.
                </p>
              </div>
            </div>
            <Button onClick={handleRenew} disabled={sending} variant="outline" className="w-full gap-2">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Solicitar Renovación Gratuita
            </Button>
          </div>
        )}

        {access.status === 'rejected' && (
          <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg">
            <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-destructive">Acceso denegado</p>
              <p className="text-muted-foreground text-xs">Tu solicitud fue rechazada. Puedes suscribirte para obtener acceso.</p>
            </div>
          </div>
        )}

        {/* Email input + request access (for no_request, rejected, pending states) */}
        {(access.status === 'no_request' || access.status === 'rejected' || access.status === 'pending') && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Correo electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {access.status !== 'pending' && (
              <Button type="button" onClick={handleSubmit} disabled={sending || !email.includes('@')} variant="outline" className="w-full gap-2">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Solicitar Acceso Gratuito (30 días)
              </Button>
            )}
          </div>
        )}

        {/* Subscription CTA — always visible when not approved */}
        <div className="space-y-2">
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">o</span></div>
          </div>
          <Button
            onClick={handleSubscribe}
            disabled={checkingOut || !email.includes('@')}
            className="w-full gap-2 bg-gradient-to-r from-primary to-emerald-400 hover:from-primary/90 hover:to-emerald-400/90 text-primary-foreground font-semibold"
          >
            {checkingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            Suscribirse — 29€/mes
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
          <p className="text-[10px] text-center text-muted-foreground">
            Acceso inmediato y sin límite. Cancela cuando quieras.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
