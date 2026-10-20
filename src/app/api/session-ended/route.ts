import { signOut } from "@/lib/auth";
import { routing } from "@/i18n/routing";

// A signed cookie whose account was deactivated or signed out elsewhere
// (password reset, role change) still looks valid to the proxy, which would
// bounce /login back into the app. Pages send such sessions here to clear
// the cookie first.
export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("locale");
  const locale = routing.locales.includes(requested as never) ? requested : routing.defaultLocale;
  await signOut({ redirectTo: `/${locale}/login?ended=1` });
}
