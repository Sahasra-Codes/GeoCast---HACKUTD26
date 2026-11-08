import {GoogleGenAI} from '@google/genai';
import type {createStore} from './store.ts';
type Snapshot = ReturnType<ReturnType<typeof createStore>['priority']>;
export const briefingRules = 'You are a briefing assistant for disaster responders. Use ONLY the numbers provided. Do not invent facts. State which zone to help first and why in 2-3 sentences, and mention a zone that is silent but high-risk if there is one. The human responder makes the final decision. The supplied ranking is final: never change the ordering or scores. These zones and their data are simulated. Dispatched means assigned, not resolved.';
export function fallbackBriefing(snapshot: Snapshot): string {
  const [first] = snapshot.zones;
  if (!first) return 'No zones are available to prioritize. The human responder makes the final decision.';
  const silent = snapshot.zones.slice(0, 3).find(z => z.powerOff && z.reportsNow < z.normalReportsPerHour);
  return `In this simulation, help ${first.name} first (score ${first.score.toFixed(1)}/100): ${first.reasons.join('; ')}.${silent ? ` Silent high-risk ${silent.name} has ${silent.reportsNow} reports versus ${silent.normalReportsPerHour}/h normal and no signal for ${silent.hoursSinceLastReport}h.` : ''} The human responder makes the final decision.`;
}
export async function generateBriefing(snapshot: Snapshot, call?: (prompt: string) => Promise<string | undefined>) {
  const fallback = () => ({text: fallbackBriefing(snapshot), source: 'template' as const, hour: snapshot.hour, simulated: true});
  if (!call && (!process.env.GEMINI_API_KEY || !process.env.GEMINI_MODEL)) return fallback();
  try {
    const prompt = JSON.stringify({simulated: true, hour: snapshot.hour, rankedTop3: snapshot.zones.slice(0, 3)});
    const text = call ? await call(prompt) : (await new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY}).models.generateContent({
      model: process.env.GEMINI_MODEL!, contents: prompt,
      config: {systemInstruction: briefingRules, temperature: 0, maxOutputTokens: 400, httpOptions: {timeout: 12000}},
    })).text;
    if (!text?.trim()) return fallback();
    return {text: text.trim(), source: 'gemini' as const, hour: snapshot.hour, simulated: true};
  } catch {return fallback();}
}
