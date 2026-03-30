// MealCard.jsx
export function MealCard({ meal }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding: "10px 14px",
      marginBottom: 8,
    }}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{meal.name}</div>
      {meal.description && (
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
          {meal.description}
        </div>
      )}
      <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 5 }}>
        {meal.prices?.student && `CHF ${meal.prices.student} (Stud)`}
        {meal.prices?.internal && ` · CHF ${meal.prices.internal} (Int)`}
        {meal.prices?.external && ` · CHF ${meal.prices.external} (Ext)`}
      </div>
    </div>
  );
}