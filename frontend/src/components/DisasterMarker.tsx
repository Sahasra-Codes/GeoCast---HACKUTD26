import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Marker, type Map } from "maplibre-gl";
import DisasterSymbol from "./DisasterSymbol";
import type { DisasterEvent } from "../types";

export default function DisasterMarker({
  map,
  event,
  selected,
  onSelect,
}: {
  map: Map;
  event: DisasterEvent;
  selected: boolean;
  onSelect: (event: DisasterEvent) => void;
}) {
  const element = useMemo(() => document.createElement("div"), []);
  useEffect(() => {
    const marker = new Marker({ element, anchor: "center" })
      .setLngLat(event.coordinates)
      .addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, event, element]);
  return createPortal(
    <button
      aria-label={`Explore ${event.name}`}
      title={`${event.name} · ${event.severity} severity · Simulated`}
      className={`disaster-marker ${event.severity} ${selected ? "is-selected" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(event);
      }}
    >
      <span className="marker-pulse" />
      <span className="marker-core">
        <DisasterSymbol type={event.type} />
      </span>
      <span className="marker-label">
        {event.id === "gulf"
          ? "Gulf Coast"
          : event.area.split(",")[0].replace(" County", "")}
        <small>{event.type} · Demo</small>
      </span>
    </button>,
    element,
  );
}
