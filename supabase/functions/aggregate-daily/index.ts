// supabase/functions/aggregate-daily/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Missing required environment variables.' }),
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Always aggregate "yesterday" (UTC), so this is safe to run any time today
  // without missing late-night ticks.
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);
  const startOfDay = `${dateStr}T00:00:00.000Z`;
  const endOfDay = `${dateStr}T23:59:59.999Z`;

  try {
    const results: Record<string, unknown> = {};

    for (const metal of ['gold', 'silver']) {
      const { data: rows, error } = await supabase
        .from('raw_prices')
        .select('price_per_oz_usd')
        .eq('metal', metal)
        .gte('fetched_at', startOfDay)
        .lte('fetched_at', endOfDay);

      if (error) throw new Error(error.message);
      if (!rows || rows.length === 0) {
        results[metal] = 'no ticks found, skipped';
        continue;
      }

      const prices = rows.map((r) => Number(r.price_per_oz_usd));
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      const min = Math.min(...prices);
      const max = Math.max(...prices);

      const { error: upsertError } = await supabase
        .from('daily_summary')
        .upsert(
          { metal, date: dateStr, avg_price: avg, min_price: min, max_price: max },
          { onConflict: 'metal,date' }
        );

      if (upsertError) throw new Error(upsertError.message);
      results[metal] = { avg, min, max, ticks: prices.length };
    }

    return new Response(JSON.stringify({ ok: true, date: dateStr, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('aggregate-daily error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 502 }
    );
  }
});