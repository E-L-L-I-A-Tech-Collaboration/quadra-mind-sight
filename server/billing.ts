/**
 * Stripe subscription billing for Quadra-M.I.N.D. Sight (open web).
 *
 * Offer: M.I.N.D. Sight Premium — $14.99/month, cancel anytime.
 * A successful subscription upgrades the user's accountTier to 'premium'
 * in cloudStore; a cancelled / past-due / deleted subscription downgrades
 * to 'practitioner'. The free 'Seeker' tier is never touched here.
 *
 * Required env vars (see .env.example):
 *   STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET, SITE_URL
 *
 * Safety: the Stripe client is created lazily and every handler degrades
 * to a 503 when billing is not configured — the server never crashes
 * because a key is missing. No secret values are ever logged.
 */
import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { cloudStore } from './cloudStore';

let stripeInstance: Stripe | null = null;

/** Lazily construct the Stripe client. Returns null when not configured. */
async function getStripe(): Promise<Stripe | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripeInstance) {
    try {
      const mod = await import('stripe');
      const StripeCtor = mod.default;
      stripeInstance = new StripeCtor(key);
    } catch (err) {
      console.error('Stripe SDK could not be loaded:', (err as Error)?.message);
      return null;
    }
  }
  return stripeInstance;
}

function siteUrl(): string {
  return (process.env.SITE_URL || '').replace(/\/$/, '');
}

export function billingConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_ID &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.SITE_URL,
  );
}

function isValidEmail(email: string): boolean {
  return /.+@.+\..+/.test(email.trim());
}

/**
 * POST /api/billing/checkout
 * Body: { email: string, uid?: string }
 * Creates a Stripe Checkout Session in subscription mode and returns its URL.
 */
export async function createCheckoutSession(req: Request, res: Response) {
  const stripe = await getStripe();
  const priceId = process.env.STRIPE_PRICE_ID;
  const origin = siteUrl();
  if (!stripe || !priceId || !origin) {
    return res
      .status(503)
      .json({ success: false, error: 'Subscriptions are not available yet. Please check back soon.' });
  }

  const { email, uid } = (req.body || {}) as { email?: string; uid?: string };
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({ success: false, error: 'A valid email address is required.' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: cleanEmail,
      client_reference_id: uid || undefined,
      metadata: { uid: uid || '', email: cleanEmail, product: 'mindsight-premium' },
      subscription_data: { metadata: { uid: uid || '', email: cleanEmail } },
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?billing=success`,
      cancel_url: `${origin}/?billing=cancelled`,
    });
    return res.json({ success: true, url: session.url });
  } catch (err) {
    console.error('Stripe checkout session creation failed.');
    return res.status(502).json({ success: false, error: 'Could not start checkout. Please try again.' });
  }
}

/** Upgrade the matched user to premium. Matches by uid, then by email. */
async function grantPremium(opts: {
  uid?: string;
  email?: string;
  stripeCustomerId?: string;
}): Promise<void> {
  const email = (opts.email || '').trim().toLowerCase();
  let uid = (opts.uid || '').trim();

  if (!uid && email) {
    const byEmail = cloudStore.getProfileByEmail(email);
    if (byEmail) uid = byEmail.uid;
  }
  // Fall back to the deterministic uid the client derives from the email,
  // so the entitlement is waiting when the user next logs in.
  if (!uid && email) {
    uid = `user_${email.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;
  }
  if (!uid) {
    console.warn('Stripe premium grant: no uid or email to match.');
    return;
  }

  cloudStore.upsertProfile({
    uid,
    email: email || undefined,
    accountTier: 'premium',
    stripeCustomerId: opts.stripeCustomerId,
  });
  console.log(`Stripe premium granted (uid resolved).`);
}

/** Downgrade the matched subscriber back to practitioner. */
async function revokePremium(stripeCustomerId?: string, email?: string): Promise<void> {
  const cleanEmail = (email || '').trim().toLowerCase();
  let uid: string | null = null;

  if (stripeCustomerId) {
    const byCustomer = cloudStore.getProfileByStripeCustomerId(stripeCustomerId);
    if (byCustomer) uid = byCustomer.uid;
  }
  if (!uid && cleanEmail) {
    const byEmail = cloudStore.getProfileByEmail(cleanEmail);
    if (byEmail) uid = byEmail.uid;
  }
  if (!uid) {
    console.warn('Stripe premium revoke: no matching profile.');
    return;
  }

  const existing = cloudStore.getProfile(uid);
  // Never touch the demo Observer account or an already-free account here;
  // subscription churn lands on 'practitioner' per product spec.
  if (existing && existing.accountTier === 'premium' && uid !== 'user_123') {
    cloudStore.upsertProfile({ uid, accountTier: 'practitioner' });
    console.log('Stripe premium revoked; tier set to practitioner.');
  }
}

async function emailForCustomer(stripe: Stripe, customerId: string | null): Promise<string> {
  if (!customerId || typeof customerId !== 'string') return '';
  try {
    const customer = (await stripe.customers.retrieve(customerId)) as Stripe.Customer;
    return (customer.email || '').toLowerCase();
  } catch {
    return '';
  }
}

/**
 * POST /api/billing/webhook
 * Stripe sends the raw body here; the route must be mounted with
 * express.raw({ type: 'application/json' }) BEFORE the JSON parser.
 * Responds 200 quickly; never throws.
 */
export async function handleWebhook(req: Request, res: Response) {
  const stripe = await getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return res.status(503).send('billing not configured');
  }

  const sig = req.headers['stripe-signature'] as string | undefined;
  if (!sig) return res.status(400).send('missing signature');

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch {
    console.error('Stripe webhook signature verification failed.');
    return res.status(400).send('bad signature');
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription') {
          const email =
            (session.customer_email || '').toLowerCase() ||
            (await emailForCustomer(stripe, session.customer as string | null));
          await grantPremium({
            uid: session.metadata?.uid || session.client_reference_id || undefined,
            email,
            stripeCustomerId:
              typeof session.customer === 'string' ? session.customer : undefined,
          });
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : '';
        const email =
          (sub.metadata?.email || '').toLowerCase() ||
          (await emailForCustomer(stripe, customerId));
        if (sub.status === 'active' || sub.status === 'trialing') {
          await grantPremium({ uid: sub.metadata?.uid, email, stripeCustomerId: customerId });
        } else if (['past_due', 'canceled', 'unpaid', 'incomplete_expired'].includes(sub.status)) {
          await revokePremium(customerId, email);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : '';
        await revokePremium(customerId, (sub.metadata?.email || '').toLowerCase());
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('Stripe webhook handler error.');
  }

  return res.status(200).send('ok');
}

/**
 * GET /api/billing/status?uid=…
 * Returns the server-side tier so the client can gate premium UI.
 */
export function billingStatus(req: Request, res: Response) {
  const uid = ((req.query.uid as string) || '').trim();
  const profile = uid ? cloudStore.getProfile(uid) : null;
  const tier = profile?.accountTier || 'practitioner';
  return res.json({
    success: true,
    tier,
    premium: tier === 'premium',
    billingConfigured: billingConfigured(),
  });
}
