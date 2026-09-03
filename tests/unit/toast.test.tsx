import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ToastProvider, useToast } from "@/components/ui/toast";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function Trigger({ messages }: { messages: string[] }) {
  const { success } = useToast();
  return (
    <button onClick={() => messages.forEach((m) => success(m))}>fire</button>
  );
}

describe("Toast — docs/07 §20", () => {
  it("shows at most one toast at a time; the rest queue", () => {
    render(
      <ToastProvider>
        <Trigger messages={["first", "second", "third"]} />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText("fire").click();
    });
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.queryByText("second")).not.toBeInTheDocument();
  });

  it("auto-dismisses after ~4s and then shows the next in line", () => {
    render(
      <ToastProvider>
        <Trigger messages={["first", "second"]} />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText("fire").click();
    });
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText("first")).not.toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
  });

  it("an error toast is announced assertively (role=alert)", () => {
    function ErrTrigger() {
      const { error } = useToast();
      return <button onClick={() => error("something failed")}>x</button>;
    }
    render(
      <ToastProvider>
        <ErrTrigger />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText("x").click();
    });
    expect(screen.getByRole("alert")).toHaveTextContent("something failed");
  });
});
