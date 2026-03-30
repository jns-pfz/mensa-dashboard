import { useMenus } from "./hooks/useMenus";
import { MensaBlock } from "./components/MensaBlock";
import { useState } from "react";

const btn = (active) => ({
  padding: "7px 18px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: active ? "var(--text)" : "var(--surface)",
  color: active ? "#fff" : "var(--text)",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
  transition: "all 0.15s",
});

export default function App() {
  const {
    today, weekDates, visibleMensas, allMensas, hiddenMensas,
    toggleMensa, loading, error,
    goToPrevWeek, goToNextWeek, goToToday,
  } = useMenus();

  const [mode, setMode] = useState("today"); // "today" | "week"

  const weekLabel = weekDates.length > 0
    ? `${new Date(weekDates[0] + "T12:00").toLocaleDateString("de-CH", { day: "numeric", month: "short" })} – ${new Date(weekDates[4] + "T12:00").toLocaleDateString("de-CH", { day: "numeric", month: "short", year: "numeric" })}`
    : "";

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "30px 20px" }}>

      {/* Title */}
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>🍽 Mensa Dashboard</h1>
      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>
        ETH & UZH · Zürich
      </p>

      {/* Controls row */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 24 }}>
        {/* Today / Week toggle */}
        <button style={btn(mode === "today")} onClick={() => setMode("today")}>Heute</button>
        <button style={btn(mode === "week")} onClick={() => setMode("week")}>Woche</button>

        {/* Week navigation (only in week mode) */}
        {mode === "week" && (
          <>
            <button style={btn(false)} onClick={goToPrevWeek}>← Letzte Woche</button>
            <button style={btn(false)} onClick={goToToday}>Diese Woche</button>
            <button style={btn(false)} onClick={goToNextWeek}>Nächste Woche →</button>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>{weekLabel}</span>
          </>
        )}
      </div>

      {/* Mensa filter pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
        {allMensas.map(m => (
          <button key={m.name} onClick={() => toggleMensa(m.name)} style={{
            padding: "5px 12px",
            border: "1px solid var(--border)",
            borderRadius: 20,
            background: hiddenMensas.has(m.name) ? "var(--border)" : "var(--surface)",
            color: hiddenMensas.has(m.name) ? "var(--muted)" : "var(--text)",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            textDecoration: hiddenMensas.has(m.name) ? "line-through" : "none",
          }}>
            {m.name}
          </button>
        ))}
      </div>

      {/* Status */}
      {loading && <p style={{ color: "var(--muted)" }}>Lade Menüpläne…</p>}
      {error && (
        <p style={{ color: "var(--accent)", background: "var(--accent-light)", padding: 12, borderRadius: 8 }}>
          ⚠️ Fehler: {error} — Läuft der Backend-Server auf Port 3001?
        </p>
      )}

      {/* Mensa blocks */}
      {!loading && !error && visibleMensas.map(mensa => (
        <MensaBlock key={mensa.name} mensa={mensa} dates={weekDates} mode={mode} />
      ))}
    </div>
  );
}