import { NextResponse } from 'next/server';

const GOLDPRICEZ_URL =
  'https://goldpricez.com/api/rates/currency/eur/measure/gram/metal/all';

type GoldPriceZResponse = {
  ounce_price_usd?: string | number;
  usd_to_eur?: string | number;
  gram_in_usd?: string | number;
  gram_in_eur?: string | number;
  silver_gram_in_usd?: string | number;
  silver_gram_in_eur?: string | number;
  silver_ounce_in_eur?: string | number;
  gram_to_ounce_formula?: string | number;
  gmt_ounce_price_usd_updated?: string;
  gmt_eur_updated?: string;
};

type NormalizedPrices = {
  gold: {
    eurPerGram: number;
    usdPerOunce: number;
  };
  silver: {
    eurPerGram: number;
    usdPerOunce: number;
  };
  usdToEur: number;
  fetchedAt: string;
  sourceUpdatedAt: string | null;
};

function parseGoldPriceZBody(value: unknown): GoldPriceZResponse {
  // GoldPriceZ can return JSON as a JSON-encoded string, e.g.
  // ""{\"ounce_price_usd\":...}"".
  if (typeof value === 'string') {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('GoldPriceZ returned an invalid JSON payload.');
    }
    return parsed as GoldPriceZResponse;
  }

  if (!value || typeof value !== 'object') {
    throw new Error('GoldPriceZ returned an invalid response.');
  }

  return value as GoldPriceZResponse;
}

function finitePositive(value: unknown, name: string): number {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`GoldPriceZ response is missing a valid ${name}.`);
  }

  return number;
}

export async function GET() {
  const apiKey = process.env.GOLDPRICEZ_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'GOLDPRICEZ_API_KEY is not configured on the server.' },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(GOLDPRICEZ_URL, {
      method: 'GET',
      headers: {
        'X-API-KEY': apiKey,
        Accept: 'application/json',
      },
      next: { revalidate: 60 },
    });

    const text = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'GoldPriceZ request failed.',
          status: response.status,
          details: text,
        },
        { status: response.status },
      );
    }

    let outerData: unknown;

    try {
      outerData = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          error: 'GoldPriceZ returned invalid JSON.',
          details: text,
        },
        { status: 502 },
      );
    }

    let data: GoldPriceZResponse;

    try {
      data = parseGoldPriceZBody(outerData);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'GoldPriceZ returned an invalid payload.',
        },
        { status: 502 },
      );
    }

    const goldEurPerGram = finitePositive(data.gram_in_eur, 'gold gram_in_eur');
    const silverEurPerGram = finitePositive(
      data.silver_gram_in_eur,
      'silver silver_gram_in_eur',
    );
    const goldUsdPerOunce = finitePositive(
      data.ounce_price_usd,
      'gold ounce_price_usd',
    );
    const usdToEur = finitePositive(data.usd_to_eur, 'usd_to_eur');

    // GoldPriceZ supplies silver per gram but the existing Supabase
    // raw_prices table stores USD per troy ounce. Its response also
    // supplies the grams-to-troy-ounce conversion factor.
    const gramToOunce = finitePositive(
      data.gram_to_ounce_formula ?? 0.0321,
      'gram_to_ounce_formula',
    );

    const silverUsdPerOunce = finitePositive(
      data.silver_gram_in_usd,
      'silver silver_gram_in_usd',
    ) / gramToOunce;

    const normalized: NormalizedPrices = {
      gold: {
        eurPerGram: goldEurPerGram,
        usdPerOunce: goldUsdPerOunce,
      },
      silver: {
        eurPerGram: silverEurPerGram,
        usdPerOunce: silverUsdPerOunce,
      },
      usdToEur,
      fetchedAt: new Date().toISOString(),
      sourceUpdatedAt:
        data.gmt_eur_updated ?? data.gmt_ounce_price_usd_updated ?? null,
    };

    return NextResponse.json(normalized, {
      status: 200,
      headers: {
        'Cache-Control':
          'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('GoldPriceZ API error:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not process GoldPriceZ response.',
      },
      { status: 502 },
    );
  }
}
