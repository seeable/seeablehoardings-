import { describe, expect, it } from "vitest";
import {
  attributeKind,
  humanizeAttributeKey,
} from "@/lib/inventory/attributes";

describe("humanizeAttributeKey", () => {
  it.each([
    ["height_ft", "Height (ft)"],
    ["width_ft", "Width (ft)"],
    ["road_name", "Road name"],
    ["facing_direction", "Facing direction"],
    ["pillar_number", "Pillar number"],
    ["metro_line", "Metro line"],
  ])("%s -> %s", (key, label) => {
    expect(humanizeAttributeKey(key)).toBe(label);
  });
});

describe("attributeKind", () => {
  it("*_ft keys are numeric with a ft suffix", () => {
    expect(attributeKind("height_ft")).toEqual({ kind: "number", suffix: "ft" });
  });
  it("known enums render as a select", () => {
    expect(attributeKind("facing_direction").kind).toBe("select");
    expect(attributeKind("illumination").kind).toBe("select");
  });
  it("numeric-hinted keys are number inputs", () => {
    expect(attributeKind("loop_duration_seconds").kind).toBe("number");
    expect(attributeKind("slot_count").kind).toBe("number");
  });
  it("everything else is free text", () => {
    expect(attributeKind("road_name")).toEqual({ kind: "text" });
    expect(attributeKind("building_name")).toEqual({ kind: "text" });
  });
});
