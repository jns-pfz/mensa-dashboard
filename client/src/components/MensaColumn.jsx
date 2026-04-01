// MensaColumn.jsx
import { MealCard } from "./MealCard";

export function MensaColumn({ mensa, date }) {
  const meals = mensa.days?.[date] || [];
  const dayLabel = new Date(date + "T12:00:00").toLocaleDateString("de-CH", {
    weekday: "short", day: "numeric", month: "short"
  });

  return (
    <div style={{
      minWidth: 220,
      maxWidth: 260,
      flex: "0 0 240px",
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--muted)",
        marginBottom: 8,
      }}>
        {dayLabel}
      </div>
      {meals.length === 0
        ? <div style={{ color: "var(--muted)", fontSize: 13 }}>Keine Angebote</div>
        : meals.map((m, i) => <MealCard key={i} meal={m} />)
      }
    </div>
  );
}