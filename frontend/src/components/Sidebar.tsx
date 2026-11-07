import {
  Activity,
  BrainCircuit,
  Compass,
  HeartHandshake,
  Map,
  PackageOpen,
  Radio,
  Settings2,
  Shield,
} from "lucide-react";
import type { Layer } from "../types";

export type Navigation =
  "overview" | "events" | "risk" | "needs" | "assistance";
export default function Sidebar({
  active,
  onNavigate,
  onSettings,
}: {
  active: Navigation;
  onNavigate: (nav: Navigation, layer: Layer) => void;
  onSettings: () => void;
}) {
  const items = [
    { id: "overview", label: "Map overview", icon: Map, layer: "activity" },
    {
      id: "events",
      label: "Disaster scenarios",
      icon: Activity,
      layer: "activity",
    },
    {
      id: "risk",
      label: "AI risk analysis",
      icon: BrainCircuit,
      layer: "risk",
    },
    {
      id: "needs",
      label: "Community needs",
      icon: PackageOpen,
      layer: "needs",
    },
    {
      id: "assistance",
      label: "Assistance resources",
      icon: HeartHandshake,
      layer: "assistance",
    },
  ] as const;
  return (
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Sentinel home">
        <span className="brand-mark">
          <Compass size={28} strokeWidth={1.5} />
        </span>
        <span>
          SENTINEL<span className="brand-sub">DISASTER INTELLIGENCE</span>
        </span>
      </a>
      <div className="workspace">
        <span className="workspace-icon">
          <Shield size={16} />
        </span>
        <div>
          Response workspace<small>United States</small>
        </div>
        <span className="workspace-dot" />
      </div>
      <div className="nav-label">WORKSPACE</div>
      <nav>
        {items.map(({ id, label, icon: Icon, layer }) => (
          <button
            key={id}
            title={label}
            className={active === id ? "nav-active" : ""}
            onClick={() => onNavigate(id, layer)}
          >
            <Icon size={18} />
            <span>{label}</span>
            {id === "events" && <b>05</b>}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="signal-card">
          <Radio size={19} />
          <strong>Clarity when it matters.</strong>
          <p>
            One shared picture.
            <br />A more informed response.
          </p>
          <span>
            INTELLIGENCE FOR IMPACT <span>↗</span>
          </span>
        </div>
        <button className="settings-button" onClick={onSettings}>
          <Settings2 size={18} />
          <span>Data & settings</span>
        </button>
        <div className="profile">
          <span className="avatar">SC</span>
          <div>
            Sentinel Command<small>Demo workspace</small>
          </div>
          <span className="online-dot" />
        </div>
      </div>
    </aside>
  );
}
