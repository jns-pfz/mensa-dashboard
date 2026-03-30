const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());

const ETH_FACILITIES = [
  { id: 9,  name: "Mensa Polyterrasse" },
  { id: 3,  name: "Clausiusbar" },
  { id: 7,  name: "Mensa Hönggerberg" },
  { id: 5,  name: "Mensa Hauptgebäude" },
  { id: 11, name: "Alumni Pavillon" },
];

const UZH_VENUES = [
  { id: "mensa-uzh-zentrum",  name: "Mensa UZH Zentrum" },
  { id: "mensa-uzh-irchel",   name: "Mensa UZH Irchel" },
  { id: "mensa-uzh-binz",     name: "Mensa UZH Binzmühle" },
];

function getMondayOf(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay(); 
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

// 1. EXTRACT ETH LOGIC INTO A FUNCTION
async function getEthData(date) {
  const monday = getMondayOf(date);
  return Promise.all(
    ETH_FACILITIES.map(async (facility) => {
      const fridayDate = new Date(monday);
      fridayDate.setDate(fridayDate.getDate() + 4);
      const friday = fridayDate.toISOString().split("T")[0];

      const url = `https://idapps.ethz.ch/cookpit-pub-services/v1/weeklyrotas?client-id=ethz-wcms&lang=de&rs-first=0&rs-size=50&valid-after=${monday}&valid-before=${friday}&facility=${facility.id}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`ETH fetch failed for ${facility.name}`);
      const data = await response.json();

      const days = {};
      const rotas = data["weekly-rota-array"]?.[0]?.["day-of-week-array"] || [];
      for (const day of rotas) {
        const dateKey = day["day-date"]; 
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
}

// 2. EXTRACT UZH LOGIC INTO A FUNCTION
async function getUzhData(date) {
  const monday = getMondayOf(date);
  return Promise.all(
    UZH_VENUES.map(async (venue) => {
      const url = `https://zfv.ch/en/microsites/menueplaene/${venue.id}/menu-plan?date=${monday}`;
      const response = await fetch(url, { headers: { "Accept": "application/json" } });

      if (!response.ok) {
        return { id: venue.id, name: venue.name, days: {}, error: "Unavailable" };
      }

      const data = await response.json();
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
}


// 3. USE THE FUNCTIONS IN YOUR ROUTES
app.get("/api/eth", async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split("T")[0];
    res.json(await getEthData(date));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/uzh", async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split("T")[0];
    res.json(await getUzhData(date));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/all", async (req, res) => {
  const date = req.query.date || new Date().toISOString().split("T")[0];
  
  // Call the functions directly instead of using fetch()
  const [ethData, uzhData] = await Promise.allSettled([
    getEthData(date),
    getUzhData(date),
  ]);

  res.json({
    eth: ethData.status === "fulfilled" ? ethData.value : [],
    uzh: uzhData.status === "fulfilled" ? uzhData.value : [],
  });
});

app.listen(3001, () => console.log("✅ Server running at http://localhost:3001"));