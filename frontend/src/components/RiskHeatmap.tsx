import { useEffect } from "react";
import type { Map } from "maplibre-gl";
import type { FeatureCollection, Geometry } from "geojson";
import type { Layer, RiskPrediction } from "../types";

export default function RiskHeatmap({
  map,
  counties,
  predictions,
  layer,
}: {
  map: Map;
  counties: FeatureCollection<Geometry>;
  predictions: RiskPrediction[];
  layer: Layer;
}) {
  useEffect(() => {
    const lookup = new MapLookup(predictions.map((p) => [p.countyId, p]));
    const data: FeatureCollection<Geometry> = {
      type: "FeatureCollection",
      features: counties.features
        .filter((f) => lookup.has(String(f.id)))
        .map((f) => ({
          ...f,
          properties: {
            ...f.properties,
            risk: lookup.get(String(f.id))!.riskScore,
            needs: lookup
              .get(String(f.id))!
              .needs.reduce((s, n) => s + n.households, 0),
          },
        })),
    };
    map.addSource("predictions", { type: "geojson", data });
    map.addLayer({
      id: "risk-fill",
      type: "fill",
      source: "predictions",
      paint: {
        "fill-color": [
          "interpolate",
          ["linear"],
          ["get", "risk"],
          0,
          "#2dd4bf",
          60,
          "#e6ba63",
          80,
          "#ed865e",
          100,
          "#f87171",
        ],
        "fill-opacity": 0.5,
      },
    });
    map.addLayer({
      id: "risk-outline",
      type: "line",
      source: "predictions",
      paint: { "line-color": "#f6c19a", "line-opacity": 0.65, "line-width": 1 },
    });
    return () => {
      if (map.getLayer("risk-outline")) map.removeLayer("risk-outline");
      if (map.getLayer("risk-fill")) map.removeLayer("risk-fill");
      if (map.getSource("predictions")) map.removeSource("predictions");
    };
  }, [map, counties, predictions]);
  useEffect(() => {
    if (!map.getLayer("risk-fill")) return;
    const visible = layer === "risk" || layer === "needs";
    map.setLayoutProperty(
      "risk-fill",
      "visibility",
      visible ? "visible" : "none",
    );
    map.setLayoutProperty(
      "risk-outline",
      "visibility",
      visible ? "visible" : "none",
    );
    map.setPaintProperty(
      "risk-fill",
      "fill-color",
      layer === "needs"
        ? [
            "interpolate",
            ["linear"],
            ["get", "needs"],
            0,
            "#244859",
            5000,
            "#38bdf8",
            12000,
            "#a5e6fa",
          ]
        : [
            "interpolate",
            ["linear"],
            ["get", "risk"],
            0,
            "#2dd4bf",
            60,
            "#e6ba63",
            80,
            "#ed865e",
            100,
            "#f87171",
          ],
    );
  }, [map, layer, counties, predictions]);
  return null;
}
// Avoid shadowing the native collection constructor with MapLibre's Map type.
const MapLookup = globalThis.Map;
