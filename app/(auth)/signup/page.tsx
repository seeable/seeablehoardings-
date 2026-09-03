"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clientEnv } from "@/lib/env";
import {
  signupSchema,
  type SignupInput,
  type SignupRole,
  normaliseMobile,
  passwordStrength,
} from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/ui/field";
import { Card, Alert } from "@/components/ui/card";
import { GoogleButton } from "@/components/auth/google-button";

const ROLE_CARDS: { role: SignupRole; title: string; body: string }[] = [
  {
    role: "VIEWER",
    title: "I want to advertise",
    body: "Discover and request outdoor advertising space across Bengaluru.",
  },
  {
    role: "PUBLISHER",
    title: "I want to list my hoardings",
    body: "Reach advertisers looking for space like yours.",
  },
];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2>(1);
  const [role, setRole] = React.useState<SignupRole | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { role: undefined },
  });

  const pw = useWatch({ control, name: "password" }) ?? "";
  const strength = passwordStrength(pw);

  function chooseRole(r: SignupRole) {
    setRole(r);
    setValue("role", r, { shouldValidate: true });
    setStep(2);
  }

  async function onSubmit(values: SignupInput) {
    setFormError(null);
    if (values.role === "PUBLISHER" && !values.business_name?.trim()) return;

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: new URL(
          "/auth/callback",
          clientEnv.NEXT_PUBLIC_APP_URL,
        ).toString(),
        data: {
          role: values.role, // handle_new_user reads this; ADMIN would be downgraded
          full_name: values.full_name,
          phone: normaliseMobile(values.phone),
          business_name:
            values.role === "PUBLISHER" ? values.business_name : undefined,
        },
      },
    });

    if (error) {
      if (/already registered|already exists/i.test(error.message)) {
        setFormError(
          "An account with this email already exists — log in instead.",
        );
      } else {
        setFormError(
          error.message || "Could not create your account. Please try again.",
        );
      }
      return;
    }
    // mailer_autoconfirm is on for the demo — a session exists now.
    router.replace("/post-login");
    router.refresh();
  }

  if (step === 1) {
    return (
      <Card>
        <h1 className="text-ink-900 text-xl font-semibold">
          Create your account
        </h1>
        <p className="text-ink-500 mt-1 text-sm">
          First, what brings you here?
        </p>

        <div
          role="radiogroup"
          aria-label="Account type"
          className="mt-6 flex flex-col gap-3"
        >
          {ROLE_CARDS.map((c) => (
            <button
              key={c.role}
              type="button"
              role="radio"
              aria-checked={role === c.role}
              onClick={() => chooseRole(c.role)}
              className="border-border bg-surface-1 hover:border-ink-300 rounded-md border p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span className="text-ink-900 block font-medium">{c.title}</span>
              <span className="text-ink-500 mt-1 block text-sm">{c.body}</span>
            </button>
          ))}
        </div>

        <div className="text-ink-500 my-5 flex items-center gap-3 text-xs">
          <span className="bg-border h-px flex-1" />
          or
          <span className="bg-border h-px flex-1" />
        </div>
        <GoogleButton />
        <p className="text-ink-500 mt-2 text-center text-xs">
          Google sign-in creates an advertiser account.
        </p>

        <p className="text-ink-500 mt-6 text-center text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-gold-700 font-medium underline">
            Log in
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <button
        type="button"
        onClick={() => setStep(1)}
        className="text-ink-500 hover:text-ink-700 mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="text-ink-900 text-xl font-semibold">
        {role === "PUBLISHER" ? "Publisher account" : "Advertiser account"}
      </h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-6 flex flex-col gap-4"
      >
        {formError && <Alert>{formError}</Alert>}
        <input type="hidden" {...register("role")} />

        <Field
          label="Full name"
          htmlFor="full_name"
          required
          error={errors.full_name?.message}
        >
          <Input
            autoComplete="name"
            invalid={!!errors.full_name}
            {...register("full_name")}
          />
        </Field>

        {role === "PUBLISHER" && (
          <Field
            label="Business name"
            htmlFor="business_name"
            required
            error={errors.business_name?.message}
          >
            <Input
              autoComplete="organization"
              invalid={!!errors.business_name}
              {...register("business_name")}
            />
          </Field>
        )}

        <Field
          label="Email"
          htmlFor="email"
          required
          error={errors.email?.message}
        >
          <Input
            type="email"
            autoComplete="email"
            invalid={!!errors.email}
            {...register("email")}
          />
        </Field>

        <Field
          label="Mobile"
          htmlFor="phone"
          hint="Optional — used only for contact"
          error={errors.phone?.message}
        >
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+91"
            invalid={!!errors.phone}
            {...register("phone")}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          required
          error={errors.password?.message}
        >
          <PasswordInput
            autoComplete="new-password"
            invalid={!!errors.password}
            {...register("password")}
          />
        </Field>
        {pw.length > 0 && (
          <div className="-mt-2">
            <div className="flex gap-1" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-1 flex-1 rounded-full ${i < strength.score ? "bg-gold-500" : "bg-border"}`}
                />
              ))}
            </div>
            <p className="text-ink-500 mt-1 text-xs">
              Password strength: {strength.label}
            </p>
          </div>
        )}

        <Button type="submit" block loading={isSubmitting}>
          Create account
        </Button>
        <p className="text-ink-500 text-center text-xs">
          By continuing you agree to SEEABLE&apos;s terms of use.
        </p>
      </form>
    </Card>
  );
}
