import { Request, Response } from "express";
import { db } from "../config/db";
import { cache } from "../services/cache";
import { Base62 } from "../utils/base62";
import { generateAIAliases } from "../services/gemini";

export class LinkController {
  /**
   * Create a new shortened link.
   */
  static async createLink(req: Request, res: Response) {
    const { title, original_url, custom_alias, expires_at } = req.body;

    try {
      // 1. Check custom alias if provided
      if (custom_alias) {
        const existingAlias = await db.getLinkByAlias(custom_alias);
        if (existingAlias) {
          return res.status(409).json({
            status: "fail",
            message: "Custom alias is already in use"
          });
        }
        // Also check if custom_alias conflicts with an auto-generated short_code
        const existingCode = await db.getLinkByCode(custom_alias);
        if (existingCode) {
          return res.status(409).json({
            status: "fail",
            message: "Custom alias conflicts with an existing short code"
          });
        }
      }

      // 2. Generate unique short code
      let shortCode = "";
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 5;

      while (!isUnique && attempts < maxAttempts) {
        // We generate a 6 character Base62 random code
        shortCode = Base62.randomCode(6);
        
        // Ensure no collisions in database
        const existingLink = await db.getLinkByCode(shortCode);
        const existingAlias = await db.getLinkByAlias(shortCode);
        
        if (!existingLink && !existingAlias) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        return res.status(500).json({
          status: "error",
          message: "Failed to generate a unique short code. Please try again."
        });
      }

      // 3. Persist link
      const link = await db.createLink(title, original_url, shortCode, custom_alias || null, expires_at);

      // 4. Pre-populate cache for low latency redirects
      // We cache both the short_code and custom_alias if set
      await cache.set(shortCode, original_url, 3600); // 1 hour Cache TTL
      if (custom_alias) {
        await cache.set(custom_alias, original_url, 3600);
      }

      return res.status(201).json({
        status: "success",
        data: link
      });
    } catch (error: any) {
      console.error("Create Link Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to create short link"
      });
    }
  }

  /**
   * List links with pagination and search.
   */
  static async listLinks(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || undefined;

    const offset = (page - 1) * limit;

    try {
      const result = await db.listLinks({ limit, offset, search });
      return res.status(200).json({
        status: "success",
        data: {
          links: result.links,
          pagination: {
            page,
            limit,
            total: result.total,
            pages: Math.ceil(result.total / limit)
          }
        }
      });
    } catch (error: any) {
      console.error("List Links Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch links"
      });
    }
  }

  /**
   * Get single link details.
   */
  static async getLink(req: Request, res: Response) {
    const id = parseInt(req.params.id);

    try {
      const link = await db.getLinkById(id);
      if (!link) {
        return res.status(404).json({
          status: "fail",
          message: "Link not found"
        });
      }

      return res.status(200).json({
        status: "success",
        data: link
      });
    } catch (error) {
      console.error("Get Link Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to retrieve link details"
      });
    }
  }

  /**
   * Update short link details.
   */
  static async updateLink(req: Request, res: Response) {
    const id = parseInt(req.params.id);
    const { title, original_url, custom_alias, expires_at, is_active } = req.body;

    try {
      // Check if link exists
      const existingLink = await db.getLinkById(id);
      if (!existingLink) {
        return res.status(404).json({
          status: "fail",
          message: "Link not found"
        });
      }

      // Check for alias conflict
      if (custom_alias && custom_alias !== existingLink.custom_alias) {
        const conflict = await db.getLinkByAlias(custom_alias);
        if (conflict) {
          return res.status(409).json({
            status: "fail",
            message: "Custom alias is already in use"
          });
        }
        const conflictCode = await db.getLinkByCode(custom_alias);
        if (conflictCode) {
          return res.status(409).json({
            status: "fail",
            message: "Custom alias conflicts with an existing short code"
          });
        }
      }

      // Update link
      const updatedLink = await db.updateLink(id, {
        title,
        original_url,
        custom_alias,
        expires_at,
        is_active
      });

      // Update or clear caches
      // Clear old cache values to trigger db reload (or set new ones)
      await cache.del(existingLink.short_code);
      if (existingLink.custom_alias) {
        await cache.del(existingLink.custom_alias);
      }

      // Pre-cache if still active and not expired
      const isExpired = updatedLink.expires_at && new Date() > updatedLink.expires_at;
      if (updatedLink.is_active && !isExpired) {
        await cache.set(updatedLink.short_code, updatedLink.original_url, 3600);
        if (updatedLink.custom_alias) {
          await cache.set(updatedLink.custom_alias, updatedLink.original_url, 3600);
        }
      }

      return res.status(200).json({
        status: "success",
        data: updatedLink
      });
    } catch (error) {
      console.error("Update Link Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to update link"
      });
    }
  }

  /**
   * Soft delete short link.
   */
  static async deleteLink(req: Request, res: Response) {
    const id = parseInt(req.params.id);

    try {
      const existingLink = await db.getLinkById(id);
      if (!existingLink) {
        return res.status(404).json({
          status: "fail",
          message: "Link not found"
        });
      }

      await db.softDeleteLink(id);

      // Invalidate cache
      await cache.del(existingLink.short_code);
      if (existingLink.custom_alias) {
        await cache.del(existingLink.custom_alias);
      }

      return res.status(200).json({
        status: "success",
        message: "Link successfully deleted (soft delete)"
      });
    } catch (error) {
      console.error("Delete Link Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to delete link"
      });
    }
  }

  /**
   * Suggest custom aliases using Gemini.
   */
  static async suggestAliases(req: Request, res: Response) {
    const { original_url, title } = req.body;

    if (!original_url) {
      return res.status(400).json({
        status: "fail",
        message: "original_url is required"
      });
    }

    try {
      const suggestions = await generateAIAliases(original_url, title || "");
      return res.status(200).json({
        status: "success",
        data: { suggestions }
      });
    } catch (error) {
      console.error("Suggest Aliases Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to generate suggestions"
      });
    }
  }
}
