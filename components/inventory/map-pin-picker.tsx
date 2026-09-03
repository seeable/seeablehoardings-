"use client";

import * as React from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { clientEnv } from "@/lib/env";

const BLR = { lat: 12.9716, lng: 77.5946 };

/**
 * PB-03 Step 3 — precise pin placement. A draggable MapLibre marker plus manual
 * lat/lng inputs; the inputs are the a11y fallback (docs/04 PB-03 Accessibility)
 * and the only path when no map style is configured. `maplibre-gl` is imported
 * lazily so it stays out of every other route's bundle.
 */
export function MapPinPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (v: { latitude: number | null; longitude: number | null }) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<import("maplibre-gl").Map | null>(null);
  const markerRef = React.useRef<import("maplibre-gl").Marker | null>(null);
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  });
  const styleUrl = clientEnv.NEXT_PUBLIC_MAP_STYLE_URL;

  React.useEffect(() => {
    if (!styleUrl || !containerRef.current) return;
    let cancelled = false;

    void import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !containerRef.current) return;
      const start = {
        lat: latitude ?? BLR.lat,
        lng: longitude ?? BLR.lng,
      };
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: styleUrl,
        center: [start.lng, start.lat],
        zoom: latitude ? 15 : 11,
        attributionControl: { compact: true },
      });
      mapRef.current = map;

      const marker = new maplibregl.Marker({ draggable: true, color: "#7A5816" })
        .setLngLat([start.lng, start.lat])
        .addTo(map);
      markerRef.current = marker;

      const emit = () => {
        const { lat, lng } = marker.getLngLat();
        onChangeRef.current({
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
        });
      };
      marker.on("dragend", emit);
      map.on("click", (e: import("maplibre-gl").MapMouseEvent) => {
        marker.setLngLat(e.lngLat);
        emit();
      });
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // deliberately mount-once — external sync goes through the marker ref below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl]);

  // Keep the marker in step with manual-input edits.
  React.useEffect(() => {
    if (markerRef.current && latitude != null && longitude != null) {
      markerRef.current.setLngLat([longitude, latitude]);
    }
  }, [latitude, longitude]);

  const num = (s: string): number | null => {
    if (s.trim() === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  return (
    <div className="space-y-3">
      {styleUrl ? (
        <div
          ref={containerRef}
          className="border-border h-64 w-full overflow-hidden rounded-lg border"
          aria-label="Map — click or drag the pin to set the location"
        />
      ) : (
        <p className="text-ink-500 flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4" /> Enter the coordinates below (no map style
          configured).
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Latitude" htmlFor="lat" required>
          <Input
            type="number"
            step="any"
            value={latitude ?? ""}
            onChange={(e) =>
              onChange({ latitude: num(e.target.value), longitude })
            }
          />
        </Field>
        <Field label="Longitude" htmlFor="lng" required>
          <Input
            type="number"
            step="any"
            value={longitude ?? ""}
            onChange={(e) =>
              onChange({ latitude, longitude: num(e.target.value) })
            }
          />
        </Field>
      </div>
    </div>
  );
}
