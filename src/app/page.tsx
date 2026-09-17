'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react';

import { Fraunces, Inter } from 'next/font/google';

import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';

import {
  GOLD_PURITY,
  SILVER_PURITY,
} from '@/lib/purity';

import TimelineChart from '@/components/timelinechart';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-display',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
});

type Metal = 'gold' | 'silver';

type Signal =
  | 'low'
  | 'high'
  | 'neutral'
  | 'unavailable';

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

const MONTHLY_BUDGET_KEY =
  'goldforus-monthly-budget-eur';

const vendors: Vendor[] = [
  {
    name: 'Holland Gold',
    description:
      'Physical gold and silver',
    buyUrl: 'https://www.hollandgold.nl/',
    sellUrl:
      'https://www.hollandgold.nl/',
  },
];

const eurFormatter =
  new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  });

const numberFormatter =
  new Intl.NumberFormat('en-IE', {
    maximumFractionDigits: 2,
  });

const percentFormatter =
  new Intl.NumberFormat('en-IE', {
    maximumFractionDigits: 1,
    signDisplay: 'always',
  });

function formatMetal(metal: Metal) {
  return metal === 'gold'
    ? 'Gold'
    : 'Silver';
}

function formatPurity(purity: number) {
  if (purity >= 0.9995) return '999.9';
  if (purity >= 0.999) return '999';

  return String(
    Math.round(purity * 1000)
  );
}

function signalFor(
  price: number | null,
  average: number | null
): Signal {
  if (
    price == null ||
    average == null ||
    !Number.isFinite(price) ||
    !Number.isFinite(average) ||
    average <= 0
  ) {
    return 'unavailable';
  }

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
      return 'AVERAGE';
    default:
      return 'NO DATA';
  }
}

function signalColor(signal: Signal) {
  switch (signal) {
    case 'low':
      return '#F0B46A';

    case 'high':
      return '#67D19A';

    case 'neutral':
      return '#D6B45C';

    default:
      return '#7E8494';
  }
}

function signalBackground(signal: Signal) {
  switch (signal) {
    case 'low':
      return 'rgba(240,180,106,0.09)';

    case 'high':
      return 'rgba(103,209,154,0.08)';

    case 'neutral':
      return 'rgba(214,180,92,0.08)';

    default:
      return 'rgba(126,132,148,0.06)';
  }
}

function percentVsAverage(
  price: number | null,
  average: number | null
) {
  if (
    price == null ||
    average == null ||
    !Number.isFinite(price) ||
    !Number.isFinite(average) ||
    average <= 0
  ) {
    return null;
  }

  return (
    ((price - average) / average) *
    100
  );
}

function Icon({
  children,
  size = 18,
}: {
  children: ReactNode;
  size?: number;
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

function GoldIcon() {
  return (
    <Icon size={22}>
      <svg
        viewBox="0 0 24 24"
        width="100%"
        height="100%"
        fill="none"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M8 12h8M10 8.5h4M10 15.5h4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </Icon>
  );
}

function SilverIcon() {
  return (
    <Icon size={22}>
      <svg
        viewBox="0 0 24 24"
        width="100%"
        height="100%"
        fill="none"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M8.5 15.5 15.5 8.5M9 9h.01M15 15h.01"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </Icon>
  );
}

function ArrowUpIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="14"
      height="14"
      fill="none"
    >
      <path
        d="M4 13 9 8l3 3 4-5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 6H16v3.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RefreshIcon({
  spinning = false,
}: {
  spinning?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="15"
      height="15"
      fill="none"
      style={{
        animation: spinning
          ? 'goldforus-spin 0.8s linear infinite'
          : undefined,
      }}
    >
      <path
        d="M16 8a6 6 0 0 0-10.8-2.9L4 6.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      <path
        d="M4 3.5v3h3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M4 12a6 6 0 0 0 10.8 2.9l1.2-1.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      <path
        d="M16 16.5v-3h-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [holdings, setHoldings] =
    useState<Holding[]>([]);

  const [prices, setPrices] =
    useState<Prices>({
      gold: {
        priceEurPerGram: null,
        averageEurPerGram: null,
        fetchedAt: null,
      },
      silver: {
        priceEurPerGram: null,
        averageEurPerGram: null,
        fetchedAt: null,
      },
    });

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState('');

  const [monthlyBudget, setMonthlyBudget] =
    useState(500);

  const [budgetInput, setBudgetInput] =
    useState('500');

  const [budgetEditing, setBudgetEditing] =
    useState(false);

  const [metal, setMetal] =
    useState<Metal>('gold');

  const [grams, setGrams] =
    useState('');

  const [purity, setPurity] =
    useState<number>(0.999);

  const [label, setLabel] =
    useState('');

  const [purchasePrice, setPurchasePrice] =
    useState('');

  const [saving, setSaving] =
    useState(false);

  const [
    investedThisMonth,
    setInvestedThisMonth,
  ] = useState(0);

  const purityOptions =
    metal === 'gold'
      ? GOLD_PURITY
      : SILVER_PURITY;

  const currentMonthKey =
    useMemo(() => {
      const now = new Date();

      return `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, '0')}`;
    }, []);

  const loadBudget =
    useCallback(() => {
      try {
        const stored =
          window.localStorage.getItem(
            userId
              ? `${MONTHLY_BUDGET_KEY}-${userId}`
              : MONTHLY_BUDGET_KEY
          );

        if (!stored) return;

        const value = Number(stored);

        if (
          Number.isFinite(value) &&
          value >= 0
        ) {
          setMonthlyBudget(value);
          setBudgetInput(
            String(value)
          );
        }
      } catch {
        // Keep default.
      }
    }, [userId]);

  const saveBudget = () => {
    const value = Number(
      budgetInput
    );

    if (
      !Number.isFinite(value) ||
      value < 0
    ) {
      setBudgetInput(
        String(monthlyBudget)
      );

      setBudgetEditing(false);

      return;
    }

    setMonthlyBudget(value);

    try {
      window.localStorage.setItem(
        userId
          ? `${MONTHLY_BUDGET_KEY}-${userId}`
          : MONTHLY_BUDGET_KEY,
        String(value)
      );
    } catch {
      // Keep in memory.
    }

    setBudgetEditing(false);
  };

  const loadInvestedThisMonth =
    useCallback(async () => {
      try {
        const key =
          `goldforus-invested-${userId ?? 'anonymous'}-${currentMonthKey}`;

        const stored =
          window.localStorage.getItem(
            key
          );

        const value = stored
          ? Number(stored)
          : 0;

        if (
          Number.isFinite(value) &&
          value >= 0
        ) {
          setInvestedThisMonth(
            value
          );
        } else {
          setInvestedThisMonth(0);
        }
      } catch {
        setInvestedThisMonth(0);
      }
    }, [currentMonthKey, userId]);

  const loadData =
    useCallback(async () => {
      setErrorMessage('');

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw new Error(
            `Authentication: ${userError.message}`
          );
        }

        if (!user) {
          setUserEmail(null);
          setUserId(null);
          router.push('/login');
          return;
        }

        setUserEmail(user.email ?? null);
        setUserId(user.id);

        const [
          holdingsResult,
          priceResponse,
          goldAverageResult,
          silverAverageResult,
        ] = await Promise.all([
          supabase
            .from('holdings')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', {
              ascending: false,
            }),

          fetch('/api/prices', {
            cache: 'no-store',
          }),

          supabase
            .from('daily_summary')
            .select(
              'date, avg_price'
            )
            .eq('metal', 'gold')
            .order('date', {
              ascending: false,
            })
            .limit(1)
            .maybeSingle(),

          supabase
            .from('daily_summary')
            .select(
              'date, avg_price'
            )
            .eq('metal', 'silver')
            .order('date', {
              ascending: false,
            })
            .limit(1)
            .maybeSingle(),
        ]);

        if (holdingsResult.error) {
          throw new Error(
            `Holdings: ${holdingsResult.error.message}`
          );
        }

        if (
          goldAverageResult.error
        ) {
          console.warn(
            'Could not load gold daily average:',
            goldAverageResult.error
          );
        }

        if (
          silverAverageResult.error
        ) {
          console.warn(
            'Could not load silver daily average:',
            silverAverageResult.error
          );
        }

        if (!priceResponse.ok) {
          throw new Error(
            `GoldPriceZ request failed (${priceResponse.status})`
          );
        }

        const data =
          await priceResponse.json();

        const goldPriceEur =
          Number(
            data?.gold?.eurPerGram
          );

        const silverPriceEur =
          Number(
            data?.silver?.eurPerGram
          );

        const usdToEur =
          Number(
            data?.usdToEur
          );

        const fetchedAt =
          data?.fetchedAt ??
          new Date().toISOString();

        const goldAverageUsdOz =
          goldAverageResult.data
            ?.avg_price != null
            ? Number(
                goldAverageResult
                  .data.avg_price
              )
            : null;

        const silverAverageUsdOz =
          silverAverageResult.data
            ?.avg_price != null
            ? Number(
                silverAverageResult
                  .data.avg_price
              )
            : null;

        const goldAverageEur =
          goldAverageUsdOz != null &&
          Number.isFinite(
            usdToEur
          ) &&
          usdToEur > 0
            ? (goldAverageUsdOz /
                31.1034768) *
              usdToEur
            : null;

        const silverAverageEur =
          silverAverageUsdOz != null &&
          Number.isFinite(
            usdToEur
          ) &&
          usdToEur > 0
            ? (silverAverageUsdOz /
                31.1034768) *
              usdToEur
            : null;

        setHoldings(
          (holdingsResult.data ??
            []) as Holding[]
        );

        setPrices({
          gold: {
            priceEurPerGram:
              Number.isFinite(
                goldPriceEur
              ) &&
              goldPriceEur > 0
                ? goldPriceEur
                : null,

            averageEurPerGram:
              goldAverageEur,

            fetchedAt,
          },

          silver: {
            priceEurPerGram:
              Number.isFinite(
                silverPriceEur
              ) &&
              silverPriceEur > 0
                ? silverPriceEur
                : null,

            averageEurPerGram:
              silverAverageEur,

            fetchedAt,
          },
        });
      } catch (error) {
        console.error(
          'Could not load GoldForUs data:',
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Could not load prices.'
        );
      } finally {
        setLoading(false);
      }
    }, [router, supabase]);

  const refresh =
    useCallback(async () => {
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
      .channel(
        'goldforus-price-changes'
      )
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
      supabase.removeChannel(
        channel
      );
    };
  }, [
    loadBudget,
    loadInvestedThisMonth,
    loadData,
  ]);

  const priceInEurPerGram = (
    metalType: Metal
  ) => {
    return metalType === 'gold'
      ? prices.gold.priceEurPerGram
      : prices.silver.priceEurPerGram;
  };

  const valueForEur = (
    holding: Holding
  ) => {
    const price =
      priceInEurPerGram(
        holding.metal
      );

    if (price == null) return null;

    return (
      holding.grams *
      holding.purity *
      price
    );
  };

  const totalValueEur =
    holdings.reduce(
      (sum, holding) => {
        const value =
          valueForEur(holding);

        return value == null
          ? sum
          : sum + value;
      },
      0
    );

  const hasValueData =
    holdings.length > 0 &&
    holdings.some(
      (holding) =>
        valueForEur(holding) != null
    );

  const goldGrams =
    holdings
      .filter(
        (h) => h.metal === 'gold'
      )
      .reduce(
        (sum, h) =>
          sum +
          h.grams * h.purity,
        0
      );

  const silverGrams =
    holdings
      .filter(
        (h) => h.metal === 'silver'
      )
      .reduce(
        (sum, h) =>
          sum +
          h.grams * h.purity,
        0
      );

  const remainingBudget =
    Math.max(
      monthlyBudget -
        investedThisMonth,
      0
    );

  const budgetPercent =
    monthlyBudget > 0
      ? Math.min(
          (investedThisMonth /
            monthlyBudget) *
            100,
          100
        )
      : 0;

  const portfolioGoldValue =
    holdings
      .filter(
        (h) => h.metal === 'gold'
      )
      .reduce(
        (sum, h) =>
          sum +
          (valueForEur(h) ?? 0),
        0
      );

  const portfolioSilverValue =
    holdings
      .filter(
        (h) => h.metal === 'silver'
      )
      .reduce(
        (sum, h) =>
          sum +
          (valueForEur(h) ?? 0),
        0
      );

  function recordInvestment(
    amount: number
  ) {
    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return;
    }

    const next =
      investedThisMonth +
      amount;

    setInvestedThisMonth(next);

    try {
      window.localStorage.setItem(
        `goldforus-invested-${userId ?? 'anonymous'}-${currentMonthKey}`,
        String(next)
      );
    } catch {
      // Keep in memory.
    }
  }

  async function handleAddHolding(
    e: FormEvent
  ) {
    e.preventDefault();

    const gramsNum =
      Number(grams);

    const paidNum =
      purchasePrice
        ? Number(purchasePrice)
        : 0;

    if (
      !Number.isFinite(
        gramsNum
      ) ||
      gramsNum <= 0
    ) {
      return;
    }

    if (
      purchasePrice &&
      (!Number.isFinite(
        paidNum
      ) ||
        paidNum <= 0)
    ) {
      return;
    }

    setSaving(true);
    setErrorMessage('');

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setSaving(false);
      setErrorMessage(
        userError?.message ?? 'You must be logged in to add a holding.'
      );
      return;
    }

    const { error } =
      await supabase
        .from('holdings')
        .insert({
          user_id: user.id,
          metal,
          grams: gramsNum,
          purity,
          label:
            label.trim() || null,
        });

    setSaving(false);

    if (error) {
      setErrorMessage(
        error.message
      );

      return;
    }

    if (paidNum > 0) {
      recordInvestment(
        paidNum
      );
    }

    setGrams('');
    setLabel('');
    setPurchasePrice('');

    await loadData();
  }

  async function handleDelete(
    id: string
  ) {
    const confirmed =
      window.confirm(
        'Remove this holding from your portfolio?'
      );

    if (!confirmed) return;

    const { error } =
      await supabase
        .from('holdings')
        .delete()
        .eq('id', id);

    if (error) {
      setErrorMessage(
        error.message
      );

      return;
    }

    await loadData();
  }

  async function handleLogout() {
    setErrorMessage('');

    const { error } = await supabase.auth.signOut();

    if (error) {
      setErrorMessage(`Logout: ${error.message}`);
      return;
    }

    router.push('/login');
    router.refresh();
  }

  const metalCards: Metal[] = [
    'gold',
    'silver',
  ];

  const lastUpdated =
    prices.gold.fetchedAt
      ? new Date(
          prices.gold.fetchedAt
        ).toLocaleTimeString(
          'en-IE',
          {
            hour: '2-digit',
            minute: '2-digit',
          }
        )
      : null;

  return (
    <main
      className={`${fraunces.variable} ${inter.variable}`}
      style={pageStyle}
    >
      <style>{`
        @keyframes goldforus-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes goldforus-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .45; }
        }

        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          background: #090A0D;
        }

        button,
        input,
        select {
          font: inherit;
        }

        button:focus-visible,
        input:focus-visible,
        select:focus-visible,
        a:focus-visible {
          outline: 2px solid #D6B45C;
          outline-offset: 2px;
        }

        .goldforus-card {
          transition:
            transform 180ms ease,
            border-color 180ms ease,
            background 180ms ease,
            box-shadow 180ms ease;
        }

        .goldforus-card:hover {
          border-color: #343741 !important;
          box-shadow:
            0 14px 45px rgba(0,0,0,.16);
        }

        .goldforus-button {
          transition:
            transform 150ms ease,
            opacity 150ms ease,
            background 150ms ease;
        }

        .goldforus-button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .goldforus-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .goldforus-input {
          transition:
            border-color 150ms ease,
            box-shadow 150ms ease;
        }

        .goldforus-input:focus {
          border-color: rgba(214,180,92,.7) !important;
          box-shadow:
            0 0 0 3px rgba(214,180,92,.08);
          outline: none;
        }

        @media (max-width: 700px) {
          .goldforus-shell {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          .goldforus-hero {
            padding-top: 28px !important;
          }

          .goldforus-kpi-grid {
            grid-template-columns: 1fr !important;
          }

          .goldforus-market-grid {
            grid-template-columns: 1fr !important;
          }

          .goldforus-form-grid {
            grid-template-columns: 1fr !important;
          }

          .goldforus-header-actions {
            width: 100%;
          }

          .goldforus-refresh {
            width: 100%;
          }

          .goldforus-portfolio-number {
            font-size: 48px !important;
          }
        }
      `}</style>

      <div
        className="goldforus-shell"
        style={shellStyle}
      >
        {/* =========================
            TOP NAV
        ========================= */}

        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              'space-between',
            gap: 20,
            padding:
              '22px 0 18px',
            borderBottom:
              '1px solid #1B1D23',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={logoStyle}
            >
              <GoldIcon />
            </div>

            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing:
                    '0.13em',
                }}
              >
                GOLDFORUS
              </div>

              <div
                style={{
                  color: '#686D7B',
                  fontSize: 10,
                  marginTop: 2,
                  letterSpacing:
                    '0.04em',
                }}
              >
                METAL PORTFOLIO
              </div>
            </div>
          </div>

          <div
            className="goldforus-header-actions"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            {userEmail && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '7px 9px',
                  border: '1px solid #292C34',
                  borderRadius: 9,
                  background: '#111318',
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(214,180,92,.10)',
                    color: '#D6B45C',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {(userEmail[0] ?? 'U').toUpperCase()}
                </div>
                <span
                  style={{
                    color: '#AEB2BC',
                    fontSize: 10,
                    maxWidth: 190,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {userEmail}
                </span>
                <button
                  className="goldforus-button"
                  type="button"
                  onClick={handleLogout}
                  style={{
                    ...secondaryLinkStyle,
                    padding: '7px 10px',
                  }}
                >
                  Logout
                </button>
              </div>
            )}

            {lastUpdated && (
              <div
                style={{
                  color: '#626774',
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background:
                      '#67D19A',
                    boxShadow:
                      '0 0 8px rgba(103,209,154,.45)',
                  }}
                />

                Live · {lastUpdated}
              </div>
            )}

            <button
              className="goldforus-button goldforus-refresh"
              type="button"
              onClick={refresh}
              disabled={refreshing}
              style={{
                ...refreshButtonStyle,
                opacity:
                  refreshing
                    ? 0.55
                    : 1,
              }}
            >
              <RefreshIcon
                spinning={
                  refreshing
                }
              />

              {refreshing
                ? 'Updating'
                : 'Refresh'}
            </button>
          </div>
        </header>

        {/* =========================
            HERO
        ========================= */}

        <section
          className="goldforus-hero"
          style={{
            padding:
              '56px 0 38px',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              color: '#D6B45C',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing:
                '0.13em',
              marginBottom: 15,
            }}
          >
            <span
              style={{
                width: 18,
                height: 1,
                background:
                  '#D6B45C',
              }}
            />

            PERSONAL METALS DASHBOARD
          </div>

          <h1
            style={{
              fontFamily:
                'var(--font-display), Georgia, serif',
              fontSize:
                'clamp(44px, 7vw, 76px)',
              lineHeight: 0.98,
              letterSpacing:
                '-0.045em',
              fontWeight: 600,
              maxWidth: 800,
              margin: 0,
            }}
          >
            Your wealth,
            <br />
            <span
              style={{
                color: '#D6B45C',
              }}
            >
              in precious metals.
            </span>
          </h1>

          <p
            style={{
              maxWidth: 610,
              color: '#777C89',
              fontSize: 14,
              lineHeight: 1.7,
              margin:
                '20px 0 0',
            }}
          >
            Track the value of your
            physical gold and silver,
            monitor market prices and
            stay within your monthly
            investment plan.
          </p>
        </section>

        {/* =========================
            ERROR
        ========================= */}

        {errorMessage && (
          <div
            style={noticeStyle}
          >
            <div
              style={{
                color: '#F0A0A0',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              Data connection issue
            </div>

            <div
              style={{
                color: '#A4A7B1',
                fontSize: 12,
              }}
            >
              {errorMessage}
            </div>
          </div>
        )}

        {/* =========================
            MAIN KPI GRID
        ========================= */}

        <section
          className="goldforus-kpi-grid"
          style={{
            display: 'grid',
            gridTemplateColumns:
              '1.35fr 1fr 1fr',
            gap: 12,
            marginBottom: 14,
          }}
        >
          {/* TOTAL VALUE */}

          <div
            className="goldforus-card"
            style={{
              ...cardStyle,
              padding: 26,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                width: 230,
                height: 230,
                right: -90,
                top: -100,
                borderRadius: '50%',
                background:
                  'rgba(214,180,92,.07)',
                filter: 'blur(1px)',
              }}
            />

            <p
              style={eyebrowStyle}
            >
              TOTAL PORTFOLIO VALUE
            </p>

            <div
              className="goldforus-portfolio-number"
              style={{
                fontFamily:
                  'var(--font-display), Georgia, serif',
                fontSize: 58,
                lineHeight: 1,
                letterSpacing:
                  '-0.04em',
                marginTop: 17,
                position:
                  'relative',
              }}
            >
              {loading
                ? '—'
                : hasValueData
                  ? eurFormatter.format(
                      totalValueEur
                    )
                  : '€—'}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 18,
              }}
            >
              <span
                style={{
                  display:
                    'inline-flex',
                  alignItems:
                    'center',
                  gap: 5,
                  color:
                    '#67D19A',
                  background:
                    'rgba(103,209,154,.08)',
                  border:
                    '1px solid rgba(103,209,154,.15)',
                  borderRadius: 99,
                  padding:
                    '5px 9px',
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                <ArrowUpIcon />
                LIVE VALUE
              </span>

              <span
                style={{
                  color:
                    '#626774',
                  fontSize: 11,
                }}
              >
                {holdings.length}{' '}
                {holdings.length ===
                1
                  ? 'position'
                  : 'positions'}
              </span>
            </div>
          </div>

          {/* GOLD */}

          <div
            className="goldforus-card"
            style={{
              ...cardStyle,
              padding: 22,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems:
                  'flex-start',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  display:
                    'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                  background:
                    'rgba(214,180,92,.09)',
                  color:
                    '#D6B45C',
                  border:
                    '1px solid rgba(214,180,92,.13)',
                }}
              >
                <GoldIcon />
              </div>

              <span
                style={{
                  color: '#555A67',
                  fontSize: 10,
                  letterSpacing:
                    '0.08em',
                  fontWeight: 600,
                }}
              >
                GOLD
              </span>
            </div>

            <div
              style={{
                fontFamily:
                  'var(--font-display), Georgia, serif',
                fontSize: 30,
                marginTop: 22,
              }}
            >
              {eurFormatter.format(
                portfolioGoldValue
              )}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                marginTop: 8,
                gap: 10,
              }}
            >
              <span
                style={{
                  color:
                    '#696E7B',
                  fontSize: 11,
                }}
              >
                Fine weight
              </span>

              <span
                style={{
                  color:
                    '#B8BBC3',
                  fontSize: 11,
                }}
              >
                {numberFormatter.format(
                  goldGrams
                )}
                g
              </span>
            </div>
          </div>

          {/* SILVER */}

          <div
            className="goldforus-card"
            style={{
              ...cardStyle,
              padding: 22,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems:
                  'flex-start',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  display:
                    'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                  background:
                    'rgba(160,168,184,.07)',
                  color:
                    '#AEB4C2',
                  border:
                    '1px solid rgba(160,168,184,.13)',
                }}
              >
                <SilverIcon />
              </div>

              <span
                style={{
                  color: '#555A67',
                  fontSize: 10,
                  letterSpacing:
                    '0.08em',
                  fontWeight: 600,
                }}
              >
                SILVER
              </span>
            </div>

            <div
              style={{
                fontFamily:
                  'var(--font-display), Georgia, serif',
                fontSize: 30,
                marginTop: 22,
              }}
            >
              {eurFormatter.format(
                portfolioSilverValue
              )}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                marginTop: 8,
                gap: 10,
              }}
            >
              <span
                style={{
                  color:
                    '#696E7B',
                  fontSize: 11,
                }}
              >
                Fine weight
              </span>

              <span
                style={{
                  color:
                    '#B8BBC3',
                  fontSize: 11,
                }}
              >
                {numberFormatter.format(
                  silverGrams
                )}
                g
              </span>
            </div>
          </div>
        </section>

        {/* =========================
            MONTHLY PLAN
        ========================= */}

        <section
          className="goldforus-card"
          style={{
            ...cardStyle,
            padding: 22,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems:
                'flex-start',
              gap: 20,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <p
                style={eyebrowStyle}
              >
                MONTHLY INVESTMENT PLAN
              </p>

              <div
                style={{
                  display: 'flex',
                  alignItems:
                    'baseline',
                  gap: 8,
                  marginTop: 8,
                }}
              >
                {budgetEditing ? (
                  <>
                    <span
                      style={{
                        color:
                          '#777C89',
                        fontSize: 18,
                      }}
                    >
                      €
                    </span>

                    <input
                      autoFocus
                      type="number"
                      min="0"
                      step="10"
                      value={
                        budgetInput
                      }
                      onChange={(e) =>
                        setBudgetInput(
                          e.target.value
                        )
                      }
                      onKeyDown={(e) => {
                        if (
                          e.key ===
                          'Enter'
                        ) {
                          saveBudget();
                        }

                        if (
                          e.key ===
                          'Escape'
                        ) {
                          setBudgetEditing(
                            false
                          );
                        }
                      }}
                      className="goldforus-input"
                      style={{
                        ...inputStyle,
                        width: 130,
                        fontSize: 22,
                      }}
                    />

                    <button
                      className="goldforus-button"
                      type="button"
                      onClick={
                        saveBudget
                      }
                      style={
                        smallPrimaryButtonStyle
                      }
                    >
                      Save
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setBudgetInput(
                        String(
                          monthlyBudget
                        )
                      );

                      setBudgetEditing(
                        true
                      );
                    }}
                    style={{
                      background:
                        'none',
                      border: 0,
                      padding: 0,
                      color:
                        '#F1F0EA',
                      cursor:
                        'pointer',
                      fontFamily:
                        'var(--font-display), Georgia, serif',
                      fontSize: 27,
                      fontWeight: 600,
                    }}
                  >
                    {eurFormatter.format(
                      monthlyBudget
                    )}

                    <span
                      style={{
                        fontFamily:
                          'var(--font-body), system-ui, sans-serif',
                        color:
                          '#666B78',
                        fontSize: 10,
                        marginLeft: 8,
                        fontWeight: 500,
                        letterSpacing:
                          '0.06em',
                      }}
                    >
                      EDIT
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div
              style={{
                textAlign: 'right',
              }}
            >
              <div
                style={{
                  color:
                    '#666B78',
                  fontSize: 10,
                  letterSpacing:
                    '0.08em',
                  fontWeight: 600,
                }}
              >
                REMAINING
              </div>

              <div
                style={{
                  fontFamily:
                    'var(--font-display), Georgia, serif',
                  fontSize: 25,
                  marginTop: 4,
                }}
              >
                {eurFormatter.format(
                  remainingBudget
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              height: 7,
              background:
                '#272A31',
              borderRadius: 99,
              overflow: 'hidden',
              marginTop: 24,
            }}
          >
            <div
              style={{
                width: `${budgetPercent}%`,
                height: '100%',
                background:
                  'linear-gradient(90deg, #B7953F, #E0C46B)',
                borderRadius: 99,
                transition:
                  'width 250ms ease',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              gap: 12,
              marginTop: 10,
            }}
          >
            <span
              style={{
                color:
                  '#666B78',
                fontSize: 11,
              }}
            >
              {eurFormatter.format(
                investedThisMonth
              )}{' '}
              invested this month
            </span>

            <span
              style={{
                color:
                  '#A5A8B2',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {Math.round(
                budgetPercent
              )}
              %
            </span>
          </div>
        </section>

        {/* =========================
            MARKET
        ========================= */}

        <section
          style={{
            marginBottom: 38,
          }}
        >
          <SectionHeader
            eyebrow="LIVE MARKET"
            title="Gold & silver prices"
            description="Current spot price compared with the latest stored daily average."
          />

          <div
            className="goldforus-market-grid"
            style={{
              display: 'grid',
              gridTemplateColumns:
                '1fr 1fr',
              gap: 12,
            }}
          >
            {metalCards.map(
              (m) => {
                const point =
                  prices[m];

                const signal =
                  signalFor(
                    point.priceEurPerGram,
                    point.averageEurPerGram
                  );

                const difference =
                  percentVsAverage(
                    point.priceEurPerGram,
                    point.averageEurPerGram
                  );

                const isGold =
                  m === 'gold';

                return (
                  <div
                    key={m}
                    className="goldforus-card"
                    style={{
                      ...cardStyle,
                      padding: 24,
                      background:
                        `linear-gradient(145deg, ${signalBackground(signal)}, #111217 70%)`,
                    }}
                  >
                    <div
                      style={{
                        display:
                          'flex',
                        alignItems:
                          'center',
                        justifyContent:
                          'space-between',
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          display:
                            'flex',
                          alignItems:
                            'center',
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius:
                              12,
                            display:
                              'flex',
                            alignItems:
                              'center',
                            justifyContent:
                              'center',
                            color:
                              isGold
                                ? '#D6B45C'
                                : '#AEB4C2',
                            background:
                              isGold
                                ? 'rgba(214,180,92,.08)'
                                : 'rgba(174,180,194,.07)',
                          }}
                        >
                          {isGold ? (
                            <GoldIcon />
                          ) : (
                            <SilverIcon />
                          )}
                        </div>

                        <div>
                          <div
                            style={{
                              fontSize: 15,
                              fontWeight: 600,
                            }}
                          >
                            {formatMetal(
                              m
                            )}
                          </div>

                          <div
                            style={{
                              color:
                                '#676C79',
                              fontSize: 10,
                              marginTop: 3,
                            }}
                          >
                            EUR / gram
                          </div>
                        </div>
                      </div>

                      <span
                        style={{
                          color:
                            signalColor(
                              signal
                            ),
                          border:
                            `1px solid ${signalColor(
                              signal
                            )}55`,
                          background:
                            `${signalBackground(
                              signal
                            )}`,
                          padding:
                            '6px 9px',
                          borderRadius:
                            99,
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing:
                            '0.08em',
                        }}
                      >
                        {signalLabel(
                          signal
                        )}
                      </span>
                    </div>

                    <div
                      style={{
                        display:
                          'grid',
                        gridTemplateColumns:
                          '1fr 1fr',
                        gap: 20,
                        marginTop: 28,
                      }}
                    >
                      <div>
                        <div
                          style={
                            metricLabelStyle
                          }
                        >
                          CURRENT
                        </div>

                        <div
                          style={{
                            fontFamily:
                              'var(--font-display), Georgia, serif',
                            fontSize: 30,
                            marginTop: 5,
                          }}
                        >
                          {point.priceEurPerGram ==
                          null
                            ? '€—'
                            : eurFormatter.format(
                                point.priceEurPerGram
                              )}
                        </div>
                      </div>

                      <div>
                        <div
                          style={
                            metricLabelStyle
                          }
                        >
                          DAILY AVG
                        </div>

                        <div
                          style={{
                            fontFamily:
                              'var(--font-display), Georgia, serif',
                            fontSize: 30,
                            marginTop: 5,
                          }}
                        >
                          {point.averageEurPerGram ==
                          null
                            ? '€—'
                            : eurFormatter.format(
                                point.averageEurPerGram
                              )}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 25,
                        paddingTop: 15,
                        borderTop:
                          '1px solid #24262D',
                        display:
                          'flex',
                        justifyContent:
                          'space-between',
                        alignItems:
                          'center',
                      }}
                    >
                      <span
                        style={{
                          color:
                            '#666B78',
                          fontSize: 10,
                        }}
                      >
                        Difference
                      </span>

                      <span
                        style={{
                          color:
                            signalColor(
                              signal
                            ),
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {difference ==
                        null
                          ? '—'
                          : `${percentFormatter.format(
                              difference
                            )}%`}
                      </span>
                    </div>

                    <div
                      style={{
                        color:
                          '#555A67',
                        fontSize: 10,
                        lineHeight: 1.55,
                        marginTop: 12,
                      }}
                    >
                      {signal ===
                      'low'
                        ? 'Current price is below the stored daily average.'
                        : signal ===
                            'high'
                          ? 'Current price is above the stored daily average.'
                          : signal ===
                              'neutral'
                            ? 'Current price is at the stored daily average.'
                            : 'Daily average will appear once historical data is available.'}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </section>

        {/* =========================
            TIMELINE
        ========================= */}

        <section
          style={{
            marginBottom: 38,
          }}
        >
          <SectionHeader
            eyebrow="PRICE HISTORY"
            title="Market timeline"
            description="Follow how precious-metal prices develop over time."
          />

          <div
            className="goldforus-card"
            style={{
              ...cardStyle,
              padding: 8,
              overflow: 'hidden',
            }}
          >
            <TimelineChart />
          </div>
        </section>

        {/* =========================
            BUY
        ========================= */}

        <section
          style={{
            marginBottom: 38,
          }}
        >
          <SectionHeader
            eyebrow="MARKETPLACE"
            title="Buy physical metals"
            description="Continue directly to a vendor when you are ready to invest."
          />

          <div
            style={{
              display: 'grid',
              gap: 10,
            }}
          >
            {vendors.map(
              (vendor) => (
                <div
                  key={vendor.name}
                  className="goldforus-card"
                  style={{
                    ...cardStyle,
                    padding:
                      '18px 20px',
                    display:
                      'flex',
                    alignItems:
                      'center',
                    justifyContent:
                      'space-between',
                    gap: 18,
                    flexWrap:
                      'wrap',
                  }}
                >
                  <div
                    style={{
                      display:
                        'flex',
                      alignItems:
                        'center',
                      gap: 13,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius:
                          11,
                        display:
                          'flex',
                        alignItems:
                          'center',
                        justifyContent:
                          'center',
                        background:
                          '#181A20',
                        border:
                          '1px solid #292C34',
                        color:
                          '#D6B45C',
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      HG
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        {vendor.name}
                      </div>

                      <div
                        style={{
                          color:
                            '#666B78',
                          fontSize: 10,
                          marginTop: 3,
                        }}
                      >
                        {
                          vendor.description
                        }
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display:
                        'flex',
                      gap: 8,
                    }}
                  >
                    <a
                      href={
                        vendor.buyUrl
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="goldforus-button"
                      style={
                        linkButtonStyle
                      }
                    >
                      Buy metals
                      <span>
                        →
                      </span>
                    </a>

                    {vendor.sellUrl && (
                      <a
                        href={
                          vendor.sellUrl
                        }
                        target="_blank"
                        rel="noreferrer"
                        style={
                          secondaryLinkStyle
                        }
                      >
                        Sell
                      </a>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </section>

        {/* =========================
            RECORD PURCHASE
        ========================= */}

        <section
          style={{
            marginBottom: 38,
          }}
        >
          <SectionHeader
            eyebrow="PORTFOLIO ACTION"
            title="Record a purchase"
            description="Add a physical position to your portfolio."
          />

          <div
            className="goldforus-card"
            style={{
              ...cardStyle,
              padding: 24,
            }}
          >
            <form
              onSubmit={
                handleAddHolding
              }
              style={{
                display: 'grid',
                gap: 18,
              }}
            >
              {/* METAL SWITCH */}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    '1fr 1fr',
                  gap: 8,
                }}
              >
                {(
                  [
                    'gold',
                    'silver',
                  ] as Metal[]
                ).map((m) => {
                  const active =
                    metal === m;

                  const isGold =
                    m === 'gold';

                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMetal(m);
                        setPurity(
                          0.999
                        );
                      }}
                      className="goldforus-button"
                      style={{
                        padding:
                          '13px 14px',
                        borderRadius:
                          10,
                        border:
                          active
                            ? `1px solid ${
                                isGold
                                  ? '#D6B45C'
                                  : '#9CA5B5'
                              }`
                            : '1px solid #292C34',
                        background:
                          active
                            ? isGold
                              ? 'rgba(214,180,92,.09)'
                              : 'rgba(156,165,181,.07)'
                            : '#15171C',
                        color:
                          active
                            ? isGold
                              ? '#D6B45C'
                              : '#B7BECA'
                            : '#858A97',
                        cursor:
                          'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <span
                        style={{
                          display:
                            'inline-flex',
                          alignItems:
                            'center',
                          gap: 8,
                        }}
                      >
                        {isGold ? (
                          <GoldIcon />
                        ) : (
                          <SilverIcon />
                        )}

                        {formatMetal(
                          m
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div
                className="goldforus-form-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    '1fr 1fr 1fr',
                  gap: 12,
                }}
              >
                <label
                  style={labelStyle}
                >
                  <span>
                    Weight
                  </span>

                  <div
                    style={{
                      position:
                        'relative',
                    }}
                  >
                    <input
                      className="goldforus-input"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={grams}
                      onChange={(e) =>
                        setGrams(
                          e.target
                            .value
                        )
                      }
                      required
                      placeholder="10"
                      style={{
                        ...inputStyle,
                        paddingRight: 35,
                      }}
                    />

                    <span
                      style={{
                        position:
                          'absolute',
                        right: 12,
                        top: '50%',
                        transform:
                          'translateY(-50%)',
                        color:
                          '#555A67',
                        fontSize: 11,
                      }}
                    >
                      g
                    </span>
                  </div>
                </label>

                <label
                  style={labelStyle}
                >
                  <span>
                    Purity
                  </span>

                  <select
                    className="goldforus-input"
                    value={purity}
                    onChange={(e) =>
                      setPurity(
                        Number(
                          e.target
                            .value
                        )
                      )
                    }
                    style={
                      inputStyle
                    }
                  >
                    {Object.entries(
                      purityOptions
                    ).map(
                      ([
                        optLabel,
                        value,
                      ]) => (
                        <option
                          key={
                            optLabel
                          }
                          value={
                            value
                          }
                        >
                          {
                            optLabel
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label
                  style={labelStyle}
                >
                  <span>
                    Purchase price
                  </span>

                  <div
                    style={{
                      position:
                        'relative',
                    }}
                  >
                    <input
                      className="goldforus-input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={
                        purchasePrice
                      }
                      onChange={(e) =>
                        setPurchasePrice(
                          e.target
                            .value
                        )
                      }
                      placeholder="750"
                      style={{
                        ...inputStyle,
                        paddingRight: 35,
                      }}
                    />

                    <span
                      style={{
                        position:
                          'absolute',
                        right: 12,
                        top: '50%',
                        transform:
                          'translateY(-50%)',
                        color:
                          '#555A67',
                        fontSize: 11,
                      }}
                    >
                      €
                    </span>
                  </div>
                </label>
              </div>

              <label
                style={labelStyle}
              >
                <span>
                  Position label
                </span>

                <input
                  className="goldforus-input"
                  type="text"
                  value={label}
                  onChange={(e) =>
                    setLabel(
                      e.target.value
                    )
                  }
                  placeholder="e.g. 10g gold bar"
                  style={
                    inputStyle
                  }
                />
              </label>

              <div
                style={{
                  height: 1,
                  background:
                    '#24262D',
                }}
              />

              <button
                className="goldforus-button"
                type="submit"
                disabled={saving}
                style={{
                  ...primaryButtonStyle,
                  opacity:
                    saving
                      ? 0.55
                      : 1,
                }}
              >
                {saving
                  ? 'Adding position…'
                  : '+ Add to portfolio'}
              </button>
            </form>
          </div>
        </section>

        {/* =========================
            HOLDINGS
        ========================= */}

        <section
          style={{
            marginBottom: 40,
          }}
        >
          <SectionHeader
            eyebrow="YOUR PORTFOLIO"
            title="Holdings"
            description={`${holdings.length} ${
              holdings.length ===
              1
                ? 'position'
                : 'positions'
            } currently tracked.`}
          />

          {loading ? (
            <div
              className="goldforus-card"
              style={{
                ...cardStyle,
                padding: 25,
                color:
                  '#666B78',
                fontSize: 12,
              }}
            >
              Loading portfolio…
            </div>
          ) : holdings.length ===
            0 ? (
            <div
              className="goldforus-card"
              style={{
                ...cardStyle,
                padding: 35,
                textAlign:
                  'center',
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  margin:
                    '0 auto 15px',
                  display:
                    'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                  background:
                    'rgba(214,180,92,.07)',
                  color:
                    '#D6B45C',
                }}
              >
                <GoldIcon />
              </div>

              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Your portfolio is empty
              </div>

              <div
                style={{
                  color:
                    '#656A77',
                  fontSize: 11,
                  marginTop: 6,
                }}
              >
                Add your first physical
                metal position above.
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 8,
              }}
            >
              {holdings.map(
                (h) => {
                  const value =
                    valueForEur(h);

                  const isGold =
                    h.metal ===
                    'gold';

                  return (
                    <div
                      key={h.id}
                      className="goldforus-card"
                      style={{
                        ...cardStyle,
                        padding:
                          '15px 17px',
                        display:
                          'flex',
                        alignItems:
                          'center',
                        justifyContent:
                          'space-between',
                        gap: 18,
                      }}
                    >
                      <div
                        style={{
                          display:
                            'flex',
                          alignItems:
                            'center',
                          gap: 12,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius:
                              11,
                            flex:
                              '0 0 auto',
                            display:
                              'flex',
                            alignItems:
                              'center',
                            justifyContent:
                              'center',
                            background:
                              isGold
                                ? 'rgba(214,180,92,.08)'
                                : 'rgba(174,180,194,.07)',
                            color:
                              isGold
                                ? '#D6B45C'
                                : '#AEB4C2',
                          }}
                        >
                          {isGold ? (
                            <GoldIcon />
                          ) : (
                            <SilverIcon />
                          )}
                        </div>

                        <div
                          style={{
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              overflow:
                                'hidden',
                              textOverflow:
                                'ellipsis',
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            {h.label ||
                              formatMetal(
                                h.metal
                              )}
                          </div>

                          <div
                            style={{
                              color:
                                '#666B78',
                              fontSize: 10,
                              marginTop: 4,
                            }}
                          >
                            {numberFormatter.format(
                              h.grams
                            )}
                            g
                            <span
                              style={{
                                margin:
                                  '0 6px',
                                color:
                                  '#393C44',
                              }}
                            >
                              ·
                            </span>
                            {formatPurity(
                              h.purity
                            )}
                            <span
                              style={{
                                margin:
                                  '0 6px',
                                color:
                                  '#393C44',
                              }}
                            >
                              ·
                            </span>
                            {formatMetal(
                              h.metal
                            )}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display:
                            'flex',
                          alignItems:
                            'center',
                          gap: 18,
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            textAlign:
                              'right',
                          }}
                        >
                          <div
                            style={{
                              fontFamily:
                                'var(--font-display), Georgia, serif',
                              fontSize: 18,
                            }}
                          >
                            {value ==
                            null
                              ? '—'
                              : eurFormatter.format(
                                  value
                                )}
                          </div>

                          <div
                            style={{
                              color:
                                '#555A67',
                              fontSize: 9,
                              marginTop: 3,
                            }}
                          >
                            CURRENT VALUE
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(
                              h.id
                            )
                          }
                          style={{
                            border: 0,
                            background:
                              'transparent',
                            color:
                              '#555A67',
                            cursor:
                              'pointer',
                            fontSize: 10,
                            padding:
                              '6px 2px',
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* =========================
            FOOTER
        ========================= */}

        <footer
          style={{
            borderTop:
              '1px solid #1B1D23',
            padding:
              '22px 0 50px',
            display: 'flex',
            justifyContent:
              'space-between',
            gap: 20,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              color:
                '#41454F',
              fontSize: 10,
              lineHeight: 1.6,
              maxWidth: 560,
            }}
          >
            GoldForUs tracks physical
            precious-metal holdings.
            Market data is provided by{' '}
            <a
              href="https://goldpricez.com"
              target="_blank"
              rel="nofollow noopener"
              style={{
                color:
                  '#666B78',
                textDecoration:
                  'underline',
              }}
            >
              GoldPriceZ
            </a>
            .
          </div>

          <div
            style={{
              color:
                '#41454F',
              fontSize: 10,
            }}
          >
            GOLDFORUS · PERSONAL
            WEALTH TRACKER
          </div>
        </footer>
      </div>
    </main>
  );
}

/* =====================================================
   COMPONENTS
===================================================== */

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        marginBottom: 14,
      }}
    >
      <div
        style={{
          color: '#D6B45C',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing:
            '0.13em',
          marginBottom: 6,
        }}
      >
        {eyebrow}
      </div>

      <h2
        style={{
          margin: 0,
          fontSize: 21,
          lineHeight: 1.2,
          letterSpacing:
            '-0.02em',
          fontWeight: 600,
        }}
      >
        {title}
      </h2>

      <p
        style={{
          margin:
            '6px 0 0',
          color: '#626774',
          fontSize: 11,
          lineHeight: 1.55,
        }}
      >
        {description}
      </p>
    </div>
  );
}

/* =====================================================
   STYLES
===================================================== */

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background:
    'radial-gradient(circle at 50% -10%, rgba(214,180,92,.065), transparent 34%), #090A0D',
  color: '#ECEBE7',
  fontFamily:
    'var(--font-body), system-ui, sans-serif',
};

const shellStyle: CSSProperties = {
  width: '100%',
  maxWidth: 1180,
  margin: '0 auto',
  padding:
    '0 24px 70px',
};

const logoStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 11,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#D6B45C',
  background:
    'linear-gradient(145deg, rgba(214,180,92,.13), rgba(214,180,92,.035))',
  border:
    '1px solid rgba(214,180,92,.18)',
};

const cardStyle: CSSProperties = {
  background:
    'linear-gradient(145deg, #13151A, #101115)',
  border:
    '1px solid #23262E',
  borderRadius: 15,
};

const eyebrowStyle: CSSProperties = {
  color: '#656A77',
  fontSize: 9,
  letterSpacing:
    '0.11em',
  fontWeight: 700,
  margin: 0,
};

const metricLabelStyle: CSSProperties = {
  color: '#656A77',
  fontSize: 9,
  letterSpacing:
    '0.08em',
  fontWeight: 600,
};

const inputStyle: CSSProperties = {
  width: '100%',
  background: '#0C0D10',
  border:
    '1px solid #292C34',
  borderRadius: 9,
  padding:
    '12px 13px',
  color: '#ECEBE7',
  fontSize: 12,
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  fontSize: 10,
  color: '#777C89',
  fontWeight: 500,
};

const primaryButtonStyle: CSSProperties = {
  width: '100%',
  padding:
    '13px 16px',
  borderRadius: 9,
  border: 0,
  background:
    'linear-gradient(135deg, #E7D18A, #C8A94F)',
  color: '#17130A',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  boxShadow:
    '0 8px 25px rgba(214,180,92,.10)',
};

const smallPrimaryButtonStyle: CSSProperties = {
  padding:
    '9px 13px',
  borderRadius: 8,
  border: 0,
  background:
    '#E7D18A',
  color: '#17130A',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 11,
};

const refreshButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  padding:
    '8px 11px',
  borderRadius: 8,
  border:
    '1px solid #292C34',
  background: '#13151A',
  color: '#B5B8C0',
  fontSize: 10,
  fontWeight: 600,
  cursor: 'pointer',
};

const linkButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding:
    '9px 13px',
  borderRadius: 8,
  background:
    '#E7D18A',
  color: '#17130A',
  textDecoration:
    'none',
  fontSize: 10,
  fontWeight: 700,
};

const secondaryLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding:
    '9px 13px',
  borderRadius: 8,
  background:
    'transparent',
  border:
    '1px solid #292C34',
  color: '#A9ADB7',
  textDecoration:
    'none',
  fontSize: 10,
  fontWeight: 600,
};

const noticeStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  background:
    'rgba(224,113,113,.06)',
  border:
    '1px solid rgba(224,113,113,.18)',
  borderRadius: 11,
  padding:
    '13px 15px',
  marginBottom: 18,
};