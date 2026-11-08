import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import "./geo.css";
import "./geocast.css";
import GeoDashboard from "./components/GeoDashboard";
import AuthProvider from "./components/AuthProvider";
import AuthGate from "./components/AuthGate";
import "./publicData.css";
import "./liveUi.css";
import "./appTheme.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider><AuthGate><GeoDashboard/></AuthGate></AuthProvider>
  </StrictMode>,
);

