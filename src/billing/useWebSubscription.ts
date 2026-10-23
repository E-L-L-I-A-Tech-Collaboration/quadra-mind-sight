import React from 'react';

export type WebTier = 'free' | 'practitioner' | 'premium';

export interface WebSubscriptionState {
  /** 'loading' until the first /api/billing/status round-trip completes. */
  status: 'loading' | 'ready';
  tier: WebTier;
  premium: boolean;
  /** False until the server has Stripe env vars configured. */
  billingConfigured: boolean;
  error: string | null;
  subscribing: boolean;
  refresh: () => Promise<void>;
  /** POSTs to /api/billing/checkout and redirects to Stripe. */
  subscribe: (email: string) => Promise<void>;
}

/**
 * Stripe subscription entitlement for the open web.
 *
 * The server's cloudStore is the source of truth: the Stripe webhook
 * upgrades accountTier to 'premium' on subscribe and downgrades to
 * 'practitioner' on cancel. This hook polls that status and drives the
 * premium gating in App (Waves 5-8).
 *
 * This is independent of the Google Play Digital Goods flow
 * (useSubscription), which only exists inside the Android TWA.
 */
export function useWebSubscription(uid: string, initialTier: WebTier): WebSubscriptionState {
  const [status, setStatus] = React.useState<'loading' | 'ready'>('loading');
  const [tier, setTier] = React.useState<WebTier>(initialTier);
  const [billingConfigured, setBillingConfigured] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [subscribing, setSubscribing] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/billing/status?uid=${encodeURIComponent(uid)}`);
      if (!res.ok) throw new Error('Subscription status check failed.');
      const json = await res.json();
      if (json && json.success) {
        const t = json.tier as WebTier;
        setTier(t === 'premium' || t === 'free' || t === 'practitioner' ? t : 'practitioner');
        setBillingConfigured(Boolean(json.billingConfigured));
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStatus('ready');
    }
  }, [uid]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const subscribe = React.useCallback(
    async (email: string) => {
      setSubscribing(true);
      setError(null);
      try {
        const res = await fetch('/api/billing/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, uid }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success || !json.url) {
          throw new Error(json.error || 'Could not start checkout.');
        }
        window.location.href = json.url as string;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setSubscribing(false);
      }
    },
    [uid],
  );

  return {
    status,
    tier,
    premium: tier === 'premium',
    billingConfigured,
    error,
    subscribing,
    refresh,
    subscribe,
  };
}
