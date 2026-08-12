import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * This callback only ever completes the password-recovery flow, so `next`
 * is checked against an exact allow-list rather than a leading-slash check
 * — `next=//evil.com` also starts with "/" and would otherwise resolve to
 * an external host via `new URL("//evil.com", origin)`.
 */
const SAFE_NEXT_PATHS = new Set(["/reset-password"]);

function resolveSafeNext(next: string | null): string {
  return next && SAFE_NEXT_PATHS.has(next) ? next : "/reset-password";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(
        new URL(resolveSafeNext(next), requestUrl.origin),
      );
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=invalid-reset-link", requestUrl.origin),
  );
}
