# LinkCraft AI ⚡

**LinkCraft AI** is an enterprise-grade, lightweight URL shortening platform built for marketing campaigns. It maps raw, UTM-heavy URLs to optimized custom aliases (e.g., `http://localhost:5000/r/summer-sale`) and provides a live analytical dashboard to track campaign engagement (click counts, browsers, operating systems, referrers, and country demographics).

To support high-concurrency needs, redirections leverage a **Read-Through Cache-Aside** pattern and execute visit analytics asynchronously, maintaining redirect latencies under **100ms**.

---

## 🚀 Key Features

* **Sub-100ms Redirection:** Lookups hit Redis/Map first, bypassing relational database reads.
* **Asynchronous Analytics:** Visit logging (User-Agent parses, IP country mappings) runs in a background thread to prevent blocking redirects.
* **AI-Powered Custom Aliases:** Directly integrates with **Gemini 2.5 Flash** to suggest SEO-friendly marketing aliases based on target URLs and titles.
* **Graceful Degradation:** The application degrades gracefully automatically:
  * Falls back to a local **SQLite** database if PostgreSQL is unreachable.
  * Falls back to an **In-Memory Map** cache if Redis is unreachable.
  * Falls back to **Programmatic SEO** suggestions if the Gemini API Key is missing.
* **Administrative Control Panel:** A single-page dashboard to search, create, edit, deactivate, and soft-delete short links (no full page refreshes).
* **Demographic Metrics:** Group clicks by browser, operating system, origin referrer, country geolocation, and daily timeline trends.

---

## 🛠️ Tech Stack

* **Frontend:** React, Tailwind CSS, Lucide Icons, Recharts, Vite.
* **Backend:** Node.js, Express, TypeScript, Zod validation, Jest, Supertest.
* **Databases:** PostgreSQL (Relational storage), SQLite (fallback).
* **Caching:** Redis (Key-value cache), JavaScript Map (fallback).
* **AI Model:** Gemini 2.5 Flash (`gemini-2.5-flash-preview-09-2025`).

---

## 📂 Project Structure

```
.
├── docker-compose.yml         # Container declarations for Postgres and Redis
├── README.md                  # Main guide and instructions
├── docs/                      # Technical documentation
│   ├── approach.md            # Problem understanding, database modeling and phase list
│   ├── architecture.md        # Architecture overview and low-latency redirect sequence
│   ├── tradeoffs.md           # Engineering tradeoffs and design decisions
│   ├── prompts.md             # AI prompts and developer bug fixes
│   └── api.md                 # REST API endpoints specifications
├── backend/                   # Node.js/Express API Application
│   ├── src/
│   │   ├── config/            # PostgreSQL, SQLite, and env configurations
│   │   ├── controllers/       # HTTP Controller logic
│   │   ├── middleware/        # Schema validators (Zod)
│   │   ├── routes/            # REST API route mappings
│   │   ├── services/          # Redis Cache & Gemini AI interfaces
│   │   ├── utils/             # Geolocation, UA, and Base62 converters
│   │   └── app.ts             # Express application bootstrapper
│   └── package.json
└── frontend/                  # React Single-Page Application
    ├── src/
    │   ├── utils/             # REST communications client
    │   ├── App.tsx            # Navigation, tables, charts, and modal views
    │   └── index.css          # Tailwind CSS style variables
    └── package.json
```

---

## ⚙️ Quick Start (Local Run)

The application features **dynamic fallbacks** that allow it to run out-of-the-box using local SQLite and Memory Map cache, requiring **no Docker or Postgres installation**.

### 1. Configure the Environment
Copy the example environment variables in the `backend/` directory:
```bash
cp backend/.env.example backend/.env
```
*(Optionally populate `GEMINI_API_KEY` to test the AI custom alias recommendations)*

### 2. Start the Backend
Navigate to the `backend/` directory, install dependencies, and start the development server:
```bash
cd backend
npm install
npm run dev
```
The server will boot on `http://localhost:5000`. You will see console logs confirming the database fallback:
`Database: Local SQLite fallback initialized successfully.`
`Cache: In-Memory Cache initialized.`

### 3. Start the Frontend
In a new terminal window, navigate to the `frontend/` directory, install dependencies, and start the Vite dev server:
```bash
cd frontend
npm install
npm run dev
```
The UI dashboard will open on `http://localhost:5173`.

---

## 🐳 Docker Deployment (Postgres + Redis)

To run the application in a production-ready container environment:

1. Spin up the database and caching containers:
   ```bash
   docker-compose up -d
   ```
2. The Node.js Express server will automatically detect PostgreSQL and Redis on start:
   `Database: PostgreSQL initialized successfully.`
   `Cache: Redis Cache initialized successfully.`

---

## 🧪 Testing

The backend includes a comprehensive integration test suite validating Zod schemas, database CRUD, cache settings, URL redirection, and soft deletion. Tests use SQLite-in-memory to run instantly and independently.

Run the tests inside the `backend/` folder:
```bash
cd backend
npm test
```
*(All 16 test cases execute and pass successfully)*
