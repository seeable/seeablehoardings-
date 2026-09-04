"""
Billboard inventory import — one-time metadata EXTRACTION, not
fabrication. The 68 source photos in `billboards/` were taken with a
"GPS Map Camera" app that stamps a real overlay onto every frame: locality,
full address, exact lat/long, and a timestamp. That overlay IS genuine
project metadata (per the task's own instruction to search for existing
metadata before inventing anything) — it just lives inside the pixels, not
in a separate file. This script OCRs that overlay and writes a reviewable
JSON artifact; nothing here invents a fact that isn't printed on the image.

Output: scripts/billboard-metadata.json — one entry per inventory code:
  { code, ocr_locality, ocr_address, latitude, longitude, ocr_date, flagged, raw_lines }
`flagged` is true when lat/long couldn't be parsed, or fell outside a
generous Karnataka bounding box — those are surfaced for manual review,
never silently guessed.

Usage: python scripts/extract-billboard-metadata.py
"""
import json
import re
from pathlib import Path

from PIL import Image
from rapidocr_onnxruntime import RapidOCR

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "billboards"
OUT = ROOT / "scripts" / "billboard-metadata.json"

# Generous Karnataka-wide bound — anything outside is almost certainly an OCR
# misread of the coordinate, not a real site this far from the rest.
LAT_RANGE = (11.0, 19.0)
LNG_RANGE = (74.0, 79.0)

LATLNG_RE = re.compile(
    r"Lat\D{0,5}(-?\d{1,2}\.\d{3,8}).{0,20}?Long\D{0,5}(-?\d{1,3}\.\d{3,8})",
    re.IGNORECASE,
)
STATE_RE = re.compile(r"(Karnataka|Tamil Nadu)", re.IGNORECASE)
DATE_RE = re.compile(r"\d{1,2}/\d{1,2}/\d{4}")

# The "GPS Map Camera" app always left-aligns its own overlay text (locality,
# address, Lat/Long, date) at the same relative X position within a photo —
# empirically clustering at ~0.31 or ~0.36 of the image width depending on
# the batch (the app appears to have scaled its overlay slightly differently
# across capture sessions), and always in the bottom third of the frame.
# Background signage/business text lands outside the X band or higher up the
# frame; the app's own "GPS Map Camera"/"Google" labels sit further left
# (~0.05-0.16) or far right (~0.75). Filtering on BOTH X position and Y
# position (not the label text itself, which is sometimes mis-OCR'd or
# mis-positioned when it overlaps busier scenes) reliably isolates the real
# overlay lines from incidental scene text.
OVERLAY_X_RATIO = (0.27, 0.37)
OVERLAY_MIN_Y_RATIO = 0.65


def extract_one(engine: RapidOCR, path: Path, width: int, height: int) -> dict:
    result, _ = engine(str(path))
    all_lines = [
        {"text": text, "x0": min(p[0] for p in box), "y0": sum(p[1] for p in box) / 4}
        for box, text, _conf in (result or [])
    ]
    overlay = sorted(
        (
            l
            for l in all_lines
            if OVERLAY_X_RATIO[0] <= l["x0"] / width <= OVERLAY_X_RATIO[1]
            and l["y0"] / height >= OVERLAY_MIN_Y_RATIO
        ),
        key=lambda l: l["y0"],
    )
    lines = [l["text"] for l in all_lines]  # kept for the raw-lines audit trail

    latlng_idx = None
    lat = lng = None
    for i, l in enumerate(overlay):
        m = LATLNG_RE.search(l["text"].replace(",", "."))
        if m:
            try:
                lat, lng = float(m.group(1)), float(m.group(2))
                latlng_idx = i
                break
            except ValueError:
                continue

    flagged_reasons = []
    if lat is None or lng is None:
        flagged_reasons.append("lat/long not parsed from OCR text")
    elif not (LAT_RANGE[0] <= lat <= LAT_RANGE[1] and LNG_RANGE[0] <= lng <= LNG_RANGE[1]):
        flagged_reasons.append(f"lat/long outside Karnataka bounds: {lat}, {lng}")

    # Everything in the (X-filtered, Y-sorted) overlay block before the
    # Lat/Long line is location text: first line = short locality, the rest
    # (joined) = the full address.
    locality_line = None
    address_line = None
    state = None
    if latlng_idx is not None and latlng_idx > 0:
        block = [l["text"] for l in overlay[:latlng_idx]]
        locality_line = block[0]
        address_line = " ".join(block[1:]) if len(block) > 1 else block[0]
        sm = STATE_RE.search(locality_line)
        state = sm.group(1).title() if sm else None

    date_line = next(
        (l["text"] for l in overlay if DATE_RE.search(l["text"])), None
    )

    if not address_line:
        flagged_reasons.append("no address line found")
    if not locality_line:
        flagged_reasons.append("no locality line found")
    elif state and state.lower() != "karnataka":
        flagged_reasons.append(f"site is outside Karnataka (state={state}) — outside single-city MVP scope")

    return {
        "ocr_locality": locality_line,
        "ocr_address": address_line,
        "state": state,
        "latitude": lat,
        "longitude": lng,
        "ocr_date": date_line,
        "flagged": bool(flagged_reasons),
        "flag_reasons": flagged_reasons,
        "raw_lines": lines,
    }


def main() -> None:
    files = sorted(SRC.glob("SH-*.jpeg"))
    print(f"Found {len(files)} source files.")
    engine = RapidOCR()
    out: dict[str, dict] = {}
    for i, path in enumerate(files, 1):
        code = path.stem
        print(f"[{i}/{len(files)}] OCR {code} ...", end=" ", flush=True)
        try:
            im = Image.open(path)
            data = extract_one(engine, path, im.width, im.height)
            data["code"] = code
            out[code] = data
            print("FLAGGED" if data["flagged"] else f"lat={data['latitude']} lng={data['longitude']}")
        except Exception as e:  # noqa: BLE001 — best-effort extraction, never crash the batch
            out[code] = {
                "code": code,
                "ocr_locality": None,
                "ocr_address": None,
                "latitude": None,
                "longitude": None,
                "ocr_date": None,
                "flagged": True,
                "flag_reasons": [f"OCR error: {e}"],
                "raw_lines": [],
            }
            print(f"ERROR: {e}")

    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    flagged = [c for c, d in out.items() if d["flagged"]]
    print(f"\nWrote {OUT} — {len(out)} entries, {len(flagged)} flagged for manual review:")
    for c in flagged:
        print(f"  {c}: {out[c]['flag_reasons']}")


if __name__ == "__main__":
    main()
