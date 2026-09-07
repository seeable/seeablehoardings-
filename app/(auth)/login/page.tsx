"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/ui/field";
import { Card, Alert } from "@/components/ui/card";
import { GoogleButton } from "@/components/auth/google-button";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const dest = next && next.startsWith("/") ? next : "/post-login";

  const errorParam = params.get("error");
  const [formError, setFormError] = React.useState<string | null>(
    errorParam === "oauth_no_code" || errorParam === "oauth_exchange"
      ? "Google sign-in couldn't be completed. Please try again."
      : errorParam
        ? "Something went wrong signing you in. Please try again."
        : null,
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      setFormError("Incorrect email or password."); // generic — AUTH-02
      return;
    }
    router.replace(dest);
    router.refresh();
  }

  return (
    <Card>
      <h1 className="text-ink-900 text-2xl font-semibold">Welcome back</h1>
      <p className="text-ink-700 mt-1 text-sm">
        Sign in to continue to SEEABLE.{" "}
        <Link href="/signup" className="text-gold-500 font-medium underline">
          Sign up
        </Link>
      </p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-6 flex flex-col gap-4"
      >
        {formError && <Alert>{formError}</Alert>}

        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            type="email"
            autoComplete="email"
            autoFocus
            invalid={!!errors.email}
            {...register("email")}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
        >
          <PasswordInput
            autoComplete="current-password"
            invalid={!!errors.password}
            {...register("password")}
          />
        </Field>

        <div className="-mt-1 text-right">
          <Link
            href="/forgot-password"
            className="text-gold-500 text-sm underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" block loading={isSubmitting}>
          Log in
        </Button>
      </form>

      <div className="text-ink-500 my-5 flex items-center gap-3 text-xs">
        <span className="bg-border h-px flex-1" />
        or
        <span className="bg-border h-px flex-1" />
      </div>
      <GoogleButton next={next ?? undefined} />
    </Card>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<Card>Loading…</Card>}>
      <LoginForm />
    </React.Suspense>
  );
}
