import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Shield, Mail, Clock, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AccessState {
  status: 'loading' | 'no_request' | 'pending' | 'approved' | 'expired' | 'rejected';
  email: string | null;
  expiresAt: string | null;
}

const STORAGE_KEY = 'edgevalidator_access_email';
const SUPERUSER_EMAILS = ['ivanaza8@gmail.com'];

function getDaysRemaining(expiresAt: string): number {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export function AccessBanner({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return null;
  const days = getDaysRemaining(expiresAt);
  const isUrgent = days <= 5;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono ${
      isUrgent ? 'bg-destructive/20 text-destructive' : 'bg-success/10 text-success'
    }`}>
      <Clock className="w-3 h-3" />
      <span>Acceso válido hasta {formatDate(expiresAt)} ({days} días)</span>
      {isUrgent && <AlertTriangle className="w-3 h-3" />}
    </div>
  );
}

export function useAccessCheck() {
  const [access, setAccess] = useState<AccessState>({
    status: 'loading', email: null, expiresAt: null,
  });

  const checkAccess = useCallback(async () => {
    const email = localStorage.getItem(STORAGE_KEY);
    if (!email) {
      setAccess({ status: 'no_request', email: null, expiresAt: null });
      return;
    }

    try {
      // Also check rejected status so we can show the right screen
      const { data, error } = await supabase
        .from('access_requests')
        .select('status, expires_at')
        .eq('email', email)
        .in('status', ['pending', 'approved', 'rejected'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !data?.length) {
        setAccess({ status: 'no_request', email, expiresAt: null });
        return;
      }

      const req = data[0];
      if (req.status === 'approved' && req.expires_at) {
        const expired = new Date(req.expires_at) < new Date();
        setAccess({
          status: expired ? 'expired' : 'approved',
          email,
          expiresAt: req.expires_at,
        });
      } else if (req.status === 'pending') {
        setAccess({ status: 'pending', email, expiresAt: null });
      } else if (req.status === 'rejected') {
        setAccess({ status: 'rejected', email, expiresAt: null });
      } else {
        setAccess({ status: 'no_request', email, expiresAt: null });
      }
    } catch {
      setAccess({ status: 'no_request', email, expiresAt: null });
    }
  }, []);

  useEffect(() => {
    checkAccess();
    // Re-check every 60 seconds
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

  if (access.status === 'approved') {
    return <>{children}</>;
  }

  return <AccessRequestScreen access={access} />;
}

function AccessRequestScreen({ access }: { access: ReturnType<typeof useAccessCheck> }) {
  const [email, setEmail] = useState(access.email || '');
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) return;

    setSending(true);
    try {
      // Check if there's already a pending or active request
      const { data: existing } = await supabase
        .from('access_requests')
        .select('id, status')
        .eq('email', email.trim().toLowerCase())
        .in('status', ['pending', 'approved'])
        .limit(1);

      if (existing?.length && existing[0].status === 'pending') {
        toast({ title: 'Solicitud ya enviada', description: 'Tu solicitud está pendiente de aprobación.' });
        localStorage.setItem(STORAGE_KEY, email.trim().toLowerCase());
        access.refresh();
        setSending(false);
        return;
      }

      // Create new request
      const { error } = await supabase
        .from('access_requests')
        .insert({ email: email.trim().toLowerCase() });

      if (error) {
        // Unique constraint violation means active request exists
        if (error.code === '23505') {
          toast({ title: 'Solicitud existente', description: 'Ya tienes una solicitud activa.' });
        } else {
          throw error;
        }
      } else {
        // Send notification to admin via edge function
        try {
          await supabase.functions.invoke('request-access', {
            body: { email: email.trim().toLowerCase() },
          });
        } catch {
          // Edge function may not be deployed yet - request is still saved
        }
        toast({ title: 'Solicitud enviada', description: 'El administrador recibirá tu solicitud por correo.' });
      }

      localStorage.setItem(STORAGE_KEY, email.trim().toLowerCase());
      access.refresh();
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo enviar la solicitud. Intenta de nuevo.', variant: 'destructive' });
    }
    setSending(false);
  };

  const handleRenew = async () => {
    setSending(true);
    try {
      // For expired access, create a new request
      const { error } = await supabase
        .from('access_requests')
        .insert({ email: email.trim().toLowerCase() });

      if (error && error.code === '23505') {
        // Update existing expired request back to pending
        // This needs to go through edge function since anon can't update
        await supabase.functions.invoke('request-access', {
          body: { email: email.trim().toLowerCase(), renew: true },
        });
      } else if (!error) {
        await supabase.functions.invoke('request-access', {
          body: { email: email.trim().toLowerCase() },
        });
      }

      toast({ title: 'Renovación solicitada', description: 'El administrador recibirá tu solicitud de renovación.' });
      access.refresh();
    } catch {
      toast({ title: 'Error', description: 'No se pudo enviar la renovación.', variant: 'destructive' });
    }
    setSending(false);
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
            Acceso restringido. Solicita acceso con tu correo electrónico.
          </p>
        </div>

        {access.status === 'pending' && (
          <div className="flex items-center gap-3 p-4 bg-warning/10 rounded-lg">
            <Clock className="w-5 h-5 text-warning flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-warning">Solicitud pendiente</p>
              <p className="text-muted-foreground text-xs">
                Tu solicitud está siendo revisada por el administrador. Recibirás acceso cuando sea aprobada.
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
                  Tu acceso expiró el {access.expiresAt ? formatDate(access.expiresAt) : '—'}. Solicita renovación.
                </p>
              </div>
            </div>
            <Button onClick={handleRenew} disabled={sending} className="w-full gap-2">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Solicitar Renovación
            </Button>
          </div>
        )}

        {access.status === 'rejected' && (
          <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg">
            <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-destructive">Acceso denegado</p>
              <p className="text-muted-foreground text-xs">El administrador rechazó tu solicitud.</p>
            </div>
          </div>
        )}

        {(access.status === 'no_request' || access.status === 'rejected') && (
          <form onSubmit={handleSubmit} className="space-y-3">
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
            <Button type="submit" disabled={sending || !email.includes('@')} className="w-full gap-2">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              Solicitar Acceso
            </Button>
          </form>
        )}

        <p className="text-[10px] text-center text-muted-foreground">
          El acceso se concede por 30 días tras la aprobación del administrador.
        </p>
      </motion.div>
    </div>
  );
}
