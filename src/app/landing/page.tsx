import Link from 'next/link';
import { Fraunces, Inter } from 'next/font/google';

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

type Plan = {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  note?: string;
  featured?: boolean;
  cta: string;
  href: string;
};

const plans: Plan[] = [
  {
    name: 'Free',
    price: '€0',
    description:
      'Start tracking your physical gold and silver without a subscription.',
    features: [
      'Personal precious-metals wallet',
      'Live gold & silver prices',
      'Basic portfolio value',
      'Daily price comparison',
      'Up to 5 holdings',
    ],
    note: 'No payment details required',
    cta: 'Start for free',
    href: '/login?plan=free',
  },
  {
    name: 'Pro',
    price: '€4.99',
    period: '/ month',
    description:
      'For investors who want a complete view of their precious-metals portfolio.',
    features: [
      'Everything in Free',
      'Unlimited holdings',
      'Full transaction history',
      'Profit & loss tracking',
      'Advanced portfolio analytics',
      'Price alerts',
      'Reports & exports',
    ],
    note: 'Subscription checkout will be connected with Stripe',
    featured: true,
    cta: 'Choose Pro',
    href: '/login?plan=pro',
  },
  {
    name: 'Premium',
    price: '€9.99',
    period: '/ month',
    description:
      'Advanced tools for active precious-metals investors and multiple portfolios.',
    features: [
      'Everything in Pro',
      'Multiple wallets',
      'Advanced alerts',
      'Extended reporting',
      'Portfolio sharing',
      'Priority features',
      'Future Buy / Sell integrations',
    ],
    note: 'Advanced features are being introduced progressively',
    cta: 'Choose Premium',
    href: '/login?plan=premium',
  },
];

function GoldMark() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 38,
        height: 38,
        borderRadius: 12,
        display: 'grid',
        placeItems: 'center',
        border: '1px solid rgba(214,180,92,.28)',
        background: 'rgba(214,180,92,.07)',
        color: '#D6B45C',
        flex: '0 0 auto',
      }}
    >
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none">
        <path
          d="M12 3.5 19 7.5v8L12 19.5l-7-4v-8l7-4Z"
          stroke="currentColor"
          strokeWidth="1.45"
          strokeLinejoin="round"
        />
        <path
          d="m8.2 9.5 3.8 2.2 3.8-2.2M12 11.7v4.3"
          stroke="currentColor"
          strokeWidth="1.45"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function CheckIcon() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 18,
        height: 18,
        borderRadius: 999,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(103,209,154,.09)',
        color: '#67D19A',
        flex: '0 0 auto',
        marginTop: 1,
      }}
    >
      <svg viewBox="0 0 16 16" width="11" height="11" fill="none">
        <path
          d="m3.5 8.2 2.7 2.7 6.3-6.1"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export default function LandingPage() {
  return (
    <main
      className={`${fraunces.variable} ${inter.variable}`}
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 50% -10%, rgba(214,180,92,.10), transparent 34%), #090A0D',
        color: '#F1F0EA',
        fontFamily: 'var(--font-body), system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: 'min(1180px, calc(100% - 32px))',
          margin: '0 auto',
          padding: '22px 0 70px',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
            paddingBottom: 22,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <GoldMark />
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display), Georgia, serif',
                  fontSize: 19,
                  letterSpacing: '-.02em',
                }}
              >
                GoldForUs
              </div>
              <div
                style={{
                  color: '#666B78',
                  fontSize: 9,
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  marginTop: 2,
                }}
              >
                Precious metals portfolio
              </div>
            </div>
          </div>

          <Link
            href="/login"
            style={{
              color: '#A5A8B2',
              textDecoration: 'none',
              fontSize: 12,
              border: '1px solid #292C34',
              background: '#111318',
              borderRadius: 10,
              padding: '10px 14px',
            }}
          >
            Sign in
          </Link>
        </header>

        <section
          style={{
            textAlign: 'center',
            padding: '74px 0 58px',
          }}
        >
          <div
            style={{
              color: '#D6B45C',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '.19em',
              textTransform: 'uppercase',
            }}
          >
            Your wealth, in precious metals.
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display), Georgia, serif',
              fontSize: 'clamp(46px, 8vw, 86px)',
              lineHeight: .96,
              letterSpacing: '-.055em',
              fontWeight: 600,
              maxWidth: 900,
              margin: '17px auto 0',
            }}
          >
            Know what your
            <br />
            <span style={{ color: '#D6B45C' }}>gold & silver are worth.</span>
          </h1>

          <p
            style={{
              maxWidth: 650,
              margin: '22px auto 0',
              color: '#777C89',
              fontSize: 14,
              lineHeight: 1.75,
            }}
          >
            GoldForUs helps you track physical gold and silver, understand
            your portfolio value and build a clearer investment overview.
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 10,
              marginTop: 28,
            }}
          >
            <Link
              href="/login?plan=free"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 46,
                padding: '0 20px',
                borderRadius: 11,
                background: '#D6B45C',
                color: '#0B0C0F',
                textDecoration: 'none',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Start for free
            </Link>

            <a
              href="#plans"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 46,
                padding: '0 20px',
                borderRadius: 11,
                border: '1px solid #2B2E36',
                background: '#111318',
                color: '#D8D8D3',
                textDecoration: 'none',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Compare plans
            </a>
          </div>
        </section>

        <section
          id="plans"
          style={{
            scrollMarginTop: 20,
          }}
        >
          <div
            style={{
              textAlign: 'center',
              marginBottom: 24,
            }}
          >
            <div
              style={{
                color: '#666B78',
                fontSize: 10,
                letterSpacing: '.16em',
                textTransform: 'uppercase',
              }}
            >
              Simple plans
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-display), Georgia, serif',
                fontSize: 'clamp(30px, 5vw, 44px)',
                letterSpacing: '-.04em',
                margin: '9px 0 0',
                fontWeight: 600,
              }}
            >
              Choose how you want to track.
            </h2>
          </div>

          <div
            className="goldforus-plans-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 12,
              alignItems: 'stretch',
            }}
          >
            {plans.map((plan) => (
              <article
                key={plan.name}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: 0,
                  padding: 25,
                  borderRadius: 16,
                  border: plan.featured
                    ? '1px solid rgba(214,180,92,.45)'
                    : '1px solid #252830',
                  background: plan.featured
                    ? 'linear-gradient(180deg, rgba(214,180,92,.075), #111318 34%)'
                    : '#111318',
                }}
              >
                {plan.featured && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 15,
                      right: 15,
                      borderRadius: 999,
                      padding: '5px 8px',
                      background: 'rgba(214,180,92,.12)',
                      color: '#D6B45C',
                      fontSize: 8,
                      fontWeight: 700,
                      letterSpacing: '.11em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Most popular
                  </div>
                )}

                <div
                  style={{
                    color: plan.featured ? '#D6B45C' : '#A0A4AE',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '.15em',
                    textTransform: 'uppercase',
                  }}
                >
                  {plan.name}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 5,
                    marginTop: 15,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-display), Georgia, serif',
                      fontSize: 39,
                      lineHeight: 1,
                      letterSpacing: '-.04em',
                    }}
                  >
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span
                      style={{
                        color: '#6F7380',
                        fontSize: 11,
                      }}
                    >
                      {plan.period}
                    </span>
                  )}
                </div>

                <p
                  style={{
                    color: '#777C89',
                    fontSize: 12,
                    lineHeight: 1.65,
                    minHeight: 59,
                    margin: '13px 0 0',
                  }}
                >
                  {plan.description}
                </p>

                <div
                  style={{
                    height: 1,
                    background: '#24262D',
                    margin: '20px 0 16px',
                  }}
                />

                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'grid',
                    gap: 10,
                  }}
                >
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 9,
                        color: '#C1C3C9',
                        fontSize: 11,
                        lineHeight: 1.45,
                      }}
                    >
                      <CheckIcon />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div style={{ flex: 1, minHeight: 20 }} />

                <Link
                  href={plan.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 45,
                    borderRadius: 10,
                    marginTop: 22,
                    textDecoration: 'none',
                    fontSize: 11,
                    fontWeight: 700,
                    background: plan.featured ? '#D6B45C' : '#191B21',
                    color: plan.featured ? '#0B0C0F' : '#D5D6D1',
                    border: plan.featured
                      ? '1px solid #D6B45C'
                      : '1px solid #2A2D35',
                  }}
                >
                  {plan.cta}
                </Link>

                <div
                  style={{
                    color: '#565A65',
                    fontSize: 9,
                    lineHeight: 1.5,
                    textAlign: 'center',
                    marginTop: 10,
                    minHeight: 27,
                  }}
                >
                  {plan.note}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          style={{
            marginTop: 56,
            padding: '23px 24px',
            borderRadius: 14,
            border: '1px solid #24262D',
            background: 'rgba(17,19,24,.75)',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 20,
          }}
          className="goldforus-trust-grid"
        >
          {[
            ['PRIVATE', 'Your portfolio belongs to your account.'],
            ['LIVE DATA', 'Track current gold and silver market prices.'],
            ['CLEAR VIEW', 'See your holdings and portfolio value in one place.'],
          ].map(([title, text]) => (
            <div key={title}>
              <div
                style={{
                  color: '#D6B45C',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '.14em',
                }}
              >
                {title}
              </div>
              <div
                style={{
                  color: '#777C89',
                  fontSize: 11,
                  lineHeight: 1.55,
                  marginTop: 6,
                }}
              >
                {text}
              </div>
            </div>
          ))}
        </section>

        <footer
          style={{
            color: '#50545E',
            fontSize: 10,
            lineHeight: 1.6,
            textAlign: 'center',
            marginTop: 34,
          }}
        >
          GoldForUs is a portfolio tracking service. Market prices are
          informational and may differ from dealer buy/sell prices.
        </footer>
      </div>

      <style>{`
        html {
          scroll-behavior: smooth;
        }

        @media (max-width: 900px) {
          .goldforus-plans-grid {
            grid-template-columns: 1fr !important;
            max-width: 620px;
            margin: 0 auto;
          }

          .goldforus-trust-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 560px) {
          .goldforus-plans-grid article {
            padding: 21px !important;
          }
        }
      `}</style>
    </main>
  );
}
