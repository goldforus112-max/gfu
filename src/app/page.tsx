'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Fraunces, Inter } from 'next/font/google';
import { supabase } from '@/lib/supabase';
import {
  GOLD_PURITY,
  SILVER_PURITY,
} from '@/lib/purity';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-display',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
});

type Metal = 'gold' | 'silver';
type Signal = 'low' | 'high' | 'neutral' | 'unavailable';

type Holding = {
  id: string;
  metal: Metal;
  grams: number;
  purity: number;
  label: string | null;
  created_at: string;
};

type PricePoint = {
  priceEurPerGram: number | null;
  averageEurPerGram: number | null;
  fetchedAt: string | null;
};

type Prices = {
  gold: PricePoint;
  silver: PricePoint;
};

type Vendor = {
  name: string;
  description: string;
  buyUrl: string;
  sellUrl?: string;
};

const MONTHLY_BUDGET_KEY = 'goldforus-monthly-budget-eur';

const vendors: Vendor[] = [
  {
    name: 'Holland Gold',
    description: 'Buy physical gold and silver',
    buyUrl: 'https://www.hollandgold.nl/',
    sellUrl: 'https://www.hollandgold.nl/',
  },
];

const eurFormatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-IE', {
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat('en-IE', {
  maximumFractionDigits: 1,
  signDisplay: 'always',
});

function formatMetal(metal: Metal) {
  return metal === 'gold' ? 'Gold' : 'Silver';
}

function formatPurity(purity: number) {
  return purity >= 0.9995
    ? '999.9'
    : purity >= 0.999
      ? '999'
      : String(Math.round(purity * 1000));
}

function signalFor(price: number | null, average: number | null): Signal {
  if (price == null || average == null || average <= 0) return 'unavailable';

  if (price > average) return 'high';
  if (price < average) return 'low';
  return 'neutral';
}

function signalLabel(signal: Signal) {
  switch (signal) {
    case 'low':
      return 'LOW';
    case 'high':
      return 'HIGH';
    case 'neutral':
      return 'AT AVERAGE';
    default:
      return 'NO DATA';
  }
}

function signalColor(signal: Signal) {
  switch (signal) {
    case 'low':
      return '#E07171';
    case 'high':
      return '#63C58A';
    case 'neutral':
      return '#C9A227';
    default:
      return '#8B8D98';
  }
}

function signalBackground(signal: Signal) {
  switch (signal) {
    case 'low':
      return 'rgba(224,113,113,0.10)';
    case 'high':
      return 'rgba(99,197,138,0.10)';
    case 'neutral':
      return 'rgba(201,162,39,0.10)';
    default:
      return 'rgba(139,141,152,0.08)';
  }
}

function percentVsAverage(price: number | null, average: number | null) {
  if (price == null || average == null || average <= 0) return null;
  return ((price - average) / average) * 100;
}

export default function Home() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [prices, setPrices] = useState<Prices>({
    gold: { priceEurPerGram: null, averageEurPerGram: null, fetchedAt: null },
    silver: { priceEurPerGram: null, averageEurPerGram: null, fetchedAt: null },
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [monthlyBudget, setMonthlyBudget] = useState(500);
  const [budgetInput, setBudgetInput] = useState('500');
  const [budgetEditing, setBudgetEditing] = useState(false);

  const [metal, setMetal] = useState<Metal>('gold');
  const [grams, setGrams] = useState('');
  const [purity, setPurity] = useState<number>(0.999);
  const [label, setLabel] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [saving, setSaving] = useState(false);

  const [investedThisMonth, setInvestedThisMonth] = useState(0);

  const purityOptions = metal === 'gold' ? GOLD_PURITY : SILVER_PURITY;

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const loadBudget = useCallback(() => {
    try {
      const stored = window.localStorage.getItem(MONTHLY_BUDGET_KEY);
      if (stored) {
        const value = Number(stored);
        if (Number.isFinite(value) && value >= 0) {
          setMonthlyBudget(value);
          setBudgetInput(String(value));
        }
      }
    } catch {
      // localStorage may be unavailable; keep the default.
    }
  }, []);

  const saveBudget = () => {
    const value = Number(budgetInput);

    if (!Number.isFinite(value) || value < 0) {
      setBudgetInput(String(monthlyBudget));
      setBudgetEditing(false);
      return;
    }

    setMonthlyBudget(value);

    try {
      window.localStorage.setItem(MONTHLY_BUDGET_KEY, String(value));
    } catch {
      // Keep the in-memory value if storage is unavailable.
    }

    setBudgetEditing(false);
  };

  const loadInvestedThisMonth = useCallback(async () => {
    /*
     * The current holdings table does not contain a purchase price/date
     * suitable for calculating monthly investment totals. Until a
     * transactions table is added, this value is kept in localStorage.
     */
    try {
      const key = `goldforus-invested-${currentMonthKey}`;
      const stored = window.localStorage.getItem(key);
      const value = stored ? Number(stored) : 0;

      if (Number.isFinite(value) && value >= 0) {
        setInvestedThisMonth(value);
      } else {
        setInvestedThisMonth(0);
      }
    } catch {
      setInvestedThisMonth(0);
    }
  }, [currentMonthKey]);

  const loadData = useCallback(async () => {
    setErrorMessage('');

    try {
      const [holdingsResult, priceResponse, goldAverageResult, silverAverageResult] =
        await Promise.all([
          supabase
            .from('holdings')
            .select('*')
            .order('created_at', { ascending: false }),

          fetch('/api/prices', { cache: 'no-store' }),

          supabase
            .from('daily_summary')
            .select('date, avg_price')
            .eq('metal', 'gold')
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle(),

          supabase
            .from('daily_summary')
            .select('date, avg_price')
            .eq('metal', 'silver')
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

      if (holdingsResult.error) {
        setErrorMessage(holdingsResult.error.message);
      }

      if (!priceResponse.ok) {
        throw new Error(`GoldPriceZ request failed (${priceResponse.status})`);
      }

      const data = await priceResponse.json();

      // /api/prices normalizes the GoldPriceZ response into a stable shape.
      const goldPriceEur = Number(data?.gold?.eurPerGram);
      const silverPriceEur = Number(data?.silver?.eurPerGram);
      const usdToEur = Number(data?.usdToEur);

      const fetchedAt = data?.fetchedAt ?? new Date().toISOString();

      const goldAverageUsdOz =
        goldAverageResult.data?.avg_price != null
          ? Number(goldAverageResult.data.avg_price)
          : null;
      const silverAverageUsdOz =
        silverAverageResult.data?.avg_price != null
          ? Number(silverAverageResult.data.avg_price)
          : null;

      // daily_summary.avg_price is stored in USD/troy oz by the existing app.
      // Convert it to EUR/gram using the same live FX rate supplied by GoldPriceZ.
      const goldAverageEur =
        goldAverageUsdOz != null && Number.isFinite(usdToEur) && usdToEur > 0
          ? (goldAverageUsdOz / 31.1034768) * usdToEur
          : null;

      const silverAverageEur =
        silverAverageUsdOz != null && Number.isFinite(usdToEur) && usdToEur > 0
          ? (silverAverageUsdOz / 31.1034768) * usdToEur
          : null;

      setHoldings((holdingsResult.data ?? []) as Holding[]);

      setPrices({
        gold: {
          priceEurPerGram:
            Number.isFinite(goldPriceEur) && goldPriceEur > 0
              ? goldPriceEur
              : null,
          averageEurPerGram: goldAverageEur,
          fetchedAt,
        },
        silver: {
          priceEurPerGram:
            Number.isFinite(silverPriceEur) && silverPriceEur > 0
              ? silverPriceEur
              : null,
          averageEurPerGram: silverAverageEur,
          fetchedAt,
        },
      });
    } catch (error) {
      console.error('Could not load prices:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not load prices.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  useEffect(() => {
    loadBudget();
    loadInvestedThisMonth();
    loadData();

    const channel = supabase
      .channel('goldforus-price-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'raw_prices',
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadBudget, loadInvestedThisMonth, loadData]);

  const priceInEurPerGram = (metalType: Metal) => {
    return metalType === 'gold'
      ? prices.gold.priceEurPerGram
      : prices.silver.priceEurPerGram;
  };

  const valueForEur = (h: Holding) => {
    const price = priceInEurPerGram(h.metal);

    if (price == null) return null;

    return h.grams * h.purity * price;
  };

  const totalValueEur = holdings.reduce((sum, h) => {
    const value = valueForEur(h);
    return value == null ? sum : sum + value;
  }, 0);

  const hasValueData =
    holdings.length > 0 &&
    holdings.some((h) => valueForEur(h) != null);

  const remainingBudget = Math.max(monthlyBudget - investedThisMonth, 0);
  const budgetPercent =
    monthlyBudget > 0
      ? Math.min((investedThisMonth / monthlyBudget) * 100, 100)
      : 0;

  function recordInvestment(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) return;

    const next = investedThisMonth + amount;
    setInvestedThisMonth(next);

    try {
      window.localStorage.setItem(
        `goldforus-invested-${currentMonthKey}`,
        String(next)
      );
    } catch {
      // Keep the in-memory value.
    }
  }

  async function handleAddHolding(e: FormEvent) {
    e.preventDefault();

    const gramsNum = Number(grams);
    const paidNum = purchasePrice ? Number(purchasePrice) : 0;

    if (!Number.isFinite(gramsNum) || gramsNum <= 0) return;

    if (
      purchasePrice &&
      (!Number.isFinite(paidNum) || paidNum <= 0)
    ) {
      return;
    }

    setSaving(true);

    const { error } = await supabase.from('holdings').insert({
      metal,
      grams: gramsNum,
      purity,
      label: label.trim() || null,
    });

    setSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (paidNum > 0) {
      recordInvestment(paidNum);
    }

    setGrams('');
    setLabel('');
    setPurchasePrice('');
    await loadData();
  }

  async function handleDelete(id: string) {
    await supabase.from('holdings').delete().eq('id', id);
    await loadData();
  }

  const metalCards: Metal[] = ['gold', 'silver'];

  return (
    <div
      className={`${fraunces.variable} ${inter.variable}`}
      style={{
        minHeight: '100vh',
        background: '#14151A',
        color: '#EDEDE9',
        fontFamily: 'var(--font-body), system-ui, sans-serif',
        padding: '36px 20px 96px',
      }}
    >
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <header style={{ marginBottom: 28 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 16,
            }}
          >
            <div>
              <p
                style={{
                  color: '#8B8D98',
                  fontSize: 13,
                  margin: 0,
                  marginBottom: 7,
                  letterSpacing: '0.02em',
                }}
              >
                GOLD FOR US
              </p>

              <h1
                style={{
                  fontFamily: 'var(--font-display), Georgia, serif',
                  fontSize: 'clamp(36px, 8vw, 56px)',
                  fontWeight: 600,
                  lineHeight: 1.02,
                  letterSpacing: '-0.03em',
                  margin: 0,
                }}
              >
                Invest with a plan.
              </h1>

              <p
                style={{
                  color: '#8B8D98',
                  fontSize: 14,
                  lineHeight: 1.5,
                  marginTop: 10,
                  maxWidth: 520,
                }}
              >
                Track your metals, compare today&apos;s price with the daily
                average, and keep your monthly investment limit visible.
              </p>
            </div>

            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              style={{
                ...secondaryButtonStyle,
                opacity: refreshing ? 0.55 : 1,
              }}
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </header>

        {errorMessage && (
          <div style={noticeStyle}>
            <strong>Supabase error</strong>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Monthly investment plan */}
        <section style={{ ...panelStyle, marginBottom: 18 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <p style={eyebrowStyle}>MONTHLY PLAN</p>

              {budgetEditing ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: '#8B8D98' }}>€</span>
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    step="10"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveBudget();
                      if (e.key === 'Escape') setBudgetEditing(false);
                    }}
                    style={{
                      ...inputStyle,
                      width: 130,
                      fontSize: 20,
                    }}
                  />
                  <button
                    type="button"
                    onClick={saveBudget}
                    style={smallPrimaryButtonStyle}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setBudgetInput(String(monthlyBudget));
                    setBudgetEditing(true);
                  }}
                  style={{
                    background: 'none',
                    border: 0,
                    padding: 0,
                    color: '#EDEDE9',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-display), Georgia, serif',
                    fontSize: 32,
                    fontWeight: 600,
                  }}
                  title="Edit monthly investment limit"
                >
                  {eurFormatter.format(monthlyBudget)}
                  <span
                    style={{
                      fontFamily: 'var(--font-body), system-ui, sans-serif',
                      fontSize: 12,
                      color: '#8B8D98',
                      marginLeft: 8,
                      fontWeight: 400,
                    }}
                  >
                    edit
                  </span>
                </button>
              )}
            </div>

            <div style={{ textAlign: 'right' }}>
              <p style={eyebrowStyle}>REMAINING</p>
              <div
                style={{
                  fontFamily: 'var(--font-display), Georgia, serif',
                  fontSize: 28,
                }}
              >
                {eurFormatter.format(remainingBudget)}
              </div>
            </div>
          </div>

          <div
            style={{
              height: 6,
              background: '#2A2B33',
              borderRadius: 99,
              overflow: 'hidden',
              marginTop: 22,
            }}
          >
            <div
              style={{
                width: `${budgetPercent}%`,
                height: '100%',
                background: '#EDEDE9',
                borderRadius: 99,
                transition: 'width 180ms ease',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 9,
              color: '#8B8D98',
              fontSize: 12,
            }}
          >
            <span>
              Invested this month {eurFormatter.format(investedThisMonth)}
            </span>
            <span>{Math.round(budgetPercent)}%</span>
          </div>
        </section>

        {/* Portfolio value */}
        <section
          style={{
            padding: '20px 2px 24px',
            marginBottom: 4,
          }}
        >
          <p style={eyebrowStyle}>PORTFOLIO VALUE · EUR</p>
          <div
            style={{
              fontFamily: 'var(--font-display), Georgia, serif',
              fontSize: 'clamp(42px, 10vw, 64px)',
              lineHeight: 1,
              letterSpacing: '-0.03em',
            }}
          >
            {loading
              ? '—'
              : hasValueData
                ? eurFormatter.format(totalValueEur)
                : '€—'}
          </div>

          <p
            style={{
              color: '#8B8D98',
              fontSize: 12,
              marginTop: 8,
            }}
          >
            {holdings.length}{' '}
            {holdings.length === 1 ? 'holding' : 'holdings'}
          </p>
        </section>

        {/* Price signals */}
        <section style={{ marginBottom: 32 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'end',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <p style={eyebrowStyle}>MARKET SIGNAL</p>
              <h2 style={sectionTitleStyle}>Today vs daily average</h2>
            </div>
            <span
              style={{
                color: '#8B8D98',
                fontSize: 11,
                textAlign: 'right',
              }}
            >
              EUR per gram
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 12,
            }}
          >
            {metalCards.map((m) => {
              const point = prices[m];
              const signal = signalFor(
                point.priceEurPerGram,
                point.averageEurPerGram
              );
              const difference = percentVsAverage(
                point.priceEurPerGram,
                point.averageEurPerGram
              );
              const currentEurGram = point.priceEurPerGram;
              const averageEurGram = point.averageEurPerGram;

              return (
                <div
                  key={m}
                  style={{
                    ...panelStyle,
                    borderColor:
                      signal === 'unavailable'
                        ? '#2A2B33'
                        : signalColor(signal),
                    background: signalBackground(signal),
                    padding: 20,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily:
                            'var(--font-display), Georgia, serif',
                          fontSize: 24,
                        }}
                      >
                        {formatMetal(m)}
                      </div>

                      <div
                        style={{
                          color: '#8B8D98',
                          fontSize: 12,
                          marginTop: 3,
                        }}
                      >
                        Price per gram
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '6px 9px',
                        borderRadius: 99,
                        color: signalColor(signal),
                        border: `1px solid ${signalColor(signal)}`,
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                      }}
                    >
                      {signalLabel(signal)}
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 22,
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 16,
                    }}
                  >
                    <div>
                      <div style={metricLabelStyle}>TODAY</div>
                      <div style={largePriceStyle}>
                        {currentEurGram == null
                          ? '€—'
                          : eurFormatter.format(currentEurGram)}
                      </div>
                    </div>

                    <div>
                      <div style={metricLabelStyle}>DAILY AVERAGE</div>
                      <div style={largePriceStyle}>
                        {averageEurGram == null
                          ? '€—'
                          : eurFormatter.format(averageEurGram)}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 17,
                      paddingTop: 14,
                      borderTop: '1px solid #2A2B33',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: '#8B8D98' }}>
                      Difference from average
                    </span>

                    <span
                      style={{
                        color: signalColor(signal),
                        fontWeight: 600,
                      }}
                    >
                      {difference == null
                        ? '—'
                        : `${percentFormatter.format(difference)}%`}
                    </span>
                  </div>

                  <div
                    style={{
                      color: '#8B8D98',
                      fontSize: 11,
                      lineHeight: 1.45,
                      marginTop: 12,
                    }}
                  >
                    {signal === 'low'
                      ? 'Below the daily average — your BUY signal.'
                      : signal === 'high'
                        ? 'Above the daily average — your SELL signal.'
                        : signal === 'neutral'
                          ? 'At the daily average.'
                          : 'Add price history to calculate the signal.'}
                  </div>
                </div>
              );
            })}
          </div>

          <p
            style={{
              color: '#656772',
              fontSize: 11,
              lineHeight: 1.5,
              margin: '12px 2px 0',
            }}
          >
            All prices shown here are EUR per gram. The LOW/HIGH indicator
            compares the current price with your stored daily average.
          </p>
        </section>

        {/* Buy section */}
        <section style={{ marginBottom: 34 }}>
          <div style={{ marginBottom: 12 }}>
            <p style={eyebrowStyle}>BUY</p>
            <h2 style={sectionTitleStyle}>Where to buy</h2>
            <p
              style={{
                color: '#8B8D98',
                fontSize: 13,
                marginTop: 5,
              }}
            >
              When you decide to invest, use a vendor link to continue to their
              store.
            </p>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {vendors.map((vendor) => (
              <div
                key={vendor.name}
                style={{
                  ...panelStyle,
                  padding: '15px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{vendor.name}</div>
                  <div
                    style={{
                      color: '#8B8D98',
                      fontSize: 12,
                      marginTop: 3,
                    }}
                  >
                    {vendor.description}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <a
                    href={vendor.buyUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={linkButtonStyle}
                  >
                    Buy →
                  </a>

                  {vendor.sellUrl && (
                    <a
                      href={vendor.sellUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={secondaryLinkStyle}
                    >
                      Sell →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Add holding / purchase */}
        <section style={{ ...panelStyle, marginBottom: 34 }}>
          <h2 style={sectionTitleStyle}>Record a purchase</h2>
          <p
            style={{
              color: '#8B8D98',
              fontSize: 12,
              lineHeight: 1.5,
              marginTop: 5,
              marginBottom: 18,
            }}
          >
            Add the metal to your holdings. If you enter what you paid, the
            amount is also counted against this month&apos;s investment budget.
          </p>

          <form
            onSubmit={handleAddHolding}
            style={{
              display: 'grid',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              {(['gold', 'silver'] as Metal[]).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => {
                    setMetal(m);
                    setPurity(0.999);
                  }}
                  style={{
                    flex: 1,
                    padding: '11px 12px',
                    borderRadius: 8,
                    border: `1px solid ${
                      metal === m
                        ? m === 'gold'
                          ? '#C9A227'
                          : '#9CA3AF'
                        : '#2A2B33'
                    }`,
                    background:
                      metal === m
                        ? m === 'gold'
                          ? 'rgba(201,162,39,0.12)'
                          : 'rgba(156,163,175,0.12)'
                        : 'transparent',
                    color:
                      metal === m
                        ? m === 'gold'
                          ? '#C9A227'
                          : '#9CA3AF'
                        : '#EDEDE9',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 12,
              }}
            >
              <label style={labelStyle}>
                Grams
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  required
                  placeholder="e.g. 10"
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                Purity
                <select
                  value={purity}
                  onChange={(e) => setPurity(Number(e.target.value))}
                  style={inputStyle}
                >
                  {Object.entries(purityOptions).map(
                    ([optLabel, value]) => (
                      <option key={optLabel} value={value}>
                        {optLabel}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label style={labelStyle}>
                What you paid (€)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="e.g. 750"
                  style={inputStyle}
                />
              </label>
            </div>

            <label style={labelStyle}>
              Label
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. 10g gold bar"
                style={inputStyle}
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              style={{
                ...primaryButtonStyle,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Add purchase'}
            </button>
          </form>
        </section>

        {/* Holdings */}
        <section>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'end',
              marginBottom: 12,
            }}
          >
            <div>
              <p style={eyebrowStyle}>PORTFOLIO</p>
              <h2 style={sectionTitleStyle}>Your holdings</h2>
            </div>
          </div>

          {loading ? (
            <p style={{ color: '#8B8D98' }}>Loading…</p>
          ) : holdings.length === 0 ? (
            <p style={{ color: '#8B8D98' }}>
              Nothing added yet. Record your first purchase above.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {holdings.map((h) => {
                const value = valueForEur(h);
                const accent = h.metal === 'gold' ? '#C9A227' : '#9CA3AF';

                return (
                  <div
                    key={h.id}
                    style={{
                      ...panelStyle,
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 14,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            flex: '0 0 auto',
                            borderRadius: '50%',
                            background: accent,
                          }}
                        />

                        <span
                          style={{
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h.label || formatMetal(h.metal)}
                        </span>
                      </div>

                      <div
                        style={{
                          color: '#8B8D98',
                          fontSize: 12,
                          marginTop: 3,
                        }}
                      >
                        {numberFormatter.format(h.grams)}g ·{' '}
                        {formatPurity(h.purity)}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          fontFamily:
                            'var(--font-display), Georgia, serif',
                          fontSize: 18,
                        }}
                      >
                        {value == null ? '—' : eurFormatter.format(value)}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDelete(h.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#656772',
                          cursor: 'pointer',
                          fontSize: 12,
                          padding: 4,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <footer
          style={{
            color: '#555762',
            fontSize: 11,
            lineHeight: 1.5,
            marginTop: 34,
            paddingTop: 18,
            borderTop: '1px solid #22232A',
          }}
        >
          Prices and averages depend on the data stored in Supabase. Vendor
          buttons open the vendor&apos;s website; this app does not process
          purchases or payments. Data source: {" "}
          <a
            href="https://goldpricez.com"
            target="_blank"
            rel="nofollow noopener"
            style={{ color: '#8B8D98', textDecoration: 'underline' }}
          >
            GoldPriceZ.com
          </a>.
        </footer>
      </div>
    </div>
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

const sectionTitleStyle: CSSProperties = {
  fontSize: 17,
  fontWeight: 600,
  margin: 0,
};

const metricLabelStyle: CSSProperties = {
  color: '#8B8D98',
  fontSize: 10,
  letterSpacing: '0.06em',
  marginBottom: 5,
};

const metricValueStyle: CSSProperties = {
  fontFamily: 'var(--font-display), Georgia, serif',
  fontSize: 20,
};

const largePriceStyle: CSSProperties = {
  fontFamily: 'var(--font-display), Georgia, serif',
  fontSize: 23,
  letterSpacing: '-0.02em',
};

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 12,
  color: '#8B8D98',
};

const inputStyle: CSSProperties = {
  background: '#14151A',
  border: '1px solid #2A2B33',
  borderRadius: 8,
  padding: '11px 12px',
  color: '#EDEDE9',
  fontSize: 14,
  minWidth: 0,
};

const primaryButtonStyle: CSSProperties = {
  marginTop: 2,
  padding: '12px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#EDEDE9',
  color: '#14151A',
  fontWeight: 600,
  cursor: 'pointer',
};

const smallPrimaryButtonStyle: CSSProperties = {
  padding: '9px 12px',
  borderRadius: 7,
  border: 'none',
  background: '#EDEDE9',
  color: '#14151A',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 12,
};

const secondaryButtonStyle: CSSProperties = {
  background: '#1C1D24',
  border: '1px solid #2A2B33',
  borderRadius: 8,
  padding: '9px 12px',
  color: '#EDEDE9',
  fontSize: 12,
  cursor: 'pointer',
};

const linkButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '9px 14px',
  borderRadius: 8,
  background: '#EDEDE9',
  color: '#14151A',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 600,
};

const secondaryLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '9px 14px',
  borderRadius: 8,
  background: 'transparent',
  border: '1px solid #2A2B33',
  color: '#EDEDE9',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 500,
};

const noticeStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  background: 'rgba(224,113,113,0.08)',
  border: '1px solid rgba(224,113,113,0.25)',
  borderRadius: 10,
  padding: '12px 14px',
  color: '#EDEDE9',
  fontSize: 12,
  lineHeight: 1.45,
  marginBottom: 18,
};
