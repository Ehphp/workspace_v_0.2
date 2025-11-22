import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { SynteroMark } from '@/components/layout/SynteroMark';
import { motion } from 'framer-motion';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 p-6">
        <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/60 bg-white/90 backdrop-blur-2xl shadow-2xl px-8 py-10">
          <div className="absolute -left-10 -top-12 h-36 w-36 rounded-full bg-blue-500/15 blur-3xl" aria-hidden />
          <div className="absolute -right-12 -bottom-16 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" aria-hidden />
          <motion.div
            aria-hidden
            className="absolute inset-6 rounded-2xl border border-blue-500/10"
            animate={{ opacity: [0.45, 0.8, 0.45], scale: [0.98, 1.02, 0.98] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="relative flex flex-col items-center gap-4">
            <SynteroMark orientation="column" subtitle="Caricamento workspace" />
            <motion.div
              className="relative h-2 w-full rounded-full bg-slate-200 overflow-hidden"
              aria-hidden
              initial={{ opacity: 0.6 }}
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <motion.span
                className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-500"
                animate={{ x: ['-60%', '120%'] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              />
            </motion.div>
            <motion.p
              className="text-sm text-slate-600 text-center"
              initial={{ opacity: 0.5, y: 4 }}
              animate={{ opacity: [0.5, 1, 0.5], y: [4, 0, 4] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              Stiamo preparando il tuo spazio Syntero...
            </motion.p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
