import { LoginForm } from "@/components/auth/login-form";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-[color:var(--main-column-bg)] px-4 py-10">
      <Suspense
        fallback={
          <div className="h-48 w-full max-w-sm animate-pulse rounded-xl border border-border bg-surface" />
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
