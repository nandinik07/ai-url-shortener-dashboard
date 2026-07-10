"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsController = void 0;
const db_1 = require("../config/db");
class AnalyticsController {
    /**
     * Get high-level stats for the admin dashboard.
     */
    static async getDashboardStats(req, res) {
        try {
            const stats = await db_1.db.getDashboardStats();
            return res.status(200).json({
                status: "success",
                data: stats
            });
        }
        catch (error) {
            console.error("Get Dashboard Stats Error:", error);
            return res.status(500).json({
                status: "error",
                message: "Failed to load dashboard metrics"
            });
        }
    }
    /**
     * Get analytical details for a specific link.
     */
    static async getLinkAnalytics(req, res) {
        const linkId = parseInt(req.params.linkId);
        try {
            const link = await db_1.db.getLinkById(linkId);
            if (!link) {
                return res.status(404).json({
                    status: "fail",
                    message: "Link not found"
                });
            }
            const analytics = await db_1.db.getLinkAnalytics(linkId);
            // Calculate total clicks for this specific link
            const totalClicks = analytics.clicksByBrowser.reduce((acc, item) => acc + item.count, 0);
            return res.status(200).json({
                status: "success",
                data: {
                    link,
                    totalClicks,
                    ...analytics
                }
            });
        }
        catch (error) {
            console.error("Get Link Analytics Error:", error);
            return res.status(500).json({
                status: "error",
                message: "Failed to load link analytics details"
            });
        }
    }
}
exports.AnalyticsController = AnalyticsController;
