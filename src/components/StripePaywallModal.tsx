import React from 'react';
import { X, Check, Crown } from 'lucide-react';

interface StripePaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Prefilled from the user's profile; editable. */
  initialEmail: string;
  subscribing: boolean;
  error: string | null;
  billingConfigured: boolean;
  onSubscribe: (email: string) => void;
}

const BENEFITS = [
  'All 8 curriculum waves — Orientation through Integration',
  'Deep metacognitive facilitator (AI-guided dialectic inquiry)',
  'Spatial audio neural engine with binaural wave states',
  'Real-time multi-device cloud sync',
  'Session journal with pattern insights',
];

/**
 * Web subscription paywall: M.I.N.D. Sight Premium — $14.99/month.
 *
 * Distinct from the Google Play paywall (PaywallModal): this one drives
 * Stripe Checkout on the open web. Shown when a non-premium user taps a
 * premium-gated surface (Waves 5-8).
 */
export default function StripePaywallModal({
  isOpen,
  onClose,
  initialEmail,
  subscribing,
  error,
  billingConfigured,
  onSubscribe,
}: StripePaywallModalProps) {
  const [email, setEmail] = React.useState(initialEmail);

  React.useEffect(() => {
    if (isOpen) setEmail(initialEmail);
  }, [isOpen, initialEmail]);

  if (!isOpen) return null;

  const emailLooksValid = /.+@.+\..+/.test(email.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 print:hidden">
      <div className="w-full max-w-lg bg-[#0A0D18] border border-white/15 shadow-[0_0_60px_rgba(212,175,55,0.12)] overflow-hidden">
        <div className="border-b border-[#D4AF37]/30 bg-[#050508] px-6 py-5 text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-white/60 hover:text-white cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Crown className="w-6 h-6 text-[#D4AF37]" />
            <h2 className="text-xl font-light tracking-wide">M.I.N.D. Sight Premium</h2>
          </div>
          <p className="text-sm text-white/60 mt-1">
            Unlock the full practice system — every wave, the deep facilitator, and the spatial audio engine.
          </p>
          <p className="text-sm font-semibold text-[#D4AF37] mt-2">$14.99/month · cancel anytime</p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <ul className="space-y-2">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-3 text-sm text-white/80">
                <Check className="w-4 h-4 text-[#D4AF37] mt-0.5 shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          {billingConfigured ? (
            <>
              <label className="block">
                <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/50">
                  Email for your subscription
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-2 w-full bg-[#050508] border border-white/15 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#D4AF37]/70"
                />
              </label>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                type="button"
                disabled={subscribing || !emailLooksValid}
                onClick={() => onSubscribe(email.trim())}
                className="w-full py-3 border border-[#D4AF37] bg-[#D4AF37] hover:bg-white hover:border-white text-[#050508] text-xs font-mono uppercase tracking-[0.2em] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {subscribing ? 'Opening secure checkout…' : 'Subscribe — $14.99/month'}
              </button>
              <p className="text-[11px] text-white/40 text-center">
                Secure checkout by Stripe. Your subscription activates automatically after payment.
              </p>
            </>
          ) : (
            <p className="text-sm text-white/60">
              Subscriptions are not available yet — please check back soon.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
