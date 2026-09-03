"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { clientEnv } from "@/lib/env";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Card, Alert } from "@/components/ui/card";

type Values = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = React.useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: Values) {
    const supabase = createClient();
    // Don't surface whether the email exists — always show the same confirmation.
    await supabase.auth.resetPasswordForEmail(values.email, {
      // Through the callback so the PKCE code becomes a (recovery) session,
      // then on to the new-password form.
      redirectTo: new URL(
        "/auth/callback?next=/reset-password",
        clientEnv.NEXT_PUBLIC_APP_URL,
      ).toString(),
    });
    setSent(true);
  }

  if (sent) {
    return (
      <Card>
        <h1 className="text-ink-900 text-xl font-semibold">Check your inbox</h1>
        <Alert tone="success" className="mt-4">
          If an account exists for {getValues("email")}, we&apos;ve sent a link
          to reset your password.
        </Alert>
        <Link
          href="/login"
          className="text-gold-700 mt-6 block text-center text-sm font-medium underline"
        >
          Back to log in
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-ink-900 text-xl font-semibold">
        Reset your password
      </h1>
      <p className="text-ink-500 mt-1 text-sm">
        Enter your email and we&apos;ll send you a reset link.
      </p>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-6 flex flex-col gap-4"
      >
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            type="email"
            autoComplete="email"
            autoFocus
            invalid={!!errors.email}
            {...register("email")}
          />
        </Field>
        <Button type="submit" block loading={isSubmitting}>
          Send reset link
        </Button>
      </form>
      <Link
        href="/login"
        className="text-ink-500 mt-4 block text-center text-sm underline"
      >
        Back to log in
      </Link>
    </Card>
  );
}
