// supabase/functions/fetch-prices/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOLDPRICEZ_URL =
  'https://goldpricez.com/api/rates/currency/eur/measure/gram/metal/all';

const TROY_OUNCE_IN_GRAMS = 31.1034768;

function parseGoldPriceZResponse(text: string) {
  const outer = JSON.parse(text);

  // GoldPriceZ can return the actual JSON payload as a JSON-encoded string.
  if (typeof outer === 'string') {
    return JSON.parse(outer);
  }

  return outer;
}

Deno.serve(async () => {
  try {
    const goldPriceZApiKey = Deno.env.get('GOLDPRICEZ_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get(
      'SUPABASE_SERVICE_ROLE_KEY'
    );

    if (
      !goldPriceZApiKey ||
      !supabaseUrl ||
      !supabaseServiceRoleKey
    ) {
      return new Response(
        JSON.stringify({
          error: 'Required environment variables are missing.',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Fetch the latest gold/silver prices from GoldPriceZ.
    const response = await fetch(GOLDPRICEZ_URL, {
      method: 'GET',
      headers: {
        'X-API-KEY': goldPriceZApiKey,
        Accept: 'application/json',
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(
        'GoldPriceZ request failed:',
        response.status,
        responseText
      );

      return new Response(
        JSON.stringify({
          error: `GoldPriceZ request failed (${response.status})`,
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const data = parseGoldPriceZResponse(responseText);

    // Gold
    const goldUsdPerOunce = Number(data?.ounce_price_usd);

    // FX
    const usdToEur = Number(data?.usd_to_eur);

    // Gold EUR/gram is supplied directly by GoldPriceZ.
    const goldEurPerGram = Number(data?.gram_in_eur);

    // Silver
    const silverEurPerGram = Number(data?.silver_gram_in_eur);
    const silverUsdPerGram = Number(data?.silver_gram_in_usd);

    // Convert silver USD/gram to USD/troy ounce.
    const silverUsdPerOunce =
      Number.isFinite(silverUsdPerGram) && silverUsdPerGram > 0
        ? silverUsdPerGram * TROY_OUNCE_IN_GRAMS
        : null;

    if (
      !Number.isFinite(goldUsdPerOunce) ||
      goldUsdPerOunce <= 0
    ) {
      throw new Error('Invalid gold USD/oz price from GoldPriceZ.');
    }

    if (
      !Number.isFinite(usdToEur) ||
      usdToEur <= 0
    ) {
      throw new Error('Invalid USD/EUR exchange rate from GoldPriceZ.');
    }

    if (
      !Number.isFinite(goldEurPerGram) ||
      goldEurPerGram <= 0
    ) {
      throw new Error('Invalid gold EUR/gram price from GoldPriceZ.');
    }

    if (
      !Number.isFinite(silverEurPerGram) ||
      silverEurPerGram <= 0
    ) {
      throw new Error('Invalid silver EUR/gram price from GoldPriceZ.');
    }

    if (
      silverUsdPerOunce == null ||
      !Number.isFinite(silverUsdPerOunce) ||
      silverUsdPerOunce <= 0
    ) {
      throw new Error('Invalid silver USD/oz price from GoldPriceZ.');
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceRoleKey
    );

    // Store gold.
    const { error: goldInsertError } = await supabase
      .from('raw_prices')
      .insert({
        metal: 'gold',
        price_per_oz_usd: goldUsdPerOunce,
        price_per_gram_eur: goldEurPerGram,
        usd_to_eur: usdToEur,
      });

    if (goldInsertError) {
      throw new Error(
        `Could not insert gold price: ${goldInsertError.message}`
      );
    }

    // Store silver.
    const { error: silverInsertError } = await supabase
      .from('raw_prices')
      .insert({
        metal: 'silver',
        price_per_oz_usd: silverUsdPerOunce,
        price_per_gram_eur: silverEurPerGram,
        usd_to_eur: usdToEur,
      });

    if (silverInsertError) {
      throw new Error(
        `Could not insert silver price: ${silverInsertError.message}`
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        gold: {
          usdPerOunce: goldUsdPerOunce,
          eurPerGram: goldEurPerGram,
        },
        silver: {
          usdPerOunce: silverUsdPerOunce,
          eurPerGram: silverEurPerGram,
        },
        usdToEur,
        fetchedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('fetch-prices error:', error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
});