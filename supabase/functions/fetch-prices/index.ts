// supabase/functions/fetch-prices/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOLDPRICEZ_URL =
  'https://goldpricez.com/api/rates/currency/eur/measure/gram/metal/all';

function finitePositive(value: unknown, name: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`GoldPriceZ response is missing a valid ${name}.`);
  }
  return number;
}

function parseGoldPriceZBody(value: unknown): Record<string, unknown> {
  // GoldPriceZ can return JSON as a JSON-encoded string.
  if (typeof value === 'string') {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('GoldPriceZ returned an invalid JSON payload.');
    }
    return parsed as Record<string, unknown>;
  }
  if (!value || typeof value !== 'object') {
    throw new Error('GoldPriceZ returned an invalid response.');
  }
  return value as Record<string, unknown>;
}

Deno.serve(async () => {
  const apiKey = Deno.env.get('GOLDPRICEZ_API_KEY');
  // SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected by Supabase
  // into every Edge Function's environment, no need to set them yourself.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!apiKey || !supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Missing required environment variables.' }),
      { status: 500 }
    );
  }

  try {
    const response = await fetch(GOLDPRICEZ_URL, {
      method: 'GET',
      headers: { 'X-API-KEY': apiKey, Accept: 'application/json' },
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`GoldPriceZ request failed (${response.status}): ${text}`);
    }

    const outerData = JSON.parse(text);
    const data = parseGoldPriceZBody(outerData);

    const goldUsdPerOunce = finitePositive(data.ounce_price_usd, 'gold ounce_price_usd');

    // raw_prices stores USD per troy ounce; GoldPriceZ gives silver per gram,
    // so convert using the same gram-to-ounce factor the API supplies.
    const gramToOunce = finitePositive(
      data.gram_to_ounce_formula ?? 0.0321,
      'gram_to_ounce_formula'
    );
    const silverUsdPerOunce =
      finitePositive(data.silver_gram_in_usd, 'silver silver_gram_in_usd') / gramToOunce;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabase.from('raw_prices').insert([
      { metal: 'gold', price_per_oz_usd: goldUsdPerOunce },
      { metal: 'silver', price_per_oz_usd: silverUsdPerOunce },
    ]);

    if (error) throw new Error(error.message);

    return new Response(
      JSON.stringify({ ok: true, gold: goldUsdPerOunce, silver: silverUsdPerOunce }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('fetch-prices error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 502 }
    );
  }
});