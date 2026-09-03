import { describe, expect, it } from "vitest";
import { Bell } from "lucide-react";
import {
  notificationHref,
  notificationIcon,
  type NotificationRow,
} from "@/lib/notifications";

const row = (over: Partial<NotificationRow>): NotificationRow => ({
  id: "n1",
  type: "REQUEST_ACCEPTED",
  title: "t",
  message: "m",
  is_read: false,
  created_at: "2026-09-15T10:00:00Z",
  related_request_id: null,
  related_hoarding_id: null,
  ...over,
});

describe("notificationHref — role-aware deep links (docs/05 SH-02)", () => {
  it("a request notification points each role at their own request view", () => {
    const n = row({ related_request_id: "r7" });
    expect(notificationHref(n, "VIEWER")).toBe("/requests?id=r7");
    expect(notificationHref(n, "PUBLISHER")).toBe("/publisher/requests?id=r7");
  });

  it("a publisher-verification notification goes to the verification screen", () => {
    const n = row({ type: "PUBLISHER_VERIFIED" });
    expect(notificationHref(n, "PUBLISHER")).toBe("/publisher/verify");
  });

  it("a listing notification goes to the Publisher's hoardings", () => {
    const n = row({ type: "LISTING_APPROVED", related_hoarding_id: "h3" });
    expect(notificationHref(n, "PUBLISHER")).toBe("/publisher/hoardings?id=h3");
  });

  it("returns null when there is nothing to navigate to", () => {
    expect(notificationHref(row({ type: "SYSTEM" }), "VIEWER")).toBeNull();
  });
});

describe("notificationIcon", () => {
  it("falls back to the bell for an unknown type", () => {
    expect(notificationIcon("SOMETHING_NEW")).toBe(Bell);
  });
  it("maps a known type to a specific icon", () => {
    expect(notificationIcon("REQUEST_ACCEPTED")).not.toBe(Bell);
  });
});
