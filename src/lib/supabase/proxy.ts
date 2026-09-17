import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },

        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })

          supabaseResponse = NextResponse.next({
            request,
          })

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })

          if (headers) {
            headers.forEach(([key, value]) => {
              supabaseResponse.headers.set(key, value)
            })
          }
        },
      },
    }
  )

  /*
   * Belangrijk:
   * getClaims() valideert de JWT en zorgt ervoor dat een verlopen
   * access token indien nodig wordt vernieuwd.
   *
   * De vernieuwde cookies moeten vervolgens via supabaseResponse
   * terug naar de browser.
   */
  const {
    data: { claims },
  } = await supabase.auth.getClaims()

  const user = claims?.sub ?? null

  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname.startsWith('/login')

  /*
   * Niet ingelogd → alleen /login toestaan.
   */
  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'

    const redirectResponse = NextResponse.redirect(url)

    /*
     * Neem eventuele Supabase cookies mee naar de redirect response.
     */
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie)
    })

    return redirectResponse
  }

  /*
   * Wel ingelogd → /login niet meer tonen.
   */
  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'

    const redirectResponse = NextResponse.redirect(url)

    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie)
    })

    return redirectResponse
  }

  return supabaseResponse
}

