import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge, VerifiedBadge } from "@/components/ui/badge";

describe("StatusBadge — docs/02 §9.1 status→colour mapping", () => {
  it.each([
    ["PENDING_REVIEW", "Pending approval", "bg-warning-50"],
    ["APPROVED", "Approved", "bg-success-50"],
    ["REJECTED", "Rejected", "bg-danger-50"],
    ["DRAFT", "Draft", "bg-neutral-50"],
    ["REQUESTED", "Pending", "bg-warning-50"],
    ["CONFIRMED", "Confirmed", "bg-success-50"],
    ["LIVE", "Live", "bg-info-50"],
    ["COMPLETED", "Completed", "bg-neutral-50"],
    ["EXPIRED", "Expired", "bg-neutral-50"],
    ["VERIFIED", "Verified", "bg-success-50"],
    ["SUSPENDED", "Suspended", "bg-danger-50"],
  ])("%s → %s", (status, label, toneClass) => {
    const { container } = render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.firstChild).toHaveClass(toneClass);
  });

  it("distinguishes a listing's 'Pending approval' from a request's 'Pending' (§25)", () => {
    render(<StatusBadge status="PENDING_REVIEW" />);
    render(<StatusBadge status="REQUESTED" />);
    expect(screen.getByText("Pending approval")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("is text-first (the word is always present, not colour alone)", () => {
    render(<StatusBadge status="CONFIRMED" />);
    expect(screen.getByText("Confirmed")).toBeVisible();
  });

  it("an unknown status falls back to a neutral pill with the raw value", () => {
    const { container } = render(<StatusBadge status="WEIRD_STATE" />);
    expect(screen.getByText("WEIRD_STATE")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("bg-neutral-50");
  });

  it("honours an explicit label override", () => {
    render(<StatusBadge status="CONFIRMED" label="Booked" />);
    expect(screen.getByText("Booked")).toBeInTheDocument();
  });
});

describe("VerifiedBadge", () => {
  it("always pairs the icon with the word 'Verified' (never icon-only)", () => {
    render(<VerifiedBadge />);
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });
});
