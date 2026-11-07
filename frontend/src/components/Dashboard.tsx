import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Database,
  Flame,
  Globe2,
  HeartHandshake,
  Layers3,
  MapPin,
  Radio,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Waves,
  Wind,
  X,
} from "lucide-react";
import type {
  AssistanceResource,
  DisasterEvent,
  Geography,
  GeographicRegion,
  IntelligenceData,
  Layer,
} from "../types";
import { getGeography, getIntelligence } from "../services/api";
import Sidebar, { type Navigation } from "./Sidebar";
import USMap from "./USMap";
import MapLayerControls from "./MapLayerControls";
import { layers } from "../data/layers";
import AIInsightsPanel from "./AIInsightsPanel";

export default function Dashboard() {
  const [data, setData] = useState<IntelligenceData>();
  const [geography, setGeography] = useState<Geography>();
  const [error, setError] = useState("");
  const [layer, setLayer] = useState<Layer>("activity");
  const [nav, setNav] = useState<Navigation>("overview");
  const [event, setEvent] = useState<DisasterEvent>();
  const [region, setRegion] = useState<GeographicRegion>();
  const [focus, setFocus] = useState<GeographicRegion>();
  const [resource, setResource] = useState<AssistanceResource>();
  const [popup, setPopup] = useState(false);
  const [showLayers, setShowLayers] = useState(true);
  const [forecast, setForecast] = useState(true);
  const [settings, setSettings] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [query, setQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [searchIndex, setSearchIndex] = useState(0);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([getIntelligence(controller.signal), getGeography()])
      .then(([intelligence, geo]) => {
        if (controller.signal.aborted) return;
        setData(intelligence);
        setGeography(geo);
        setEvent(intelligence.events[0]);
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : "Unable to load data");
      });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPopup(false);
        setNotifications(false);
        setSearchActive(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const chooseLayer = (next: Layer) => {
    setLayer(next);
    setNav(next === "activity" ? "overview" : next);
    setResource(undefined);
  };
  const chooseRegion = (next: GeographicRegion) => {
    setRegion(next);
    setFocus(next);
    setPopup(false);
    setQuery("");
    setSearchActive(false);
    setResource(undefined);
  };
  const explore = (next: DisasterEvent) => {
    const found = geography?.regions.find((r) => r.id === next.countyId);
    if (found) {
      chooseRegion(found);
      chooseLayer("risk");
    }
  };
  const sample = () => {
    const found = geography?.regions.find((r) => r.id === "48201");
    if (found) {
      chooseRegion(found);
      chooseLayer("risk");
    }
  };
  const selectEvent = (next: DisasterEvent) => {
    setEvent(next);
    setPopup(true);
    setResource(undefined);
  };
  const selectResource = (next: AssistanceResource) => {
    setResource(next);
    const found = geography?.regions.find((r) => r.id === next.countyId);
    if (found) {
      setRegion(found);
      setFocus(found);
    }
  };
  const term = query.toLowerCase().trim();
  const results = term
    ? (geography?.regions || [])
        .filter((r) =>
          term
            .split(/\s+/)
            .every((word) =>
              (
                r.name +
                " " +
                (r.kind === "county" ? "county" : "") +
                " " +
                r.state
              )
                .toLowerCase()
                .includes(word),
            ),
        )
        .sort((a, b) => {
          const rank = (r: GeographicRegion) =>
            r.name.toLowerCase() === term
              ? 0
              : r.name.toLowerCase().startsWith(term)
                ? r.name.length
                : 1000;
          return rank(a) - rank(b) || a.name.localeCompare(b.name);
        })
        .slice(0, 7)
    : [];
  const featured = region || geography?.regions.find((r) => r.id === "48201");
  const prediction = data?.predictions.find((p) => p.countyId === featured?.id);
  const exportSnapshot = () => {
    if (!data) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            ...data,
            selectedLayer: layer,
            selectedRegion: region,
            note:
              data.mode === "demo"
                ? "Synthetic demonstration data. Not operational intelligence."
                : "Connected backend snapshot.",
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `sentinel-${data.mode}-snapshot.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="dashboard">
      <Sidebar
        active={nav}
        onNavigate={(next, nextLayer) => {
          setNav(next);
          setLayer(nextLayer);
          setResource(undefined);
          if (next === "overview") {
            setRegion(undefined);
            setFocus(undefined);
          }
        }}
        onSettings={() => setSettings(true)}
      />
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace
            <ChevronRight size={12} />
            <strong>
              {nav === "events"
                ? "Disaster scenarios"
                : layer === "activity"
                  ? "Map overview"
                  : layers.find((l) => l.id === layer)?.label}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className="demo-chip">
              <span />
              {data?.mode === "connected"
                ? "CONNECTED BACKEND"
                : "DEMO WORKSPACE"}
            </span>
            <button
              className="icon-button notification-button"
              aria-label="Data update information"
              aria-expanded={notifications}
              onClick={() => setNotifications(!notifications)}
            >
              <Bell size={18} />
              <i />
            </button>
            <span className="topbar-divider" />
            <button
              className="avatar small"
              aria-label="Workspace settings"
              onClick={() => setSettings(true)}
            >
              SC
            </button>
          </div>
          <AnimatePresence>
            {notifications && (
              <motion.div
                className="notifications panel"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <h3>
                  <Bell size={15} />
                  Data updates
                </h3>
                <p>
                  {data?.mode === "demo"
                    ? "You are viewing a fixed demonstration snapshot. No live alerts are connected."
                    : "Viewing data from the configured intelligence backend."}
                </p>
                <small>
                  Snapshot:{" "}
                  {data ? new Date(data.updatedAt).toLocaleString() : "Loading"}
                </small>
                <button
                  className="text-button"
                  onClick={() => {
                    setNotifications(false);
                    setSettings(true);
                  }}
                >
                  View data sources
                  <ArrowUpRight size={13} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </header>
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <span className="live-dot" />
              GEOSPATIAL INTELLIGENCE
            </div>
            <h1>A clearer picture. A stronger response.</h1>
            <p>Understand the impact. Anticipate the need. Reach the people.</p>
          </div>
          <button
            className="export-button"
            onClick={exportSnapshot}
            disabled={!data}
          >
            <ArrowDownToLine size={15} />
            <span>Export snapshot</span>
          </button>
        </div>
        <div className="map-toolbar">
          <div className="search-wrap">
            <Search size={16} />
            <input
              aria-label="Search states or counties"
              aria-controls="geographic-results"
              aria-expanded={searchActive && !!query}
              role="combobox"
              autoComplete="off"
              placeholder="Search a state or county…"
              value={query}
              onFocus={() => setSearchActive(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchActive(true);
                setSearchIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSearchIndex((i) => Math.min(i + 1, results.length - 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSearchIndex((i) => Math.max(0, i - 1));
                }
                if (e.key === "Enter" && results[searchIndex])
                  chooseRegion(results[searchIndex]);
              }}
            />
            <kbd>↵</kbd>
            <AnimatePresence>
              {searchActive && query && (
                <motion.div
                  id="geographic-results"
                  role="listbox"
                  className="search-results panel"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {results.length ? (
                    results.map((r, i) => (
                      <button
                        role="option"
                        aria-selected={i === searchIndex}
                        key={r.id}
                        onMouseEnter={() => setSearchIndex(i)}
                        onClick={() => chooseRegion(r)}
                      >
                        <MapPin size={14} />
                        <span>
                          {r.name}
                          {r.kind === "county" ? " County" : ""}
                          <small>
                            {r.kind === "state" ? "State" : r.state}
                          </small>
                        </span>
                        <ArrowUpRight size={13} />
                      </button>
                    ))
                  ) : (
                    <p>No matching state or county.</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="toolbar-right">
            <span className="snapshot-time">
              <Clock3 size={13} />
              {data
                ? new Date(data.updatedAt).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Loading snapshot"}
              <span className="muted">
                · {data?.mode === "connected" ? "Backend" : "Demo snapshot"}
              </span>
            </span>
            <button
              className={`layers-toggle ${showLayers ? "active" : ""}`}
              onClick={() => setShowLayers(!showLayers)}
              aria-expanded={showLayers}
            >
              <Layers3 size={15} />
              Layers
              <ChevronDown size={13} />
            </button>
          </div>
        </div>
        <main className="operations">
          <section className="map-stage" aria-label="Map workspace">
            {data && geography ? (
              <USMap
                geography={geography}
                data={data}
                layer={layer}
                selectedEvent={event}
                focus={focus}
                showPopup={popup}
                showForecast={forecast}
                onEvent={selectEvent}
                onRegion={chooseRegion}
                onExplore={explore}
                onClosePopup={() => setPopup(false)}
                onResource={selectResource}
              />
            ) : (
              <div className="map-loading">
                {error ? (
                  <>
                    <strong>Unable to prepare the workspace</strong>
                    <p>{error}</p>
                    <button
                      className="export-button"
                      onClick={() => {
                        setError("");
                        setRetry((n) => n + 1);
                      }}
                    >
                      Retry
                    </button>
                  </>
                ) : (
                  <>
                    <span className="loading-ring" />
                    Loading geographic intelligence…
                  </>
                )}
              </div>
            )}
            <div className="map-title">
              <span>
                <Globe2 size={13} />
                UNITED STATES
              </span>
              <h2>
                {layer === "activity"
                  ? "Disaster activity"
                  : layers.find((l) => l.id === layer)?.label}
              </h2>
              <p>
                {layer === "activity"
                  ? "An interconnected view of emerging impact."
                  : layer === "assistance"
                    ? "Example support locations. Availability unverified."
                    : "Illustrative model outputs · 15 sample counties"}
              </p>
            </div>
            <div className="map-stats">
              <div>
                <span className="stat-dot red" />
                <strong>
                  {String(data?.events.length || 0).padStart(2, "0")}
                </strong>
                <span>Demo scenarios</span>
              </div>
              <div>
                <span className="stat-dot amber" />
                <strong>
                  {String(data?.predictions.length || 0).padStart(2, "0")}
                </strong>
                <span>Counties modeled</span>
              </div>
              <div>
                <span className="stat-dot teal" />
                <strong>
                  {String(data?.resources.length || 0).padStart(2, "0")}
                </strong>
                <span>Example resources</span>
              </div>
            </div>
            <AnimatePresence>
              {showLayers && (
                <motion.div
                  className="layer-position"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                >
                  <MapLayerControls layer={layer} onChange={chooseLayer} />
                  {layer === "activity" && (
                    <label className="forecast-toggle panel">
                      <span>
                        <Wind size={14} />
                        Scenario forecast path
                      </span>
                      <input
                        type="checkbox"
                        checked={forecast}
                        onChange={(e) => setForecast(e.target.checked)}
                      />
                      <span className="switch" />
                    </label>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="map-coordinate">
              <span className="cross-icon">+</span>CONUS · WGS 84
              <span className="coordinate-divider" />
              DRAG TO EXPLORE
            </div>
            <div className="map-legend panel">
              <span className="legend-heading">
                {layer === "activity"
                  ? "SEVERITY"
                  : layer === "risk"
                    ? "PREDICTED RISK"
                    : layer === "needs"
                      ? "EST. HOUSEHOLDS WITH NEEDS"
                      : "RESOURCE TYPE"}
              </span>
              {layer === "activity" ? (
                <>
                  <span>
                    <i className="dot moderate" />
                    Moderate
                  </span>
                  <span>
                    <i className="dot high" />
                    High
                  </span>
                  <span>
                    <i className="dot critical" />
                    Critical
                  </span>
                  <span className="legend-path" />
                  Scenario path
                </>
              ) : layer === "assistance" ? (
                <span>
                  <i className="dot assistance" />
                  Example response hub
                </span>
              ) : (
                <>
                  <span>0</span>
                  <span
                    className={`gradient-legend ${layer === "needs" ? "blue" : ""}`}
                  />
                  <span>{layer === "risk" ? "100" : "12k+"}</span>
                  <span className="no-data-key" />
                  No estimate
                </>
              )}
            </div>
            <span className="map-demo-label">
              <Radio size={11} />
              {data?.mode === "connected"
                ? "BACKEND DATA"
                : "SIMULATED DATA · NOT LIVE"}
            </span>
          </section>
          <aside className="context-panel">
            <div className="context-heading">
              <span className="eyebrow">SITUATIONAL AWARENESS</span>
              <SlidersHorizontal size={15} />
            </div>
            {resource ? (
              <section className="resource-detail">
                <span className="ai-badge">EXAMPLE RESOURCE</span>
                <h2>
                  <HeartHandshake size={22} />
                  {resource.name}
                </h2>
                <p>{resource.type}</p>
                <span className="resource-status">
                  <Check size={13} />
                  {resource.status}
                </span>
                <p className="muted">{resource.description}</p>
                <button
                  className="text-button"
                  onClick={() => setResource(undefined)}
                >
                  Back to overview
                  <ChevronRight size={14} />
                </button>
              </section>
            ) : layer === "assistance" ? (
              <section className="resource-detail">
                <h2>Assistance network</h2>
                <p className="muted">
                  Explore example response hubs on the map.
                </p>
                <div className="resource-list">
                  {data?.resources.map((r) => (
                    <button key={r.id} onClick={() => selectResource(r)}>
                      <HeartHandshake size={17} />
                      <span>
                        {r.name}
                        <small>{r.type} · Demo</small>
                      </span>
                      <ChevronRight size={14} />
                    </button>
                  ))}
                </div>
              </section>
            ) : layer !== "activity" ? (
              <section className="layer-summary">
                <span className="ai-badge">ILLUSTRATIVE MODEL OUTPUT</span>
                <h2>
                  {layer === "risk"
                    ? "Anticipate the impact."
                    : "Understand the gap."}
                </h2>
                <p>
                  Select a colored county to explore{" "}
                  {layer === "risk"
                    ? "relative risk, vulnerability, and the factors behind the estimate"
                    : "estimated household needs and community vulnerabilities"}
                  . Uncolored areas have no demo estimate.
                </p>
              </section>
            ) : (
              <section className="event-section">
                <div className="section-heading">
                  <span>
                    <Activity size={14} />
                    DISASTER SCENARIOS
                  </span>
                  <b>{data?.events.length || 0}</b>
                </div>
                <div className="event-list">
                  {data?.events
                    .slice(0, nav === "events" ? undefined : 3)
                    .map((e) => {
                      const Icon =
                        e.type === "Wildfire"
                          ? Flame
                          : e.type === "Flood"
                            ? Waves
                            : Wind;
                      return (
                        <button
                          key={e.id}
                          className={`event-row ${event?.id === e.id ? "active" : ""}`}
                          onClick={() => {
                            chooseLayer("activity");
                            selectEvent(e);
                          }}
                        >
                          <span className={`event-icon ${e.severity}`}>
                            <Icon size={18} />
                          </span>
                          <span>
                            <strong>{e.name}</strong>
                            <small>{e.area}</small>
                          </span>
                          <span className={`dot ${e.severity}`} />
                        </button>
                      );
                    })}
                </div>
                {nav !== "events" && (
                  <button className="view-all" onClick={() => setNav("events")}>
                    View all {data?.events.length || 0} scenarios
                    <ChevronRight size={12} />
                  </button>
                )}
                {event && (
                  <div className="selected-event">
                    <span className={`severity ${event.severity}`}>
                      {event.severity} severity
                    </span>
                    <p>{event.description}</p>
                    <button
                      className="text-button"
                      onClick={() => explore(event)}
                    >
                      Explore affected communities
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                )}
              </section>
            )}
            <div className="insight-context">
              {region ? "SELECTED AREA" : "FEATURED DEMO COMMUNITY"}
              <span />
            </div>
            <AIInsightsPanel
              region={featured}
              prediction={prediction}
              onExplore={sample}
            />
          </aside>
        </main>
        <footer className="statusbar">
          <span>
            <ShieldCheck size={13} />
            {data?.mode === "connected"
              ? "Connected intelligence snapshot"
              : "Demonstration environment"}
            <span className="footer-divider" />
            {data?.mode === "connected"
              ? "Review backend provenance before use"
              : "Synthetic scenarios. Real geography."}
          </span>
          <button onClick={() => setSettings(true)}>
            <Database size={12} />
            Data sources
            <CircleHelp size={12} />
          </button>
        </footer>
      </div>
      {settings && (
        <SettingsDialog data={data} onClose={() => setSettings(false)} />
      )}
    </div>
  );
}
function SettingsDialog({
  data,
  onClose,
}: {
  data?: IntelligenceData;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="settings-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-title">
        <span className="brand-mark">
          <Database size={21} />
        </span>
        <h2>Data & workspace</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close settings"
        >
          <X size={20} />
        </button>
      </div>
      <p className="muted">A transparent view of what powers this workspace.</p>
      <div className="source-card">
        <strong>
          <span className="online-dot" />
          {data?.mode === "connected"
            ? "Configured FastAPI backend"
            : "Demonstration mode"}
        </strong>
        <p>
          {data?.mode === "connected"
            ? "An intelligence endpoint is configured. Verify data provenance with your backend operator."
            : "Disaster events, resources, exposure figures, and model scores are synthetic examples. No live disaster feed or trained model is connected."}
        </p>
      </div>
      <div className="source-row">
        <span>
          US state & county boundaries
          <small>US Atlas · US Census Bureau, 2017 edition</small>
        </span>
        <span className="source-status">BUNDLED</span>
      </div>
      <div className="source-row">
        <span>
          Roads, coastlines & labels
          <small>OpenFreeMap · OpenStreetMap · OpenMapTiles</small>
        </span>
        <span className="source-status">PUBLIC TILES</span>
      </div>
      <h3 className="small-heading">Future integration endpoints</h3>
      {[
        "NOAA / National Weather Service",
        "National Hurricane Center GIS",
        "FEMA OpenFEMA",
        "US Census & CDC Social Vulnerability Index",
      ].map((name) => (
        <div className="source-row" key={name}>
          <span>{name}</span>
          <span className="source-status pending">NOT CONNECTED</span>
        </div>
      ))}
      <p className="settings-note">
        The typed API adapter supports a future FastAPI intelligence endpoint.
        Setup instructions and the response contract are in the frontend README.
      </p>
      <button className="explore-button" onClick={onClose}>
        Return to map
        <ArrowUpRight size={15} />
      </button>
    </dialog>
  );
}
