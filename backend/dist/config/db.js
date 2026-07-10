"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const pg_1 = require("pg");
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// PostgreSQL Implementation
class PostgresDbService {
    pool;
    constructor() {
        this.pool = new pg_1.Pool({
            connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/shortener"
        });
    }
    async initialize() {
        const createLinksTable = `
      CREATE TABLE IF NOT EXISTS links (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        original_url TEXT NOT NULL,
        short_code VARCHAR(50) UNIQUE NOT NULL,
        custom_alias VARCHAR(50) UNIQUE,
        is_active BOOLEAN DEFAULT TRUE,
        expires_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL
      );
    `;
        const createClicksTable = `
      CREATE TABLE IF NOT EXISTS clicks (
        id SERIAL PRIMARY KEY,
        link_id INTEGER REFERENCES links(id) ON DELETE CASCADE,
        clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        browser VARCHAR(100),
        operating_system VARCHAR(100),
        country VARCHAR(100),
        referrer VARCHAR(255)
      );
    `;
        const createShortCodeIndex = `
      CREATE INDEX IF NOT EXISTS idx_links_short_code ON links(short_code) WHERE deleted_at IS NULL;
    `;
        const createAliasIndex = `
      CREATE INDEX IF NOT EXISTS idx_links_alias ON links(custom_alias) WHERE deleted_at IS NULL;
    `;
        await this.pool.query(createLinksTable);
        await this.pool.query(createClicksTable);
        await this.pool.query(createShortCodeIndex);
        await this.pool.query(createAliasIndex);
    }
    async close() {
        await this.pool.end();
    }
    parseLink(row) {
        return {
            id: row.id,
            title: row.title,
            original_url: row.original_url,
            short_code: row.short_code,
            custom_alias: row.custom_alias,
            is_active: row.is_active,
            expires_at: row.expires_at ? new Date(row.expires_at) : null,
            created_at: new Date(row.created_at),
            deleted_at: row.deleted_at ? new Date(row.deleted_at) : null
        };
    }
    async createLink(title, originalUrl, shortCode, customAlias, expiresAt) {
        const query = `
      INSERT INTO links (title, original_url, short_code, custom_alias, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
        const res = await this.pool.query(query, [title, originalUrl, shortCode, customAlias, expiresAt]);
        return this.parseLink(res.rows[0]);
    }
    async getLinkById(id) {
        const res = await this.pool.query("SELECT * FROM links WHERE id = $1 AND deleted_at IS NULL", [id]);
        return res.rows.length ? this.parseLink(res.rows[0]) : null;
    }
    async getLinkByCode(shortCode) {
        const res = await this.pool.query("SELECT * FROM links WHERE short_code = $1 AND deleted_at IS NULL", [shortCode]);
        return res.rows.length ? this.parseLink(res.rows[0]) : null;
    }
    async getLinkByAlias(alias) {
        const res = await this.pool.query("SELECT * FROM links WHERE custom_alias = $1 AND deleted_at IS NULL", [alias]);
        return res.rows.length ? this.parseLink(res.rows[0]) : null;
    }
    async listLinks(options) {
        let whereClause = "WHERE l.deleted_at IS NULL";
        const params = [];
        if (options.search) {
            params.push(`%${options.search}%`);
            whereClause += ` AND (l.title ILIKE $${params.length} OR l.original_url ILIKE $${params.length})`;
        }
        const countQuery = `SELECT COUNT(*) FROM links l ${whereClause}`;
        const countRes = await this.pool.query(countQuery, params);
        const total = parseInt(countRes.rows[0].count);
        params.push(options.limit);
        const limitParam = params.length;
        params.push(options.offset);
        const offsetParam = params.length;
        const query = `
      SELECT l.*, COUNT(c.id)::int as click_count
      FROM links l
      LEFT JOIN clicks c ON l.id = c.link_id
      ${whereClause}
      GROUP BY l.id
      ORDER BY l.created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;
        const res = await this.pool.query(query, params);
        const links = res.rows.map((row) => ({
            ...this.parseLink(row),
            click_count: row.click_count
        }));
        return { links, total };
    }
    async updateLink(id, data) {
        const fields = [];
        const params = [];
        let paramIndex = 1;
        Object.entries(data).forEach(([key, val]) => {
            if (val !== undefined) {
                fields.push(`${key} = $${paramIndex}`);
                params.push(val);
                paramIndex++;
            }
        });
        params.push(id);
        const query = `
      UPDATE links
      SET ${fields.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
        const res = await this.pool.query(query, params);
        if (!res.rows.length) {
            throw new Error(`Link not found: ${id}`);
        }
        return this.parseLink(res.rows[0]);
    }
    async softDeleteLink(id) {
        const res = await this.pool.query("UPDATE links SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id", [id]);
        return res.rows.length > 0;
    }
    async recordClick(linkId, browser, os, country, referrer) {
        const query = `
      INSERT INTO clicks (link_id, browser, operating_system, country, referrer)
      VALUES ($1, $2, $3, $4, $5)
    `;
        await this.pool.query(query, [linkId, browser, os, country, referrer]);
    }
    async getLinkAnalytics(linkId) {
        const dateQuery = `
      SELECT TO_CHAR(clicked_at, 'YYYY-MM-DD') as date, COUNT(*)::int as count
      FROM clicks
      WHERE link_id = $1
      GROUP BY date
      ORDER BY date ASC
      LIMIT 30
    `;
        const browserQuery = `
      SELECT browser, COUNT(*)::int as count
      FROM clicks
      WHERE link_id = $1
      GROUP BY browser
      ORDER BY count DESC
    `;
        const osQuery = `
      SELECT operating_system as os, COUNT(*)::int as count
      FROM clicks
      WHERE link_id = $1
      GROUP BY os
      ORDER BY count DESC
    `;
        const countryQuery = `
      SELECT country, COUNT(*)::int as count
      FROM clicks
      WHERE link_id = $1
      GROUP BY country
      ORDER BY count DESC
    `;
        const referrerQuery = `
      SELECT referrer, COUNT(*)::int as count
      FROM clicks
      WHERE link_id = $1
      GROUP BY referrer
      ORDER BY count DESC
    `;
        const [dates, browsers, os, countries, referrers] = await Promise.all([
            this.pool.query(dateQuery, [linkId]),
            this.pool.query(browserQuery, [linkId]),
            this.pool.query(osQuery, [linkId]),
            this.pool.query(countryQuery, [linkId]),
            this.pool.query(referrerQuery, [linkId])
        ]);
        return {
            clicksByDate: dates.rows,
            clicksByBrowser: browsers.rows,
            clicksByOS: os.rows,
            clicksByCountry: countries.rows,
            clicksByReferrer: referrers.rows
        };
    }
    async getDashboardStats() {
        const totalLinksRes = await this.pool.query("SELECT COUNT(*) FROM links WHERE deleted_at IS NULL");
        const totalClicksRes = await this.pool.query("SELECT COUNT(*) FROM clicks c JOIN links l ON c.link_id = l.id WHERE l.deleted_at IS NULL");
        const activeLinksRes = await this.pool.query("SELECT COUNT(*) FROM links WHERE deleted_at IS NULL AND is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())");
        const expiredLinksRes = await this.pool.query("SELECT COUNT(*) FROM links WHERE deleted_at IS NULL AND expires_at <= NOW()");
        return {
            totalLinks: parseInt(totalLinksRes.rows[0].count),
            totalClicks: parseInt(totalClicksRes.rows[0].count),
            activeLinks: parseInt(activeLinksRes.rows[0].count),
            expiredLinks: parseInt(expiredLinksRes.rows[0].count)
        };
    }
}
// SQLite Implementation
class SqliteDbService {
    db;
    dbPath;
    constructor() {
        this.dbPath = path_1.default.resolve(__dirname, "../../database.sqlite");
    }
    async initialize() {
        // Ensure dir exists
        const dir = path_1.default.dirname(this.dbPath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        this.db = await (0, sqlite_1.open)({
            filename: this.dbPath,
            driver: sqlite3_1.default.Database
        });
        await this.db.exec(`
      CREATE TABLE IF NOT EXISTS links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        original_url TEXT NOT NULL,
        short_code TEXT UNIQUE NOT NULL,
        custom_alias TEXT UNIQUE,
        is_active INTEGER DEFAULT 1,
        expires_at TEXT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT NULL
      );

      CREATE TABLE IF NOT EXISTS clicks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        link_id INTEGER REFERENCES links(id) ON DELETE CASCADE,
        clicked_at TEXT DEFAULT CURRENT_TIMESTAMP,
        browser TEXT,
        operating_system TEXT,
        country TEXT,
        referrer TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_links_short_code ON links(short_code) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_links_alias ON links(custom_alias) WHERE deleted_at IS NULL;
    `);
    }
    async close() {
        if (this.db) {
            await this.db.close();
        }
    }
    parseLink(row) {
        return {
            id: row.id,
            title: row.title,
            original_url: row.original_url,
            short_code: row.short_code,
            custom_alias: row.custom_alias,
            is_active: row.is_active === 1 || row.is_active === true,
            expires_at: row.expires_at ? new Date(row.expires_at) : null,
            created_at: new Date(row.created_at),
            deleted_at: row.deleted_at ? new Date(row.deleted_at) : null
        };
    }
    async createLink(title, originalUrl, shortCode, customAlias, expiresAt) {
        const expiresAtStr = expiresAt ? expiresAt.toISOString() : null;
        const res = await this.db.run("INSERT INTO links (title, original_url, short_code, custom_alias, expires_at) VALUES (?, ?, ?, ?, ?)", [title, originalUrl, shortCode, customAlias, expiresAtStr]);
        const row = await this.db.get("SELECT * FROM links WHERE id = ?", [res.lastID]);
        return this.parseLink(row);
    }
    async getLinkById(id) {
        const row = await this.db.get("SELECT * FROM links WHERE id = ? AND deleted_at IS NULL", [id]);
        return row ? this.parseLink(row) : null;
    }
    async getLinkByCode(shortCode) {
        const row = await this.db.get("SELECT * FROM links WHERE short_code = ? AND deleted_at IS NULL", [shortCode]);
        return row ? this.parseLink(row) : null;
    }
    async getLinkByAlias(alias) {
        const row = await this.db.get("SELECT * FROM links WHERE custom_alias = ? AND deleted_at IS NULL", [alias]);
        return row ? this.parseLink(row) : null;
    }
    async listLinks(options) {
        let whereClause = "WHERE deleted_at IS NULL";
        const params = [];
        if (options.search) {
            whereClause += " AND (title LIKE ? OR original_url LIKE ?)";
            params.push(`%${options.search}%`, `%${options.search}%`);
        }
        const countRes = await this.db.get(`SELECT COUNT(*) as count FROM links ${whereClause}`, params);
        const total = countRes ? countRes.count : 0;
        const queryParams = [...params, options.limit, options.offset];
        const query = `
      SELECT l.*, COUNT(c.id) as click_count
      FROM links l
      LEFT JOIN clicks c ON l.id = c.link_id
      ${whereClause.replace("deleted_at", "l.deleted_at")}
      GROUP BY l.id
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `;
        const rows = await this.db.all(query, queryParams);
        const links = rows.map((row) => ({
            ...this.parseLink(row),
            click_count: row.click_count
        }));
        return { links, total };
    }
    async updateLink(id, data) {
        const fields = [];
        const params = [];
        Object.entries(data).forEach(([key, val]) => {
            if (val !== undefined) {
                fields.push(`${key} = ?`);
                if (val instanceof Date) {
                    params.push(val.toISOString());
                }
                else if (typeof val === "boolean") {
                    params.push(val ? 1 : 0);
                }
                else {
                    params.push(val);
                }
            }
        });
        params.push(id);
        const query = `
      UPDATE links
      SET ${fields.join(", ")}
      WHERE id = ?
    `;
        await this.db.run(query, params);
        const row = await this.db.get("SELECT * FROM links WHERE id = ?", [id]);
        if (!row) {
            throw new Error(`Link not found: ${id}`);
        }
        return this.parseLink(row);
    }
    async softDeleteLink(id) {
        const nowStr = new Date().toISOString();
        const res = await this.db.run("UPDATE links SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL", [nowStr, id]);
        return (res.changes ?? 0) > 0;
    }
    async recordClick(linkId, browser, os, country, referrer) {
        const query = `
      INSERT INTO clicks (link_id, browser, operating_system, country, referrer)
      VALUES (?, ?, ?, ?, ?)
    `;
        await this.db.run(query, [linkId, browser, os, country, referrer]);
    }
    async getLinkAnalytics(linkId) {
        // SQLite syntax for grouping by date (substr or strftime)
        const dates = await this.db.all(`
      SELECT substr(clicked_at, 1, 10) as date, COUNT(*) as count
      FROM clicks
      WHERE link_id = ?
      GROUP BY date
      ORDER BY date ASC
      LIMIT 30
    `, [linkId]);
        const browsers = await this.db.all(`
      SELECT browser, COUNT(*) as count
      FROM clicks
      WHERE link_id = ?
      GROUP BY browser
      ORDER BY count DESC
    `, [linkId]);
        const os = await this.db.all(`
      SELECT operating_system as os, COUNT(*) as count
      FROM clicks
      WHERE link_id = ?
      GROUP BY os
      ORDER BY count DESC
    `, [linkId]);
        const countries = await this.db.all(`
      SELECT country, COUNT(*) as count
      FROM clicks
      WHERE link_id = ?
      GROUP BY country
      ORDER BY count DESC
    `, [linkId]);
        const referrers = await this.db.all(`
      SELECT referrer, COUNT(*) as count
      FROM clicks
      WHERE link_id = ?
      GROUP BY referrer
      ORDER BY count DESC
    `, [linkId]);
        return {
            clicksByDate: dates,
            clicksByBrowser: browsers,
            clicksByOS: os,
            clicksByCountry: countries,
            clicksByReferrer: referrers
        };
    }
    async getDashboardStats() {
        const nowStr = new Date().toISOString();
        const totalLinksRes = await this.db.get("SELECT COUNT(*) as count FROM links WHERE deleted_at IS NULL");
        const totalClicksRes = await this.db.get("SELECT COUNT(*) as count FROM clicks c JOIN links l ON c.link_id = l.id WHERE l.deleted_at IS NULL");
        const activeLinksRes = await this.db.get("SELECT COUNT(*) as count FROM links WHERE deleted_at IS NULL AND is_active = 1 AND (expires_at IS NULL OR expires_at > ?)", [nowStr]);
        const expiredLinksRes = await this.db.get("SELECT COUNT(*) as count FROM links WHERE deleted_at IS NULL AND expires_at <= ?", [nowStr]);
        return {
            totalLinks: totalLinksRes ? totalLinksRes.count : 0,
            totalClicks: totalClicksRes ? totalClicksRes.count : 0,
            activeLinks: activeLinksRes ? activeLinksRes.count : 0,
            expiredLinks: expiredLinksRes ? expiredLinksRes.count : 0
        };
    }
}
// Instantiate DB Service based on DB availability and environment
let db;
if (process.env.USE_SQLITE === "true" || process.env.NODE_ENV === "test") {
    console.log("Database: Forcing SQLite database service.");
    exports.db = db = new SqliteDbService();
}
else {
    // Try Postgres by default. We will check if it fails and fall back to SQLite dynamically!
    console.log("Database: Attempting to connect to PostgreSQL...");
    const pgService = new PostgresDbService();
    exports.db = db = pgService;
    // Enhance the db object to intercept errors and switch to SQLite
    const originalInit = db.initialize.bind(db);
    db.initialize = async () => {
        try {
            await originalInit();
            console.log("Database: PostgreSQL initialized successfully.");
        }
        catch (err) {
            console.warn("Database: PostgreSQL connection failed. Falling back to SQLite. Error:", err.message);
            exports.db = db = new SqliteDbService();
            await db.initialize();
            console.log("Database: Local SQLite fallback initialized successfully.");
        }
    };
}
