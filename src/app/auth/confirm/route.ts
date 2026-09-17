import type { EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/'
  }

  return value
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeNextPath(searchParams.get('next'))

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL('/login?error=confirmation_failed', request.url)
    )
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  })

  if (error) {
    return NextResponse.redirect(
      new URL('/login?error=confirmation_failed', request.url)
    )
  }

  return NextResponse.redirect(new URL(next, request.url))
}
