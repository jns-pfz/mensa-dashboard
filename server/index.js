const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());

// ── Cache ────────────────────────────────────────────────────────────────────
const CACHE_DIR = path.join(__dirname, "cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
function getCacheKey(date) {
  const d = new Date(date + "T12:00:00");
  return `uzh-${d.getFullYear()}-W${String(getISOWeek(d)).padStart(2, "0")}`;
}
function readCache(key) {
  try {
    const file = path.join(CACHE_DIR, `${key}.json`);
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {}
  return null;
}
function writeCache(key, data) {
  fs.writeFileSync(path.join(CACHE_DIR, `${key}.json`), JSON.stringify(data, null, 2), "utf8");
}

// ── Config ───────────────────────────────────────────────────────────────────
const ETH_FACILITIES = [
  { id: 9,  name: "Mensa Polyterrasse" },
  { id: 3,  name: "Clausiusbar" },
  { id: 7,  name: "Mensa Hönggerberg" },
  { id: 5,  name: "Mensa Hauptgebäude" },
  { id: 11, name: "Alumni Pavillon" },
];

const UZH_VENUES = [
  { name: "Obere Mensa UZH", weeklyUrl: "https://app.food2050.ch/de/v2/zfv/universitat-zurich,campus-zentrum/obere-mensa/mittagsverpflegung/menu/weekly" },
  { name: "Untere Mensa UZH", weeklyUrl: "https://app.food2050.ch/de/v2/zfv/universitat-zurich,campus-zentrum/untere-mensa/mittagsverpflegung/menu/weekly" },
  { name: "Platte14 UZH",     weeklyUrl: "https://app.food2050.ch/de/v2/zfv/universitat-zurich,platte-14/platte-14/mittagsverpflegung/menu/weekly" },
];

// ── Date helpers ──────────────────────────────────────────────────────────────
function getMondayOf(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
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

// ── Browser ───────────────────────────────────────────────────────────────────
let browserInstance = null;
async function getBrowser() {
  if (!browserInstance || !browserInstance.connected) {
    browserInstance = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserInstance;
}

// ── ETH scraping ──────────────────────────────────────────────────────────────
async function scrapeEthDay(browser, facilityId, date) {
  const url = `https://ethz.ch/de/campus/erleben/gastronomie-und-einkaufen/gastronomie/menueplaene/offerDay.html?date=${date}&id=${facilityId}`;
  const page = await browser.newPage();
  try {
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36");
    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
    await page.waitForSelector(".cp-menu", { timeout: 10000 }).catch(() => {});

    return await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".cp-menu")).map(el => {
        const name        = el.querySelector(".cp-menu__title")?.innerText.trim() ?? "";
        const description = el.querySelector(".cp-menu__description")?.innerText.trim() ?? "";
        const line        = el.querySelector(".cp-menu__line-small")?.innerText.trim() ?? "";
        const image       = el.querySelector(".cp-menu__image img")?.src ?? "";
        const priceText   = el.querySelector(".cp-menu__prices .cp-menu__paragraph")?.innerText.trim() ?? "";
        const [student, internal, external] = priceText.split("/").map(p => p.trim());
        return {
          name, description, line, image,
          prices: { student: student || null, internal: internal || null, external: external || null },
          nutrition: null,
          climate: null,
        };
      }).filter(m => m.name.length > 0);
    });
  } catch (err) {
    console.error(`ETH scrape failed ${facilityId} ${date}:`, err.message);
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
      for (const date of dates) {
        const menus = await scrapeEthDay(browser, facility.id, date);
        if (menus.length > 0) days[date] = menus;
      }
      return { name: facility.name, days, source: "ETH" };
    })
  );
}

// ── UZH overview scraping ─────────────────────────────────────────────────────
async function scrapeUzhOverview(browser, venue) {
  const page = await browser.newPage();
  try {
    await page.goto(venue.weeklyUrl, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));

    const items = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll("a[href*='food2050.ch'][href*='/mittagsverpflegung']").forEach(a => {
        const href = a.href;
        const dateMatch = href.match(/\/(\d{4}-\d{2}-\d{2})$/);
        if (!dateMatch) return;
        const date = dateMatch[1];
        const name = a.querySelector("p")?.innerText?.trim();
        if (!name || name.length < 8) return;
        const climate = a.querySelector("circle[rating]")?.getAttribute("rating") ?? null;

        // Find the row label (farm, butcher, ying, etc.)
        let cur = a.parentElement;
        let line = "";
        for (let i = 0; i < 6; i++) {
          if (!cur) break;
          const prev = cur.previousElementSibling;
          if (prev) {
            const p = prev.querySelector("p");
            if (p && p.innerText.trim().length > 0 && p.innerText.trim().length < 30) {
              line = p.innerText.trim();
              break;
            }
          }
          cur = cur.parentElement;
        }
        results.push({ date, name, line, climate, dishUrl: href });
      });
      return results;
    });

    const days = {};
    for (const item of items) {
      if (!days[item.date]) days[item.date] = [];
      const exists = days[item.date].some(m => m.name === item.name && m.line === item.line);
      if (!exists) {
        days[item.date].push({
          name: item.name, description: "", line: item.line,
          image: "", dishUrl: item.dishUrl, climate: item.climate,
          prices: { student: null, internal: null, external: null },
          nutrition: null,
        });
      }
    }
    return days;
  } catch (err) {
    console.error(`UZH overview failed for ${venue.name}:`, err.message);
    return {};
  } finally {
    await page.close();
  }
}

// ── UZH detail scraping ───────────────────────────────────────────────────────
async function scrapeFood2050Detail(browser, dishUrl) {
  const page = await browser.newPage();
  try {
    await page.goto(dishUrl, { waitUntil: "networkidle2", timeout: 20000 });
    await new Promise(r => setTimeout(r, 1500));

    return await page.evaluate(() => {
      const text = document.body.innerText;

      // Image
      const image = document.querySelector("img[src*='storage.googleapis.com']")?.src
                 ?? document.querySelector("img[src*='dish-images']")?.src ?? "";

      // Prices — format: "6.10 CHF\nStudierende"
      const prices = { student: null, internal: null, external: null };
      const sm = text.match(/(\d+\.\d{2})\s*CHF[\s\S]{0,30}?Studierende/);
      const im = text.match(/(\d+\.\d{2})\s*CHF[\s\S]{0,30}?Mitarbeitende/);
      const em = text.match(/(\d+\.\d{2})\s*CHF[\s\S]{0,30}?Externe/);
      if (sm) prices.student  = sm[1];
      if (im) prices.internal = im[1];
      if (em) prices.external = em[1];

      // Nutrition — format: "Protein\n13.00 g\n2.59 g"
      const nutr = {};
      const cal  = text.match(/(\d+)\s*kcal/);
      const prot = text.match(/Protein[\s\S]{0,12}?(\d+\.?\d*)\s*g/);
      const fat  = text.match(/Fett[\s\S]{0,12}?(\d+\.?\d*)\s*g/);
      const carb = text.match(/Kohlenhydrate[\s\S]{0,12}?(\d+\.?\d*)\s*g/);
      const salt = text.match(/Salz[\s\S]{0,12}?(\d+\.?\d*)\s*g/);
      const wgt  = text.match(/Gesamtgewicht[\s\S]{0,12}?(\d+)\s*g/);
      if (cal)  nutr.calories = parseInt(cal[1]);
      if (prot) nutr.protein  = parseFloat(prot[1]);
      if (fat)  nutr.fat      = parseFloat(fat[1]);
      if (carb) nutr.carbs    = parseFloat(carb[1]);
      if (salt) nutr.salt     = parseFloat(salt[1]);
      if (wgt)  nutr.weight   = parseInt(wgt[1]);

      const climate = document.querySelector("circle[rating]")?.getAttribute("rating") ?? null;

      return {
        image, prices,
        nutrition: Object.keys(nutr).length > 0 ? nutr : null,
        climate,
      };
    });
  } catch (err) {
    console.error(`Detail failed: ${dishUrl.slice(-40)}`, err.message);
    return { image: "", prices: { student: null, internal: null, external: null }, nutrition: null, climate: null };
  } finally {
    await page.close();
  }
}

// ── Batch runner ──────────────────────────────────────────────────────────────
async function runInBatches(items, fn, batchSize = 4) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const res = await Promise.all(batch.map(fn));
    results.push(...res);
    console.log(`  Enriched ${Math.min(i + batchSize, items.length)}/${items.length} dishes`);
  }
  return results;
}

// ── Background enrichment ─────────────────────────────────────────────────────
const enrichmentState = {};

async function enrichUzhBackground(cacheKey, venues) {
  if (enrichmentState[cacheKey]) return;
  enrichmentState[cacheKey] = "in_progress";
  console.log(`\n🔬 Background enrichment started: ${cacheKey}`);

  try {
    const browser = await getBrowser();

    // Collect all dish references
    const allDishes = [];
    venues.forEach((venue, vi) => {
      Object.entries(venue.days).forEach(([date, meals]) => {
        meals.forEach((meal, mi) => {
          if (meal.dishUrl) allDishes.push({ vi, date, mi, dishUrl: meal.dishUrl });
        });
      });
    });

    console.log(`  ${allDishes.length} dishes to enrich across ${venues.length} mensas`);

    const details = await runInBatches(
      allDishes,
      ({ dishUrl }) => scrapeFood2050Detail(browser, dishUrl),
      4
    );

    // Merge detail data back
    allDishes.forEach((ref, i) => {
      const d    = details[i];
      const meal = venues[ref.vi].days[ref.date][ref.mi];
      if (d.image)     meal.image     = d.image;
      if (d.nutrition) meal.nutrition = d.nutrition;
      if (d.climate)   meal.climate   = d.climate;
      meal.prices = d.prices;
    });

    writeCache(cacheKey, venues);
    enrichmentState[cacheKey] = "done";
    console.log(`✅ Enrichment complete: ${cacheKey}\n`);
  } catch (err) {
    console.error("Enrichment failed:", err.message);
    delete enrichmentState[cacheKey]; // allow retry
  }
}

// ── UZH data (overview fast + enrichment in background) ──────────────────────
async function getUzhData(date) {
  const cacheKey = getCacheKey(date);
  const cached   = readCache(cacheKey);

  if (cached) {
    console.log(`✅ UZH cache hit: ${cacheKey}`);
    return { venues: cached, enriched: true };
  }

  console.log(`🔄 Scraping UZH overview: ${cacheKey}`);
  const browser = await getBrowser();

  const venues = await Promise.all(
    UZH_VENUES.map(async (venue) => {
      const days = await scrapeUzhOverview(browser, venue);
      return { name: venue.name, days, source: "UZH" };
    })
  );

  // Fire-and-forget enrichment
  enrichUzhBackground(cacheKey, JSON.parse(JSON.stringify(venues)));

  return { venues, enriched: false };
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/api/all", async (req, res) => {
  const date  = req.query.date || new Date().toISOString().split("T")[0];
  const dates = getWeekDates(date);

  const [ethResult, uzhResult] = await Promise.allSettled([
    getEthData(dates),
    getUzhData(date),
  ]);

  const cacheKey = getCacheKey(date);
  const uzh = uzhResult.status === "fulfilled" ? uzhResult.value : { venues: [], enriched: false };

  res.json({
    eth: ethResult.status === "fulfilled" ? ethResult.value : [],
    uzh: uzh.venues,
    meta: {
      uzhEnriched:        uzh.enriched,
      enrichmentStatus:   enrichmentState[cacheKey] ?? (uzh.enriched ? "done" : "idle"),
    },
  });
});

app.get("/api/cache-status", (req, res) => {
  const date     = req.query.date || new Date().toISOString().split("T")[0];
  const cacheKey = getCacheKey(date);
  const enriched = !!readCache(cacheKey);
  res.json({
    enriched,
    status: enrichmentState[cacheKey] ?? (enriched ? "done" : "idle"),
    cacheKey,
  });
});

app.listen(3001, () => console.log("✅ Server running at http://localhost:3001"));