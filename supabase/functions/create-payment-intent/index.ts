import {serve} from 'https://deno.land/std@0.224.0/http/server.ts';
import {createPaymentIntentHandler} from './handler.ts';
import {readJsonObject} from '../_shared/http.ts';

// Minimal Stripe REST client using fetch (no SDK dependency in Deno edge runtime)
function makeStripeApi(secretKey: string) {
  async function stripePost(path: string, params: Record<string, string>) {
    const body = new URLSearchParams(params);
    const res = await fetch(`https://api.stripe.com/v1${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Stripe ${path} failed: ${err}`);
    }
    return res.json();
  }

  async function stripeGet(path: string) {
    const res = await fetch(`https://api.stripe.com/v1${path}`, {
      headers: {Authorization: `Bearer ${secretKey}`},
    });
    if (!res.ok) throw new Error(`Stripe GET ${path} failed`);
    return res.json();
  }

  return {
    async createOrRetrieveCustomer(matrixUserId: string) {
      // Search for existing customer by metadata
      const search = await stripeGet(
        `/customers/search?query=metadata["matrix_user_id"]:"${encodeURIComponent(matrixUserId)}"`,
      );
      if (search.data?.length > 0) return search.data[0];
      return stripePost('/customers', {
        'metadata[matrix_user_id]': matrixUserId,
      });
    },
    createEphemeralKey(customerId: string) {
      return stripePost('/ephemeral_keys', {
        customer: customerId,
        'Stripe-Version': '2023-10-16',
      });
    },
    createPaymentIntent(customerId: string, priceId: string) {
      return stripePost('/payment_intents', {
        amount: '19900',  // amount set by price lookup in production; hardcoded here as placeholder
        currency: 'usd',
        customer: customerId,
        'metadata[price_id]': priceId,
        'automatic_payment_methods[enabled]': 'true',
      });
    },
  };
}

serve(async req => {
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  const stripePriceId = Deno.env.get('STRIPE_SUBSCRIPTION_PRICE_ID') ?? '';
  const stripePublishableKey = Deno.env.get('STRIPE_PUBLISHABLE_KEY') ?? '';

  const body = readJsonObject<unknown>(await req.text());
  const handler = createPaymentIntentHandler(makeStripeApi(stripeSecretKey), {
    stripeSecretKey,
    stripePriceId,
    stripePublishableKey,
  });
  const result = await handler(body);

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {'Content-Type': 'application/json'},
  });
});
