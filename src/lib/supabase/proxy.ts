import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub ?? null;
  const pathname = request.nextUrl.pathname;

  const isLoginPage = pathname.startsWith('/login');
  const isLandingPage = pathname === '/landing';

  /*
   * Public pages:
   * - /landing is the public pricing/marketing page.
   * - /login is the authentication page.
   *
   * The root route remains the authenticated wallet.
   * An unauthenticated visitor is redirected from / to /landing.
   */
  if (!userId && pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/landing';

    const redirectResponse = NextResponse.redirect(url);

    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  if (!userId && !isLoginPage && !isLandingPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/landing';

    const redirectResponse = NextResponse.redirect(url);

    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  if (userId && (isLoginPage || isLandingPage)) {
    const url = request.nextUrl.clone();
    url.pathname = '/';

    const redirectResponse = NextResponse.redirect(url);

    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  void error;

  return supabaseResponse;
}
