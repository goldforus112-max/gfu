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

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })

          supabaseResponse = NextResponse.next({
            request,
          })

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  /*
   * getClaims() geeft bij een geldige sessie direct de claims terug.
   *
   * In jouw versie van @supabase/ssr is de returnwaarde:
   * {
   *   data: JwtPayload | null,
   *   error: ...
   * }
   *
   * Daarom gebruiken we data rechtstreeks als claims.
   */
  const {
    data: claims,
    error: claimsError,
  } = await supabase.auth.getClaims()

  const userId = claims?.sub ?? null

  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname.startsWith('/login')

  /*
   * Als Supabase geen geldige sessie heeft:
   * stuur de gebruiker naar /login.
   */
  if (!userId && !isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'

    const redirectResponse = NextResponse.redirect(url)

    /*
     * Eventuele vernieuwde Supabase cookies behouden.
     */
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie)
    })

    return redirectResponse
  }

  /*
   * Als de gebruiker al ingelogd is, hoeft /login niet geopend
   * te kunnen worden.
   */
  if (userId && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'

    const redirectResponse = NextResponse.redirect(url)

    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie)
    })

    return redirectResponse
  }

  /*
   * claimsError gebruiken we hier niet om direct te redirecten.
   * Een ontbrekende/ongeldige sessie wordt hierboven al afgehandeld
   * doordat userId null is.
   */
  void claimsError

  return supabaseResponse
}