import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import apiRoutes from "./routes/api";
import { RedirectController } from "./controllers/redirectController";
import { db } from "./config/db";
import { cache } from "./services/cache";

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Body parser middleware
app.use(express.json());

// Base health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date() });
});

// Core Low-Latency Redirection route
app.get("/r/:shortCode", RedirectController.redirect);

// Administrative REST API endpoints
app.use("/api", apiRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
    await db.initialize();

    // 2. Initialize Cache (Redis with in-memory fallback)
    await cache.initialize();

    // 3. Start Express server
    const server = app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`);
    });

    // Graceful Shutdown helper
    const handleShutdown = async (signal: string) => {
      console.log(`Received ${signal}. Shutting down server gracefully...`);
      server.close(async () => {
        try {
          await db.close();
          await cache.close();
          console.log("Database and cache connections closed. Exit successful.");
          process.exit(0);
        } catch (err) {
          console.error("Error during connection cleanup:", err);
          process.exit(1);
        }
      });
    };

    process.on("SIGINT", () => handleShutdown("SIGINT"));
    process.on("SIGTERM", () => handleShutdown("SIGTERM"));

  } catch (error) {
    console.error("Server bootstrap failed:", error);
    process.exit(1);
  }
}

// Only run bootstrap if this file is executed directly (not in testing)
if (process.env.NODE_ENV !== "test") {
  bootstrap();
}

export default app;
