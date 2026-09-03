import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import * as React from "react";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Drawer } from "@/components/ui/drawer";

describe("Modal — docs/07 §19 / §24.2", () => {
  it("renders nothing when closed", () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Hidden">
        body
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is a labelled modal dialog when open", () => {
    render(
      <Modal open onClose={vi.fn()} title="Submit request" description="Pick dates">
        <p>content</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByText("Submit request")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="X">
        body
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on backdrop mousedown but not on content mousedown", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="X">
        <button>inside</button>
      </Modal>,
    );
    fireEvent.mouseDown(screen.getByText("inside"));
    expect(onClose).not.toHaveBeenCalled();
    // the outermost container is the backdrop click target
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("moves focus into the dialog and restores it on close", () => {
    function Harness() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>open</button>
          <Modal open={open} onClose={() => setOpen(false)} title="Trap">
            <button>first</button>
          </Modal>
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByText("open");
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(trigger);
  });
});

describe("ConfirmDialog", () => {
  it("fires onConfirm from the confirm button", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={vi.fn()}
        onConfirm={onConfirm}
        title="Delist listing"
        message="It will be hidden from Discover."
        confirmLabel="Delist"
        destructive
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delist" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

describe("Drawer", () => {
  it("renders a labelled dialog and closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="Notifications">
        <p>list</p>
      </Drawer>,
    );
    expect(
      screen.getByRole("dialog", { name: "Notifications" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
