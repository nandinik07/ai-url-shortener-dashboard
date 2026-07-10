"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const linkController_1 = require("../controllers/linkController");
const analyticsController_1 = require("../controllers/analyticsController");
const validation_1 = require("../middleware/validation");
const router = (0, express_1.Router)();
// Link management endpoints
router.post("/links", (0, validation_1.validate)(validation_1.createLinkSchema), linkController_1.LinkController.createLink);
router.get("/links", linkController_1.LinkController.listLinks);
router.get("/links/:id", linkController_1.LinkController.getLink);
router.patch("/links/:id", (0, validation_1.validate)(validation_1.updateLinkSchema), linkController_1.LinkController.updateLink);
router.delete("/links/:id", linkController_1.LinkController.deleteLink);
// AI alias generation suggestion
router.post("/links/suggest-aliases", linkController_1.LinkController.suggestAliases);
// Analytics endpoints
router.get("/analytics/dashboard", analyticsController_1.AnalyticsController.getDashboardStats);
router.get("/analytics/links/:linkId", analyticsController_1.AnalyticsController.getLinkAnalytics);
exports.default = router;
