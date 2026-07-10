"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const api_1 = __importDefault(require("./routes/api"));
const redirectController_1 = require("./controllers/redirectController");
const db_1 = require("./config/db");
const cache_1 = require("./services/cache");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Enable CORS
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
// Body parser middleware
app.use(express_1.default.json());
// Base health check
app.get("/health", (req, res) => {
    res.status(200).json({ status: "OK", timestamp: new Date() });
});
// Core Low-Latency Redirection route
app.get("/r/:shortCode", redirectController_1.RedirectController.redirect);
// Administrative REST API endpoints
app.use("/api", api_1.default);
// Global Error Handler
app.use((err, req, res, next) => {
    console.error("Global error handler caught an error:", err);
    res.status(500).json({
        status: "error",
        message: err.message || "Internal Server Error"
    });
});
// Bootstrap server
async function bootstrap() {
    try {
        // 1. Initialize DB (Postgres with SQLite fallback)
        await db_1.db.initialize();
        // 2. Initialize Cache (Redis with in-memory fallback)
        await cache_1.cache.initialize();
        // 3. Start Express server
        const server = app.listen(PORT, () => {
            console.log(`Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`);
        });
        // Graceful Shutdown helper
        const handleShutdown = async (signal) => {
            console.log(`Received ${signal}. Shutting down server gracefully...`);
            server.close(async () => {
                try {
                    await db_1.db.close();
                    await cache_1.cache.close();
                    console.log("Database and cache connections closed. Exit successful.");
                    process.exit(0);
                }
                catch (err) {
                    console.error("Error during connection cleanup:", err);
                    process.exit(1);
                }
            });
        };
        process.on("SIGINT", () => handleShutdown("SIGINT"));
        process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    }
    catch (error) {
        console.error("Server bootstrap failed:", error);
        process.exit(1);
    }
}
// Only run bootstrap if this file is executed directly (not in testing)
if (process.env.NODE_ENV !== "test") {
    bootstrap();
}
exports.default = app;
