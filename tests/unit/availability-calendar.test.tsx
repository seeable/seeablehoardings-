import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  AvailabilityCalendar,
  type DayState,
} from "@/components/ui/availability-calendar";

// Pin "today" (IST) to 15 Sep 2026 so past-day tests are deterministic.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-15T06:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const cell = (iso: string) =>
  screen.getByRole("gridcell", { name: new RegExp(`^${iso}`) });

function setup(
  dayState?: (d: string) => Exclude<DayState, "past">,
  onSelect = vi.fn(),
) {
  render(
    <AvailabilityCalendar
      year={2026}
      month={9}
      onMonthChange={vi.fn()}
      mode="select"
      dayState={dayState}
      onSelect={onSelect}
    />,
  );
  return { onSelect };
}

describe("AvailabilityCalendar — cell states (docs/02 §10.6)", () => {
  it("days before today (IST) render as past and are not selectable", () => {
    setup();
    expect(cell("2026-09-10")).toBeDisabled();
    expect(cell("2026-09-10")).toHaveClass("bg-surface-2");
  });

  it("a booked day is disabled, greyed, and tooltipped 'Booked'", () => {
    setup((d) => (d === "2026-09-20" ? "booked" : "available"));
    const booked = cell("2026-09-20");
    expect(booked).toBeDisabled();
    expect(booked).toHaveClass("bg-ink-300");
    expect(booked).toHaveAttribute("title", "Booked");
  });

  it("a held day is not selectable and carries the hatch texture", () => {
    const { onSelect } = setup((d) =>
      d === "2026-09-22" ? "held" : "available",
    );
    const held = cell("2026-09-22");
    expect(held).toHaveClass("bg-warning-50");
    fireEvent.click(held);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("an available future day is selectable", () => {
    setup();
    expect(cell("2026-09-18")).not.toBeDisabled();
  });
});

describe("AvailabilityCalendar — range selection", () => {
  it("first click sets the start, second click commits a clear range", () => {
    const onSelect = vi.fn();
    render(
      <AvailabilityCalendar
        year={2026}
        month={9}
        onMonthChange={vi.fn()}
        mode="select"
        onSelect={onSelect}
      />,
    );
    fireEvent.click(cell("2026-09-18"));
    expect(onSelect).toHaveBeenLastCalledWith("2026-09-18", null);
  });

  it("re-anchors instead of committing a range that crosses a booked day", () => {
    const onSelect = vi.fn();
    function Wrapper() {
      return (
        <AvailabilityCalendar
          year={2026}
          month={9}
          onMonthChange={vi.fn()}
          mode="select"
          dayState={(d) => (d === "2026-09-20" ? "booked" : "available")}
          selectedStart="2026-09-18"
          selectedEnd={null}
          onSelect={onSelect}
        />
      );
    }
    render(<Wrapper />);
    fireEvent.click(cell("2026-09-22")); // 20th is booked → range invalid
    expect(onSelect).toHaveBeenLastCalledWith("2026-09-22", null);
  });

  it("commits a valid multi-day range", () => {
    const onSelect = vi.fn();
    render(
      <AvailabilityCalendar
        year={2026}
        month={9}
        onMonthChange={vi.fn()}
        mode="select"
        selectedStart="2026-09-18"
        selectedEnd={null}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(cell("2026-09-25"));
    expect(onSelect).toHaveBeenLastCalledWith("2026-09-18", "2026-09-25");
  });
});

describe("AvailabilityCalendar — keyboard", () => {
  it("arrow keys move the roving focus", () => {
    setup();
    const start = cell("2026-09-15");
    fireEvent.focus(start);
    fireEvent.keyDown(start, { key: "ArrowRight" });
    expect(cell("2026-09-16")).toHaveAttribute("tabindex", "0");
  });
});
