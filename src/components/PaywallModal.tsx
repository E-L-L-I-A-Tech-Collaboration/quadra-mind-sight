import React from 'react';
import { X, Check, Crown, RefreshCw } from 'lucide-react';
import { SUBSCRIPTION_PLANS, TRIAL_COPY } from '../billing/plans';
import type { SubscriptionState } from '../billing/useSubscription';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  sub: SubscriptionState;
  /**
   * Hard-gate mode: rendered as the app's subscription screen with no
   * way to dismiss it (used when the Android app has no active
   * subscription). Hides the close button.
   */
  blocking?: boolean;
}

function formatPrice(
  sub: SubscriptionState,
  itemId: string,
  fallback: string,
): string {
  const detail = sub.details[itemId];
  if (detail?.price) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: detail.price.currency,
      }).format(Number(detail.price.value));
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/**
 * Quadra-M.I.N.D. Sight subscription paywall.
 *
 * Inside the Google Play app this drives Play Billing through the
 * Digital Goods API. On the open web it explains the subscription and
 * points to the Android app; the web app itself stays ungated.
 *
 * Offer: 7-day free trial, then $14.99/month. The trial is an
 * introductory offer configured in Play Console, not code.
 */
export default function PaywallModal({ isOpen, onClose, sub, blocking }: PaywallModalProps) {
  if (!isOpen) return null;

  const inPlay = sub.status === 'free' || sub.status === 'premium';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 print:hidden">
      <div className="w-full max-w-lg bg-[#0A0D18] border border-white/15 shadow-[0_0_60px_rgba(212,175,55,0.12)] overflow-hidden">
        <div className="border-b border-[#D4AF37]/30 bg-[#050508] px-6 py-5 text-white relative">
          {!blocking && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 text-white/60 hover:text-white cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Crown className="w-6 h-6 text-[#D4AF37]" />
            <h2 className="text-xl font-light tracking-wide">Quadra-M.I.N.D. Sight</h2>
          </div>
          <p className="text-sm text-white/60 mt-1">
            {blocking
              ? 'Quadra-M.I.N.D. Sight requires an active subscription in the Android app. Start your free trial to continue.'
              : 'Unlock the full Quadra-M.I.N.D. Sight practice system — sessions, sight training, journaling, and labs.'}
          </p>
          <p className="text-sm font-semibold text-[#D4AF37] mt-2">{TRIAL_COPY}</p>
        </div>

        <div className="px-6 py-5 space-y-4">
          {sub.status === 'premium' ? (
            <div className="flex items-start gap-3 bg-[#D4AF37]/10 border border-[#D4AF37]/40 p-4">
              <Check className="w-5 h-5 text-[#D4AF37] mt-0.5" />
              <div>
                <p className="font-semibold text-white">Your subscription is active.</p>
                <p className="text-sm text-white/60">
                  Your Google Play subscription is active. Manage or cancel it
                  anytime in Google Play &gt; Subscriptions.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-3">
                {SUBSCRIPTION_PLANS.map((plan) => (
                  <div
                    key={plan.itemId}
                    className="border border-white/15 bg-[#050508] p-4 flex flex-col gap-2 hover:border-[#D4AF37]/60 transition-colors"
                  >
                    <div className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-white/50">
                      {plan.name}
                    </div>
                    <div className="text-2xl font-light text-white">
                      {formatPrice(sub, plan.itemId, plan.fallbackPrice)}
                      <span className="text-sm font-normal text-white/50">
                        {plan.periodLabel}
                      </span>
                    </div>
                    <p className="text-xs text-white/60 flex-1">{plan.blurb}</p>
                    <button
                      type="button"
                      disabled={!inPlay || sub.purchasingItemId !== null}
                      onClick={() => void sub.purchase(plan.itemId)}
                      className="mt-1 w-full py-3 border border-[#D4AF37] bg-[#D4AF37] hover:bg-white hover:border-white text-[#050508] text-xs font-mono uppercase tracking-[0.2em] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      {sub.purchasingItemId === plan.itemId
                        ? 'Opening Google Play…'
                        : inPlay
                          ? 'Start 7-day free trial'
                          : 'Available in the Android app'}
                    </button>
                  </div>
                ))}
              </div>

              {!inPlay && (
                <p className="text-xs text-white/60 bg-[#050508] border border-white/10 p-3">
                  Subscriptions are sold through Google Play inside the
                  Quadra-M.I.N.D. Sight Android app. This web version stays
                  open so you can explore first.
                </p>
              )}

              <button
                type="button"
                onClick={() => void sub.refresh()}
                className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-[#D4AF37] hover:text-white cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Restore purchase
              </button>

              {sub.error && (
                <p className="text-xs text-red-400">{sub.error}</p>
              )}

              <p className="text-[11px] leading-relaxed text-white/40">
                {TRIAL_COPY}. Auto-renews until cancelled. Payment is charged
                to your Google Play account; manage or cancel anytime in
                Google Play subscriptions.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
