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
  {
    name: "Obere Mensa UZH",
    weeklyUrl: "https://app.food2050.ch/de/v2/zfv/universitat-zurich,campus-zentrum/obere-mensa/mittagsverpflegung/menu/weekly"
  },
  {
    name: "Untere Mensa UZH",
    weeklyUrl: "https://app.food2050.ch/de/v2/zfv/universitat-zurich,campus-zentrum/untere-mensa/mittagsverpflegung/menu/weekly"
  },
  {
    name: "Platte14 UZH",
    weeklyUrl: "https://app.food2050.ch/de/v2/zfv/universitat-zurich,platte-14/platte-14/mittagsverpflegung/menu/weekly"
  },
];

async function scrapeFood2050Weekly(browser, venue) {
  const page = await browser.newPage();
  try {
    await page.goto(venue.weeklyUrl, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));

    const menus = await page.evaluate(() => {
      const results = [];

      document.querySelectorAll("a[href*='food2050.ch'][href*='/mittagsverpflegung']").forEach(a => {
        const href = a.href;

        // Extract date from end of URL e.g. .../2026-04-01
        const dateMatch = href.match(/\/(\d{4}-\d{2}-\d{2})$/);
        if (!dateMatch) return;
        const date = dateMatch[1];

        // Dish name is in the first <p> inside the link
        const name = a.querySelector("p")?.innerText?.trim();
        if (!name || name.length < 3) return;

        // Skip placeholder entries like "Karfreitag", "Feiertag" etc.
        if (name.length < 8 && !name.includes(" ")) return;

        // Menu line label: go up to the row div, grab its first <p>
        // Structure: rowDiv > [labelDiv > p.label, dayCell > a, dayCell > a, ...]
        // Walk up until we find a sibling that has the label
        let rowEl = a.parentElement; // the day cell div
        while (rowEl && !rowEl.previousElementSibling?.querySelector("p")) {
          rowEl = rowEl.parentElement;
        }
        const line = rowEl?.previousElementSibling?.querySelector("p")?.innerText?.trim() ?? "";

        results.push({ date, name, line });
      });

      return results;
    });

    // Group by date
    const days = {};
    for (const item of menus) {
      if (!days[item.date]) days[item.date] = [];
      // Deduplicate — same dish can appear in multiple DOM nodes
      const exists = days[item.date].some(m => m.name === item.name && m.line === item.line);
      if (!exists) {
        days[item.date].push({
          name: item.name,
          description: "",
          line: item.line,
          image: "",
          prices: { student: null, internal: null, external: null },
        });
      }
    }

    return days;
  } catch (err) {
    console.error(`food2050 scrape failed for ${venue.name}:`, err.message);
    return {};
  } finally {
    await page.close();
  }
}

async function getUzhData() {
  const browser = await getBrowser();
  return Promise.all(
    UZH_VENUES.map(async (venue) => {
      const days = await scrapeFood2050Weekly(browser, venue);
      return { name: venue.name, days, source: "UZH" };
    })
  );
}

app.get("/api/debug-uzh", async (req, res) => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.goto("https://app.food2050.ch/de/v2/zfv/universitat-zurich,campus-zentrum/obere-mensa/mittagsverpflegung/menu/weekly", {
    waitUntil: "networkidle2", timeout: 30000
  });
  await new Promise(r => setTimeout(r, 4000));
  const html = await page.content();
  await page.close();
  res.send(html);
});

app.get("/api/debug-uzh2", async (req, res) => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.goto("https://app.food2050.ch/de/v2/zfv/universitat-zurich,campus-zentrum/untere-mensa", {
    waitUntil: "networkidle2", timeout: 30000
  });
  await new Promise(r => setTimeout(r, 3000));
  const html = await page.content();
  await page.close();
  res.send(html);
});

app.get("/api/debug-uzh3", async (req, res) => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.goto("https://app.food2050.ch/de/v2/zfv/universitat-zurich,campus-zentrum/platte-14", {
    waitUntil: "networkidle2", timeout: 30000
  });
  await new Promise(r => setTimeout(r, 3000));
  const html = await page.content();
  await page.close();
  res.send(html);
});

app.get("/api/all", async (req, res) => {
  const date = req.query.date || new Date().toISOString().split("T")[0];
  const dates = getWeekDates(date);
  const [ethData, uzhData] = await Promise.allSettled([
    getEthData(dates),
    getUzhData(),   // ← no argument needed anymore
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