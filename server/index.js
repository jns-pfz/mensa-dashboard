const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());

// ─── ETH Mensa facility IDs ───────────────────────────────────────────────────
const ETH_FACILITIES = [
  { id: 9,  name: "Mensa Polyterrasse" },
  { id: 3,  name: "Clausiusbar" },
  { id: 7,  name: "Mensa Hönggerberg" },
  { id: 5,  name: "Mensa Hauptgebäude" },
  { id: 11, name: "Alumni Pavillon" },
];

// ─── UZH / ZFV venue IDs ─────────────────────────────────────────────────────
// ZFV API powers most UZH mensas
const UZH_VENUES = [
  { id: "mensa-uzh-zentrum",  name: "Mensa UZH Zentrum" },
  { id: "mensa-uzh-irchel",   name: "Mensa UZH Irchel" },
  { id: "mensa-uzh-binz",     name: "Mensa UZH Binzmühle" },
];

// ─── Helper: get Monday of a given date's week ───────────────────────────────
function getMondayOf(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

// ─── Route: ETH menus for a full week ────────────────────────────────────────
app.get("/api/eth", async (req, res) => {
  const date = req.query.date || new Date().toISOString().split("T")[0];
  const monday = getMondayOf(date);

  try {
    const results = await Promise.all(
      ETH_FACILITIES.map(async (facility) => {
        // Calculate the Friday of the week for valid-before
        const fridayDate = new Date(monday);
        fridayDate.setDate(fridayDate.getDate() + 4);
        const friday = fridayDate.toISOString().split("T")[0];

        const url = `https://idapps.ethz.ch/cookpit-pub-services/v1/weeklyrotas` +
          `?client-id=ethz-wcms&lang=de&rs-first=0&rs-size=50` +
         `&valid-after=${monday}&valid-before=${friday}&facility=${facility.id}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`ETH fetch failed for ${facility.name}`);
        const data = await response.json();

        // Parse the nested structure into a flat day→meals map
        const days = {};
        const rotas = data["weekly-rota-array"]?.[0]?.["day-of-week-array"] || [];
        for (const day of rotas) {
          const dateKey = day["day-date"]; // e.g. "2026-03-30"
          days[dateKey] = (day["opening-hour-array"] || []).flatMap((oh) =>
            (oh["meal-array"] || []).map((meal) => ({
              name: meal["name"],
              description: meal["description"] || "",
              prices: {
                student: meal["meal-price-array"]?.find(p => p["customer-group-desc-short"] === "Stud")?.["price"],
                internal: meal["meal-price-array"]?.find(p => p["customer-group-desc-short"] === "Int")?.["price"],
                external: meal["meal-price-array"]?.find(p => p["customer-group-desc-short"] === "Ext")?.["price"],
              },
            }))
          );
        }

        return { id: facility.id, name: facility.name, days };
      })
    );

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Route: UZH menus for a full week ────────────────────────────────────────
app.get("/api/uzh", async (req, res) => {
  const date = req.query.date || new Date().toISOString().split("T")[0];
  const monday = getMondayOf(date);

  try {
    const results = await Promise.all(
      UZH_VENUES.map(async (venue) => {
        // ZFV public menu plan endpoint
        const url = `https://zfv.ch/en/microsites/menueplaene/${venue.id}/menu-plan?date=${monday}`;
        const response = await fetch(url, {
          headers: { "Accept": "application/json" }
        });

        if (!response.ok) {
          // ZFV often returns HTML pages — return empty if it fails
          return { id: venue.id, name: venue.name, days: {}, error: "Unavailable" };
        }

        const data = await response.json();

        // ZFV structure: data.menuLines[].menus[]{date, name, prices}
        const days = {};
        for (const line of (data.menuLines || [])) {
          for (const menu of (line.menus || [])) {
            const d = menu.date?.split("T")[0];
            if (!d) continue;
            if (!days[d]) days[d] = [];
            days[d].push({
              name: menu.name || line.name || "Menu",
              description: menu.description || "",
              prices: {
                student: menu.prices?.find(p => p.name === "Studierende")?.value,
                internal: menu.prices?.find(p => p.name === "Intern")?.value,
                external: menu.prices?.find(p => p.name === "Extern")?.value,
              },
            });
          }
        }

        return { id: venue.id, name: venue.name, days };
      })
    );

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Combined route ───────────────────────────────────────────────────────────
app.get("/api/all", async (req, res) => {
  const date = req.query.date || new Date().toISOString().split("T")[0];
  const [ethData, uzhData] = await Promise.allSettled([
    fetch(`http://localhost:3001/api/eth?date=${date}`).then(r => r.json()),
    fetch(`http://localhost:3001/api/uzh?date=${date}`).then(r => r.json()),
  ]);

  res.json({
    eth: ethData.status === "fulfilled" ? ethData.value : [],
    uzh: uzhData.status === "fulfilled" ? uzhData.value : [],
  });
});

app.listen(3001, () => console.log("✅ Server running at http://localhost:3001"));