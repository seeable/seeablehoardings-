"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { formatPrice } from "@/lib/format";
import { ApiClientError } from "@/lib/api/client";
import {
  createHoarding,
  getHoarding,
  submitHoarding,
  updateHoarding,
} from "@/lib/inventory/client";
import { humanizeAttributeKey } from "@/lib/inventory/attributes";
import type {
  Blocker,
  HoardingOwnerView,
  HoardingTypeView,
  MediaAsset,
} from "@/lib/inventory/types";
import { TypeGrid } from "@/components/inventory/type-grid";
import { AttributeFields } from "@/components/inventory/attribute-fields";
import { MediaUploader } from "@/components/inventory/media-uploader";
import { Skeleton } from "@/components/ui/skeleton";
import { SubmissionChecklist } from "@/components/inventory/submission-checklist";
import { AvailabilityEditor } from "@/components/inventory/availability-editor";
import { cn } from "@/lib/utils";

// maplibre-gl loads only in the browser, and only on this step — keeps it out
// of every server bundle (RISK-1, the Worker size budget).
const MapPinPicker = dynamic(
  () =>
    import("@/components/inventory/map-pin-picker").then((m) => m.MapPinPicker),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> },
);

const STEPS = ["Type", "Details", "Location", "Photos", "Pricing", "Review"];

type Attrs = Record<string, string | number | boolean | null>;
interface FormState {
  title: string;
  description: string;
  size: string;
  price: string;
  price_unit: "DAY" | "WEEK" | "MONTH";
  latitude: number | null;
  longitude: number | null;
  locality: string;
  address_text: string;
  attributes: Attrs;
  traffic_volume: string;
  visibility_rating: string;
  nearby_landmarks: string;
}

function initialForm(h?: HoardingOwnerView): FormState {
  const si = (h?.site_intelligence ?? {}) as Record<string, string>;
  return {
    title: h?.title ?? "",
    description: h?.description ?? "",
    size: h?.size ?? "",
    price: h?.price != null ? String(h.price) : "",
    price_unit: (h?.price_unit as FormState["price_unit"]) ?? "MONTH",
    latitude: h?.latitude ?? null,
    longitude: h?.longitude ?? null,
    locality: h?.locality ?? "",
    address_text: h?.address_text ?? "",
    attributes: (h?.attributes ?? {}) as Attrs,
    traffic_volume: si.traffic_volume ?? "",
    visibility_rating: si.visibility_rating ?? "",
    nearby_landmarks: si.nearby_landmarks ?? "",
  };
}

export function HoardingWizard({
  types,
  initial,
}: {
  types: HoardingTypeView[];
  initial?: HoardingOwnerView;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = !!initial;

  const [step, setStep] = React.useState(initial ? 6 : 1);
  const [id, setId] = React.useState<string | null>(initial?.id ?? null);
  const [typeCode, setTypeCode] = React.useState<string | null>(
    initial?.type_code ?? null,
  );
  const [form, setForm] = React.useState<FormState>(initialForm(initial));
  const [media, setMedia] = React.useState<MediaAsset[]>(initial?.media ?? []);
  const [blockers, setBlockers] = React.useState<Blocker[]>(
    initial?.submission_readiness.blockers ?? [],
  );
  const [missingAttrs, setMissingAttrs] = React.useState<string[]>(
    initial?.missing_attribute_keys ?? [],
  );
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const frozen = initial?.is_edit_frozen ?? false;

  const selectedType = types.find((t) => t.code === typeCode) ?? null;
  const attrKeys = selectedType?.required_attribute_keys ?? [];
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function buildPayload() {
    const si: Record<string, string> = {};
    if (form.traffic_volume) si.traffic_volume = form.traffic_volume;
    if (form.visibility_rating) si.visibility_rating = form.visibility_rating;
    if (form.nearby_landmarks.trim())
      si.nearby_landmarks = form.nearby_landmarks.trim();
    return {
      title: form.title.trim(),
      description: form.description.trim() || null,
      size: form.size.trim() || null,
      price: form.price.trim() === "" ? null : Number(form.price),
      price_unit: form.price_unit,
      latitude: form.latitude,
      longitude: form.longitude,
      locality: form.locality.trim() || null,
      address_text: form.address_text.trim() || null,
      attributes: form.attributes,
      site_intelligence: si,
    };
  }

  async function persist(): Promise<boolean> {
    setSaving(true);
    try {
      const payload = buildPayload();
      let view: HoardingOwnerView;
      if (!id) {
        view = await createHoarding({ type_code: typeCode!, ...payload });
        setId(view.id);
      } else {
        view = await updateHoarding(id, payload);
      }
      setBlockers(view.submission_readiness.blockers);
      setMissingAttrs(view.missing_attribute_keys);
      return true;
    } catch (e) {
      if (e instanceof ApiClientError) {
        if (e.code === "HOARDING_EDIT_FROZEN") {
          toast.error(
            "Some fields are locked while a request is pending on this listing.",
          );
        } else {
          toast.error(e.message);
        }
      } else {
        toast.error("Couldn't save. Please try again.");
      }
      return false;
    } finally {
      setSaving(false);
    }
  }

  function validateStep(): string | null {
    if (step === 1 && !typeCode) return "Choose a hoarding type to continue.";
    if (step === 2 && form.title.trim() === "")
      return "Give this hoarding a name.";
    return null;
  }

  async function next() {
    const err = validateStep();
    if (err) {
      toast.error(err);
      return;
    }
    if (step >= 2) {
      const ok = await persist();
      if (!ok) return;
    }
    const target = step + 1;
    if (target === 6 && id) await refresh();
    setStep(target);
  }

  async function refresh() {
    if (!id) return;
    try {
      const v = await getHoarding(id);
      setBlockers(v.submission_readiness.blockers);
      setMissingAttrs(v.missing_attribute_keys);
      setMedia(v.media);
    } catch {
      /* keep what we have */
    }
  }

  async function saveDraft() {
    if (step < 2 && !id) {
      toast.error("Add a name first, then you can save a draft.");
      return;
    }
    if (await persist()) {
      toast.success("Saved as a draft.");
      router.push("/publisher/hoardings");
      router.refresh();
    }
  }

  async function submit() {
    if (!id) return;
    setSubmitting(true);
    try {
      if (!(await persist())) return;
      await submitHoarding(id);
      toast.success("Submitted for approval.");
      router.push("/publisher/hoardings?status=PENDING_REVIEW");
      router.refresh();
    } catch (e) {
      if (e instanceof ApiClientError) {
        toast.error(e.message);
        const keys = e.details?.missing_attribute_keys;
        if (Array.isArray(keys)) setMissingAttrs(keys as string[]);
        await refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-h1 text-ink-900">
          {editing ? `Edit ${initial!.title}` : "Add a hoarding"}
        </h1>
        <button
          type="button"
          onClick={() => router.push("/publisher/hoardings")}
          className="text-ink-500 hover:text-ink-900 text-sm"
        >
          Close
        </button>
      </div>

      <Stepper step={step} />

      {editing && initial!.approval_status === "REJECTED" && initial!.rejection_reason && (
        <Alert tone="danger" className="mt-4">
          SEEABLE noted: {initial!.rejection_reason}
        </Alert>
      )}
      {frozen && (
        <Alert tone="warning" className="mt-4">
          A request is pending on this listing — commercial details (name, type,
          price, location) are locked until it&apos;s resolved.
        </Alert>
      )}

      <div className="mt-6 space-y-5">
        {step === 1 && (
          <TypeGrid
            types={types}
            value={typeCode}
            onChange={setTypeCode}
            disabled={editing}
          />
        )}

        {step === 2 && (
          <>
            <Field label="Hoarding name" htmlFor="title" required>
              <Input
                value={form.title}
                disabled={frozen}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Premium Unipole — Hosur Road"
              />
            </Field>
            <Field label="Description" htmlFor="description" hint="Optional">
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
            <Field label="Size / dimensions" htmlFor="size" hint="e.g. 20ft x 40ft">
              <Input
                value={form.size}
                onChange={(e) => set("size", e.target.value)}
              />
            </Field>
            <AttributeFields
              keys={attrKeys}
              values={form.attributes}
              missing={missingAttrs}
              onChange={(a) => set("attributes", a)}
            />
          </>
        )}

        {step === 3 && (
          <>
            <MapPinPicker
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={({ latitude, longitude }) =>
                setForm((f) => ({ ...f, latitude, longitude }))
              }
            />
            <Field label="Locality / area" htmlFor="locality" hint="e.g. Marathahalli">
              <Input
                value={form.locality}
                onChange={(e) => set("locality", e.target.value)}
              />
            </Field>
            <Field label="Address" htmlFor="address" hint="Optional">
              <Input
                value={form.address_text}
                onChange={(e) => set("address_text", e.target.value)}
              />
            </Field>
            <p className="text-overline text-ink-500">Site intelligence · optional</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Traffic volume" htmlFor="traffic">
                <Select
                  value={form.traffic_volume}
                  placeholder="Not specified"
                  onChange={(e) => set("traffic_volume", e.target.value)}
                >
                  {["LOW", "MEDIUM", "HIGH"].map((o) => (
                    <option key={o} value={o}>
                      {o[0] + o.slice(1).toLowerCase()}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Visibility rating" htmlFor="visibility">
                <Select
                  value={form.visibility_rating}
                  placeholder="Not specified"
                  onChange={(e) => set("visibility_rating", e.target.value)}
                >
                  {["FAIR", "GOOD", "EXCELLENT"].map((o) => (
                    <option key={o} value={o}>
                      {o[0] + o.slice(1).toLowerCase()}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Nearby landmarks" htmlFor="landmarks">
              <Input
                value={form.nearby_landmarks}
                onChange={(e) => set("nearby_landmarks", e.target.value)}
                placeholder="e.g. Electronic City Signal, 200m from Infosys gate"
              />
            </Field>
          </>
        )}

        {step === 4 &&
          (id ? (
            <MediaUploader hoardingId={id} media={media} onChange={setMedia} />
          ) : (
            <p className="text-ink-500 text-sm">
              Go back and add a name first — photos attach to a saved draft.
            </p>
          ))}

        {step === 5 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Base rate (₹)" htmlFor="price" required>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.price}
                  disabled={frozen}
                  onChange={(e) => set("price", e.target.value)}
                />
              </Field>
              <Field label="Per" htmlFor="unit">
                <Select
                  value={form.price_unit}
                  disabled={frozen}
                  onChange={(e) =>
                    set("price_unit", e.target.value as FormState["price_unit"])
                  }
                >
                  <option value="MONTH">Month</option>
                  <option value="WEEK">Week</option>
                  <option value="DAY">Day</option>
                </Select>
              </Field>
            </div>
            {id && (
              <div>
                <p className="text-overline text-ink-500 mb-2">
                  Block dates you already know are unavailable · optional
                </p>
                <AvailabilityEditor hoardingId={id} />
              </div>
            )}
          </>
        )}

        {step === 6 && (
          <>
            <ReviewSummary
              form={form}
              type={selectedType}
              attrKeys={attrKeys}
              mediaCount={media.length}
              onEdit={setStep}
            />
            <div>
              <h2 className="text-h3 text-ink-900 mb-2">Submission readiness</h2>
              <SubmissionChecklist blockers={blockers} />
            </div>
          </>
        )}
      </div>

      <div className="border-border mt-8 flex items-center justify-between gap-3 border-t pt-4">
        <div>
          {step > 1 && (
            <Button
              variant="ghost"
              onClick={() => setStep(step - 1)}
              disabled={saving || submitting}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={saveDraft}
            loading={saving}
            disabled={submitting}
          >
            Save as draft
          </Button>
          {step < 6 ? (
            <Button onClick={next} loading={saving} disabled={submitting}>
              Continue
            </Button>
          ) : (
            <Button
              onClick={submit}
              loading={submitting || saving}
              disabled={blockers.length > 0}
            >
              Submit for approval
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < step ? "done" : n === step ? "current" : "todo";
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                state === "done" && "bg-gold-500 text-ink-900",
                state === "current" && "bg-ink-900 text-surface-1",
                state === "todo" && "bg-surface-2 text-ink-500",
              )}
            >
              {state === "done" ? <Check className="h-3 w-3" /> : n}
            </span>
            <span
              className={cn(
                "hidden text-xs sm:block",
                state === "current" ? "text-ink-900 font-semibold" : "text-ink-500",
              )}
            >
              {label}
            </span>
            {n < STEPS.length && (
              <span className="bg-border h-px flex-1" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ReviewSummary({
  form,
  type,
  attrKeys,
  mediaCount,
  onEdit,
}: {
  form: FormState;
  type: HoardingTypeView | null;
  attrKeys: string[];
  mediaCount: number;
  onEdit: (step: number) => void;
}) {
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="text-ink-900 text-right">{value || "—"}</span>
    </div>
  );
  const section = (title: string, stepNo: number, body: React.ReactNode) => (
    <div className="border-border rounded-lg border p-4">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-h4 text-ink-900">{title}</h3>
        <button
          type="button"
          onClick={() => onEdit(stepNo)}
          className="text-gold-700 text-xs font-medium"
        >
          Edit
        </button>
      </div>
      {body}
    </div>
  );
  return (
    <div className="space-y-3">
      {section("Type", 1, row("Hoarding type", type?.display_name))}
      {section(
        "Details",
        2,
        <>
          {row("Name", form.title)}
          {row("Size", form.size)}
          {attrKeys.map((k) =>
            row(humanizeAttributeKey(k), String(form.attributes[k] ?? "")),
          )}
        </>,
      )}
      {section(
        "Location",
        3,
        <>
          {row("Locality", form.locality)}
          {row(
            "Coordinates",
            form.latitude != null && form.longitude != null
              ? `${form.latitude}, ${form.longitude}`
              : "",
          )}
        </>,
      )}
      {section("Photos", 4, row("Uploaded", `${mediaCount} photo${mediaCount === 1 ? "" : "s"}`))}
      {section(
        "Pricing",
        5,
        row("Rate", formatPrice(Number(form.price) || null, form.price_unit)),
      )}
    </div>
  );
}
