'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { TROY_OUNCE_IN_GRAMS } from '@/lib/purity';

type Range = 'day' | 'month' | '6m' | 'year';

type ChartPoint = {
  label: string;
  goldAvg: number | null;
  goldMin?: number | null;
  goldMax?: number | null;
  silverAvg: number | null;
  silverMin?: number | null;
  silverMax?: number | null;
};

const RANGE_CONFIG: Record<Range, { label: string; days: number | 'day' }> = {
  day: { label: 'Day', days: 'day' },
  month: { label: 'Month', days: 30 },
  '6m': { label: '6 Months', days: 182 },
  year: { label: 'Year', days: 365 },
};

const GOLD_COLOR = '#C9A227';
const SILVER_COLOR = '#9CA3AF';

const eurFormatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

function usdOzToEurGram(usdOz: number | null, usdToEur: number | null): number | null {
  if (usdOz == null || usdToEur == null || usdToEur <= 0) return null;
  return (usdOz / TROY_OUNCE_IN_GRAMS) * usdToEur;
}

export default function TimelineChart() {
  const [range, setRange] = useState<Range>('month');
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadChartData = useCallback(async (selectedRange: Range) => {
    setLoading(true);
    setErrorMessage('');

    try {
      const priceResponse = await fetch('/api/prices', { cache: 'no-store' });
      if (!priceResponse.ok) throw new Error(`Price API failed (${priceResponse.status})`);
      const priceData = await priceResponse.json();
      const usdToEur = Number(priceData?.usdToEur);

      const config = RANGE_CONFIG[selectedRange];

      if (config.days === 'day') {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const [{ data: goldTicks }, { data: silverTicks }] = await Promise.all([
          supabase
            .from('raw_prices')
            .select('price_per_oz_usd, fetched_at')
            .eq('metal', 'gold')
            .gte('fetched_at', startOfToday.toISOString())
            .order('fetched_at', { ascending: true }),
          supabase
            .from('raw_prices')
            .select('price_per_oz_usd, fetched_at')
            .eq('metal', 'silver')
            .gte('fetched_at', startOfToday.toISOString())
            .order('fetched_at', { ascending: true }),
        ]);

        // Merge gold/silver ticks onto a shared set of timestamps, rounded to
        // the nearest minute so points from both metals line up on one axis.
        const merged = new Map<string, ChartPoint>();

        const addTick = (rows: { price_per_oz_usd: number; fetched_at: string }[] | null, key: 'goldAvg' | 'silverAvg') => {
          (rows ?? []).forEach((row) => {
            const time = new Date(row.fetched_at);
            const bucket = time.toISOString().slice(11, 16); // HH:MM
            const existing = merged.get(bucket) ?? { label: bucket, goldAvg: null, silverAvg: null };
            existing[key] = usdOzToEurGram(Number(row.price_per_oz_usd), usdToEur);
            merged.set(bucket, existing);
          });
        };

        addTick(goldTicks, 'goldAvg');
        addTick(silverTicks, 'silverAvg');

        const sorted = Array.from(merged.values()).sort((a, b) => a.label.localeCompare(b.label));
        setData(sorted);
      } else {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - config.days);
        const cutoffStr = cutoff.toISOString().slice(0, 10);

        const [{ data: goldRows }, { data: silverRows }] = await Promise.all([
          supabase
            .from('daily_summary')
            .select('date, avg_price, min_price, max_price')
            .eq('metal', 'gold')
            .gte('date', cutoffStr)
            .order('date', { ascending: true }),
          supabase
            .from('daily_summary')
            .select('date, avg_price, min_price, max_price')
            .eq('metal', 'silver')
            .gte('date', cutoffStr)
            .order('date', { ascending: true }),
        ]);

        const merged = new Map<string, ChartPoint>();

        const addRow = (
          rows: { date: string; avg_price: number; min_price: number; max_price: number }[] | null,
          prefix: 'gold' | 'silver'
        ) => {
          (rows ?? []).forEach((row) => {
            const existing = merged.get(row.date) ?? { label: row.date, goldAvg: null, silverAvg: null };
            existing[`${prefix}Avg`] = usdOzToEurGram(Number(row.avg_price), usdToEur);
            existing[`${prefix}Min`] = usdOzToEurGram(Number(row.min_price), usdToEur);
            existing[`${prefix}Max`] = usdOzToEurGram(Number(row.max_price), usdToEur);
            merged.set(row.date, existing);
          });
        };

        addRow(goldRows, 'gold');
        addRow(silverRows, 'silver');

        const sorted = Array.from(merged.values()).sort((a, b) => a.label.localeCompare(b.label));
        setData(sorted);
      }
    } catch (error) {
      console.error('Could not load chart data:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Could not load chart data.');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChartData(range);
  }, [range, loadChartData]);

  const hasData = useMemo(
    () => data.some((d) => d.goldAvg != null || d.silverAvg != null),
    [data]
  );

  const showBand = range !== 'day';

  return (
    <section style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <p style={eyebrowStyle}>HISTORY</p>
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Price over time</h2>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {(Object.keys(RANGE_CONFIG) as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              style={{
                padding: '7px 12px',
                borderRadius: 7,
                border: `1px solid ${range === r ? '#EDEDE9' : '#2A2B33'}`,
                background: range === r ? '#EDEDE9' : 'transparent',
                color: range === r ? '#14151A' : '#8B8D98',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {RANGE_CONFIG[r].label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#8B8D98', fontSize: 13 }}>Loading chart…</p>
      ) : errorMessage ? (
        <p style={{ color: '#E07171', fontSize: 13 }}>{errorMessage}</p>
      ) : !hasData ? (
        <p style={{ color: '#8B8D98', fontSize: 13 }}>
          No price history yet for this range. Once your price cron job has been running a while, this fills in automatically.
        </p>
      ) : (
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#2A2B33" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#8B8D98', fontSize: 11 }}
                axisLine={{ stroke: '#2A2B33' }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                yAxisId="gold"
                orientation="left"
                tick={{ fill: GOLD_COLOR, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={54}
                tickFormatter={(v) => `€${Math.round(v)}`}
              />
              <YAxis
                yAxisId="silver"
                orientation="right"
                tick={{ fill: SILVER_COLOR, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={54}
                tickFormatter={(v) => `€${v.toFixed(1)}`}
              />
              <Tooltip
                contentStyle={{
                  background: '#1C1D24',
                  border: '1px solid #2A2B33',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#8B8D98', marginBottom: 4 }}
                formatter={(value: number, name: string) => [eurFormatter.format(value), name]}
              />

              {showBand && (
                <Area
                  yAxisId="gold"
                  dataKey="goldMax"
                  stroke="none"
                  fill={GOLD_COLOR}
                  fillOpacity={0.08}
                  isAnimationActive={false}
                  name="Gold range"
                />
              )}
              {showBand && (
                <Area
                  yAxisId="gold"
                  dataKey="goldMin"
                  stroke="none"
                  fill="#1C1D24"
                  fillOpacity={1}
                  isAnimationActive={false}
                  legendType="none"
                  name="Gold range floor"
                />
              )}

              <Line
                yAxisId="gold"
                dataKey="goldAvg"
                stroke={GOLD_COLOR}
                strokeWidth={2}
                dot={false}
                connectNulls
                name="Gold"
              />
              <Line
                yAxisId="silver"
                dataKey="silverAvg"
                stroke={SILVER_COLOR}
                strokeWidth={2}
                dot={false}
                connectNulls
                name="Silver"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 11, color: '#8B8D98' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: GOLD_COLOR }} />
          Gold (EUR/g)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: SILVER_COLOR }} />
          Silver (EUR/g)
        </span>
      </div>
    </section>
  );
}

const panelStyle: CSSProperties = {
  background: '#1C1D24',
  border: '1px solid #2A2B33',
  borderRadius: 12,
  padding: 20,
};

const eyebrowStyle: CSSProperties = {
  color: '#8B8D98',
  fontSize: 10,
  letterSpacing: '0.10em',
  fontWeight: 600,
  margin: 0,
};