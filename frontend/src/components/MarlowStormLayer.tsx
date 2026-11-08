import {useEffect,useMemo} from 'react'
import {createPortal} from 'react-dom'
import {Marker,type Map as LibreMap} from 'maplibre-gl'
// Deterministic synthetic reflectivity texture, never an observed radar product.
function radarTexture(){
 const canvas=document.createElement('canvas'),size=400;canvas.width=size;canvas.height=size
 const context=canvas.getContext('2d');if(!context)return ''
 const pixels=context.createImageData(size,size)
 const smooth=(n:number)=>n*n*(3-2*n)
 const hash=(x:number,y:number)=>{const value=Math.sin(x*127.1+y*311.7)*43758.5453;return value-Math.floor(value)}
 const noise=(x:number,y:number)=>{const a=Math.floor(x),b=Math.floor(y),u=smooth(x-a),v=smooth(y-b);return (hash(a,b)*(1-u)+hash(a+1,b)*u)*(1-v)+(hash(a,b+1)*(1-u)+hash(a+1,b+1)*u)*v}
 const colors=[[25,137,59],[28,193,62],[100,220,39],[216,233,28],[255,215,18],[255,153,12],[247,80,15],[220,29,37],[172,18,65],[199,61,172]]
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const dx=(x-size/2)/(size*.48),dy=(y-size/2)/(size*.48),r=Math.hypot(dx,dy),angle=Math.atan2(dy,dx)
  if(r>1.06||r<.085)continue
  const broad=noise(dx*5+11,dy*5+19),fine=noise(dx*24+31,dy*24+47),grain=noise(dx*65+73,dy*65+97)
  const wave=Math.cos(3*(angle+1.8*Math.log(r+.08))+(broad-.5)*1.9)
  const bands=Math.pow(Math.max(0,(wave+.35)/1.35),1.3)
  const eyewall=Math.exp(-(((r-.18-(broad-.5)*.035)/.065)**2))
  const envelope=Math.max(0,1-r)**.7
  const strength=(.13+bands*.83)*envelope+eyewall*.76+(broad-.5)*.22+(fine-.5)*.19+(grain-.5)*.07
  if(strength<.13)continue
  const color=colors[Math.min(colors.length-1,Math.max(0,Math.floor((strength-.12)*10)))],offset=(y*size+x)*4
  pixels.data[offset]=color[0];pixels.data[offset+1]=color[1];pixels.data[offset+2]=color[2]
  pixels.data[offset+3]=Math.round(205*Math.min(1,(strength-.12)*7)*Math.min(1,Math.max(0,(r-.085)/.035))*Math.min(1,Math.max(0,(1.06-r)/.12)))
 }
 context.putImageData(pixels,0,0);return canvas.toDataURL('image/png')
}
export default function MarlowStormLayer({map}:{map:LibreMap}){
 const element=useMemo(()=>{const node=document.createElement('div');node.className='marlow-storm';node.setAttribute('aria-label','Simulated Hurricane Marlow visualization, not observed radar');return node},[])
 useEffect(()=>{
  const marker=new Marker({element,anchor:'center'}).setLngLat([-96.8,27.6]).addTo(map)
  const size=()=>{const a=map.project([-98.3,27.6]),b=map.project([-95.3,27.6]);const pixels=Math.max(70,Math.min(560,Math.abs(b.x-a.x)));element.style.width=pixels+'px';element.style.height=pixels+'px'}
  size();map.on('move',size);map.on('resize',size)
  return()=>{map.off('move',size);map.off('resize',size);marker.remove()}
 },[map,element])
 const texture=useMemo(radarTexture,[])
 return createPortal(<><svg viewBox="0 0 200 200" role="img" aria-label="Simulated spinning hurricane radar-style rainfall"><g className="marlow-swirl"><image href={texture} x="0" y="0" width="200" height="200"/></g></svg><div className="marlow-storm-label">Simulated Hurricane Marlow<small>Illustration, not observed radar</small><div className="marlow-intensity-key" aria-label="Simulated rainfall intensity from lighter to heavier"/><small>Lighter rain - Heavier rain (fictional)</small></div></>,element)
}
