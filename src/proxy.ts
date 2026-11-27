import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Obnoví přihlášení (Supabase session v cookies) a nepřihlášené pošle na přihlášení.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const prihlasen = !!data?.claims;
  const cesta = request.nextUrl.pathname;
  const naPrihlaseni = cesta.startsWith("/prihlaseni");
  const verejne = naPrihlaseni || cesta.startsWith("/heslo") || cesta.startsWith("/auth/");

  if (!prihlasen && !verejne) {
    return NextResponse.redirect(new URL("/prihlaseni", request.url));
  }
  if (prihlasen && naPrihlaseni) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
