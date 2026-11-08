import {generalLinks,type GuidanceCategory} from '../services/generalGuidance'
export default function GeneralGuidance({category='planning'}:{category?:string}){
 const links=generalLinks[category as GuidanceCategory]||generalLinks.planning
 return <aside className="general-guidance" aria-label="General guidance"><strong>General guidance</strong><p>Use these official resources while local data is unavailable. Listings do not confirm current availability.</p><ul>{links.map(link=><li key={link.url}><a href={link.url} target="_blank" rel="noreferrer">{link.title}</a></li>)}</ul></aside>
}
