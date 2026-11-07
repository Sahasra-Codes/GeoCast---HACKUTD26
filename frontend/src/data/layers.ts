import {
  Activity,
  BrainCircuit,
  HeartHandshake,
  PackageOpen,
} from "lucide-react";
import type { Layer } from "../types";
export const layers = [
  { id: "activity" as Layer, label: "Disaster activity", icon: Activity },
  { id: "risk" as Layer, label: "AI risk predictions", icon: BrainCircuit },
  { id: "needs" as Layer, label: "Unmet needs", icon: PackageOpen },
  {
    id: "assistance" as Layer,
    label: "Available assistance",
    icon: HeartHandshake,
  },
];
