import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import "./geo.css";
import "./geocast.css";
import GeoDashboard from "./components/GeoDashboard";
import AuthProvider from "./components/AuthProvider";
import Login from "./components/Login";
import "./publicData.css";
import "./liveUi.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>{window.location.pathname.replace(/\/$/, "") === "/login" ? <Login/> : <GeoDashboard/>}</AuthProvider>
  </StrictMode>,
);

