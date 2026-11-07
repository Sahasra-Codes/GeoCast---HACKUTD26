import Chatbot from "./Chatbot";
﻿import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowUpRight,
  ChevronDown,
  CircleHelp,
  Clock3,
  Compass,
  Globe2,
  Layers3,
  Menu,
  SearchX,
  ShieldCheck,
  X,
} from "lucide-react";
import type {
  AssistanceResource,
  DisasterEvent,
  GeographicRegion,
  Geography,
  IntelligenceData,
  Layer,
} from "../types";
import { getGeography, getIntelligence } from "../services/api";
import {
  createProfiles,
  createRequests,
  matchingCountyIds,
  regionTitle,
} from "../data/geo";
import type {
  AssistanceRequest,
  DisasterFilter,
  MapFilters,
} from "../data/geo";
import GeoSidebar from "./GeoSidebar";
import CommunityDetailsPanel from "./CommunityDetailsPanel";
import USMap from "./USMap";
import MapLayerControls from "./MapLayerControls";

export default function GeoDashboard() {
  const [geography, setGeography] = useState<Geography>();
  const [data, setData] = useState<IntelligenceData>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [disaster, setDisaster] = useState<DisasterFilter>("all");
  const [needs, setNeeds] = useState<string[]>([]);
  const [match, setMatch] = useState<"any" | "all">("any");
  const [scope, setScope] = useState<GeographicRegion>();
  const [applied, setApplied] = useState<MapFilters>();
  const [region, setRegion] = useState<GeographicRegion>();
  const [event, setEvent] = useState<DisasterEvent>();
  const [focus, setFocus] = useState<GeographicRegion>();
  const [popup, setPopup] = useState(false);
  const [layer, setLayer] = useState<Layer>("activity");
  const [layersOpen, setLayersOpen] = useState(false);
  const [overlays, setOverlays] = useState(true);
  const [requests, setRequests] = useState<AssistanceRequest[]>([]);
  const [about, setAbout] = useState(false);
  const [mobileFilters, setMobileFilters] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([getGeography(), getIntelligence(controller.signal)])
      .then(([geo, intelligence]) => {
        if (controller.signal.aborted) return;
        setGeography(geo);
        setData(intelligence);
        setRequests(createRequests(createProfiles(intelligence.predictions)));
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error ? err.message : "Data could not be loaded.",
          );
      });
    return () => controller.abort();
  }, [retry]);
  const profiles = useMemo(
    () => createProfiles(data?.predictions || []),
    [data],
  );
  const currentFilters = useMemo<MapFilters>(
    () => ({
      disaster,
      needs: applied?.needs || [],
      match: applied?.match || match,
      regionId: scope?.id,
    }),
    [disaster, applied, match, scope],
  );
  const matchingIds = useMemo(
    () => (data ? matchingCountyIds(currentFilters, profiles, data) : []),
    [currentFilters, profiles, data],
  );
  const visibleEvents = useMemo(
    () =>
      (data?.events || [])
        .filter((e) => {
          if (disaster !== "all" && disaster !== e.type) return false;
          const countyIds = e.affectedCountyIds || [e.countyId];
          if (
            scope &&
            !countyIds.some((id) =>
              scope.id.length === 2 ? id.startsWith(scope.id) : id === scope.id,
            )
          )
            return false;
          if (
            applied?.needs.length &&
            !countyIds.some((id) => matchingIds.includes(id))
          )
            return false;
          return true;
        })
        .map((e) => e.id),
    [data, disaster, scope, applied, matchingIds],
  );
  const filterActive = disaster !== "all" || !!scope || !!applied;
  const showEmpty =
    !!data && (applied ? matchingIds.length === 0 : visibleEvents.length === 0);
  const pending =
    !!applied &&
    (needs.join("|") !== applied.needs.join("|") || match !== applied.match);
  const selectRegion = (next: GeographicRegion) => {
    setFocus(next);
    setPopup(false);
    setEvent(undefined);
    if (next.kind === "county") setRegion(next);
    else {
      setScope(next);
      setRegion(undefined);
      setApplied(undefined);
    }
  };
  const selectLocation = (next?: GeographicRegion) => {
    setScope(next);
    setApplied(undefined);
    setEvent(undefined);
    setPopup(false);
    setRegion(next?.kind === "county" ? next : undefined);
    setFocus(next);
  };
  const selectDisaster = (next: DisasterFilter) => {
    setDisaster(next);
    setApplied(undefined);
    setPopup(false);
    setEvent(undefined);
    setRegion(undefined);
    setLayer("activity");
  };
  const explore = (selected: DisasterEvent) => {
    const found = geography?.regions.find((r) => r.id === selected.countyId);
    if (found) {
      selectRegion(found);
      setLayer("needs");
    }
  };
  const sample = () => {
    const found = geography?.regions.find((r) => r.id === "48201");
    if (found) {
      selectRegion(found);
      setLayer("needs");
    }
  };
  const clearFilters = () => {
    setDisaster("all");
    setNeeds([]);
    setMatch("any");
    setScope(undefined);
    setApplied(undefined);
    setRegion(undefined);
    setEvent(undefined);
    setFocus(undefined);
    setPopup(false);
    setLayer("activity");
  };
  const apply = () => {
    if (!data || !geography) return;
    const next = { disaster, needs, match, regionId: scope?.id };
    const ids = matchingCountyIds(next, profiles, data);
    setApplied(next);
    setLayer("needs");
    setRegion(undefined);
    setEvent(undefined);
    setPopup(false);
    setMobileFilters(false);
    const regions = geography.regions.filter(
      (r) => r.kind === "county" && ids.includes(r.id),
    );
    if (regions.length) {
      const west = Math.min(...regions.map((r) => r.bounds[0][0])),
        south = Math.min(...regions.map((r) => r.bounds[0][1]));
      const east = Math.max(...regions.map((r) => r.bounds[1][0])),
        north = Math.max(...regions.map((r) => r.bounds[1][1]));
      setFocus({
        id: `matches-${Date.now()}`,
        name: "Matching areas",
        state: "",
        kind: "state",
        coordinates: [(west + east) / 2, (south + north) / 2],
        bounds: [
          [west, south],
          [east, north],
        ],
      });
    }
  };
  const updateRequest = (updated: AssistanceRequest) =>
    setRequests((existing) =>
      existing.map((r) => (r.id === updated.id ? updated : r)),
    );
  const resourceSelected = (resource: AssistanceResource) => {
    const found = geography?.regions.find((r) => r.id === resource.countyId);
    if (found) selectRegion(found);
  };
  const exportSnapshot = () => {
    if (!data) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              ...data,
              filters: currentFilters,
              requests,
              note: "GEO prototype: population profiles and assistance requests are synthetic demo fixtures.",
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "geo-demo-snapshot.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="geo-app">
      <header className="geo-header">
        <a href="/" className="geo-brand" aria-label="GEO home">
          <Globe2 size={31} strokeWidth={1} />
          <span>
            GEO<span className="brand-period">.</span>
          </span>
        </a>
        <span className="header-rule" />
        <span className="header-description">
          Disaster response intelligence
          <span>A shared perspective. A stronger response.</span>
        </span>
        <div className="header-right">
          <a href="/login" style={{ color: "#b01829", font: "600 12px Arial, sans-serif", textDecoration: "none" }}>Sign in</a>
          <span className="data-status">
            <span />
            {data?.mode === "connected"
              ? "Backend connected"
              : "Demo exploration"}
          </span>
          <button className="header-about" onClick={() => setAbout(true)}>
            About the data
            <ArrowUpRight size={13} />
          </button>
          <button
            className="header-download"
            aria-label="Export snapshot"
            title="Export demo snapshot"
            disabled={!data}
            onClick={exportSnapshot}
          >
            <ArrowDownToLine size={16} />
          </button>
          <button
            className="mobile-filter-button"
            aria-label="Toggle filters"
            onClick={() => setMobileFilters(!mobileFilters)}
          >
            {mobileFilters ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>
      <div className="geo-workspace">
        <div
          className={`sidebar-container ${mobileFilters ? "mobile-open" : ""}`}
        >
          <GeoSidebar
            geography={geography}
            disaster={disaster}
            onDisaster={selectDisaster}
            needs={needs}
            onNeeds={setNeeds}
            match={match}
            onMatch={setMatch}
            scope={scope}
            onLocation={selectLocation}
            onFind={apply}
            onClear={clearFilters}
            count={matchingIds.length}
            applied={!!applied}
            onAbout={() => setAbout(true)}
          />
        </div>
        <main className="geo-map-frame">
          <section
            className="map-stage"
            aria-label="GEO interactive map workspace"
          >
            {geography && data ? (
              <USMap
                geography={geography}
                data={data}
                layer={overlays ? layer : "activity"}
                selectedEvent={event}
                focus={focus}
                showPopup={popup}
                showForecast={overlays}
                showOverlays={overlays}
                visibleEventIds={visibleEvents}
                visibleCountyIds={filterActive ? matchingIds : undefined}
                onEvent={(selected) => {
                  setEvent(selected);
                  setRegion(undefined);
                  setPopup(true);
                  setMobileFilters(false);
                }}
                onRegion={selectRegion}
                onExplore={explore}
                onClosePopup={() => setPopup(false)}
                onResource={resourceSelected}
              />
            ) : (
              <div className="map-loading">
                {error ? (
                  <>
                    <h2>Let's try that again.</h2>
                    <p>{error}</p>
                    <button
                      className="find-button"
                      onClick={() => {
                        setError("");
                        setRetry((n) => n + 1);
                      }}
                    >
                      Reload geographic data
                    </button>
                  </>
                ) : (
                  <>
                    <span className="loading-ring" />
                    <p>Unfolding your world…</p>
                  </>
                )}
              </div>
            )}
            <div className="map-location-card">
              <span className="map-location-icon">
                <Globe2 size={19} strokeWidth={1.2} />
              </span>
              <span>
                <span className="overline">YOUR FIELD OF VIEW</span>
                <strong>{scope ? regionTitle(scope) : "United States"}</strong>
              </span>
              <span className="map-location-rule" />
              <span className="location-subtitle">
                {scope
                  ? scope.kind === "state"
                    ? "State exploration"
                    : scope.state
                  : "A connected landscape"}
              </span>
            </div>
            <div className="map-top-actions">
              <span className="snapshot-label">
                <Clock3 size={12} />
                {data
                  ? new Date(data.updatedAt).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })
                  : "Loading"}{" "}
                ·{" "}
                {data?.mode === "connected"
                  ? "Backend snapshot"
                  : "Demo snapshot"}
              </span>
              <button
                className={`map-overlay-toggle ${overlays ? "enabled" : ""}`}
                aria-pressed={overlays}
                aria-label="Toggle map overlays"
                title="Toggle geographic overlays"
                onClick={() => setOverlays(!overlays)}
              >
                <Layers3 size={16} />
              </button>
            </div>
            {applied && (
              <div className="result-summary" role="status">
                <span className="result-dot" />
                <span>
                  {matchingIds.length} matching{" "}
                  {matchingIds.length === 1 ? "county" : "counties"}
                  <small>
                    {applied.needs.length
                      ? `${applied.match === "all" ? "All" : "Any"} of ${applied.needs.length} selected needs`
                      : "Available demo profiles"}
                    {pending ? " · Filters changed; search again" : ""}
                  </small>
                </span>
                <button
                  aria-label="Clear result filters"
                  onClick={clearFilters}
                >
                  <X size={13} />
                </button>
              </div>
            )}
            {showEmpty && (
              <div className="map-empty-state" role="status">
                <SearchX size={24} strokeWidth={1.2} />
                <h2>No matching areas. Yet.</h2>
                <p>
                  {applied
                    ? "Try matching any need, widening the geographic area, or clearing a few filters."
                    : "There are no demo scenarios of this type in the selected area."}
                </p>
                <button onClick={clearFilters}>
                  Clear filters
                  <ArrowUpRight size={14} />
                </button>
              </div>
            )}
            <div className="map-bottom-actions">
              <button
                className={`map-layer-button ${layersOpen ? "active" : ""}`}
                onClick={() => setLayersOpen(!layersOpen)}
                aria-expanded={layersOpen}
              >
                <Layers3 size={15} />
                Map layers
                <ChevronDown size={13} />
              </button>
              <button
                className="map-source-button"
                aria-label="Map data information"
                onClick={() => setAbout(true)}
              >
                <CircleHelp size={17} />
              </button>
            </div>
            {layersOpen && (
              <div className="geo-layer-popover">
                <MapLayerControls
                  layer={layer}
                  onChange={(next) => {
                    setLayer(next);
                    setOverlays(true);
                    setLayersOpen(false);
                  }}
                />
              </div>
            )}
            {!region && !event && !applied && (
              <div className="fieldnote">
                <div className="fieldnote-art">
                  <Compass size={47} strokeWidth={0.75} />
                  <span>✳</span>
                </div>
                <div className="fieldnote-copy">
                  <span className="overline">INTELLIGENCE WITH EMPATHY</span>
                  <h2>
                    Behind every point,
                    <br />
                    <em>a community.</em>
                  </h2>
                  <p>
                    Explore the places where understanding can make a
                    difference.
                  </p>
                  <button onClick={sample}>
                    Take a closer look
                    <ArrowUpRight size={15} />
                  </button>
                </div>
              </div>
            )}
            <MapLegend layer={overlays ? layer : "activity"} />
            <div className="map-bottom-meta">
              <span>
                <span className="tiny-cross">+</span>WGS 84 · REAL GEOGRAPHY
              </span>
              <span>
                <ShieldCheck size={10} />
                {data?.mode === "connected"
                  ? "BACKEND SNAPSHOT"
                  : "ILLUSTRATIVE SCENARIOS · NOT LIVE"}
              </span>
            </div>
          </section>
          <AnimatePresence>
            {(region || event) && (
              <CommunityDetailsPanel
                region={region}
                event={event}
                profile={profiles.find((p) => p.countyId === region?.id)}
                prediction={data?.predictions.find(
                  (p) => p.countyId === region?.id,
                )}
                requests={requests.filter((r) => r.countyId === region?.id)}
                resources={
                  data?.resources.filter((r) => r.countyId === region?.id) || []
                }
                onUpdate={updateRequest}
                onClose={() => {
                  setRegion(undefined);
                  setEvent(undefined);
                  setPopup(false);
                }}
                onExplore={explore}
              />
            )}
          </AnimatePresence>
        </main>
      </div>
      <footer className="geo-footer">
        <span>GEO / A little perspective goes a long way.</span>
        <span>
          Public geography. Illustrative intelligence.
          <button onClick={() => setAbout(true)}>
            Explore responsibly
            <ArrowUpRight size={11} />
          </button>
        </span>
      </footer>
      <Chatbot
        context={JSON.stringify({ disaster, layer, location: scope?.name || "United States", selectedCounty: region?.name, needs, mode: data?.mode || "demo" })}
        onNavigate={(target) => {
          if (target === "filters") setMobileFilters(true);
          if (target === "assistance") { setLayer("assistance"); setLayersOpen(false); }
          if (target === "about") setAbout(true);
        }}
      />
      {about && <AboutDialog data={data} onClose={() => setAbout(false)} />}
    </div>
  );
}
function MapLegend({ layer }: { layer: Layer }) {
  return (
    <div className="map-legend">
      <span className="overline">
        {layer === "activity"
          ? "SCENARIO SEVERITY"
          : layer === "risk"
            ? "ILLUSTRATIVE RISK"
            : layer === "needs"
              ? "ESTIMATED HOUSEHOLD NEEDS"
              : "EXAMPLE RESOURCES"}
      </span>
      {layer === "activity" ? (
        <div className="legend-items">
          <span>
            <i className="legend-dot moderate" />
            Moderate
          </span>
          <span>
            <i className="legend-dot high" />
            High
          </span>
          <span>
            <i className="legend-dot critical" />
            Critical
          </span>
        </div>
      ) : layer === "assistance" ? (
        <div className="legend-items">
          <span>
            <i className="legend-dot assistance" />
            Unverified response hub
          </span>
        </div>
      ) : (
        <>
          <div className={`legend-ramp ${layer === "needs" ? "needs" : ""}`} />
          <div className="legend-scale">
            <span>Lower</span>
            <span>Higher</span>
          </div>
        </>
      )}
      <small>
        {layer === "activity"
          ? "Synthetic disaster scenarios"
          : "Uncolored areas have no demo estimate"}
      </small>
    </div>
  );
}
function AboutDialog({
  data,
  onClose,
}: {
  data?: IntelligenceData;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="about-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        className="dialog-close"
        aria-label="Close data information"
        onClick={onClose}
      >
        <X size={19} />
      </button>
      <Globe2 size={34} strokeWidth={1} />
      <span className="overline">A NOTE ON PERSPECTIVE</span>
      <h2>
        Good intelligence
        <br />
        starts with <em>transparency.</em>
      </h2>
      <p>
        GEO is a demonstration of how geographic context can help us understand
        potential community needs.
      </p>
      <section>
        <h3>Real geography</h3>
        <p>
          Bundled US Census (2017) state and county boundaries via US Atlas.
          Roads, coastlines, and labels use OpenFreeMap, OpenStreetMap, and
          OpenMapTiles. Detailed basemap tiles require internet access.
        </p>
      </section>
      <section>
        <h3>Illustrative intelligence</h3>
        <p>
          {data?.mode === "connected"
            ? "A backend is configured; verify event and prediction provenance with its operator. "
            : "Disasters and predictions are synthetic fixtures, not live or historical reports. "}
          Community population figures, need indicators, assistance requests,
          and resources are demo examples. No real emergency requests or
          operational shelter listings are connected.
        </p>
      </section>
      <section>
        <h3>Your demo changes</h3>
        <p>
          Request assignments and statuses update locally in this session. They
          do not dispatch assistance or contact an organization.
        </p>
      </section>
      <p className="dialog-footnote">
        Instrument Serif is bundled locally. City and ZIP suggestions cover 8
        demo locations; state and county search covers the bundled US geography.
      </p>
      <button className="find-button" onClick={onClose}>
        Back to exploring
        <ArrowUpRight size={17} />
      </button>
    </dialog>
  );
}
