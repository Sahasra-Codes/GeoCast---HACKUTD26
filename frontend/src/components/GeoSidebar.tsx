import { useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  Globe2,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Geography, GeographicRegion } from "../types";
import type { DisasterFilter } from "../data/geo";
import { demoPlaces, disasterOptions, regionTitle } from "../data/geo";
import PopulationNeedFilters from "./PopulationNeedFilters";
interface Props {
  geography?: Geography;
  disaster: DisasterFilter;
  onDisaster: (value: DisasterFilter) => void;
  needs: string[];
  onNeeds: (needs: string[]) => void;
  match: "any" | "all";
  onMatch: (mode: "any" | "all") => void;
  scope?: GeographicRegion;
  onLocation: (region?: GeographicRegion) => void;
  onFind: () => void;
  onClear: () => void;
  count: number;
  applied: boolean;
  onAbout: () => void;
}
export default function GeoSidebar(props: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const term = query.toLowerCase().trim();
  const placeResults = term
    ? demoPlaces
        .filter((p) =>
          `${p.name} ${p.zip} ${p.state}`.toLowerCase().includes(term),
        )
        .map((p) => ({
          region: props.geography?.regions.find((r) => r.id === p.countyId),
          title: `${p.name}, ${p.state}`,
          subtitle: `Sample city / ZIP ${p.zip}`,
        }))
    : [];
  const regionResults = term
    ? (props.geography?.regions || [])
        .filter((r) =>
          term
            .split(/\s+/)
            .every((w) =>
              `${r.name} ${r.state} ${r.kind}`.toLowerCase().includes(w),
            ),
        )
        .sort(
          (a, b) =>
            (a.name.toLowerCase() === term
              ? 0
              : a.name.toLowerCase().startsWith(term)
                ? a.name.length
                : 1000) -
            (b.name.toLowerCase() === term
              ? 0
              : b.name.toLowerCase().startsWith(term)
                ? b.name.length
                : 1000),
        )
        .slice(0, 6)
        .map((r) => ({
          region: r,
          title: regionTitle(r),
          subtitle: r.kind === "state" ? "State · United States" : r.state,
        }))
    : [];
  const results = [...placeResults, ...regionResults]
    .filter((r) => r.region)
    .slice(0, 7);
  const choose = (region: GeographicRegion) => {
    props.onLocation(region);
    setQuery("");
    setActive(false);
  };
  return (
    <aside className="geo-sidebar">
      <div className="sidebar-intro">
        <h1>Disaster explorer</h1>
        <p>
          Find impacted areas, assess needs,
          <br />
          and connect to resources.
        </p>
      </div>
      <div className="sidebar-scroll">
        <section className="location-filters">
          <label className="field-label" htmlFor="disaster-type">
            Disaster type
          </label>
          <div className="select-wrap">
            <SlidersHorizontal size={15} />
            <select
              id="disaster-type"
              value={props.disaster}
              onChange={(e) =>
                props.onDisaster(e.target.value as DisasterFilter)
              }
            >
              {disasterOptions.map((o) => (
                <option value={o.value} key={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown size={13} />
          </div>
          <label className="field-label" htmlFor="geo-search">
            Geographic search
          </label>
          <div className="geo-search">
            <Search size={16} />
            <input
              id="geo-search"
              aria-label="Search city, county, state, or ZIP code"
              role="combobox"
              aria-expanded={active && !!term}
              aria-controls="geo-suggestions"
              placeholder="Search a location…"
              value={query}
              onFocus={() => setActive(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setIndex(0);
                setActive(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setIndex((i) => Math.min(i + 1, results.length - 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setIndex((i) => Math.max(i - 1, 0));
                }
                if (e.key === "Enter" && results[index]?.region)
                  choose(results[index].region!);
                if (e.key === "Escape") setActive(false);
              }}
            />
            {query && (
              <button aria-label="Clear search" onClick={() => setQuery("")}>
                <X size={13} />
              </button>
            )}
            {active && term && (
              <div
                id="geo-suggestions"
                className="geo-suggestions"
                role="listbox"
              >
                {results.length ? (
                  results.map((r, i) => (
                    <button
                      key={r.title + r.subtitle}
                      role="option"
                      aria-selected={index === i}
                      onMouseEnter={() => setIndex(i)}
                      onClick={() => choose(r.region!)}
                    >
                      <MapPin size={13} />
                      <span>
                        {r.title}
                        <small>{r.subtitle}</small>
                      </span>
                      <ArrowUpRight size={12} />
                    </button>
                  ))
                ) : (
                  <p>
                    No match. Try a state, county, or a demo city such as Miami.
                  </p>
                )}
              </div>
            )}
          </div>
          <p className="search-hint">
            All states & counties · 8 sample cities / ZIPs
          </p>
          {props.scope && (
            <div className="location-scope">
              <MapPin size={12} />
              <span>{regionTitle(props.scope)}</span>
              <button
                aria-label="Clear geographic area"
                onClick={() => props.onLocation(undefined)}
              >
                <X size={12} />
              </button>
            </div>
          )}
        </section>
        <PopulationNeedFilters
          selected={props.needs}
          onChange={props.onNeeds}
          match={props.match}
          onMatch={props.onMatch}
        />
        {props.needs.length > 0 && (
          <div className="selected-needs">
            <span className="overline">
              YOUR SELECTION · {props.needs.length}
            </span>
            <div>
              {props.needs.map((n) => (
                <button
                  key={n}
                  onClick={() =>
                    props.onNeeds(props.needs.filter((s) => s !== n))
                  }
                >
                  {n}
                  <X size={10} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="sidebar-actions">
        <button
          className="find-button"
          onClick={props.onFind}
          disabled={!props.geography}
        >
          <span>Apply filters</span>
          <ArrowUpRight size={19} />
        </button>
        <div className="filter-footer">
          <button onClick={props.onClear}>Clear filters</button>
          <span>
            {props.applied
              ? `${props.count} matching counties`
              : "Explore with intention"}
          </span>
        </div>
        <div className="sidebar-footnote">
          <span className="demo-label">Demo scenarios</span>
          <button
            aria-label="About this demo and data sources"
            onClick={props.onAbout}
          >
            <Globe2 size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
