import { Router } from "express";
import { LinkController } from "../controllers/linkController";
import { AnalyticsController } from "../controllers/analyticsController";
import { createLinkSchema, updateLinkSchema, validate } from "../middleware/validation";

const router = Router();

// Link management endpoints
router.post("/links", validate(createLinkSchema), LinkController.createLink);
router.get("/links", LinkController.listLinks);
router.get("/links/:id", LinkController.getLink);
router.patch("/links/:id", validate(updateLinkSchema), LinkController.updateLink);
router.delete("/links/:id", LinkController.deleteLink);

// AI alias generation suggestion
router.post("/links/suggest-aliases", LinkController.suggestAliases);

// Analytics endpoints
router.get("/analytics/dashboard", AnalyticsController.getDashboardStats);
router.get("/analytics/links/:linkId", AnalyticsController.getLinkAnalytics);

export default router;
