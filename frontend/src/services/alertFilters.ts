import type {PublicAlert} from '../publicDataTypes'
import {classifyHazard} from '../data/catalog'

export const severityLevels: Record<string, number> = {Extreme:4, Severe:3, Moderate:2, Minor:1, Unknown:0.5}
export const severityLevel = (value: string) => severityLevels[value] ?? 0
export function isCurrentAlert(alert: PublicAlert, now: number) {
  return !alert.expires || new Date(alert.expires).getTime() > now
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
