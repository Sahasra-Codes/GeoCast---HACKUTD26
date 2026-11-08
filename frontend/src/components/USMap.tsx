import MarlowStormLayer from './MarlowStormLayer'
import {useScenario} from '../services/scenario'
﻿import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as maplibregl from "maplibre-gl";
import type { Map as LibreMap, StyleSpecification } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
maplibregl.setWorkerUrl(workerUrl);
import {
  Crosshair,
  HeartHandshake,
  House,
  Cross,
  PackageOpen,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import type {
  DisasterEvent,
  Geography,
  GeographicRegion,
  IntelligenceData,
  Layer,
  AssistanceResource,
} from "../types";
import mapStyle from "../data/basemap.json";
import DisasterMarker from "./DisasterMarker";
import DisasterPopup from "./DisasterPopup";
import RiskHeatmap from "./RiskHeatmap";
import LiveRadarLayer from "./LiveRadarLayer";
import PublicMapLayers from "./PublicMapLayers";
import type { PublicMapData } from "../publicDataTypes";

interface Props {
  geography: Geography;
  data: IntelligenceData;
  layer: Layer;
  selectedEvent?: DisasterEvent;
  focus?: GeographicRegion;
  showPopup: boolean;
  showForecast: boolean;
  showOverlays?: boolean;
  publicMapData?: PublicMapData;
  onPublicCounty?: (id: string) => void;
  onPublicAlert?: (id: string) => void;
  showRadar?: boolean;
  showResponseSites?: boolean;
  radarFrame?: number;
  onEvent: (event: DisasterEvent) => void;
  onRegion: (region: GeographicRegion) => void;
  onExplore: (event: DisasterEvent) => void;
  onClosePopup: () => void;
  onResource: (resource: AssistanceResource) => void;
  visibleEventIds?: string[];
  visibleCountyIds?: string[];
}
export default function USMap(props: Props) {
  const simulated=useScenario()
  const container = useRef<HTMLDivElement>(null);
  const [readyMap, setReadyMap] = useState<LibreMap | null>(null);
  const [tileError, setTileError] = useState(false);
  const [fatalError, setFatalError] = useState(false);
  const callbacks = useRef(props);
  const visiblePredictions = useMemo(
    () =>
      props.visibleCountyIds
        ? props.data.predictions.filter((p) =>
            props.visibleCountyIds!.includes(p.countyId),
          )
        : props.data.predictions,
    [props.data, props.visibleCountyIds],
  );
  useEffect(() => {
    callbacks.current = props;
  }, [props]);
  useEffect(() => {
    if (!container.current) return;
    let map: LibreMap;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: mapStyle as unknown as StyleSpecification,
        center: [-97, 37],
        zoom: 3.5,
        minZoom: 2,
        maxZoom: 14,
        attributionControl: false,
        renderWorldCopies: false,
      });
    } catch {
      queueMicrotask(() => setFatalError(true));
      return;
    }
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-left",
    );
    let initialized = false;
    const initialize = () => {
      if (initialized) return;
      initialized = true;
      map.addSource("us-states", {
        type: "geojson",
        data: props.geography.states,
        attribution: "US Census Bureau (2017) / US Atlas",
      });
      map.addSource("us-counties", {
        type: "geojson",
        data: props.geography.counties,
      });
      map.addLayer(
        {
          id: "state-areas",
          type: "fill",
          source: "us-states",
          paint: { "fill-color": "#a9bda5", "fill-opacity": 0.9 },
        },
        map.getStyle().layers.find((l) => l.type !== "background")?.id,
      );
      map.addLayer({
        id: "state-lines",
        type: "line",
        source: "us-states",
        paint: {
          "line-color": "#667e6c",
          "line-opacity": 0.34,
          "line-width": 0.8,
        },
      });
      map.addLayer({
        id: "county-areas",
        type: "fill",
        source: "us-counties",
        minzoom: 4.5,
        paint: { "fill-opacity": 0 },
      });
      map.addLayer({
        id: "county-lines",
        type: "line",
        source: "us-counties",
        minzoom: 5,
        paint: {
          "line-color": "#667e6c",
          "line-opacity": 0.2,
          "line-width": 0.5,
        },
      });
      map.addSource("atlas-grid", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            ...Array.from({ length: 15 }, (_, i) => ({
              type: "Feature" as const,
              properties: {},
              geometry: {
                type: "LineString" as const,
                coordinates: [
                  [-130 + i * 5, 18],
                  [-130 + i * 5, 57],
                ],
              },
            })),
            ...Array.from({ length: 9 }, (_, i) => ({
              type: "Feature" as const,
              properties: {},
              geometry: {
                type: "LineString" as const,
                coordinates: [
                  [-135, 18 + i * 5],
                  [-55, 18 + i * 5],
                ],
              },
            })),
          ],
        },
      });
      map.addLayer({
        id: "atlas-grid-lines",
        type: "line",
        source: "atlas-grid",
        maxzoom: 7,
        paint: {
          "line-color": "#f3f2d9",
          "line-width": 0.6,
          "line-opacity": 0.3,
        },
      });
      map.addSource("hover-region", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "hover-region-fill",
        type: "fill",
        source: "hover-region",
        paint: { "fill-color": "#557865", "fill-opacity": 0.15 },
      });
      map.addSource("selection", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "selection-fill",
        type: "fill",
        source: "selection",
        paint: { "fill-color": "#4d8b82", "fill-opacity": 0.13 },
      });
      map.addLayer({
        id: "selection-line",
        type: "line",
        source: "selection",
        paint: { "line-color": "#416e58", "line-width": 2 },
      });
      map.addSource("impact-zones", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: props.data.events
            .filter((e) => e.impactZone)
            .map((e) => ({
              type: "Feature",
              properties: { name: e.name },
              geometry: { type: "Polygon", coordinates: [e.impactZone!] },
            })),
        },
      });
      map.addLayer({
        id: "impact-fill",
        type: "fill",
        source: "impact-zones",
        paint: { "fill-color": "#c48c65", "fill-opacity": 0.09 },
      });
      map.addLayer({
        id: "impact-line",
        type: "line",
        source: "impact-zones",
        paint: {
          "line-color": "#c48c65",
          "line-width": 1,
          "line-opacity": 0.35,
          "line-dasharray": [3, 4],
        },
      });
      const affectedIds = new Set(props.data.events.map((e) => e.countyId));
      map.addSource("scenario-counties", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: props.geography.counties.features.filter((f) =>
            affectedIds.has(String(f.id)),
          ),
        },
      });
      map.addLayer({
        id: "scenario-county-fill",
        type: "fill",
        source: "scenario-counties",
        paint: { "fill-color": "#4d8b82", "fill-opacity": 0.18 },
      });
      map.addLayer({
        id: "scenario-county-line",
        type: "line",
        source: "scenario-counties",
        paint: {
          "line-color": "#6d9986",
          "line-width": 1,
          "line-dasharray": [2, 2],
        },
      });
      map.addSource("forecast", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: props.data.events
            .filter((e) => e.forecast)
            .map((e) => ({
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: e.forecast! },
            })),
        },
      });
      map.addLayer({
        id: "forecast-glow",
        type: "line",
        source: "forecast",
        paint: {
          "line-color": "#c48c65",
          "line-width": 22,
          "line-opacity": 0.09,
          "line-blur": 10,
        },
      });
      map.addLayer({
        id: "forecast-line",
        type: "line",
        source: "forecast",
        paint: {
          "line-color": "#c48c65",
          "line-width": 2,
          "line-dasharray": [3, 3],
          "line-opacity": 0.85,
        },
      });
      map.on("click", (e) => {
        const layers = [
          "county-areas",
          "state-areas",
          ...(map.getLayer("risk-fill") ? ["risk-fill"] : []),
        ];
        const features = map.queryRenderedFeatures(e.point, { layers });
        const county =
          features.find((f) => f.layer.id === "risk-fill") ||
          features.find((f) => f.layer.id === "county-areas");
        const chosen = callbacks.current.publicMapData ? features.find(f => f.layer.id === "state-areas") : county || features[0];
        const region =
          chosen &&
          callbacks.current.geography.regions.find(
            (r) => chosen.layer.id === "state-areas" ? r.kind === "state" && r.id.padStart(2,"0") === String(chosen.id).padStart(2,"0") : r.id === String(chosen.id),
          );
        if (region) callbacks.current.onRegion(region);
      });
      let hoveredId: string | undefined;
      map.on("mousemove", (e) => {
        const hit = map.queryRenderedFeatures(e.point, {
          layers: ["county-areas", "state-areas"],
        })[0];
        const id = hit ? String(hit.id) : undefined;
        if (id !== hoveredId) {
          hoveredId = id;
          const original =
            id &&
            [
              ...props.geography.counties.features,
              ...props.geography.states.features,
            ].find((f) => String(f.id) === id);
          (map.getSource("hover-region") as maplibregl.GeoJSONSource).setData({
            type: "FeatureCollection",
            features: original ? [original] : [],
          });
        }
        map.getCanvas().style.cursor = map.queryRenderedFeatures(e.point, {
          layers: ["state-areas", "county-areas"],
        }).length
          ? "pointer"
          : "";
      });
      setReadyMap(map);
      map.fitBounds(
        [
          [-125, 23],
          [-66, 50],
        ],
        {
          padding: { top: 100, left: 40, right: 40, bottom: 100 },
          duration: 0,
        },
      );
    };
    map.on("movestart", () => {
      if (container.current) container.current.dataset.cameraMoving = "true";
    });
    map.on("moveend", () => {
      if (container.current) container.current.dataset.cameraMoving = "false";
    });
    map.on("style.load", initialize);
    map.on("error", (e) => {
      setTileError(true);
      if (
        "sourceId" in e &&
        e.sourceId === "openmaptiles" &&
        map.getLayer("background")
      )
        map.setPaintProperty("background", "background-color", "#a7c9cf");
    });
    map.on("dataloading", () => {
      if (container.current) container.current.dataset.mapIdle = "false";
    });
    map.on("movestart", () => {
      if (container.current) container.current.dataset.mapIdle = "false";
    });
    map.on("idle", () => {
      if (container.current) container.current.dataset.mapIdle = "true";
    });
    map.on("sourcedata", (e) => {
      if (e.sourceId === "us-states" && e.isSourceLoaded && container.current)
        container.current.dataset.boundariesReady = "true";
    });
    const fallback = window.setTimeout(() => {
      if (!initialized) {
        setTileError(true);
        map.setStyle({
          version: 8,
          sources: {},
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#a7c9cf" },
            },
          ],
        });
      }
    }, 12000);
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container.current);
    return () => {
      window.clearTimeout(fallback);
      observer.disconnect();
      map.remove();
      setReadyMap(null);
    };
  }, [props.geography, props.data]);
  useEffect(() => {
    if (!readyMap) return;
    if (!props.focus) {
      (readyMap.getSource("selection") as maplibregl.GeoJSONSource).setData({
        type: "FeatureCollection",
        features: [],
      });
      readyMap.fitBounds(
        [
          [-125, 23],
          [-66, 50],
        ],
        {
          padding: { top: 100, left: 40, right: 40, bottom: 100 },
          duration: 800,
        },
      );
      return;
    }
    const collection =
      props.focus.kind === "county"
        ? props.geography.counties
        : props.geography.states;
    const feature = collection.features.find(
      (f) => String(f.id) === props.focus!.id,
    );
    (readyMap.getSource("selection") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: feature ? [feature] : [],
    });
    readyMap.fitBounds(props.focus.bounds, {
      padding: 100,
      maxZoom: props.focus.kind === "county" ? 8 : 6,
      duration: 1300,
    });
  }, [readyMap, props.focus, props.geography]);
  useEffect(() => {
    if (!readyMap) return;
    for (const id of [
      "forecast-line",
      "forecast-glow",
      "impact-fill",
      "impact-line",
    ])
      readyMap.setLayoutProperty(
        id,
        "visibility",
        props.showForecast &&
          props.showOverlays !== false &&
          props.layer === "activity"
          ? "visible"
          : "none",
      );
  }, [readyMap, props.showForecast, props.layer, props.showOverlays]);
  useEffect(() => {
    if (!readyMap) return;
    for (const id of ["scenario-county-fill", "scenario-county-line"])
      readyMap.setLayoutProperty(
        id,
        "visibility",
        props.showOverlays !== false && props.layer === "activity"
          ? "visible"
          : "none",
      );
  }, [readyMap, props.layer, props.showOverlays]);
  useEffect(() => {
    if (!readyMap || !props.showPopup || !props.selectedEvent) return;
    readyMap.easeTo({
      center: props.selectedEvent.coordinates,
      offset: [40, 90],
      zoom: Math.max(readyMap.getZoom(), 4.3),
      duration: 1000,
    });
  }, [readyMap, props.selectedEvent, props.showPopup]);
  useEffect(() => {
    if (!readyMap) return;
    const events = props.data.events.filter(
      (event) =>
        !props.visibleEventIds || props.visibleEventIds.includes(event.id),
    );
    (readyMap.getSource("forecast") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: events
        .filter((e) => e.forecast)
        .map((e) => ({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: e.forecast! },
        })),
    });
    (readyMap.getSource("impact-zones") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: events
        .filter((e) => e.impactZone)
        .map((e) => ({
          type: "Feature",
          properties: { name: e.name },
          geometry: { type: "Polygon", coordinates: [e.impactZone!] },
        })),
    });
    const ids = new Set(
      props.visibleCountyIds ||
        events.flatMap((e) => e.affectedCountyIds || [e.countyId]),
    );
    (
      readyMap.getSource("scenario-counties") as maplibregl.GeoJSONSource
    ).setData({
      type: "FeatureCollection",
      features: props.geography.counties.features.filter((f) =>
        ids.has(String(f.id)),
      ),
    });
  }, [
    readyMap,
    props.visibleEventIds,
    props.visibleCountyIds,
    props.data,
    props.geography,
  ]);
  useEffect(() => {
    if (!readyMap) return;
    for (const id of ['county-areas','county-lines']) readyMap.setLayoutProperty(id,'visibility',props.publicMapData ? 'none' : 'visible');
  }, [readyMap, props.publicMapData]);
  const reset = () =>
    readyMap?.fitBounds(
      [
        [-125, 23],
        [-66, 50],
      ],
      {
        padding: { top: 100, left: 40, right: 40, bottom: 100 },
        duration: 1200,
      },
    );
  return (
    <>
      <div
        ref={container}
        className="map-canvas"
        aria-label="Interactive United States disaster intelligence map"
      />
      {!readyMap && !fatalError && (
        <div className="map-loading">
          <span className="loading-ring" />
          Preparing geographic intelligence…
        </div>
      )}
      {fatalError && (
        <div className="map-loading">
          WebGL is unavailable. Enable hardware acceleration to explore the map.
        </div>
      )}
      {tileError && (
        <div className="map-notice">
          Some basemap details could not load. Check your connection; local US
          boundaries remain available.
        </div>
      )}
      {readyMap && (
        <>
          {props.publicMapData && props.showRadar && <LiveRadarLayer map={readyMap}/>}
          {props.publicMapData && simulated && props.publicMapData.alerts.some(alert=>alert.simulated) && <MarlowStormLayer map={readyMap}/>}
          {props.publicMapData && <PublicMapLayers map={readyMap} data={props.publicMapData} onCounty={props.onPublicCounty || (() => {})} onAlert={props.onPublicAlert || (() => {})}/>}
          <RiskHeatmap
            map={readyMap}
            counties={props.geography.counties}
            predictions={visiblePredictions}
            layer={props.layer}
          />
          {props.layer !== "assistance" &&
            props.data.events
              .filter(
                (event) =>
                  !props.visibleEventIds ||
                  props.visibleEventIds.includes(event.id),
              )
              .map((event) => (
                <DisasterMarker
                  key={event.id}
                  map={readyMap}
                  event={event}
                  selected={props.selectedEvent?.id === event.id}
                  onSelect={props.onEvent}
                />
              ))}
          {props.layer !== "assistance" &&
            props.showPopup &&
            props.selectedEvent && (
              <DisasterPopup
                key={props.selectedEvent.id}
                map={readyMap}
                event={props.selectedEvent}
                onExplore={() => props.onExplore(props.selectedEvent!)}
                onClose={props.onClosePopup}
              />
            )}
          {(props.layer === "assistance" || props.showResponseSites) &&
            props.data.resources
              .filter(
                (resource) =>
                  !props.visibleCountyIds ||
                  props.visibleCountyIds.includes(resource.countyId),
              )
              .map((resource) => (
                <ResourceMarker
                  key={resource.id}
                  map={readyMap}
                  resource={resource}
                  onSelect={props.onResource}
                />
              ))}
        </>
      )}
      <div className="map-tools panel">
        <button
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() => readyMap?.zoomIn()}
        >
          <Plus size={18} />
        </button>
        <button
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() => readyMap?.zoomOut()}
        >
          <Minus size={18} />
        </button>
        <span />
        <button
          aria-label="Reset map to United States"
          title="Reset view"
          onClick={reset}
        >
          <Crosshair size={18} />
        </button>
        <button
          aria-label="Reset map bearing"
          title="Reset bearing"
          onClick={() => readyMap?.easeTo({ bearing: 0, pitch: 0 })}
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </>
  );
}
function ResourceMarker({
  map,
  resource,
  onSelect,
}: {
  map: LibreMap;
  resource: AssistanceResource;
  onSelect: (resource: AssistanceResource) => void;
}) {
  const [element] = useState(() => document.createElement("div"));
  useEffect(() => {
    const marker = new maplibregl.Marker({ element })
      .setLngLat(resource.coordinates)
      .addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, element, resource]);
  return createPortal(
    <button
      className="resource-marker"
      aria-label={resource.name}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(resource);
      }}
    >
      {resource.type === "Temporary shelter" ? (
        <House size={20} />
      ) : resource.type === "Medical assistance" ? (
        <Cross size={20} />
      ) : resource.type === "Supply distribution" ? (
        <PackageOpen size={20} />
      ) : (
        <HeartHandshake size={20} />
      )}
      <span>{resource.name}</span>
    </button>,
    element,
  );
}
