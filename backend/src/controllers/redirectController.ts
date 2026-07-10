import { Request, Response } from "express";
import { db } from "../config/db";
import { cache } from "../services/cache";
import { parseUserAgent } from "../utils/uaParser";
import { getCountryFromIp } from "../utils/geo";

export class RedirectController {
  /**
   * Main redirect handler matching /r/:shortCode
   */
  static async redirect(req: Request, res: Response) {
    const { shortCode } = req.params;

    try {
      // 1. Check cache first (Extremely Fast O(1))
      let targetUrl = await cache.get(shortCode);
      let linkId: number | null = null;

      if (!targetUrl) {
        // 2. Cache Miss: Query Database (Postgres/SQLite)
        // Check both shortCode and custom_alias
        let link = await db.getLinkByCode(shortCode);
        if (!link) {
          link = await db.getLinkByAlias(shortCode);
        }

        // If not found or soft-deleted
        if (!link) {
          return res.status(404).send(`
            <html>
              <head><title>Link Not Found</title></head>
              <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #334155;">
                <div style="text-align: center; padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                  <h1 style="color: #ef4444; margin-top: 0;">Link Not Found</h1>
                  <p>The link you are trying to access does not exist or has been deleted.</p>
                  <a href="/" style="display: inline-block; margin-top: 1rem; padding: 0.5rem 1rem; background: #6366f1; color: white; text-decoration: none; border-radius: 6px;">Go to Dashboard</a>
                </div>
              </body>
            </html>
          `);
        }

        // Check if disabled
        if (!link.is_active) {
          return res.status(403).send(`
            <html>
              <head><title>Link Disabled</title></head>
              <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #334155;">
                <div style="text-align: center; padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                  <h1 style="color: #f59e0b; margin-top: 0;">Link Disabled</h1>
                  <p>This shortened link has been temporarily deactivated by the administrator.</p>
                </div>
              </body>
            </html>
          `);
        }

        // Check if expired
        const now = new Date();
        if (link.expires_at && now > link.expires_at) {
          return res.status(410).send(`
            <html>
              <head><title>Link Expired</title></head>
              <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #334155;">
                <div style="text-align: center; padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                  <h1 style="color: #64748b; margin-top: 0;">Link Expired</h1>
                  <p>This link has reached its expiration date and is no longer active.</p>
                </div>
              </body>
            </html>
          `);
        }

        targetUrl = link.original_url;
        linkId = link.id;

        // 3. Populate Cache asynchronously (1 hour TTL)
        await cache.set(shortCode, targetUrl, 3600);
      }

      // If we don't have the linkId yet because it was a Cache Hit,
      // we query the database to get the ID for analytics, but we DO NOT let it block the redirect response!
      const userAgent = req.headers["user-agent"] || "";
      const rawReferrer = req.headers["referer"] || req.headers["referrer"] || "Direct";
      
      // Determine referrer host or clean display
      let referrer = "Direct";
      if (rawReferrer && rawReferrer !== "Direct") {
        try {
          const refUrl = new URL(rawReferrer as string);
          referrer = refUrl.hostname.replace("www.", "") || "Other";
        } catch {
          referrer = "Other";
        }
      }

      // Resolve client IP
      // x-forwarded-for contains client IP when behind proxy
      const ipHeader = req.headers["x-forwarded-for"];
      const clientIp = Array.isArray(ipHeader)
        ? ipHeader[0]
        : typeof ipHeader === "string"
          ? ipHeader.split(",")[0].trim()
          : req.socket.remoteAddress || "127.0.0.1";

      // 4. Trigger asynchronous analytics recording (Non-blocking)
      // This is the core architectural requirement to maintain sub-100ms redirect speeds
      (async () => {
        try {
          // If we had a cache hit, we need to fetch the link record from DB to get linkId
          if (!linkId) {
            let link = await db.getLinkByCode(shortCode);
            if (!link) {
              link = await db.getLinkByAlias(shortCode);
            }
            if (link) {
              linkId = link.id;
            }
          }

          if (linkId) {
            const metrics = parseUserAgent(userAgent);
            const country = await getCountryFromIp(clientIp);
            await db.recordClick(linkId, metrics.browser, metrics.os, country, referrer);
          }
        } catch (analyticsError) {
          console.error("Async Analytics Error for code:", shortCode, analyticsError);
        }
      })();

      // 5. Perform the Redirect immediately
      return res.redirect(302, targetUrl);

    } catch (error) {
      console.error("Redirect Handler Error:", error);
      return res.status(500).send("Internal Server Error");
    }
  }
}
