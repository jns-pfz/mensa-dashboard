// MensaBlock.jsx
import { MensaColumn } from "./MensaColumn";

export function MensaBlock({ mensa, dates, mode }) {
  const displayDates = mode === "today" ? [dates[0]] : dates;
  // In today mode, use today's real date (dates[0] might be Monday)
  const todayStr = new Date().toISOString().split("T")[0];
  const activeDates = mode === "today" ? [todayStr] : dates;

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding: "18px 20px",
      marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase",
          background: mensa.source === "ETH" ? "#1a3a6e" : "#a0282a",
          color: "#fff",
          padding: "2px 8px",
          borderRadius: 4,
        }}>
          {mensa.source}
        </span>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{mensa.name}</span>
      </div>

      {/* Meals */}
      <div style={{ display: "flex", gap: 20, overflowX: "auto", paddingBottom: 4 }}>
        {activeDates.map(date => (
          <MensaColumn key={date} mensa={mensa} date={date} />
        ))}
      </div>
    </div>
  );
}