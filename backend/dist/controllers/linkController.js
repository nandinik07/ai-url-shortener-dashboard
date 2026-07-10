"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkController = void 0;
const db_1 = require("../config/db");
const cache_1 = require("../services/cache");
const base62_1 = require("../utils/base62");
const gemini_1 = require("../services/gemini");
class LinkController {
    /**
     * Create a new shortened link.
     */
    static async createLink(req, res) {
        const { title, original_url, custom_alias, expires_at } = req.body;
        try {
            // 1. Check custom alias if provided
            if (custom_alias) {
                const existingAlias = await db_1.db.getLinkByAlias(custom_alias);
                if (existingAlias) {
                    return res.status(409).json({
                        status: "fail",
                        message: "Custom alias is already in use"
                    });
                }
                // Also check if custom_alias conflicts with an auto-generated short_code
                const existingCode = await db_1.db.getLinkByCode(custom_alias);
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
                shortCode = base62_1.Base62.randomCode(6);
                // Ensure no collisions in database
                const existingLink = await db_1.db.getLinkByCode(shortCode);
                const existingAlias = await db_1.db.getLinkByAlias(shortCode);
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
            const link = await db_1.db.createLink(title, original_url, shortCode, custom_alias || null, expires_at);
            // 4. Pre-populate cache for low latency redirects
            // We cache both the short_code and custom_alias if set
            await cache_1.cache.set(shortCode, original_url, 3600); // 1 hour Cache TTL
            if (custom_alias) {
                await cache_1.cache.set(custom_alias, original_url, 3600);
            }
            return res.status(201).json({
                status: "success",
                data: link
            });
        }
        catch (error) {
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
    static async listLinks(req, res) {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || undefined;
        const offset = (page - 1) * limit;
        try {
            const result = await db_1.db.listLinks({ limit, offset, search });
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
        }
        catch (error) {
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
    static async getLink(req, res) {
        const id = parseInt(req.params.id);
        try {
            const link = await db_1.db.getLinkById(id);
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
        }
        catch (error) {
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
    static async updateLink(req, res) {
        const id = parseInt(req.params.id);
        const { title, original_url, custom_alias, expires_at, is_active } = req.body;
        try {
            // Check if link exists
            const existingLink = await db_1.db.getLinkById(id);
            if (!existingLink) {
                return res.status(404).json({
                    status: "fail",
                    message: "Link not found"
                });
            }
            // Check for alias conflict
            if (custom_alias && custom_alias !== existingLink.custom_alias) {
                const conflict = await db_1.db.getLinkByAlias(custom_alias);
                if (conflict) {
                    return res.status(409).json({
                        status: "fail",
                        message: "Custom alias is already in use"
                    });
                }
                const conflictCode = await db_1.db.getLinkByCode(custom_alias);
                if (conflictCode) {
                    return res.status(409).json({
                        status: "fail",
                        message: "Custom alias conflicts with an existing short code"
                    });
                }
            }
            // Update link
            const updatedLink = await db_1.db.updateLink(id, {
                title,
                original_url,
                custom_alias,
                expires_at,
                is_active
            });
            // Update or clear caches
            // Clear old cache values to trigger db reload (or set new ones)
            await cache_1.cache.del(existingLink.short_code);
            if (existingLink.custom_alias) {
                await cache_1.cache.del(existingLink.custom_alias);
            }
            // Pre-cache if still active and not expired
            const isExpired = updatedLink.expires_at && new Date() > updatedLink.expires_at;
            if (updatedLink.is_active && !isExpired) {
                await cache_1.cache.set(updatedLink.short_code, updatedLink.original_url, 3600);
                if (updatedLink.custom_alias) {
                    await cache_1.cache.set(updatedLink.custom_alias, updatedLink.original_url, 3600);
                }
            }
            return res.status(200).json({
                status: "success",
                data: updatedLink
            });
        }
        catch (error) {
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
    static async deleteLink(req, res) {
        const id = parseInt(req.params.id);
        try {
            const existingLink = await db_1.db.getLinkById(id);
            if (!existingLink) {
                return res.status(404).json({
                    status: "fail",
                    message: "Link not found"
                });
            }
            await db_1.db.softDeleteLink(id);
            // Invalidate cache
            await cache_1.cache.del(existingLink.short_code);
            if (existingLink.custom_alias) {
                await cache_1.cache.del(existingLink.custom_alias);
            }
            return res.status(200).json({
                status: "success",
                message: "Link successfully deleted (soft delete)"
            });
        }
        catch (error) {
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
    static async suggestAliases(req, res) {
        const { original_url, title } = req.body;
        if (!original_url) {
            return res.status(400).json({
                status: "fail",
                message: "original_url is required"
            });
        }
        try {
            const suggestions = await (0, gemini_1.generateAIAliases)(original_url, title || "");
            return res.status(200).json({
                status: "success",
                data: { suggestions }
            });
        }
        catch (error) {
            console.error("Suggest Aliases Error:", error);
            return res.status(500).json({
                status: "error",
                message: "Failed to generate suggestions"
            });
        }
    }
}
exports.LinkController = LinkController;
