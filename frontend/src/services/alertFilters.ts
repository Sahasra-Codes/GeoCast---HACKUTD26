import type {PublicAlert} from '../publicDataTypes'
import {classifyHazard} from '../data/catalog'

export const severityLevels: Record<string, number> = {Extreme:4, Severe:3, Moderate:2, Minor:1, Unknown:0.5}
export const severityLevel = (value: string) => severityLevels[value] ?? 0
export function isCurrentAlert(alert: PublicAlert, now: number) {
  const start=alert.effective?Date.parse(alert.effective):null
  const endTimes=[alert.expires,alert.ends].filter((value):value is string=>!!value).map(value=>Date.parse(value))
  if(start!==null&&(!Number.isFinite(start)||start>now))return false
  if(endTimes.some(end=>!Number.isFinite(end)||end<=now))return false
  return true
}
export function matchesAlertType(alert: PublicAlert, filter: string) {
  if (filter.startsWith('event:')) return alert.event === filter.slice(6)
  if (filter.startsWith('alert:')) return alert.id === filter.slice(6)
  return filter === 'all' || classifyHazard(alert.event) === filter
}
export function alertImpact(alert: PublicAlert) {
  const section = (name: string) => alert.description?.match(new RegExp('\\*\\s*'+name+'\\.\\.\\.([\\s\\S]*?)(?=\\n\\s*\\*|$)','i'))?.[1]?.replace(/\s+/g,' ').trim()
  const what = section('WHAT'), impacts = section('IMPACTS')
  const floodCategory = what?.match(/\b(minor|moderate|major) flooding\b/i)?.[1]
  return {what, impacts, floodCategory: floodCategory ? floodCategory[0].toUpperCase()+floodCategory.slice(1).toLowerCase() : undefined}
}

// NWS severity categories are discrete; break ties by urgency, certainty, then issue time.
export function compareAlertPriority(a: PublicAlert, b: PublicAlert) {
  const urgency: Record<string,number> = {Immediate:3, Expected:2, Future:1}
  const certainty: Record<string,number> = {Observed:4, Likely:3, Possible:2, Unlikely:1}
  const issued = (value: string|null) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0
  return severityLevel(b.severity)-severityLevel(a.severity)
    || (urgency[b.urgency]||0)-(urgency[a.urgency]||0)
    || (certainty[b.certainty]||0)-(certainty[a.certainty]||0)
    || issued(b.sent)-issued(a.sent)
    || a.id.localeCompare(b.id)
}
