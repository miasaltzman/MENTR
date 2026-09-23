import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_PAGES, isProtectedPath } from "@/lib/auth/redirects";
import { isSupabaseConfigured, publicEnv } from "@/lib/public-env";

/**
 * Refreshes the Supabase session cookie on every request and performs
 * optimistic auth redirects. Pages still verify the user server-side.
 */
export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getClaims() validates the JWT and refreshes an expired session.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    if (path === "/login") url.searchParams.set("next", pathname + search);
    const redirect = NextResponse.redirect(url);
    // Preserve any refreshed auth cookies on the redirect.
    for (const cookie of response.cookies.getAll())
      redirect.cookies.set(cookie);
    return redirect;
  };

  if (!isSignedIn && isProtectedPath(pathname)) return redirectTo("/login");
  if (isSignedIn && (AUTH_PAGES as readonly string[]).includes(pathname)) {
    return redirectTo("/home");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
