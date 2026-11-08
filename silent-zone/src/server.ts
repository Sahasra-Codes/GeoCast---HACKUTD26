import {generalReliefPlan} from './generalRelief.ts';
import {existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {createReliefPlan,getCachedMarlowPlan,ReliefError} from './relief.ts';
import {createServer, type IncomingMessage} from 'node:http';
import {pathToFileURL} from 'node:url';
import {createStore, loadZones} from './store.ts';
import {generateBriefing} from './briefing.ts';
// Keep existing backend Gemini configuration server-side; local Node values take precedence.
const backendEnv = new URL('../../backend/.env', import.meta.url);
if(existsSync(backendEnv)){const original={...process.env};loadEnvFile(backendEnv);Object.assign(process.env,original);}
process.env.GEMINI_MODEL ||= 'gemini-3.1-flash-lite';
async function body(req: IncomingMessage) {
  let text = '';
  for await (const chunk of req) {text += chunk; if (Buffer.byteLength(text) > 32768) throw new Error('Body too large');}
  return JSON.parse(text || '{}');
}
export function createPriorityServer(store: ReturnType<typeof createStore>) {
  return createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    // Loopback demo service; no cross-origin writes through a browser.
    if (req.headers.origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.origin)) {
      res.writeHead(403); res.end(JSON.stringify({error: 'Origin not allowed'})); return;
    }
    const send = (code: number, data: unknown) => {res.writeHead(code); res.end(JSON.stringify(data));};
    const path = new URL(req.url || '/', 'http://localhost').pathname;
    try {
      if (req.method === 'GET' && path === '/api/priority') return send(200, store.priority());
      if (req.method === 'POST' && path === '/api/advance') return send(200, store.advance());
      if (req.method === 'POST' && path === '/api/briefing') return send(200, await generateBriefing(store.priority()));
      if (req.method === 'GET' && /^\/api\/relief\/scenario-plans\/48[0-9]{3}$/.test(path)) {
        const plan=await getCachedMarlowPlan(path.split('/').pop()!);
        return send(200,plan||generalReliefPlan({city:'Selected county',state:'TX',county:path.split('/').pop()!,simulated:true}));
      }
      if (req.method === 'POST' && path === '/api/relief/plan') {
        const input = await body(req);
        if (!input || typeof input.city !== 'string' || !input.city.trim() || typeof input.state !== 'string' || !input.state.trim()) {
          throw new ReliefError(400, 'Enter a city and select a state to generate your relief plan. County is optional.');
        }
        return send(200, await createReliefPlan(input));
      }
      if (req.method === 'POST' && path === '/api/dispatch') {
        const {zoneId} = await body(req);
        if (typeof zoneId !== 'string') return send(400, {error: 'zoneId is required'});
        const zone = store.dispatch(zoneId);
        return zone ? send(200, zone) : send(404, {error: 'Unknown zone'});
      }
      send(404, {error: 'Route not found'});
    } catch(error) {if(error instanceof ReliefError)send(error.status,{error:error.message});else send(400,{error:'Invalid request'});}
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createPriorityServer(createStore(await loadZones()));
  server.listen(Number(process.env.PORT || 8001), '127.0.0.1', () => console.log('GeoCast responder API · live relief plans + Silent Zone simulation · http://127.0.0.1:' + (process.env.PORT || 8001)));
}
