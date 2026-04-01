# Mensa Dashboard

A full-stack web application that aggregates and displays the daily food menus for ETH Zurich and University of Zurich (UZH) cafeterias. 

Because official APIs frequently change or go offline during holidays, this application utilizes a custom Node.js backend to dynamically scrape and format menu data directly from the official university websites.

---

## Features
* **Unified Dashboard:** View ETH and UZH menus side-by-side in a single React interface.
* **Custom Web Scraper:** Uses Cheerio to bypass broken/empty "Ghost APIs" and pull live text directly from ETH HTML pages.
* **Weekly Navigation:** Easily skip forward or backward to view menus for upcoming or past weeks.
* **Customizable View:** Hide or show specific Mensas based on your daily preferences.

---

## 🛠️ Tech Stack
**Frontend (`/client`)**
* React.js
* Vite (Build Tool & Dev Server)
* CSS (Custom styling)

**Backend (`/server`)**
* Node.js
* Express.js (API routing)
* Cheerio (HTML Web Scraping)
* Node-Fetch (HTTP requests)

---

## Project Structure
This repository uses a monorepo structure, separating the backend API and the frontend user interface into two distinct folders:

```text
mensa-dashboard/
├── client/          # React frontend code
│   ├── src/         # React components and hooks
│   └── package.json 
├── server/          # Node.js backend code
│   ├── index.js     # Express server and Cheerio scrapers
│   └── package.json
└── README.md        


Installation & Setup
Prerequisites
Make sure you have Node.js and Git installed on your machine.

1. Clone the repository
Bash
git clone [https://github.com/your-username/mensa-dashboard.git](https://github.com/your-username/mensa-dashboard.git)
cd mensa-dashboard
2. Install Backend Dependencies
Bash
cd server
npm install
3. Install Frontend Dependencies
Open a new terminal window/tab:

Bash
cd client
npm install


Running the App (The "Two Terminals" Rule)
Because this is a full-stack application, you must run both the backend server and the frontend interface simultaneously in two separate terminal windows.

Terminal 1: Start the Backend API

Bash
cd server
node index.js
The Express server will start on http://localhost:3001.

Terminal 2: Start the Frontend Interface

Bash
cd client
npm run dev
Vite will start the React app, usually on http://localhost:5173. Open this link in your browser to view the dashboard!

Known Issues & Architecture Notes
ETH API during Holidays: The official ETH JSON API often returns empty arrays ("undefined": []) during semester breaks. The backend bypasses this by scraping the offerDay.html pages directly.

UZH Data Source (FOOD2050): ZFV recently migrated their microsites to the FOOD2050 digital system. If the UZH API endpoints return 404 Not Found, the backend must be updated to target the new routing system.