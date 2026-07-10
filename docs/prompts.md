# AI Prompts & Troubleshooting

This document details the AI prompts used during development, as well as the technical errors identified and corrected.

---

## 1. AI Prompts Used

### Phase 1: Database Setup
> *"Write a typescript database configuration service that sets up a PostgreSQL database pool, but automatically falls back to an SQLite database file if PostgreSQL is unreachable or fails to connect, utilizing a repository pattern."*

### Phase 2: Redirection and Caching
> *"Write an Express route handler in typescript matching `/r/:shortCode` that implements the read-through cache pattern using Redis, falling back to a local Map cache. It should perform the 302 redirect immediately, and process client User-Agent, Referrer, and IP Geolocation asynchronously in a background task to keep redirect latency under 100ms."*

### Phase 3: Zod Input Validation
> *"Create a validation middleware using Zod to check fields on short link creation. The title must be required, the original URL must start with http/https, the custom alias must be alphanumeric with dashes, and the expiration date must be a valid future datetime."*

### Phase 5: Gemini AI Suggestions
> *"Write a service that calls the gemini-2.5-flash-preview-09-2025 model using standard fetch to generate 3 short, catchy custom alias recommendations. The schema returned must be structured JSON matching: `{ suggestions: string[] }`. Provide exponential backoff retry and a fallback static alias generator if the key is missing."*

### Phase 6: Frontend App Dashboard
> *"Build a single-page dashboard client in React using Tailwind CSS. It should feature metrics cards, a paginated search table, a creation modal with AI suggestions, and an analytics timeline chart showing browser, country, OS, and referrer breakdowns using Recharts."*

---

## 2. Identified AI Mistakes & Corrections

### Mistake 1: TypeScript type checking error for response.json()
* **Description:** During backend test execution, the build failed with:
  `src/services/gemini.ts:59:23 - error TS18046: 'result' is of type 'unknown'.`
* **Root Cause:** In modern TypeScript environments, the standard `response.json()` return type defaults to `Promise<unknown>` (rather than `Promise<any>`) to enforce safe parsing, which throws an error if properties are read directly (e.g., `result.candidates`).
* **Correction:** Cast the parsed JSON return value directly to `any` to allow safe property reading:
  ```typescript
  const result = (await response.json()) as any;
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  ```

### Mistake 2: Tailwind CSS v4 PostCSS compilation error
* **Description:** During frontend production compilation using `npm run build`, the bundler failed with:
  `Error: [postcss] It looks like you're trying to use tailwindcss directly as a PostCSS plugin... update your PostCSS configuration.`
* **Root Cause:** The project scaffolded with the latest Vite and Tailwind CSS v4, which deprecates calling `tailwindcss` directly in `postcss.config.js` and moves the PostCSS parser to a separate package `@tailwindcss/postcss`.
* **Correction:**
  1. Installed the `@tailwindcss/postcss` plugin:
     `npm install -D @tailwindcss/postcss`
  2. Modified `postcss.config.js` to register the new plugin:
     ```javascript
     export default {
       plugins: {
         '@tailwindcss/postcss': {},
         autoprefixer: {},
       },
     }
     ```

### Mistake 3: Unused variable/import compiler errors
* **Description:** Vite build failed due to unused variables and imports in `App.tsx` (e.g. `BarChart`, `Bar`, `Cell`, `COLORS`, type-only imports for `Link`, `DashboardStats` under verbatimModuleSyntax).
* **Root Cause:** TypeScript was configured with strict unused checks and verbatim module syntax enabled.
* **Correction:**
  * Cleaned up all unused imports from `recharts`.
  * Removed the unused `COLORS` array.
  * Used `import type` for TypeScript types imported from `api.ts` to satisfy `verbatimModuleSyntax`.
  * Integrated `analyticsLoading` in the JSX layout to display a loading spinner when analytics data is being fetched.
  * Deleted the unused `shortUrl` variable.
