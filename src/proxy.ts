import createIntlMiddleware from "next-intl/middleware";
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const intlMiddleware = createIntlMiddleware(routing);

const PUBLIC_SEGMENTS = ["login"];

export default auth((req) => {
  const { nextUrl } = req;
  const segments = nextUrl.pathname.split("/").filter(Boolean);
  const locale = routing.locales.includes(segments[0] as never) ? segments[0] : routing.defaultLocale;
  const rest = routing.locales.includes(segments[0] as never) ? segments.slice(1) : segments;
  const isPublic = rest.length === 0 || PUBLIC_SEGMENTS.includes(rest[0]);

  if (!req.auth && !isPublic) {
    const loginUrl = new URL(`/${locale}/login`, nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (req.auth && rest[0] === "login") {
    return NextResponse.redirect(new URL(`/${locale}/appointments`, nextUrl.origin));
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
