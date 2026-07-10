import request from "supertest";
import app from "../app";
import { db } from "../config/db";
import { cache } from "../services/cache";

// Set environment for test mode
process.env.NODE_ENV = "test";
process.env.USE_SQLITE = "true";
process.env.USE_MEMORY_CACHE = "true";

describe("URL Shortener API Integration Tests", () => {
  beforeAll(async () => {
    // Initialize test SQLite database and in-memory cache
    await db.initialize();
    await cache.initialize();
    
    // Clear database tables to ensure clean slate for repeated test runs
    const sqliteDb = (db as any).db;
    if (sqliteDb) {
      await sqliteDb.exec("DELETE FROM clicks; DELETE FROM links;");
    }
  });

  afterAll(async () => {
    // Close connections
    await db.close();
    await cache.close();
  });

  let createdLinkId: number;
  let createdShortCode: string;
  const customAlias = "test-custom-alias";

  describe("POST /api/links - Create Short Link", () => {
    it("should successfully create a short link with auto-generated code", async () => {
      const response = await request(app)
        .post("/api/links")
        .send({
          title: "Google Homepage",
          original_url: "https://www.google.com"
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe("success");
      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data.title).toBe("Google Homepage");
      expect(response.body.data.original_url).toBe("https://www.google.com");
      expect(response.body.data).toHaveProperty("short_code");
      
      createdLinkId = response.body.data.id;
      createdShortCode = response.body.data.short_code;
    });

    it("should create a link with a custom alias", async () => {
      const response = await request(app)
        .post("/api/links")
        .send({
          title: "GitHub Homepage",
          original_url: "https://github.com",
          custom_alias: customAlias
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe("success");
      expect(response.body.data.custom_alias).toBe(customAlias);
    });

    it("should reject custom alias that is already taken", async () => {
      const response = await request(app)
        .post("/api/links")
        .send({
          title: "GitHub Again",
          original_url: "https://github.com/another",
          custom_alias: customAlias
        });

      expect(response.status).toBe(409);
      expect(response.body.status).toBe("fail");
      expect(response.body.message).toContain("already in use");
    });

    it("should validate that original_url is a valid URL", async () => {
      const response = await request(app)
        .post("/api/links")
        .send({
          title: "Bad URL",
          original_url: "not-a-valid-url"
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe("fail");
      expect(response.body.errors[0].field).toBe("original_url");
    });

    it("should validate that expiration date is in the future", async () => {
      const pastDate = new Date(Date.now() - 3600 * 1000).toISOString(); // 1 hour ago
      const response = await request(app)
        .post("/api/links")
        .send({
          title: "Expired Link",
          original_url: "https://example.com",
          expires_at: pastDate
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe("fail");
    });
  });

  describe("GET /api/links - List Links", () => {
    it("should list paginated links", async () => {
      const response = await request(app)
        .get("/api/links")
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.data.links.length).toBeGreaterThanOrEqual(2);
      expect(response.body.data.pagination.total).toBeGreaterThanOrEqual(2);
    });

    it("should filter links by search term", async () => {
      const response = await request(app)
        .get("/api/links")
        .query({ search: "Google" });

      expect(response.status).toBe(200);
      expect(response.body.data.links.length).toBe(1);
      expect(response.body.data.links[0].title).toBe("Google Homepage");
    });
  });

  describe("GET /r/:shortCode - Redirection Engine", () => {
    it("should redirect an active short code to original URL", async () => {
      const response = await request(app).get(`/r/${createdShortCode}`);
      
      expect(response.status).toBe(302);
      expect(response.header.location).toBe("https://www.google.com");
    });

    it("should redirect custom alias to original URL", async () => {
      const response = await request(app).get(`/r/${customAlias}`);

      expect(response.status).toBe(302);
      expect(response.header.location).toBe("https://github.com");
    });

    it("should return 404 for unknown short code", async () => {
      const response = await request(app).get("/r/non-existent-code");
      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /api/links/:id - Update Link", () => {
    it("should update title and active status", async () => {
      const response = await request(app)
        .patch(`/api/links/${createdLinkId}`)
        .send({
          title: "Google Search Engine",
          is_active: false
        });

      expect(response.status).toBe(200);
      expect(response.body.data.title).toBe("Google Search Engine");
      expect(response.body.data.is_active).toBe(false);
    });

    it("should block redirection when link is inactive", async () => {
      const response = await request(app).get(`/r/${createdShortCode}`);
      expect(response.status).toBe(403); // Forbidden
    });
  });

  describe("DELETE /api/links/:id - Soft Delete Link", () => {
    it("should soft delete a link", async () => {
      const response = await request(app).delete(`/api/links/${createdLinkId}`);
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
    });

    it("should return 404 on redirection of soft-deleted link", async () => {
      const response = await request(app).get(`/r/${createdShortCode}`);
      expect(response.status).toBe(404);
    });

    it("should exclude soft-deleted link from search listings", async () => {
      const response = await request(app)
        .get("/api/links")
        .query({ search: "Google" });

      expect(response.status).toBe(200);
      expect(response.body.data.links.length).toBe(0);
    });
  });

  describe("POST /api/links/suggest-aliases - AI alias suggestion", () => {
    it("should return suggested aliases", async () => {
      const response = await request(app)
        .post("/api/links/suggest-aliases")
        .send({
          original_url: "https://www.shopify.com/blog/start-online-store",
          title: "Start Online Store"
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.data.suggestions).toBeInstanceOf(Array);
      expect(response.body.data.suggestions.length).toBe(3);
    });
  });
});
