import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection, Geometry, Position } from "geojson";
import type { Geography, GeographicRegion, IntelligenceData } from "../types";
import { mockData } from "../data/mock";

const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");
export async function getIntelligence(
  signal?: AbortSignal,
): Promise<IntelligenceData> {
  if (!base) return mockData;
  const response = await fetch(`${base}/intelligence`, { signal });
  if (!response.ok)
    throw new Error(`Intelligence service returned ${response.status}`);
  const data = (await response.json()) as IntelligenceData;
  if (
    !Array.isArray(data.events) ||
    !Array.isArray(data.predictions) ||
    !Array.isArray(data.resources) ||
    !data.updatedAt ||
    !["demo", "connected"].includes(data.mode)
  )
    throw new Error("Invalid intelligence response");
  return data;
}

let geographyPromise: Promise<Geography> | undefined;
export function getGeography(): Promise<Geography> {
  if (!geographyPromise)
    geographyPromise = loadGeography().catch((error) => {
      geographyPromise = undefined;
      throw error;
    });
  return geographyPromise;
}
async function loadGeography(): Promise<Geography> {
  const response = await fetch("/data/us-counties.topo.json");
  if (!response.ok)
    throw new Error("Geographic boundaries could not be loaded.");
  const topology = (await response.json()) as Topology<{
    states: GeometryCollection;
    counties: GeometryCollection;
  }>;
  const states = feature(
    topology,
    topology.objects.states,
  ) as FeatureCollection<Geometry>;
  const counties = feature(
    topology,
    topology.objects.counties,
  ) as FeatureCollection<Geometry>;
  const stateNames = new Map(
    states.features.map((f) => [String(f.id), String(f.properties?.name)]),
  );
  const regions: GeographicRegion[] = [
    ...states.features,
    ...counties.features,
  ].map((f) => {
    const id = String(f.id);
    const points: Position[] = [];
    function collect(value: unknown) {
      if (!Array.isArray(value)) return;
      if (typeof value[0] === "number") points.push(value as Position);
      else value.forEach(collect);
    }
    if ("coordinates" in f.geometry) collect(f.geometry.coordinates);
    const xs = points.map((p) => p[0]),
      ys = points.map((p) => p[1]);
    const west = Math.min(...xs),
      east = Math.max(...xs),
      south = Math.min(...ys),
      north = Math.max(...ys);
    return {
      id,
      name: String(f.properties?.name),
      kind: id.length === 2 ? "state" : "county",
      state: stateNames.get(id.slice(0, 2)) || "",
      coordinates: [(west + east) / 2, (south + north) / 2],
      bounds: [
        [west, south],
        [east, north],
      ],
    };
  });
  return { states, counties, regions };
}
