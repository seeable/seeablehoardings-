import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { NotificationRow } from "@/lib/notifications";

// --- mocks -------------------------------------------------------------------
const apiGet = vi.fn();
const apiPatch = vi.fn();
vi.mock("@/lib/api/client", () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    patch: (...a: unknown[]) => apiPatch(...a),
  },
  ApiClientError: class ApiClientError extends Error {},
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({
    user: { id: "u1", role: "VIEWER" },
    loading: false,
    refresh: vi.fn(),
  }),
}));

let realtimeInsert: ((payload: { new: NotificationRow }) => void) | null = null;
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    const channel = {
      on: (_e: string, _cfg: unknown, cb: (p: { new: NotificationRow }) => void) => {
        realtimeInsert = cb;
        return channel;
      },
      subscribe: () => channel,
    };
    return { channel: () => channel, removeChannel: vi.fn() };
  },
}));

import { useNotifications } from "@/hooks/use-notifications";

const mk = (over: Partial<NotificationRow>): NotificationRow => ({
  id: "seed",
  type: "REQUEST_ACCEPTED",
  title: "Seed",
  message: "m",
  is_read: false,
  created_at: "2026-09-15T09:00:00Z",
  related_request_id: null,
  related_hoarding_id: null,
  ...over,
});

beforeEach(() => {
  apiGet.mockReset();
  apiPatch.mockReset().mockResolvedValue({ data: {} });
  realtimeInsert = null;
});

describe("useNotifications (IMPLEMENTATION-PLAN.md §Phase 4)", () => {
  it("loads the initial list and derives the unread count", async () => {
    apiGet.mockResolvedValue({
      data: { notifications: [mk({ id: "a" }), mk({ id: "b", is_read: true })] },
    });
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.unreadCount).toBe(1);
  });

  it("prepends a live INSERT from Realtime and bumps the unread count", async () => {
    apiGet.mockResolvedValue({ data: { notifications: [mk({ id: "a" })] } });
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      realtimeInsert!({ new: mk({ id: "live", title: "Live one" }) });
    });

    expect(result.current.items[0].id).toBe("live");
    expect(result.current.unreadCount).toBe(2);
  });

  it("ignores a duplicate INSERT for a row already in the list", async () => {
    apiGet.mockResolvedValue({ data: { notifications: [mk({ id: "a" })] } });
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => realtimeInsert!({ new: mk({ id: "a" }) }));
    expect(result.current.items).toHaveLength(1);
  });

  it("markRead optimistically flips is_read and calls the facade", async () => {
    apiGet.mockResolvedValue({ data: { notifications: [mk({ id: "a" })] } });
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.markRead("a");
    });

    expect(result.current.unreadCount).toBe(0);
    expect(apiPatch).toHaveBeenCalledWith("/api/v1/notifications/a", {
      is_read: true,
    });
  });
});
