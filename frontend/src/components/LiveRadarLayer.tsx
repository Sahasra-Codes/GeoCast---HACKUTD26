import { useEffect, useState } from 'react'
import type { Map, RasterTileSource } from 'maplibre-gl'
import type { SourceResult } from '../publicDataTypes'
export interface RadarObservation { frames:string[]; latest:string; wmsUrl:string; layer:string; coverage:string; product:string; units:string }
export default function LiveRadarLayer({map}:{map:Map}) {
 const [radar,setRadar]=useState<SourceResult<RadarObservation>>()
 const [frame,setFrame]=useState(0)
 useEffect(()=>{
  const controller=new AbortController()
  const load=()=>fetch('/api/public/radar',{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error('Radar metadata unavailable');return r.json()}).then(value=>setRadar(value)).catch(()=>{if(!controller.signal.aborted)setRadar({status:'unavailable',data:null,name:'NOAA MRMS radar',classification:'observed_radar',sourceUrl:'https://radar.weather.gov/',vintage:'',retrievedAt:new Date().toISOString(),error:'Observed radar is unavailable.'})})
  void load(); const interval=setInterval(()=>{if(document.visibilityState==='visible')void load()},120000)
  return()=>{controller.abort();clearInterval(interval)}
 },[])
 useEffect(()=>{if(!radar?.data?.frames.length)return;const timer=setInterval(()=>setFrame(value=>(value+1)%radar.data!.frames.length),1800);return()=>clearInterval(timer)},[radar])
 useEffect(()=>{
  if(!radar?.data){if(map.getLayer('observed-radar-layer'))map.removeLayer('observed-radar-layer');if(map.getSource('observed-radar'))map.removeSource('observed-radar');return}
  const current=radar.data
  const time=current.frames[frame%current.frames.length]
  const url=current.wmsUrl+'?service=WMS&version=1.1.1&request=GetMap&layers='+encodeURIComponent(current.layer)+'&styles=&format=image/png&transparent=true&srs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256&time='+encodeURIComponent(time)
  if(map.getSource('observed-radar'))(map.getSource('observed-radar') as RasterTileSource).setTiles([url])
  else {map.addSource('observed-radar',{type:'raster',tiles:[url],tileSize:256,bounds:[-130,20,-60,55],attribution:'NOAA MRMS / NWS observed radar'});map.addLayer({id:'observed-radar-layer',type:'raster',source:'observed-radar',paint:{'raster-opacity':.65,'raster-fade-duration':250}},map.getLayer('public-county-area')?'public-county-area':undefined)}
  map.getContainer().dataset.radarTimestamp=time
 },[map,radar,frame])
 useEffect(()=>()=>{if(map.getLayer('observed-radar-layer'))map.removeLayer('observed-radar-layer');if(map.getSource('observed-radar'))map.removeSource('observed-radar')},[map])
 return <div className="live-radar-status" role="status"><span className={radar?.status==='available'?'radar-status-dot':'radar-status-dot unavailable'}/>{radar?.data?<><strong>NOAA observed radar</strong><span>{new Date(radar.data.frames[frame%radar.data.frames.length]).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span><small>CONUS · recorded frames · dBZ</small></>:<span>{radar?.error||'Connecting to observed radar…'}</span>}</div>
}
