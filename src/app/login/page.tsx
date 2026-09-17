'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Fraunces, Inter } from 'next/font/google'
import { createClient } from '@/lib/supabase/client'

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-display',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
})

type Mode = 'login' | 'signup'

type Plan = 'free' | 'pro' | 'premium'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [requestedPlan, setRequestedPlan] = useState<Plan | null>(null)
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const plan = params.get('plan')

    if (plan === 'free' || plan === 'pro' || plan === 'premium') {
      setRequestedPlan(plan)
      setMode('signup')
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              requested_plan: requestedPlan ?? 'free',
            },
          },
        })

        if (signUpError) {
          throw signUpError
        }

        // With Confirm Email enabled Supabase intentionally returns no session
        // until the user has clicked the confirmation link.
        if (!data.session) {
          setMessage(
            `Account created. Check ${email.trim()} for the confirmation email. After confirming your email, you can log in immediately.`
          )
          return
        }

        router.replace('/')
        router.refresh()
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) {
        throw signInError
      }

      router.replace('/')
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main
      className={`${fraunces.variable} ${inter.variable}`}
      style={{
        minHeight: '100vh',
        width: '100%',
        overflowX: 'hidden',
        background:
          'radial-gradient(circle at 50% -10%, rgba(214,180,92,.09), transparent 38%), #090A0D',
        color: '#ECEBE7',
        fontFamily: 'var(--font-body), system-ui, sans-serif',
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; width: 100%; max-width: 100%; overflow-x: hidden; background: #090A0D; }
        button, input { font: inherit; }
        .goldforus-auth-input:focus {
          outline: none;
          border-color: rgba(214,180,92,.7) !important;
          box-shadow: 0 0 0 3px rgba(214,180,92,.08);
        }
        .goldforus-auth-button:hover:not(:disabled) { transform: translateY(-1px); }
        @media (max-width: 520px) {
          .goldforus-auth-shell { padding: 20px 16px !important; }
          .goldforus-auth-card { padding: 24px !important; border-radius: 16px !important; }
          .goldforus-auth-title { font-size: 40px !important; }
        }
      `}</style>

      <div
        className="goldforus-auth-shell"
        style={{
          width: '100%',
          maxWidth: 520,
          margin: '0 auto',
          padding: '42px 20px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              margin: '0 auto 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background:
                'linear-gradient(145deg, rgba(214,180,92,.13), rgba(214,180,92,.035))',
              border: '1px solid rgba(214,180,92,.18)',
              color: '#D6B45C',
            }}
          >
            ◉
          </div>

          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.16em',
            }}
          >
            GOLDFORUS
          </div>

          <p
            style={{
              color: '#626774',
              fontSize: 11,
              margin: '7px 0 0',
            }}
          >
            Personal precious-metal portfolio
          </p>
        </div>

        <section
          className="goldforus-auth-card"
          style={{
            background: 'linear-gradient(145deg, #13151A, #101115)',
            border: '1px solid #23262E',
            borderRadius: 18,
            padding: 32,
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                color: '#D6B45C',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.13em',
                marginBottom: 8,
              }}
            >
              {mode === 'signup' ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}
            </div>

            <h1
              className="goldforus-auth-title"
              style={{
                margin: 0,
                fontFamily: 'var(--font-display), Georgia, serif',
                fontSize: 48,
                lineHeight: 1,
                letterSpacing: '-0.04em',
                fontWeight: 600,
              }}
            >
              {mode === 'signup' ? 'Start tracking.' : 'Your wallet awaits.'}
            </h1>

            <p
              style={{
                color: '#777C89',
                fontSize: 12,
                lineHeight: 1.65,
                margin: '13px 0 0',
              }}
            >
              {mode === 'signup'
                ? 'Create your account. We will send a confirmation email before your first sign-in.'
                : 'Sign in to access your personal GoldForUs portfolio.'}
            </p>
          </div>

          {requestedPlan && mode === 'signup' && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 9,
                marginBottom: 14,
                background: 'rgba(214,180,92,.07)',
                border: '1px solid rgba(214,180,92,.16)',
                color: '#B9B1A0',
                fontSize: 11,
              }}
            >
              Selected plan: <strong style={{ color: '#D6B45C' }}>{requestedPlan}</strong>
            </div>
          )}

          {message && (
            <div
              role="status"
              style={{
                padding: 13,
                borderRadius: 10,
                marginBottom: 14,
                background: 'rgba(103,209,154,.07)',
                border: '1px solid rgba(103,209,154,.16)',
                color: '#9DDDBB',
                fontSize: 11,
                lineHeight: 1.6,
              }}
            >
              {message}
            </div>
          )}

          {error && (
            <div
              role="alert"
              style={{
                padding: 13,
                borderRadius: 10,
                marginBottom: 14,
                background: 'rgba(240,160,160,.06)',
                border: '1px solid rgba(240,160,160,.14)',
                color: '#E9A8A8',
                fontSize: 11,
                lineHeight: 1.6,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
            <label style={{ display: 'grid', gap: 7 }}>
              <span style={{ color: '#777C89', fontSize: 10, fontWeight: 600 }}>
                EMAIL
              </span>
              <input
                className="goldforus-auth-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="you@example.com"
                style={{
                  width: '100%',
                  minWidth: 0,
                  background: '#0C0D10',
                  border: '1px solid #292C34',
                  borderRadius: 9,
                  padding: '13px 14px',
                  color: '#ECEBE7',
                  fontSize: 13,
                }}
              />
            </label>

            <label style={{ display: 'grid', gap: 7 }}>
              <span style={{ color: '#777C89', fontSize: 10, fontWeight: 600 }}>
                PASSWORD
              </span>
              <input
                className="goldforus-auth-input"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  minWidth: 0,
                  background: '#0C0D10',
                  border: '1px solid #292C34',
                  borderRadius: 9,
                  padding: '13px 14px',
                  color: '#ECEBE7',
                  fontSize: 13,
                }}
              />
            </label>

            <button
              className="goldforus-auth-button"
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                marginTop: 4,
                padding: '13px 16px',
                borderRadius: 9,
                border: 0,
                background: 'linear-gradient(135deg, #E7D18A, #C8A94F)',
                color: '#17130A',
                fontWeight: 700,
                fontSize: 12,
                cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.55 : 1,
                transition: 'transform 150ms ease, opacity 150ms ease',
              }}
            >
              {loading
                ? 'Please wait…'
                : mode === 'signup'
                  ? 'Create account'
                  : 'Sign in'}
            </button>
          </form>

          <div
            style={{
              height: 1,
              background: '#24262D',
              margin: '22px 0',
            }}
          />

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setError('')
              setMessage('')
            }}
            style={{
              width: '100%',
              background: 'transparent',
              border: 0,
              color: '#9EA3AE',
              cursor: 'pointer',
              fontSize: 11,
              padding: 8,
            }}
          >
            {mode === 'login'
              ? 'New to GoldForUs? Create an account'
              : 'Already have an account? Sign in'}
          </button>
        </section>

        <p
          style={{
            color: '#4F535D',
            fontSize: 10,
            lineHeight: 1.6,
            textAlign: 'center',
            margin: '18px 10px 0',
          }}
        >
          Your email is confirmed before your first sign-in. No manual approval by the GoldForUs owner is required.
        </p>
      </div>
    </main>
  )
}
