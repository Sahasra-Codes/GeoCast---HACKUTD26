import { Layers3 } from "lucide-react";
import { layers } from "../data/layers";
import { motion } from "framer-motion";
import type { Layer } from "../types";

export default function MapLayerControls({
  layer,
  onChange,
}: {
  layer: Layer;
  onChange: (layer: Layer) => void;
}) {
  return (
    <div className="layer-controls panel">
      <div className="eyebrow">
        <Layers3 size={13} /> INTELLIGENCE LAYERS
      </div>
      <div role="group" aria-label="Map layers">
        {layers.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={layer === id ? "selected" : ""}
            onClick={() => onChange(id)}
            aria-pressed={layer === id}
          >
            {layer === id && (
              <motion.span layoutId="layer-active" className="layer-active" />
            )}
            <Icon size={16} />
            <span>{label}</span>
            <span className="radio-dot" />
          </button>
        ))}
      </div>
    </div>
  );
}
