import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./geo.css";
import GeoDashboard from "./components/GeoDashboard";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GeoDashboard />
  </StrictMode>,
);
