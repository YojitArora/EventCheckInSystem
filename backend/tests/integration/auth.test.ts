import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/config/prisma";

describe("Authentication API (/api/auth)", () => {
  const app = createApp();

  beforeAll(async () => {
    // Clean up users created during tests
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            "test.user@mic.dev",
            "duplicate.test@mic.dev",
            "login.test@mic.dev",
            "me.test@mic.dev",
          ],
        },
      },
    });
  });

  describe("POST /api/auth/register", () => {
    it("successfully registers a new user with default ATTENDEE role", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "Test Attendee",
        email: "test.user@mic.dev",
        password: "Password123!",
        role: "ORGANIZER", // Attempt to inject role should be ignored
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe("test.user@mic.dev");
      expect(res.body.data.user.name).toBe("Test Attendee");
      expect(res.body.data.user.role).toBe("ATTENDEE"); // Role must be ATTENDEE
      expect(res.body.data.token).toBeDefined();
    });

    it("rejects registration with duplicate email", async () => {
      // First registration
      await request(app).post("/api/auth/register").send({
        name: "Duplicate User",
        email: "duplicate.test@mic.dev",
        password: "Password123!",
      });

      // Duplicate attempt
      const res = await request(app).post("/api/auth/register").send({
        name: "Duplicate User",
        email: "duplicate.test@mic.dev",
        password: "Password123!",
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("EMAIL_EXISTS");
    });

    it("rejects invalid input (short password, invalid email)", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "A",
        email: "not-an-email",
        password: "123",
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/auth/login", () => {
    beforeAll(async () => {
      await request(app).post("/api/auth/register").send({
        name: "Login User",
        email: "login.test@mic.dev",
        password: "CorrectPassword123!",
      });
    });

    it("successfully logs in with valid credentials", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "login.test@mic.dev",
        password: "CorrectPassword123!",
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe("login.test@mic.dev");
      expect(res.body.data.token).toBeDefined();
    });

    it("rejects login with incorrect password", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "login.test@mic.dev",
        password: "WrongPassword!",
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects login with non-existent email", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "nonexistent@mic.dev",
        password: "SomePassword123!",
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /api/auth/me", () => {
    let token: string;

    beforeAll(async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "Me User",
        email: "me.test@mic.dev",
        password: "Password123!",
      });
      token = res.body.data.token;
    });

    it("returns profile for authenticated user", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe("me.test@mic.dev");
      expect(res.body.data.user.role).toBe("ATTENDEE");
    });

    it("rejects request without authorization header", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects request with invalid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-garbage-token");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });
});
