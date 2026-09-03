"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/ui/field";
import { Card, Alert } from "@/components/ui/card";

type Values = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, setState] = React.useState<
    "checking" | "ready" | "invalid" | "done"
  >("checking");
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setState(data.session ? "ready" : "invalid");
    });
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(resetPasswordSchema) });

  async function onSubmit(values: Values) {
    setFormError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });
    if (error) {
      setFormError(error.message || "Could not update your password.");
      return;
    }
    setState("done");
  }

  if (state === "checking") {
    return (
      <Card>
        <p className="text-ink-500 text-sm">Checking your reset link…</p>
      </Card>
    );
  }

  if (state === "invalid") {
    return (
      <Card>
        <h1 className="text-ink-900 text-xl font-semibold">Link expired</h1>
        <Alert className="mt-4">
          This password reset link is invalid or has expired.
        </Alert>
        <Link
          href="/forgot-password"
          className="text-gold-700 mt-6 block text-center text-sm font-medium underline"
        >
          Request a new link
        </Link>
      </Card>
    );
  }

  if (state === "done") {
    return (
      <Card>
        <h1 className="text-ink-900 text-xl font-semibold">Password updated</h1>
        <Alert tone="success" className="mt-4">
          Your password has been changed.
        </Alert>
        <Button
          className="mt-6"
          block
          onClick={() => {
            router.replace("/post-login");
            router.refresh();
          }}
        >
          Continue
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-ink-900 text-xl font-semibold">Set a new password</h1>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-6 flex flex-col gap-4"
      >
        {formError && <Alert>{formError}</Alert>}
        <Field
          label="New password"
          htmlFor="password"
          error={errors.password?.message}
        >
          <PasswordInput
            autoComplete="new-password"
            autoFocus
            invalid={!!errors.password}
            {...register("password")}
          />
        </Field>
        <Field
          label="Confirm password"
          htmlFor="confirm"
          error={errors.confirm?.message}
        >
          <PasswordInput
            autoComplete="new-password"
            invalid={!!errors.confirm}
            {...register("confirm")}
          />
        </Field>
        <Button type="submit" block loading={isSubmitting}>
          Update password
        </Button>
      </form>
    </Card>
  );
}
