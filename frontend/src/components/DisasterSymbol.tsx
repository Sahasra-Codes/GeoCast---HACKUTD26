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
  if (type === "Hurricane")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3.3" />
        <path d="M5 13a7 7 0 0 1 7-8h6l-2 3M19 11a7 7 0 0 1-7 8H6l2-3" />
      </svg>
    );
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
