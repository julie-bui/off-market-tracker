import ResetPasswordForm from "@/components/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-zinc-100 px-4 py-10">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
            Off-Market Tracker
          </p>

          <h1 className="mt-1 text-xl font-semibold text-zinc-900">
            Choose a new password
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Enter and confirm your new password.
          </p>
        </div>

        <ResetPasswordForm />
      </div>
    </main>
  );
}
