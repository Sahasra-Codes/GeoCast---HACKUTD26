import fs from 'node:fs'
const edit = (file, transform) => fs.writeFileSync(file, transform(fs.readFileSync(file, 'utf8')))
edit('src/types.ts', s => s.replace('type: "Hurricane" | "Flood" | "Wildfire" | "Severe storm";', 'type: "Hurricane" | "Flood" | "Wildfire" | "Severe storm" | "Tornado" | "Winter storm" | "Earthquake" | "Extreme heat";').replace('  countyId: string;\n  declarationStatus?', '  countyId: string;\n  affectedCountyIds?: string[];\n  declarationStatus?'))
edit('src/data/mock.ts', s => s.replace('name: "Atlantic storm scenario"', 'name: "Atlantic hurricane scenario"').replace('type: "Severe storm"', 'type: "Hurricane"').replace('countyId: "22071",\n      declarationStatus:', 'countyId: "22071",\n      affectedCountyIds: ["22071", "22051", "22075", "22103", "28047", "28059", "01097"],\n      declarationStatus:').replace('countyId: "48201",\n      description:', 'countyId: "48201",\n      affectedCountyIds: ["48201", "48167", "48245", "48361"],\n      description:').replace('countyId: "12086",\n      description:', 'countyId: "12086",\n      affectedCountyIds: ["12086", "12033"],\n      description:'))
edit('src/main.tsx', s => s.replace('import "./index.css";', 'import "@fontsource/instrument-serif/400.css";\nimport "@fontsource/instrument-serif/400-italic.css";\nimport "./geo.css";').replace('import Dashboard from "./components/Dashboard";', 'import GeoDashboard from "./components/GeoDashboard";').replace('<Dashboard />', '<GeoDashboard />'))
edit('src/components/USMap.tsx', s => s.replace('useEffect, useRef, useState', 'useEffect, useMemo, useRef, useState').replace('  onResource: (resource: AssistanceResource) => void;', '  onResource: (resource: AssistanceResource) => void;\n  visibleEventIds?: string[];\n  visibleCountyIds?: string[];').replace('  const callbacks = useRef(props);', '  const callbacks = useRef(props);\n  const visiblePredictions = useMemo(() => props.visibleCountyIds ? props.data.predictions.filter(p => props.visibleCountyIds!.includes(p.countyId)) : props.data.predictions, [props.data, props.visibleCountyIds]);').replaceAll('"#192d44"', '"#a9bda5"').replaceAll('"#6885a4"', '"#667e6c"').replaceAll('"#6c88a4"', '"#667e6c"').replaceAll('"#38bdf8"', '"#4d8b82"').replaceAll('"#74d2fc"', '"#416e58"').replaceAll('"#eaa265"', '"#c48c65"').replaceAll('"#77bed5"', '"#6d9986"').replaceAll('"#080f1e"', '"#a7c9cf"').replaceAll('top: 140, left: 50, right: 40, bottom: 70', 'top: 100, left: 40, right: 40, bottom: 100').replace('        minzoom: 5,\n        paint: { "fill-opacity": 0 }', '        minzoom: 4.5,\n        paint: { "fill-opacity": 0 }').replace('predictions={props.data.predictions}', 'predictions={visiblePredictions}').replaceAll('props.layer === "activity" &&', 'props.layer !== "assistance" &&').replace('props.data.events.map((event)', 'props.data.events.filter(event => !props.visibleEventIds || props.visibleEventIds.includes(event.id)).map((event)').replace('props.data.resources.map((resource)', 'props.data.resources.filter(resource => !props.visibleCountyIds || props.visibleCountyIds.includes(resource.countyId)).map((resource)'))
edit('src/components/USMap.tsx', s => s.replace('  const reset = () =>', `  useEffect(() => {
    if (!readyMap) return;
    const events = props.data.events.filter(event => !props.visibleEventIds || props.visibleEventIds.includes(event.id));
    (readyMap.getSource('forecast') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: events.filter(e => e.forecast).map(e => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: e.forecast! } })) });
    (readyMap.getSource('impact-zones') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: events.filter(e => e.impactZone).map(e => ({ type: 'Feature', properties: { name: e.name }, geometry: { type: 'Polygon', coordinates: [e.impactZone!] } })) });
    const ids = new Set(props.visibleCountyIds || events.flatMap(e => e.affectedCountyIds || [e.countyId]));
    (readyMap.getSource('scenario-counties') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: props.geography.counties.features.filter(f => ids.has(String(f.id))) });
  }, [readyMap, props.visibleEventIds, props.visibleCountyIds, props.data, props.geography]);
  const reset = () =>`))
edit('src/components/USMap.tsx', s => s.replace('      map.addSource("selection", {', `      map.addSource('atlas-grid', { type: 'geojson', data: { type: 'FeatureCollection', features: [
        ...Array.from({ length: 15 }, (_, i) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: [[-130+i*5,18],[-130+i*5,57]] } })),
        ...Array.from({ length: 9 }, (_, i) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: [[-135,18+i*5],[-55,18+i*5]] } })),
      ] } });
      map.addLayer({ id: 'atlas-grid-lines', type: 'line', source: 'atlas-grid', maxzoom: 7, paint: { 'line-color': '#f3f2d9', 'line-width': 0.6, 'line-opacity': 0.3 } });
      map.addSource('hover-region', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'hover-region-fill', type: 'fill', source: 'hover-region', paint: { 'fill-color': '#557865', 'fill-opacity': 0.15 } });
      map.addSource("selection", {`).replace('      map.on("mousemove", (e) => {', '      let hoveredId: string | undefined;\n      map.on("mousemove", (e) => {\n        const hit = map.queryRenderedFeatures(e.point, { layers: ["county-areas", "state-areas"] })[0];\n        const id = hit ? String(hit.id) : undefined;\n        if (id !== hoveredId) {\n          hoveredId = id;\n          const original = id && [...props.geography.counties.features, ...props.geography.states.features].find(f => String(f.id) === id);\n          (map.getSource("hover-region") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features: original ? [original] : [] });\n        }'))
const stylePath = 'src/data/basemap.json'
const style = JSON.parse(fs.readFileSync(stylePath, 'utf8'))
for (const layer of style.layers) {
  if (layer.type === 'background') layer.paint['background-color'] = '#a7c9cf'
  if (layer.type === 'fill') {
    layer.paint['fill-color'] = layer.id.includes('water') ? '#a7c9cf' : layer.id.includes('wood') || layer.id.includes('park') ? '#89a68b' : layer.id.includes('building') ? '#d8d3bd' : '#b5c5aa'
    delete layer.paint['fill-pattern']
  }
  if (layer.type === 'line') layer.paint['line-color'] = layer.id.includes('water') ? '#91bbc1' : layer.id.includes('boundary') ? '#7b927d' : layer.id.includes('road') || layer.id.includes('transport') ? '#f1efdc' : '#c4cbb1'
  if (layer.type === 'symbol') {
    layer.paint['text-color'] = '#536c60'
    layer.paint['text-halo-color'] = '#dce2ca'
    layer.paint['text-halo-width'] = 1
    if (layer.layout) delete layer.layout['icon-image']
  }
}
fs.writeFileSync(stylePath, JSON.stringify(style))
edit('src/components/RiskHeatmap.tsx', s => s.replaceAll('#2dd4bf', '#8fb39b').replaceAll('#e6ba63', '#c9b078').replaceAll('#ed865e', '#c5916d').replaceAll('#f87171', '#c86d61').replaceAll('#f6c19a', '#8e7053').replaceAll('#244859', '#cbd3ac').replaceAll('#38bdf8', '#7d9f72').replaceAll('#a5e6fa', '#436c55'))
