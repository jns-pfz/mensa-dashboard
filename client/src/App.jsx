import { useMenus } from "./hooks/useMenus";
import { MensaBlock } from "./components/MensaBlock";
import { MealCard } from "./components/MealCard";

const btn = (active, color) => ({
  padding: "7px 16px",
  border: `1px solid ${active ? (color ?? "var(--text)") : "var(--border)"}`,
  borderRadius: 6,
  background: active ? (color ?? "var(--text)") : "var(--surface)",
  color: active ? "#fff" : "var(--text)",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
  transition: "all 0.15s",
});

const SORT_OPTIONS = [
  { key: "default",  label: "Standard",        icon: "📋" },
  { key: "protein",  label: "Meiste Proteine",  icon: "🥩" },
  { key: "calories", label: "Wenigste Kalorien",icon: "🔥" },
  { key: "climate",  label: "Bestes Klima",     icon: "🌱" },
];

export default function App() {
  const {
    today, currentDate, weekDates,
    allMensas, visibleMensas, hiddenMensas,
    sortMode, setSortMode,
    sortedTodayMeals, uzhEnriched, meta,
    toggleMensa, loading, error,
    goToPrevWeek, goToNextWeek, goToToday,
  } = useMenus();

  const [mode, setMode] = window.__modeState ?? (() => {
    // simple local state without hook to avoid re-render issues
    let _mode = "today";
    const listeners = [];
    const get = () => _mode;
    const set = (v) => { _mode = v; listeners.forEach(l => l(v)); };
    window.__modeState = [get, set];
    return [get, set];
  })();

  // Use React's own state for mode
  const [viewMode, setViewMode] = window.React?.useState
    ? window.React.useState("today")
    : ["today", () => {}];

  // Actually just use a normal import
  return <AppInner />;
}

// Separate inner component so we can use hooks properly
import { useState } from "react";

function AppInner() {
  const {
    today, currentDate, weekDates,
    allMensas, visibleMensas, hiddenMensas,
    sortMode, setSortMode,
    sortedTodayMeals, uzhEnriched, meta,
    toggleMensa, loading, error,
    goToPrevWeek, goToNextWeek, goToToday,
  } = useMenus();

  const [mode, setMode] = useState("today");

  const weekLabel = weekDates.length > 0
    ? `${new Date(weekDates[0] + "T12:00").toLocaleDateString("de-CH", { day: "numeric", month: "short" })} – ${new Date(weekDates[4] + "T12:00").toLocaleDateString("de-CH", { day: "numeric", month: "short", year: "numeric" })}`
    : "";

  const isActiveSort = mode === "today" && sortMode !== "default";

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "30px 20px" }}>

      {/* Title */}
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>🍽 Mensa Dashboard</h1>
      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>ETH & UZH · Zürich</p>

      {/* Enrichment banner */}
      {!uzhEnriched && meta.enrichmentStatus === "in_progress" && (
        <div style={{
          background: "#fff8e1", border: "1px solid #ffe082",
          borderRadius: 8, padding: "10px 16px", marginBottom: 16,
          fontSize: 13, color: "#795548",
        }}>
          ⏳ <strong>Nährwerte werden im Hintergrund geladen</strong> — die Seite aktualisiert sich automatisch. Dies dauert beim ersten Aufruf der Woche etwa 3–5 Minuten.
        </div>
      )}

      {/* Mode + week nav */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <button style={btn(mode === "today")}  onClick={() => setMode("today")}>Heute</button>
        <button style={btn(mode === "week")}   onClick={() => setMode("week")}>Woche</button>
        {mode === "week" && (
          <>
            <button style={btn(false)} onClick={goToPrevWeek}>← Letzte Woche</button>
            <button style={btn(false)} onClick={goToToday}>Diese Woche</button>
            <button style={btn(false)} onClick={goToNextWeek}>Nächste Woche →</button>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>{weekLabel}</span>
          </>
        )}
      </div>

      {/* Sort bar — only in today mode */}
      {mode === "today" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Sortieren:
          </span>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              style={btn(sortMode === opt.key, opt.key === "protein" ? "#c0392b" : opt.key === "climate" ? "#4caf50" : null)}
              onClick={() => setSortMode(opt.key)}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Mensa filter pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {allMensas.map(m => (
          <button key={m.name} onClick={() => toggleMensa(m.name)} style={{
            padding: "5px 12px",
            border: "1px solid var(--border)",
            borderRadius: 20,
            background: hiddenMensas.has(m.name) ? "var(--border)" : "var(--surface)",
            color: hiddenMensas.has(m.name) ? "var(--muted)" : "var(--text)",
            textDecoration: hiddenMensas.has(m.name) ? "line-through" : "none",
            cursor: "pointer", fontSize: 12, fontWeight: 600,
          }}>
            {m.name}
          </button>
        ))}
      </div>

      {/* Status */}
      {loading && <p style={{ color: "var(--muted)" }}>Lade Menüpläne…</p>}
      {error && (
        <p style={{ color: "var(--accent)", background: "var(--accent-light)", padding: 12, borderRadius: 8 }}>
          ⚠️ Fehler: {error} — Läuft der Backend-Server?
        </p>
      )}

      {/* SORTED FLAT VIEW (today + sort active) */}
      {!loading && !error && isActiveSort && (
        <div style={{ columns: "2 400px", gap: 20 }}>
          {sortedTodayMeals.length === 0
            ? <p style={{ color: "var(--muted)" }}>Keine Angebote heute.</p>
            : sortedTodayMeals.map((meal, i) => (
                <div key={i} style={{ breakInside: "avoid", marginBottom: 0 }}>
                  <MealCard
                    meal={meal}
                    highlight={i === 0 && sortMode === "protein" && meal.nutrition?.protein != null}
                    showMensa={true}
                  />
                </div>
              ))
          }
        </div>
      )}

      {/* NORMAL GROUPED VIEW */}
      {!loading && !error && !isActiveSort && (
        visibleMensas.map(mensa => (
          <MensaBlock key={mensa.name} mensa={mensa} dates={weekDates} mode={mode} />
        ))
      )}
    </div>
  );
}