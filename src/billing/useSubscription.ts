import React from 'react';
import {
  PLAY_BILLING_SERVICE_URL,
  PLAN_ITEM_IDS,
  SUBSCRIPTION_PLANS,
} from './plans';
import type {
  DigitalGoodsItemDetails,
  DigitalGoodsService,
} from './digital-goods.d';

export type SubscriptionStatus =
  | 'loading' // checking environment / purchases
  | 'unavailable' // not in the Play/TWA environment (open web) — no gate
  | 'free' // Play environment, no active subscription
  | 'premium'; // Play environment, active subscription found

export interface SubscriptionState {
  status: SubscriptionStatus;
  details: Record<string, DigitalGoodsItemDetails>;
  purchasingItemId: string | null;
  error: string | null;
  refresh: () => Promise<void>;
  purchase: (itemId: string) => Promise<boolean>;
}

/**
 * Google Play Billing via the Digital Goods API.
 *
 * Entitlement model (v1):
 * - Inside the Android app (TWA with Play Billing enabled), premium is
 *   unlocked when `listPurchases()` returns an active purchase for one
 *   of PLAN_ITEM_IDS. A 7-day free trial counts as active — Play
 *   reports it as a purchase.
 * - On the open web the Digital Goods API does not exist; the app
 *   runs ungated and the paywall simply explains that the subscription
 *   lives in the Android app.
 *
 * Production hardening still required before public launch: verify
 * purchases server-side with the Google Play Developer API and listen
 * to Real-time Developer Notifications; client-side listPurchases()
 * alone is the standard v1 approach for a TWA but is not a backend
 * entitlement ledger.
 */
export function useSubscription(): SubscriptionState {
  const [status, setStatus] = React.useState<SubscriptionStatus>('loading');
  const [details, setDetails] = React.useState<
    Record<string, DigitalGoodsItemDetails>
  >({});
  const [purchasingItemId, setPurchasingItemId] = React.useState<string | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const serviceRef = React.useRef<DigitalGoodsService | null>(null);

  const getService = React.useCallback(async () => {
    if (serviceRef.current) return serviceRef.current;
    if (typeof window === 'undefined' || !window.getDigitalGoodsService) {
      return null;
    }
    const service = await window.getDigitalGoodsService(
      PLAY_BILLING_SERVICE_URL,
    );
    serviceRef.current = service;
    return service;
  }, []);

  const refresh = React.useCallback(async () => {
    try {
      const service = await getService();
      if (!service) {
        setStatus('unavailable');
        return;
      }
      const purchases = await service.listPurchases();
      const entitled = purchases.some((p) => PLAN_ITEM_IDS.includes(p.itemId));
      setStatus(entitled ? 'premium' : 'free');
      try {
        const items = await service.getDetails(PLAN_ITEM_IDS);
        const map: Record<string, DigitalGoodsItemDetails> = {};
        for (const item of items) map[item.itemId] = item;
        setDetails(map);
      } catch {
        // Price display falls back to the configured USD prices.
      }
    } catch (err) {
      setStatus('unavailable');
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [getService]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const purchase = React.useCallback(
    async (itemId: string) => {
      const service = await getService();
      if (!service) {
        setError(
          'Google Play Billing is only available inside the Android app.',
        );
        return false;
      }
      setPurchasingItemId(itemId);
      setError(null);
      try {
        const plan = SUBSCRIPTION_PLANS.find((p) => p.itemId === itemId);
        const request = new PaymentRequest(
          [
            {
              supportedMethods: PLAY_BILLING_SERVICE_URL,
              data: { sku: itemId },
            },
          ],
          {
            total: {
              label: plan ? `Quadra-M.I.N.D. Sight ${plan.name}` : 'Quadra-M.I.N.D. Sight',
              amount: { currency: 'USD', value: '0' },
            },
          },
        );
        const response = await request.show();
        await response.complete('success');

        // Confirm entitlement and acknowledge so Play does not auto-refund.
        const purchases = await service.listPurchases();
        const match = purchases.find((p) => p.itemId === itemId);
        if (match && service.acknowledge) {
          try {
            await service.acknowledge(match.purchaseToken, 'subscription');
          } catch {
            // Server-side acknowledgement remains the fallback; see docs.
          }
        }
        const entitled = purchases.some((p) =>
          PLAN_ITEM_IDS.includes(p.itemId),
        );
        setStatus(entitled ? 'premium' : 'free');
        return entitled;
      } catch (err) {
        // User cancelling the Play purchase sheet lands here; that is not
        // an app error worth alarming about.
        setError(
          err instanceof Error ? err.message : 'Purchase was not completed.',
        );
        await refresh();
        return false;
      } finally {
        setPurchasingItemId(null);
      }
    },
    [getService, refresh],
  );

  return { status, details, purchasingItemId, error, refresh, purchase };
}
