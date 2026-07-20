"use server";

import { createClient } from "@/lib/supabase/server";

export type SignUpResult =
  | { ok: true; needsEmailConfirmation: boolean }
  | { ok: false; error: string };

function inviteCodesMatch(provided: string, expected: string): boolean {
  // Constant-time-ish compare for equal-length strings; reject length mismatch early.
  if (provided.length !== expected.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function signUpWithInvite(input: {
  email: string;
  password: string;
  inviteCode: string;
}): Promise<SignUpResult> {
  const expected = process.env.INVITE_CODE;
  if (!expected) {
    return {
      ok: false,
      error: "Sign-up is not configured. Ask an admin to set INVITE_CODE.",
    };
  }

  const provided = input.inviteCode.trim();
  if (!inviteCodesMatch(provided, expected.trim())) {
    return { ok: false, error: "Invalid invite code" };
  }

  const email = input.email.trim();
  const password = input.password;

  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }

  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return {
      ok: false,
      error: error.message || "Could not create your account.",
    };
  }

  return {
    ok: true,
    needsEmailConfirmation: data.session == null,
  };
}
