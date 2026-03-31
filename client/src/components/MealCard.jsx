// MealCard.jsx
export function MealCard({ meal }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      overflow: "hidden",
      marginBottom: 8,
    }}>
      {/* Image */}
      {meal.image && (
        <img
          src={meal.image}
          alt={meal.name}
          style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
          onError={e => { e.target.style.display = "none"; }} // hide if image fails to load
        />
      )}

      <div style={{ padding: "10px 14px" }}>
        {meal.line && (
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "var(--muted)", marginBottom: 4,
          }}>
            {meal.line}
          </div>
        )}
        <div style={{ fontWeight: 600, fontSize: 14 }}>{meal.name}</div>
        {meal.description && (
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
            {meal.description}
          </div>
        )}
        <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 5 }}>
          {meal.prices?.student && `CHF ${meal.prices.student} (Stud)`}
          {meal.prices?.internal && ` · ${meal.prices.internal} (Int)`}
          {meal.prices?.external && ` · ${meal.prices.external} (Ext)`}
        </div>
      </div>
    </div>
  );
}
