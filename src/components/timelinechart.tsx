'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';

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

type Range = 'day' | 'month' | '6m' | 'year';

type RawPriceRow = {
  price_per_gram_eur: number | null;
  fetched_at: string;
};

type DailyRow = {
  date: string;
  avg_price: number | null;
  min_price: number | null;
  max_price: number | null;
};

type ChartPoint = {
  label: string;

  goldAvg: number | null;
  goldMin: number | null;
  goldMax: number | null;

  silverAvg: number | null;
  silverMin: number | null;
  silverMax: number | null;
};

const RANGE_CONFIG: Record<
  Range,
  { label: string; days: number | 'day' }
> = {
  day: {
    label: 'Day',
    days: 'day',
  },

  month: {
    label: 'Month',
    days: 30,
  },

  '6m': {
    label: '6 Months',
    days: 182,
  },

  year: {
    label: 'Year',
    days: 365,
  },
};

const GOLD_COLOR = '#C9A227';
const SILVER_COLOR = '#9CA3AF';

const eurFormatter = new Intl.NumberFormat(
  'en-IE',
  {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }
);

function formatDay(date: string) {
  const parsed = new Date(`${date}T00:00:00`);

  return parsed.toLocaleDateString(
    'en-IE',
    {
      day: '2-digit',
      month: '2-digit',
    }
  );
}

function formatTime(value: string) {
  return value;
}

function average(
  values: number[]
) {
  if (values.length === 0) {
    return null;
  }

  return (
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length
  );
}

function minimum(
  values: number[]
) {
  if (values.length === 0) {
    return null;
  }

  return Math.min(...values);
}

function maximum(
  values: number[]
) {
  if (values.length === 0) {
    return null;
  }

  return Math.max(...values);
}

export default function TimelineChart() {
  const [range, setRange] =
    useState<Range>('month');

  const [data, setData] =
    useState<ChartPoint[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState('');

  const loadChartData =
    useCallback(
      async (
        selectedRange: Range
      ) => {
        setLoading(true);
        setErrorMessage('');

        try {
          const config =
            RANGE_CONFIG[
              selectedRange
            ];

          /*
           * DAY
           *
           * Use the EUR/gram value that was
           * stored at the exact moment the
           * price was fetched.
           */
          if (
            config.days === 'day'
          ) {
            const startOfToday =
              new Date();

            startOfToday.setHours(
              0,
              0,
              0,
              0
            );

            const [
              goldResult,
              silverResult,
            ] = await Promise.all([
              supabase
                .from('raw_prices')
                .select(
                  'price_per_gram_eur, fetched_at'
                )
                .eq(
                  'metal',
                  'gold'
                )
                .gte(
                  'fetched_at',
                  startOfToday.toISOString()
                )
                .not(
                  'price_per_gram_eur',
                  'is',
                  null
                )
                .order(
                  'fetched_at',
                  {
                    ascending: true,
                  }
                ),

              supabase
                .from('raw_prices')
                .select(
                  'price_per_gram_eur, fetched_at'
                )
                .eq(
                  'metal',
                  'silver'
                )
                .gte(
                  'fetched_at',
                  startOfToday.toISOString()
                )
                .not(
                  'price_per_gram_eur',
                  'is',
                  null
                )
                .order(
                  'fetched_at',
                  {
                    ascending: true,
                  }
                ),
            ]);

            if (goldResult.error) {
              throw new Error(
                `Gold history: ${goldResult.error.message}`
              );
            }

            if (silverResult.error) {
              throw new Error(
                `Silver history: ${silverResult.error.message}`
              );
            }

            const goldTicks =
              (goldResult.data ??
                []) as RawPriceRow[];

            const silverTicks =
              (silverResult.data ??
                []) as RawPriceRow[];

            /*
             * Put both metals on the same
             * minute-based x-axis.
             */
            const merged =
              new Map<
                string,
                ChartPoint
              >();

            const addTicks = (
              rows: RawPriceRow[],
              metal:
                | 'gold'
                | 'silver'
            ) => {
              rows.forEach(
                (row) => {
                  if (
                    row.price_per_gram_eur ==
                    null
                  ) {
                    return;
                  }

                  const time =
                    new Date(
                      row.fetched_at
                    );

                  const bucket =
                    time
                      .toISOString()
                      .slice(
                        11,
                        16
                      );

                  const existing =
                    merged.get(
                      bucket
                    ) ??
                    {
                      label: bucket,

                      goldAvg:
                        null,
                      goldMin:
                        null,
                      goldMax:
                        null,

                      silverAvg:
                        null,
                      silverMin:
                        null,
                      silverMax:
                        null,
                    };

                  if (
                    metal ===
                    'gold'
                  ) {
                    existing.goldAvg =
                      Number(
                        row.price_per_gram_eur
                      );
                  } else {
                    existing.silverAvg =
                      Number(
                        row.price_per_gram_eur
                      );
                  }

                  merged.set(
                    bucket,
                    existing
                  );
                }
              );
            };

            addTicks(
              goldTicks,
              'gold'
            );

            addTicks(
              silverTicks,
              'silver'
            );

            const sorted =
              Array.from(
                merged.values()
              ).sort(
                (a, b) =>
                  a.label.localeCompare(
                    b.label
                  )
              );

            setData(sorted);

            return;
          }

          /*
           * MONTH / 6 MONTHS / YEAR
           *
           * daily_summary currently contains
           * USD/oz. Until we add historical
           * EUR columns to daily_summary, the
           * chart cannot safely use it for
           * historical EUR/gram values.
           *
           * Therefore we calculate daily
           * EUR/gram directly from raw_prices.
           */
          const cutoff =
            new Date();

          cutoff.setDate(
            cutoff.getDate() -
              config.days
          );

          const [
            goldResult,
            silverResult,
          ] = await Promise.all([
            supabase
              .from('raw_prices')
              .select(
                'price_per_gram_eur, fetched_at'
              )
              .eq(
                'metal',
                'gold'
              )
              .gte(
                'fetched_at',
                cutoff.toISOString()
              )
              .not(
                'price_per_gram_eur',
                'is',
                null
              )
              .order(
                'fetched_at',
                {
                  ascending: true,
                }
              ),

            supabase
              .from('raw_prices')
              .select(
                'price_per_gram_eur, fetched_at'
              )
              .eq(
                'metal',
                'silver'
              )
              .gte(
                'fetched_at',
                cutoff.toISOString()
              )
              .not(
                'price_per_gram_eur',
                'is',
                null
              )
              .order(
                'fetched_at',
                {
                  ascending: true,
                }
              ),
          ]);

          if (goldResult.error) {
            throw new Error(
              `Gold history: ${goldResult.error.message}`
            );
          }

          if (silverResult.error) {
            throw new Error(
              `Silver history: ${silverResult.error.message}`
            );
          }

          const goldRows =
            (goldResult.data ??
              []) as RawPriceRow[];

          const silverRows =
            (silverResult.data ??
              []) as RawPriceRow[];

          /*
           * Group raw ticks by calendar day.
           */
          const grouped =
            new Map<
              string,
              {
                gold: number[];
                silver: number[];
              }
            >();

          const addRows = (
            rows: RawPriceRow[],
            metal:
              | 'gold'
              | 'silver'
          ) => {
            rows.forEach(
              (row) => {
                if (
                  row.price_per_gram_eur ==
                  null
                ) {
                  return;
                }

                const date =
                  row.fetched_at.slice(
                    0,
                    10
                  );

                const existing =
                  grouped.get(
                    date
                  ) ?? {
                    gold: [],
                    silver: [],
                  };

                const value =
                  Number(
                    row.price_per_gram_eur
                  );

                if (
                  !Number.isFinite(
                    value
                  )
                ) {
                  return;
                }

                existing[
                  metal
                ].push(value);

                grouped.set(
                  date,
                  existing
                );
              }
            );
          };

          addRows(
            goldRows,
            'gold'
          );

          addRows(
            silverRows,
            'silver'
          );

          /*
           * Convert each day's raw ticks
           * into average/min/max.
           */
          const chartRows =
            Array.from(
              grouped.entries()
            )
              .map(
                ([
                  date,
                  values,
                ]) => ({
                  label:
                    formatDay(
                      date
                    ),

                  goldAvg:
                    average(
                      values.gold
                    ),

                  goldMin:
                    minimum(
                      values.gold
                    ),

                  goldMax:
                    maximum(
                      values.gold
                    ),

                  silverAvg:
                    average(
                      values.silver
                    ),

                  silverMin:
                    minimum(
                      values.silver
                    ),

                  silverMax:
                    maximum(
                      values.silver
                    ),
                })
              )
              .sort(
                (a, b) =>
                  a.label.localeCompare(
                    b.label
                  )
              );

          setData(
            chartRows
          );
        } catch (error) {
          console.error(
            'Could not load chart data:',
            error
          );

          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Could not load chart data.'
          );

          setData([]);
        } finally {
          setLoading(false);
        }
      },
      []
    );

  useEffect(() => {
    loadChartData(range);
  }, [
    range,
    loadChartData,
  ]);

  const hasData =
    useMemo(
      () =>
        data.some(
          (point) =>
            point.goldAvg !=
              null ||
            point.silverAvg !=
              null
        ),
      [data]
    );

  const showBand =
    range !== 'day';

  return (
    <section
      style={panelStyle}
    >
      <div
        style={{
          display: 'flex',
          justifyContent:
            'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 18,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <p
            style={
              eyebrowStyle
            }
          >
            HISTORY
          </p>

          <h2
            style={{
              fontSize: 17,
              fontWeight: 600,
              margin: 0,
            }}
          >
            Price over time
          </h2>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 6,
          }}
        >
          {(
            Object.keys(
              RANGE_CONFIG
            ) as Range[]
          ).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() =>
                setRange(r)
              }
              style={{
                padding:
                  '7px 12px',
                borderRadius: 7,
                border: `1px solid ${
                  range === r
                    ? '#EDEDE9'
                    : '#2A2B33'
                }`,
                background:
                  range === r
                    ? '#EDEDE9'
                    : 'transparent',
                color:
                  range === r
                    ? '#14151A'
                    : '#8B8D98',
                fontSize: 12,
                fontWeight: 600,
                cursor:
                  'pointer',
              }}
            >
              {
                RANGE_CONFIG[
                  r
                ].label
              }
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p
          style={{
            color:
              '#8B8D98',
            fontSize: 13,
          }}
        >
          Loading chart…
        </p>
      ) : errorMessage ? (
        <p
          style={{
            color:
              '#E07171',
            fontSize: 13,
          }}
        >
          {errorMessage}
        </p>
      ) : !hasData ? (
        <p
          style={{
            color:
              '#8B8D98',
            fontSize: 13,
          }}
        >
          No price history yet
          for this range. Once
          your price cron job has
          been running, this fills
          in automatically.
        </p>
      ) : (
        <div
          style={{
            width: '100%',
            height: 280,
          }}
        >
          <ResponsiveContainer>
            <ComposedChart
              data={data}
              margin={{
                top: 4,
                right: 4,
                bottom: 0,
                left: 0,
              }}
            >
              <CartesianGrid
                stroke="#2A2B33"
                strokeDasharray="3 3"
                vertical={false}
              />

              <XAxis
                dataKey="label"
                tick={{
                  fill: '#8B8D98',
                  fontSize: 11,
                }}
                axisLine={{
                  stroke:
                    '#2A2B33',
                }}
                tickLine={false}
                minTickGap={24}
              />

              <YAxis
                yAxisId="gold"
                orientation="left"
                tick={{
                  fill:
                    GOLD_COLOR,
                  fontSize: 11,
                }}
                axisLine={false}
                tickLine={false}
                width={54}
                tickFormatter={(
                  value
                ) =>
                  `€${Math.round(
                    value
                  )}`
                }
              />

              <YAxis
                yAxisId="silver"
                orientation="right"
                tick={{
                  fill:
                    SILVER_COLOR,
                  fontSize: 11,
                }}
                axisLine={false}
                tickLine={false}
                width={54}
                tickFormatter={(
                  value
                ) =>
                  `€${value.toFixed(
                    1
                  )}`
                }
              />

              <Tooltip
  contentStyle={{
    background: '#1C1D24',
    border: '1px solid #2A2B33',
    borderRadius: 8,
    fontSize: 12,
  }}
  labelStyle={{
    color: '#8B8D98',
    marginBottom: 4,
  }}
  formatter={(value, name) => [
    value == null
      ? '—'
      : eurFormatter.format(Number(value)),
    String(name),
  ]}
/>

              {showBand && (
                <Area
                  yAxisId="gold"
                  dataKey="goldMax"
                  stroke="none"
                  fill={
                    GOLD_COLOR
                  }
                  fillOpacity={0.08}
                  isAnimationActive={
                    false
                  }
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
                  isAnimationActive={
                    false
                  }
                  legendType="none"
                  name="Gold range floor"
                />
              )}

              <Line
                yAxisId="gold"
                dataKey="goldAvg"
                stroke={
                  GOLD_COLOR
                }
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={
                  false
                }
                name="Gold"
              />

              <Line
                yAxisId="silver"
                dataKey="silverAvg"
                stroke={
                  SILVER_COLOR
                }
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={
                  false
                }
                name="Silver"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 16,
          marginTop: 14,
          fontSize: 11,
          color: '#8B8D98',
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems:
              'center',
            gap: 6,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background:
                GOLD_COLOR,
            }}
          />

          Gold (EUR/g)
        </span>

        <span
          style={{
            display: 'flex',
            alignItems:
              'center',
            gap: 6,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background:
                SILVER_COLOR,
            }}
          />

          Silver (EUR/g)
        </span>
      </div>
    </section>
  );
}

const panelStyle: CSSProperties = {
  background: '#1C1D24',
  border:
    '1px solid #2A2B33',
  borderRadius: 12,
  padding: 20,
};

const eyebrowStyle: CSSProperties = {
  color: '#8B8D98',
  fontSize: 10,
  letterSpacing:
    '0.10em',
  fontWeight: 600,
  margin: 0,
};