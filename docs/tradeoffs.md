# Technical Trade-offs & Design Decisions

This document outlines key technical decisions made during the design and implementation of the URL Shortener Dashboard, comparing alternatives and detailing trade-offs.

---

## 1. Database Layer: Postgres with Programmatic SQLite Fallback

### Chosen Approach
Implement a `DbService` repository interface. The system default is PostgreSQL, but if it encounters connection timeouts or missing drivers, it catches the error, initializes a local SQLite file (`database.sqlite`), and continues.

| Option | Pros | Cons |
| :--- | :--- | :--- |
| **PostgreSQL Only** | - Highly scalable, robust analytical grouping.<br>- Strict transactional integrity. | - Requires Docker or local PostgreSQL instance to run the application at all. |
| **SQLite Only** | - Zero external configuration.<br>- Easy file-based backups. | - Does not scale horizontally under heavy write loads. |
| **Dynamic Fallback (Chosen)** | - **Zero-Setup out of the box** (runs anywhere without database commands).<br>- Instantly compatible with production Docker/PostgreSQL when deployed. | - Repository code must translate SQL dialects and handle DB drivers dynamically. |

---

## 2. Caching Layer: Redis with In-Memory Map Fallback

### Chosen Approach
Redirections query an in-memory cache first. The cache service attempts to establish a connection to Redis, falling back to a local Javascript `Map` object (with standard key-expiry TTL pruning) if Redis is unavailable.

### Why this is used
A database read, even if indexed, takes $5\text{ms}$ to $20\text{ms}$ on PostgreSQL. On SQLite, file-read operations can block the event loop. Querying Redis or the in-memory Map takes $<1\text{ms}$, ensuring the redirections execute under $100\text{ms}$ (typically $<15\text{ms}$).
If Redis fails, fallback Map caching avoids taking the service offline while preserving fast response times.

---

## 3. Analytics Processing: Asynchronous & Non-Blocking

### Chosen Approach
Redirections execute immediately (HTTP 302). Visit analytics (parsing browser agent, resolving country via `ip-api.com` with a short 2-second timeout, and checking databases) are executed asynchronously in a background promise.

```
Request Received ──> Cache Check ──> HTTP 302 (Redirect) ──> Client browser loads original URL
                                             │
                                             └───> (Async Background) Geolocation lookup & DB Write
```

### Trade-off analysis
* **Synchronous Analytics:** Easy to write and guarantees that if redirection succeeds, the analytic record *must* be in the database. However, calling external APIs or writing to disks synchronously pushes redirect times to $500\text{ms} - 3000\text{ms}$, causing noticeable lag for users.
* **Asynchronous Analytics (Chosen):** Prioritizes user experience by redirecting immediately. The redirection time stays $<100\text{ms}$. In extreme failure cases (e.g. system crashes in the middle of a redirection), a click analytic row might be lost, but the user is never slowed down. This is the standard trade-off in production systems.

---

## 4. Code Generation: Random Base62 check vs Auto-Increment base-10 conversion

### Chosen Approach
For new links, the system generates a 6-character random Base62 code and verifies uniqueness using a collision-check loop (retrying up to 5 times if a collision occurs).

### Rationale
* **Auto-Increment Base-10 (e.g. 1 -> `1`, 2 -> `2`):** Easy to implement and mathematically guarantees no collisions. However, it makes short URLs highly predictable (e.g., users can guess `/r/1`, `/r/2` to access other campaign links), posing a business privacy risk.
* **Random Base62 (Chosen):** Maximizes security and density. A 6-character code yields $62^6 \approx 56.8 \text{ billion}$ combinations, making URLs completely non-predictable. The potential collision rate is mitigated by the 5-attempt uniqueness check before database insertion.

---

## 5. UI Architecture: Simple React State vs React Router

### Chosen Approach
The dashboard switches between list and analytics panels by toggling a component-level string state (`view: "dashboard" | "analytics"`) rather than importing `react-router-dom`.

### Rationale
* Keeps the build bundle lightweight ($579\text{kB}$ total with Recharts).
* Avoids complex history sync and route matching overhead.
* Maintains the single-page control panel requirement, ensuring transitions feel instantaneous.
