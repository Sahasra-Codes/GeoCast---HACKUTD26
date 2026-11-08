import { useEffect, useMemo, useRef } from 'react'
import {severityLevel} from '../services/alertFilters'
import type { Map, GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl'
import type { FeatureCollection, Geometry } from 'geojson'
import type { PublicMapData } from '../publicDataTypes'
export default function PublicMapLayers({ map, data, onCounty, onAlert }: { map: Map; data: PublicMapData; onCounty: (id: string) => void; onAlert: (id: string) => void }) {
  const handlers = useRef({ onCounty, onAlert })
  useEffect(() => { handlers.current = { onCounty, onAlert } }, [onCounty, onAlert])
  const counties = useMemo<FeatureCollection<Geometry>>(() => ({ type: 'FeatureCollection', features: data.counties.features.map(f => {
    const id = String(f.id || f.properties?.GEOID)
    const alerts = data.alerts.filter(a => a.kind !== 'observed_earthquake' && !a.geometry && a.countyIds.includes(id))
    return { ...f, id, properties: { ...f.properties, countyId: id, warning: alerts.length ? Math.max(...alerts.map(a => severityLevel(a.severity))) : 0, risk: data.risk.find(r => r.countyId === id)?.riskScore ?? -1, declaration: data.declarationCountyIds.includes(id) ? 1 : 0 } }
  }) }), [data.counties, data.alerts, data.risk, data.declarationCountyIds])
  const alertGeometry = useMemo<FeatureCollection<Geometry>>(() => ({ type: 'FeatureCollection', features: data.alerts.filter(a => a.geometry).map(a => ({ type: 'Feature', properties: { alertId: a.id, kind:a.kind||'weather_alert',severity: severityLevel(a.severity),magnitude:a.magnitude??0 }, geometry: a.geometry! })) }), [data.alerts])
  useEffect(() => {
    map.addSource('public-counties', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addSource('public-alerts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addSource('public-tracts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({ id: 'public-county-area', type: 'fill', source: 'public-counties', paint: { 'fill-color': '#c23142', 'fill-opacity': .01 } })
    map.addLayer({ id: 'public-county-line', type: 'line', source: 'public-counties', paint: { 'line-color': '#536c58', 'line-width': 1, 'line-opacity': .14 } })
    map.addLayer({ id: 'public-nri', type: 'fill', source: 'public-counties', filter: ['>=',['get','risk'],0], paint: { 'fill-color': ['interpolate',['linear'],['get','risk'],0,'#b5ce9d',50,'#e3ca7b',80,'#d99b6e',100,'#c64f55'], 'fill-opacity': .45 } })
    map.addLayer({ id: 'public-warning-counties', type: 'fill', source: 'public-counties', filter: ['>', ['get','warning'],0], paint: { 'fill-color': ['match',['get','warning'],4,'#dc2626',3,'#f97316',2,'#fbbf24',1,'#fde047','#8b949e'], 'fill-opacity': .38 } })
    map.addLayer({ id: 'public-warning-polygons', type: 'fill', source: 'public-alerts', paint: { 'fill-color': ['match',['get','severity'],4,'#dc2626',3,'#f97316',2,'#fbbf24',1,'#fde047','#8b949e'], 'fill-opacity': .38 } })
    map.addLayer({ id: 'public-warning-outline', type: 'line', source: 'public-alerts', paint: { 'line-color': ['match',['get','severity'],4,'#dc2626',3,'#f97316',2,'#fbbf24',1,'#fde047','#8b949e'], 'line-width': 2 } })
    map.addLayer({ id: 'public-declarations', type: 'line', source: 'public-counties', filter: ['==',['get','declaration'],1], paint: { 'line-color': '#7554a1', 'line-width': 2, 'line-dasharray': [2,2] } })
    map.addLayer({ id: 'public-tract-lines', type: 'line', source: 'public-tracts', paint: { 'line-color': '#36568a', 'line-width': .8, 'line-opacity': .75 } })
    map.addLayer({id:'public-earthquake-dots',type:'circle',source:'public-alerts',filter:['all',['==',['geometry-type'],'Point'],['==',['get','kind'],'observed_earthquake']],paint:{'circle-radius':6,'circle-color':'#dc2626','circle-stroke-color':'#ffffff','circle-stroke-width':1.5,'circle-opacity':.95}})
    const countyClick = (e: MapLayerMouseEvent) => { const id = e.features?.[0]?.properties?.countyId; if (id) handlers.current.onCounty(String(id)) }
    const alertClick = (e: MapLayerMouseEvent) => { const id = e.features?.[0]?.properties?.alertId; if (id) handlers.current.onAlert(String(id)) }
    map.on('click','public-county-area',countyClick)
    map.on('click','public-warning-polygons',alertClick)
    map.on('click','public-earthquake-dots',alertClick)
    return () => {
      map.off('click','public-county-area',countyClick); map.off('click','public-warning-polygons',alertClick);map.off('click','public-earthquake-dots',alertClick)
      for (const id of ['public-earthquake-dots','public-tract-lines','public-declarations','public-warning-outline','public-warning-polygons','public-warning-counties','public-nri','public-county-line','public-county-area']) if (map.getLayer(id)) map.removeLayer(id)
      for (const id of ['public-tracts','public-alerts','public-counties']) if (map.getSource(id)) map.removeSource(id)
    }
  }, [map])
  useEffect(() => {
    ;(map.getSource('public-counties') as GeoJSONSource).setData(counties)
    ;(map.getSource('public-alerts') as GeoJSONSource).setData(alertGeometry)
    ;(map.getSource('public-tracts') as GeoJSONSource).setData(data.tracts || { type: 'FeatureCollection', features: [] })
    for (const id of ['public-warning-counties','public-warning-polygons','public-warning-outline','public-earthquake-dots']) map.setLayoutProperty(id,'visibility',data.showAlerts ? 'visible' : 'none')
    map.setLayoutProperty('public-nri','visibility',data.showRisk ? 'visible' : 'none')
    map.setLayoutProperty('public-declarations','visibility',data.showDeclarations ? 'visible' : 'none')
  }, [map, counties, alertGeometry, data])
  return null
}
