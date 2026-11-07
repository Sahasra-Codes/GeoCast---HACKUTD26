import type { FeatureCollection, Geometry } from "geojson";

export type Layer = "activity" | "risk" | "needs" | "assistance";
export type Severity = "critical" | "high" | "moderate";
export interface DisasterEvent {
  id: string;
  name: string;
  type: "Hurricane" | "Flood" | "Wildfire" | "Severe storm";
  coordinates: [number, number];
  severity: Severity;
  area: string;
  description: string;
  status: string;
  updatedAt: string;
  countyId: string;
  declarationStatus?: string;
  impactZone?: [number, number][];
  forecast?: [number, number][];
}
export interface GeographicRegion {
  id: string;
  name: string;
  state: string;
  kind: "state" | "county";
  coordinates: [number, number];
  bounds: [[number, number], [number, number]];
}
export interface RiskPrediction {
  countyId: string;
  riskScore: number;
  exposedPopulation: number;
  confidence: number;
  vulnerability: { label: string; value: number }[];
  needs: { label: string; households: number }[];
  factors: string[];
}
export interface AssistanceResource {
  id: string;
  name: string;
  type: string;
  coordinates: [number, number];
  countyId: string;
  status: string;
  description: string;
}
export interface Geography {
  states: FeatureCollection<Geometry>;
  counties: FeatureCollection<Geometry>;
  regions: GeographicRegion[];
}
export interface IntelligenceData {
  events: DisasterEvent[];
  predictions: RiskPrediction[];
  resources: AssistanceResource[];
  mode: "demo" | "connected";
  updatedAt: string;
}
