import type {ReactNode} from 'react'
export function parseAlertSections(text:string){
 const normalized=text.replace(/\r\n?/g,'\n')
 const markers=[...normalized.matchAll(/^\s*\*\s*([A-Z][A-Z /-]*?)\.{3}\s*/gm)]
 if(!markers.length)return [{title:'',body:normalized.trim()}]
 const sections:{title:string;body:string}[]=[]
 const intro=normalized.slice(0,markers[0].index).trim()
 if(intro)sections.push({title:'',body:intro})
 markers.forEach((marker,index)=>sections.push({title:marker[1].toLowerCase().replace(/\b\w/g,letter=>letter.toUpperCase()),body:normalized.slice(marker.index!+marker[0].length,markers[index+1]?.index??normalized.length).trim()}))
 return sections
}
function links(text:string):ReactNode[]{
 return text.split(/(https?:\/\/[^\s<>]+)/g).map((part,index)=>/^https?:\/\//.test(part)?<a key={index} href={part} target="_blank" rel="noreferrer">{part}</a>:part)
}
function blocks(body:string){
 const paragraphs=body.split(/\n\s*\n/).filter(Boolean)
 return paragraphs.map((paragraph,index)=>{
  const items=paragraph.split(/(?:^|\n)\s*-\s+/).filter(value=>value.trim())
  if(/(?:^|\n)\s*-\s+/.test(paragraph))return <ul key={index}>{items.map((item,i)=><li key={i}>{links(item.replace(/\s+/g,' ').trim())}</li>)}</ul>
  return <p key={index}>{links(paragraph.replace(/\s+/g,' ').trim())}</p>
 })
}
export default function OfficialAlertText({text}:{text:string}){
 return <div className="official-alert-text">{parseAlertSections(text).map((section,index)=><section key={index}>{section.title&&<h4>{section.title}</h4>}{blocks(section.body)}</section>)}</div>
}
