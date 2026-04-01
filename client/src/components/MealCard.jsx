const CLIMATE_COLOR  = { LOW: "#4caf50", MEDIUM: "#ff9800", HIGH: "#f44336" };
const CLIMATE_LABEL  = { LOW: "🌱 Klimafreundlich", MEDIUM: "🌿 Mittel", HIGH: "⚠️ Hoch" };

export function MealCard({ meal, highlight = false, showMensa = false }) {
  const climateColor = CLIMATE_COLOR[meal.climate] ?? "#bbb";
  const n = meal.nutrition;
  const total = n ? (n.protein ?? 0) + (n.carbs ?? 0) + (n.fat ?? 0) : 0;
  const pPct  = total > 0 ? ((n.protein ?? 0) / total * 100).toFixed(0) : 0;
  const cPct  = total > 0 ? ((n.carbs   ?? 0) / total * 100).toFixed(0) : 0;
  const fPct  = total > 0 ? ((n.fat     ?? 0) / total * 100).toFixed(0) : 0;

  return (
    <div style={{
      background:    "var(--surface)",
      border:        highlight ? "2px solid var(--accent)" : "1px solid var(--border)",
      borderRadius:  "var(--radius)",
      overflow:      "hidden",
      marginBottom:  8,
    }}>

      {/* Highlight banner */}
      {highlight && (
        <div style={{
          background: "var(--accent)", color: "#fff",
          fontSize: 11, fontWeight: 700,
          padding: "4px 12px", textAlign: "center", letterSpacing: "0.08em",
        }}>
          🏆 MEISTE PROTEINE HEUTE
        </div>
      )}

      {/* Mensa source badge (shown in sorted flat view) */}
      {showMensa && (
        <div style={{
          background: meal.source === "ETH" ? "#1a3a6e" : "#7b1fa2",
          color: "#fff", fontSize: 11, fontWeight: 700,
          padding: "3px 10px", letterSpacing: "0.05em",
        }}>
          {meal.source} · {meal.mensaName}
        </div>
      )}

      {/* Image */}
      {meal.image && (
        <img src={meal.image} alt={meal.name}
          style={{ width: "100%", height: 130, objectFit: "cover", display: "block" }}
          onError={e => { e.target.style.display = "none"; }} />
      )}

      <div style={{ padding: "10px 14px" }}>

        {/* Top row: line label + climate badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          {meal.line && (
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.1em", color: "var(--muted)",
            }}>
              {meal.line}
            </span>
          )}
          {meal.climate && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              background: climateColor + "22", color: climateColor,
              border: `1px solid ${climateColor}`,
              borderRadius: 10, padding: "1px 7px",
            }}>
              {CLIMATE_LABEL[meal.climate]}
            </span>
          )}
        </div>

        {/* Name */}
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{meal.name}</div>

        {/* Description */}
        {meal.description && (
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, lineHeight: 1.4 }}>
            {meal.description}
          </div>
        )}

        {/* Prices */}
        {(meal.prices?.student || meal.prices?.internal) && (
          <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 6 }}>
            {[
              meal.prices.student  && `CHF ${meal.prices.student}`,
              meal.prices.internal && `${meal.prices.internal}`,
              meal.prices.external && `${meal.prices.external}`,
            ].filter(Boolean).join(" / ")}
            <span style={{ color: "var(--muted)", fontWeight: 400, marginLeft: 4 }}>
              Stud / Int / Ext
            </span>
          </div>
        )}

        {/* Nutrition */}
        {n ? (
          <div style={{ marginTop: 6 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, marginBottom: 5 }}>
              {n.calories != null && (
                <span style={{ color: "var(--muted)" }}>🔥 {n.calories} kcal</span>
              )}
              {n.protein != null && (
                <span style={{ fontWeight: 700, color: "#c0392b" }}>🥩 {n.protein}g Protein</span>
              )}
              {n.carbs != null && (
                <span style={{ color: "var(--muted)" }}>🌾 {n.carbs}g KH</span>
              )}
              {n.fat != null && (
                <span style={{ color: "var(--muted)" }}>🧈 {n.fat}g Fett</span>
              )}
            </div>
            {/* Macro bar: red=protein, yellow=carbs, blue=fat */}
            {total > 0 && (
              <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", gap: 1 }}>
                <div style={{ width: `${pPct}%`, background: "#c0392b", borderRadius: "3px 0 0 3px" }} />
                <div style={{ width: `${cPct}%`, background: "#f39c12" }} />
                <div style={{ width: `${fPct}%`, background: "#3498db", borderRadius: "0 3px 3px 0" }} />
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, fontStyle: "italic" }}>
            Nährwerte werden geladen…
          </div>
        )}
      </div>
    </div>
  );
}