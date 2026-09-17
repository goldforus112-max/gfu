'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setMessage('')
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      router.push('/')
      router.refresh()
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (!data.session) {
      setMessage(
        'Account created. Please check your email to confirm your account.'
      )
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#14151A',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#1C1D24',
          border: '1px solid #2A2B33',
          borderRadius: 18,
          padding: 32,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ marginBottom: 30 }}>
          <div
            style={{
              color: '#C9A227',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            GoldForUs
          </div>

          <h1
            style={{
              margin: 0,
              color: '#F4F1E8',
              fontSize: 30,
              lineHeight: 1.15,
            }}
          >
            {mode === 'login'
              ? 'Welcome back'
              : 'Create your wallet'}
          </h1>

          <p
            style={{
              margin: '10px 0 0',
              color: '#8B8D98',
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            {mode === 'login'
              ? 'Sign in to access your personal precious metals wallet.'
              : 'Create an account to start managing your personal wallet.'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label
            style={{
              display: 'block',
              color: '#C8C9D0',
              fontSize: 13,
              marginBottom: 7,
            }}
          >
            Email
          </label>

          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            style={inputStyle}
          />

          <label
            style={{
              display: 'block',
              color: '#C8C9D0',
              fontSize: 13,
              marginBottom: 7,
            }}
          >
            Password
          </label>

          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
            autoComplete={
              mode === 'login'
                ? 'current-password'
                : 'new-password'
            }
            style={inputStyle}
          />

          {error && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                background: 'rgba(180, 60, 60, 0.12)',
                border: '1px solid rgba(180, 60, 60, 0.25)',
                color: '#E58A8A',
                fontSize: 13,
                lineHeight: 1.4,
              }}
            >
              {error}
            </div>
          )}

          {message && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                background: 'rgba(201, 162, 39, 0.08)',
                border: '1px solid rgba(201, 162, 39, 0.2)',
                color: '#D7B84B',
                fontSize: 13,
                lineHeight: 1.4,
              }}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              marginTop: 20,
              padding: '13px 16px',
              borderRadius: 10,
              border: 0,
              background: loading ? '#806B27' : '#C9A227',
              color: '#14151A',
              fontWeight: 700,
              fontSize: 14,
              cursor: loading ? 'default' : 'pointer',
            }}
          >
            {loading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <div
          style={{
            marginTop: 22,
            paddingTop: 20,
            borderTop: '1px solid #2A2B33',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              color: '#8B8D98',
              fontSize: 13,
            }}
          >
            {mode === 'login'
              ? "Don't have an account?"
              : 'Already have an account?'}
          </span>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setError('')
              setMessage('')
            }}
            style={{
              marginLeft: 6,
              padding: 0,
              border: 0,
              background: 'transparent',
              color: '#C9A227',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {mode === 'login'
              ? 'Create one'
              : 'Sign in'}
          </button>
        </div>
      </div>
    </main>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  marginBottom: 16,
  padding: '13px 14px',
  borderRadius: 10,
  border: '1px solid #343640',
  background: '#14151A',
  color: '#F4F1E8',
  outline: 'none',
  fontSize: 14,
}