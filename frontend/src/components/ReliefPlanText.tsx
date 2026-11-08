import type {ReactNode} from 'react'

// Render the limited Markdown Gemini returns as React elements. Never inject model HTML.
function inline(text:string):ReactNode[]{
 const tokens=/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*\n]+\*)/g
 return text.split(tokens).filter(Boolean).map((part,index)=>{
  if(part.startsWith('**')||part.startsWith('__'))return <strong key={index}>{part.slice(2,-2)}</strong>
  if(part.startsWith('`'))return <code key={index}>{part.slice(1,-1)}</code>
  if(part.startsWith('*')&&part.endsWith('*'))return <em key={index}>{part.slice(1,-1)}</em>
  const link=part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
  if(link)return /^https?:\/\//i.test(link[2])?<a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>:link[1]
  return part
 })
}
const item=(line:string)=>line.match(/^(\s*)([-+*]|\d+[.)])\s+(.+)$/)
const heading=(line:string)=>line.match(/^\s*#{1,6}\s+(.+?)\s*#*$/)
const rule=(line:string)=>/^\s*(?:\*\s*){3,}$|^\s*(?:-\s*){3,}$|^\s*(?:_\s*){3,}$/.test(line)
function list(lines:string[],start:number):{node:ReactNode;next:number}{
 const first=item(lines[start])!,indent=first[1].length,ordered=/^\d/.test(first[2]),entries:{text:string;children:ReactNode[]}[]=[]
 let index=start
 while(index<lines.length){
  if(!lines[index].trim()){if(item(lines[index+1]||'')){index++;continue}break}
  const match=item(lines[index])
  if(match){
   if(match[1].length<indent)break
   if(match[1].length>indent&&entries.length){const nested=list(lines,index);entries[entries.length-1].children.push(nested.node);index=nested.next;continue}
   if(/^\d/.test(match[2])!==ordered)break
   entries.push({text:match[3],children:[]});index++
  }else if(entries.length&&!heading(lines[index])&&!rule(lines[index])&&/^\s+/.test(lines[index])){
   entries[entries.length-1].text+=' '+lines[index].trim();index++
  }else break
 }
 const children=entries.map((entry,i)=><li key={i}>{inline(entry.text)}{entry.children.map((child,j)=><div className="relief-nested-list" key={j}>{child}</div>)}</li>)
 return {node:ordered?<ol start={parseInt(first[2],10)}>{children}</ol>:<ul>{children}</ul>,next:index}
}
export default function ReliefPlanText({text}:{text:string}){
 const lines=text.replace(/\r\n?/g,'\n').split('\n'),blocks:ReactNode[]=[]
 for(let index=0;index<lines.length;){
  const line=lines[index];if(!line.trim()){index++;continue}
  const title=heading(line)
  if(title){blocks.push(<h3 key={index}>{inline(title[1])}</h3>);index++;continue}
  if(rule(line)){blocks.push(<hr key={index}/>);index++;continue}
  if(item(line)){const parsed=list(lines,index);blocks.push(<div className="relief-plan-list" key={index}>{parsed.node}</div>);index=parsed.next;continue}
  const paragraph=[line.trim()],key=index++
  while(index<lines.length&&lines[index].trim()&&!heading(lines[index])&&!item(lines[index])&&!rule(lines[index]))paragraph.push(lines[index++].trim())
  blocks.push(<p key={key}>{inline(paragraph.join(' '))}</p>)
 }
 return <div className="relief-plan-text relief-plan-prose">{blocks}</div>
}
