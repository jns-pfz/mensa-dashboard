const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
app.use(cors());

const ETH_FACILITIES = [
  { id: 9,  name: "Mensa Polyterrasse" },
  { id: 3,  name: "Clausiusbar" },
  { id: 7,  name: "Mensa Hönggerberg" },
  { id: 5,  name: "Mensa Hauptgebäude" },
  { id: 11, name: "Alumni Pavillon" },
];

function getMondayOf(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

function getWeekDates(dateStr) {
  const monday = getMondayOf(dateStr);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday + "T12:00:00");
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

// Reuse a single browser instance across requests — much faster
let browserInstance = null;
async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserInstance;
}

async function scrapeEthDay(browser, facilityId, date) {
  const url = `https://ethz.ch/de/campus/erleben/gastronomie-und-einkaufen/gastronomie/menueplaene/offerDay.html?date=${date}&id=${facilityId}`;
  const page = await browser.newPage();

  try {
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36");
    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
    await page.waitForSelector(".cp-menu", { timeout: 10000 }).catch(() => {});

    const menus = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".cp-menu")).map(el => {
        const name = el.querySelector(".cp-menu__title")?.innerText.trim() ?? "";
        const description = el.querySelector(".cp-menu__description")?.innerText.trim() ?? "";
        const line = el.querySelector(".cp-menu__line-small")?.innerText.trim() ?? "";
        const priceText = el.querySelector(".cp-menu__prices .cp-menu__paragraph")?.innerText.trim() ?? "";
        const image = el.querySelector(".cp-menu__image img")?.src ?? ""; // ← NEW

        const [student, internal, external] = priceText.split("/").map(p => p.trim());

    return { name, description, line, image, prices: { student, internal, external } };
  }).filter(m => m.name.length > 0);
});

    return menus;
  } catch (err) {
    console.error(`Puppeteer failed for facility ${facilityId} on ${date}:`, err.message);
    return [];
  } finally {
    await page.close();
  }
}

async function getEthData(dates) {
  const browser = await getBrowser();

  return Promise.all(
    ETH_FACILITIES.map(async (facility) => {
      const days = {};

      // Fetch days sequentially per facility to avoid overloading
      for (const date of dates) {
        const menus = await scrapeEthDay(browser, facility.id, date);
        if (menus.length > 0) days[date] = menus;
      }

      return { id: facility.id, name: facility.name, days };
    })
  );
}

const { XMLParser } = require("fast-xml-parser");

const UZH_VENUES = [
  { id: 509, name: "Mensa UZH Zentrum" },
  { id: 510, name: "Mensa UZH Irchel" },
  { id: 529, name: "Mensa UZH Oerlikon" },
];

async function getUzhData(date) {
  const fetch = (await import("node-fetch")).default;
  const parser = new XMLParser();

  // Figure out which weekday 1–5 the requested date is
  const d = new Date(date + "T12:00:00");
  const dayOfWeek = d.getDay(); // 0=Sun, 6=Sat
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    // Weekend — return empty
    return UZH_VENUES.map(v => ({ id: v.id, name: v.name, days: {} }));
  }

  return Promise.all(
    UZH_VENUES.map(async (venue) => {
      const url = `https://zfv.ch/de/menus/rssMenuPlan?menuId=${venue.id}&type=uzh2&dayOfWeek=${dayOfWeek}`;
      try {
        const response = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        });
        if (!response.ok) return { id: venue.id, name: venue.name, days: {} };

        const xml = await response.text();
        const parsed = parser.parse(xml);
        const items = parsed?.rss?.channel?.item;
        if (!items) return { id: venue.id, name: venue.name, days: {} };

        // items can be a single object or array
        const itemArray = Array.isArray(items) ? items : [items];

        const menus = itemArray.map(item => {
          // Title format: "MENU NAME | Ingredients"
          const titleRaw = item.title?.toString() ?? "";
          const [name, ...rest] = titleRaw.split("|");
          const description = item.description?.toString().replace(/<[^>]+>/g, "").trim() ?? rest.join("|").trim();

          return {
            name: name.trim(),
            description,
            line: "",
            image: "",
            prices: { student: null, internal: null, external: null },
          };
        }).filter(m => m.name.length > 0);

        return { id: venue.id, name: venue.name, days: { [date]: menus }, source: "UZH" };
      } catch (err) {
        console.error(`UZH fetch failed for ${venue.name}:`, err.message);
        return { id: venue.id, name: venue.name, days: {} };
      }
    })
  );
}

app.get("/api/all", async (req, res) => {
  const date = req.query.date || new Date().toISOString().split("T")[0];
  const dates = getWeekDates(date);
  const [ethData, uzhData] = await Promise.allSettled([
    getEthData(dates),
    getUzhData(date),
  ]);
  res.json({
    eth: ethData.status === "fulfilled" ? ethData.value : [],
    uzh: uzhData.status === "fulfilled" ? uzhData.value : [],
  });
});

// Debug route — shows raw scraped HTML so you can check selectors
app.get("/api/debug", async (req, res) => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.goto("https://ethz.ch/de/campus/erleben/gastronomie-und-einkaufen/gastronomie/menueplaene/offerDay.html?date=2026-04-01&id=9", {
    waitUntil: "networkidle2", timeout: 20000
  });
  const html = await page.content(); // fully rendered HTML after JS
  await page.close();
  res.send(html);
});

app.listen(3001, () => console.log("✅ Server running at http://localhost:3001"));