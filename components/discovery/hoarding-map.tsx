"use client";

import * as React from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPinOff } from "lucide-react";
import { clientEnv } from "@/lib/env";
import type { DiscoverCard } from "@/lib/discovery/types";

const BLR: [number, number] = [77.5946, 12.9716];

/**
 * VW-02 map — the same filtered result set as the list, plotted. Restrained
 * black points, SEEABLE gold marks the selected pin only (brand §16); black
 * clusters. Precise pins to every Viewer, no fuzzing (docs/27). Tile-load
 * failure degrades to a message, never a crash; the synced list beside the
 * map is the accessible path.
 */
export function HoardingMap({
  hoardings,
  selectedId,
  onSelect,
  center,
}: {
  hoardings: DiscoverCard[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  center?: { latitude: number; longitude: number } | null;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<import("maplibre-gl").Map | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const styleUrl = clientEnv.NEXT_PUBLIC_MAP_STYLE_URL;
  const onSelectRef = React.useRef(onSelect);
  React.useEffect(() => {
    onSelectRef.current = onSelect;
  });

  const geojson = React.useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: hoardings
        .filter((h) => h.location.latitude != null && h.location.longitude != null)
        .map((h) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [h.location.longitude!, h.location.latitude!],
          },
          properties: { id: h.id },
        })),
    }),
    [hoardings],
  );

  React.useEffect(() => {
    if (!styleUrl || !ref.current) {
      setFailed(!styleUrl);
      return;
    }
    let cancelled = false;
    void import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !ref.current) return;
      const map = new maplibregl.Map({
        container: ref.current,
        style: styleUrl,
        center: center ? [center.longitude, center.latitude] : BLR,
        zoom: center ? 12 : 10.5,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("error", (e) => {
        if (String(e.error?.message ?? "").match(/tile|style|fetch/i)) setFailed(true);
      });
      map.on("load", () => {
        if (cancelled) return;
        map.addSource("hoardings", {
          type: "geojson",
          data: geojson,
          cluster: true,
          clusterRadius: 44,
        });
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "hoardings",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#0A0A0A",
            "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 25, 26],
          },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "hoardings",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 12,
          },
          paint: { "text-color": "#FFFFFF" },
        });
        map.addLayer({
          id: "point",
          type: "circle",
          source: "hoardings",
          filter: ["!", ["has", "point_count"]],
          paint: {
            // Restrained by default; SEEABLE gold marks the selected pin only (docs brand §16).
            "circle-color": [
              "case",
              ["==", ["get", "id"], selectedId ?? ""],
              "#D9A62E",
              "#0A0A0A",
            ],
            "circle-radius": [
              "case",
              ["==", ["get", "id"], selectedId ?? ""],
              9,
              6,
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#FFFFFF",
          },
        });

        map.on("click", "point", (e) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (id) onSelectRef.current(id);
        });
        map.on("click", "clusters", (e) => {
          const f = e.features?.[0];
          const clusterId = f?.properties?.cluster_id;
          const src = map.getSource("hoardings") as import("maplibre-gl").GeoJSONSource;
          if (clusterId != null && src.getClusterExpansionZoom) {
            src.getClusterExpansionZoom(clusterId).then((z: number) => {
              map.easeTo({
                center: (f!.geometry as { coordinates: [number, number] }).coordinates,
                zoom: z,
              });
            });
          }
        });
        for (const layer of ["point", "clusters"]) {
          map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
        }
        setReady(true);
      });
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl]);

  // Push filtered data + selection into the live map.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource("hoardings") as
      | import("maplibre-gl").GeoJSONSource
      | undefined;
    src?.setData(geojson);
  }, [geojson, ready]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer("point")) return;
    map.setPaintProperty("point", "circle-radius", [
      "case",
      ["==", ["get", "id"], selectedId ?? ""],
      9,
      6,
    ]);
    // SEEABLE gold marks the selected pin only; every other pin stays restrained.
    map.setPaintProperty("point", "circle-color", [
      "case",
      ["==", ["get", "id"], selectedId ?? ""],
      "#D9A62E",
      "#0A0A0A",
    ]);
  }, [selectedId, ready]);

  if (failed) {
    return (
      <div className="border-border bg-surface-2 text-ink-500 flex h-full min-h-[24rem] flex-col items-center justify-center rounded-lg border p-6 text-center text-sm">
        <MapPinOff className="mb-2 h-6 w-6" />
        The map couldn&apos;t load. Use the list to browse hoardings.
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="border-border h-full min-h-[24rem] w-full overflow-hidden rounded-lg border"
      aria-label="Map of hoardings"
    />
  );
}
