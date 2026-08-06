import Link from "next/link";

import ForgotPasswordForm from "@/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-zinc-100 px-4 py-10">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
            Off-Market Tracker
          </p>

          <h1 className="mt-1 text-xl font-semibold text-zinc-900">
            Reset your password
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Enter your email and we will send you a password reset link.
          </p>
        </div>

        <ForgotPasswordForm />

        <p className="mt-5 text-center text-sm text-zinc-500">
          Remembered your password?{" "}
          <Link
            href="/login"
            className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-600"
          >
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
