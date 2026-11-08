import {
  Check,
  ChevronDown,
  HeartPulse,
  PersonStanding,
  Radio,
  HandHeart,
  PackageOpen,
} from "lucide-react";
import { motion } from "framer-motion";
import { needCategories } from "../data/geo";
const icons = {
  medical: HeartPulse,
  mobility: PersonStanding,
  visibility: Radio,
  assistance: HandHeart,
  basic: PackageOpen,
};
export default function PopulationNeedFilters({
  selected,
  onChange,
  match,
  onMatch,
}: {
  selected: string[];
  onChange: (needs: string[]) => void;
  match: "any" | "all";
  onMatch: (value: "any" | "all") => void;
}) {
  const toggle = (need: string) =>
    onChange(
      selected.includes(need)
        ? selected.filter((n) => n !== need)
        : [...selected, need],
    );
  return (
    <section className="population-filters">
      <div className="population-title">
        <h2>Population need</h2>
        <span className="count-pill">{selected.length}</span>
      </div>
      {needCategories.map((category) => {
        const Icon = icons[category.icon as keyof typeof icons];
        const enabled = category.needs.some((n) => selected.includes(n));
        const toggleCategory = () =>
          onChange(
            enabled
              ? selected.filter((n) => !category.needs.includes(n))
              : [...new Set([...selected, ...category.needs])],
          );
        return (
          <details
            className={`need-category ${enabled ? "category-selected" : ""}`}
            key={category.title}
          >
            <summary>
              <label onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={toggleCategory}
                  aria-label={`${category.title} needs`}
                />
                <Icon size={15} />
                <span>{category.title}</span>
              </label>
              <ChevronDown size={12} />
            </summary>
            <div className="need-chips">
              {category.needs.map((need) => (
                <motion.button
                  key={need}
                  whileTap={{ scale: 0.97 }}
                  aria-pressed={selected.includes(need)}
                  onClick={() => toggle(need)}
                  className={selected.includes(need) ? "selected" : ""}
                >
                  {selected.includes(need) && <Check size={11} />} {need}
                </motion.button>
              ))}
            </div>
          </details>
        );
      })}
      <div className="match-control">
        <span>Match needs</span>
        <div role="group" aria-label="Need matching mode">
          {(["any", "all"] as const).map((mode) => (
            <button
              key={mode}
              className={match === mode ? "chosen" : ""}
              aria-pressed={match === mode}
              onClick={() => onMatch(mode)}
            >
              {mode === "any" ? "Any" : "All"}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
