import {setScenarioEnabled,useScenario} from '../services/scenario'
export function SimulatedBadge(){return <span className="simulated-badge">Simulated</span>}
export default function ScenarioControl(){const enabled=useScenario();return <div className="scenario-control"><label><input type="checkbox" checked={enabled} onChange={event=>setScenarioEnabled(event.target.checked)}/>Simulate major event</label>{enabled&&<strong>Hurricane Marlow (fictional)</strong>}<span>Real counties and Census data, fictional storm</span></div>}
