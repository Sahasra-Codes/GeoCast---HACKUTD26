import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Popup, type Map } from "maplibre-gl";
import { ArrowUpRight, Clock3, Wind, X } from "lucide-react";
import { motion } from "framer-motion";
import type { DisasterEvent } from "../types";

export default function DisasterPopup({
  map,
  event,
  onExplore,
  onClose,
}: {
  map: Map;
  event: DisasterEvent;
  onExplore: () => void;
  onClose: () => void;
}) {
  const element = useMemo(() => document.createElement("div"), []);
  useEffect(() => {
    const popup = new Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: "290px",
      offset: 35,
      anchor: "bottom",
    })
      .setLngLat(event.coordinates)
      .setDOMContent(element)
      .addTo(map);
    return () => {
      popup.remove();
    };
  }, [map, event, element]);
  return createPortal(
    <motion.div
      className="disaster-popup"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="popup-top">
        <span className={`severity ${event.severity}`}>
          {event.severity} severity
        </span>
        <button
          aria-label="Close event card"
          className="icon-button"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>
      <h3>
        <Wind size={18} />
        {event.name}
      </h3>
      <p>
        {event.type} · {event.area}
      </p>
      <div className="popup-status">
        <span className="online-dot" />
        {event.status}
      </div>
      {event.declarationStatus && <p>{event.declarationStatus}</p>}
      <small>
        <Clock3 size={11} />
        {new Date(event.updatedAt).toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        · Demo snapshot
      </small>
      <button className="explore-button" onClick={onExplore}>
        Explore affected communities
        <ArrowUpRight size={15} />
      </button>
    </motion.div>,
    element,
  );
}
