import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

type Orientation = 'row' | 'column';

interface SynteroMarkProps {
  subtitle?: string;
  orientation?: Orientation;
  showText?: boolean;
  className?: string;
  compact?: boolean;
}

/**
 * Reusable brand mark that displays the Syntero logo with a subtle motion glow.
 */
export function SynteroMark({
  subtitle = 'AI estimation workspace',
  orientation = 'row',
  showText = true,
  className,
  compact = false,
}: SynteroMarkProps) {
  const layout = orientation === 'row' ? 'flex-row items-center gap-3' : 'flex-col items-center gap-2';
  const sizeClasses = compact ? 'w-9 h-9 md:w-10 md:h-10' : 'w-10 h-10 md:w-12 md:h-12';

  return (
    <div className={cn('flex', layout, className)}>
      <div className="relative">
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/50 via-indigo-500/30 to-amber-400/40 blur-lg"
          animate={{ opacity: [0.45, 0.8, 0.45], scale: [0.96, 1.04, 0.96] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className={cn(
            'relative overflow-hidden rounded-2xl border border-white/60 bg-white/90 shadow-lg ring-1 ring-blue-500/10',
            sizeClasses
          )}
          initial={{ rotate: -2, scale: 0.96, y: 2 }}
          animate={{ rotate: [0, 2, -2, 0], scale: [0.98, 1, 0.98], y: [0, -1, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-white/40"
            animate={{ opacity: [0.4, 0.9, 0.4], x: ['-10%', '10%', '-10%'] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <img
            src="/logo.svg"
            alt="Syntero"
            className="relative h-full w-full object-contain"
            loading="lazy"
          />
        </motion.div>
      </div>

      {showText && (
        <div className={cn('leading-tight', orientation === 'column' && 'text-center')}>
          <span className="block text-base font-extrabold tracking-tight text-slate-900">Syntero</span>
          <span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
}
