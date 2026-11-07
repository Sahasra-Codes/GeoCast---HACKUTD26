import {
  Activity,
  Flame,
  Snowflake,
  Thermometer,
  Tornado,
  Waves,
  Wind,
} from "lucide-react";
import type { DisasterEvent } from "../types";
export default function DisasterSymbol({
  type,
  size = 21,
}: {
  type: DisasterEvent["type"];
  size?: number;
}) {
  const Icon =
    type === "Wildfire"
      ? Flame
      : type === "Flood"
        ? Waves
        : type === "Winter storm"
          ? Snowflake
          : type === "Tornado"
            ? Tornado
            : type === "Earthquake"
              ? Activity
              : type === "Extreme heat"
                ? Thermometer
                : Wind;
  return <Icon size={size} strokeWidth={1.5} />;
}
