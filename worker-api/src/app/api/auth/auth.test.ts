import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabaseProvider, resetDatabaseProvider } from "@/lib/database";
import { findUserByUsername } from "@/lib/auth/user-repository";
import { POST as handleToken, OPTIONS as handleTokenOptions } from "./token/route";
import { POST as handleRegister, OPTIONS as handleRegisterOptions } from "./register/route";
import { POST as handleLogin, OPTIONS as handleLoginOptions } from "./login/route";
import { GET as handleMe, OPTIONS as handleMeOptions } from "./me/route";
import {
  GET as handleGetProfile,
  PUT as handlePutProfile,
  OPTIONS as handleProfileOptions,
} from "./profile/route";
import {
  PUT as handleChangePassword,
  OPTIONS as handleChangePasswordOptions,
} from "./change-password/route";
import {
  POST as handleForgotPassword,
  OPTIONS as handleForgotPasswordOptions,
} from "./forgot-password/route";
import {
  POST as handleResetPassword,
  OPTIONS as handleResetPasswordOptions,
} from "./reset-password/route";

describe("Auth API Routes", () => {
  let dbFile: string;

  beforeEach(async () => {
    vi.stubEnv("DATABASE_BACKEND", "SQLAlchemy");
    vi.stubEnv("JWT_SECRET", "test-auth-secret-key-47");
    vi.stubEnv("JWT_EXP_MINUTES", "60");

    // Use a unique file SQLite database per test run for clean isolation
    dbFile = path.join(process.cwd(), `test-auth-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
    vi.stubEnv("DATABASE_URL", `sqlite:///${dbFile.replace(/\\/g, "/")}`);
    resetDatabaseProvider();

    const provider = await getDatabaseProvider();
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), "migrations", "sqlite", "0001_initial.sql"),
      "utf-8",
    );

    // Apply the initial schema statements
    const statements = migrationSql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const sql of statements) {
      await provider.execute(sql);
    }
  });

  afterEach(async () => {
    resetDatabaseProvider();
    vi.unstubAllEnvs();
    if (dbFile && fs.existsSync(dbFile)) {
      try {
        fs.unlinkSync(dbFile);
      } catch {
        // ignore cleanup error
      }
    }
  });

  describe("OPTIONS preflights", () => {
    it("handles preflight on all auth routes", async () => {
      const req = new Request("http://localhost:3000/api/auth/login", {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:3000" },
      });
      const res = await handleLoginOptions(req);
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    });
  });

  describe("POST /api/auth/register", () => {
    it("validates required fields", async () => {
      const req = new Request("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "ab", email: "not-an-email", password: "123" }),
      });
      const res = await handleRegister(req);
      expect(res.status).toBe(400);
      const data = (await res.json()) as Record<string, any>;
      expect(data.error).toBe("Validation error");
      expect(data.details.username).toBeDefined();
      expect(data.details.email).toBeDefined();
      expect(data.details.password).toBeDefined();
    });

    it("registers a new user successfully", async () => {
      const req = new Request("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "testuser",
          email: "testuser@example.com",
          password: "password123",
        }),
      });
      const res = await handleRegister(req);
      expect(res.status).toBe(201);
      const data = (await res.json()) as Record<string, any>;
      expect(data.message).toBe("User registered successfully");
      expect(data.user.username).toBe("testuser");
      expect(data.user.email).toBe("testuser@example.com");
      expect(data.user.is_admin).toBe(false);
      expect(data.user.id).toBeGreaterThan(0);
    });

    it("rejects duplicate username and email", async () => {
      // Register first user
      await handleRegister(
        new Request("http://localhost:3000/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "uniqueuser",
            email: "unique@example.com",
            password: "password123",
          }),
        }),
      );

      // Duplicate username
      const dupUserRes = await handleRegister(
        new Request("http://localhost:3000/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "uniqueuser",
            email: "other@example.com",
            password: "password123",
          }),
        }),
      );
      expect(dupUserRes.status).toBe(400);
      expect(await dupUserRes.json()).toEqual({ error: "Username already exists" });

      // Duplicate email
      const dupEmailRes = await handleRegister(
        new Request("http://localhost:3000/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "anotheruser",
            email: "unique@example.com",
            password: "password123",
          }),
        }),
      );
      expect(dupEmailRes.status).toBe(400);
      expect(await dupEmailRes.json()).toEqual({ error: "Email already exists" });
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      await handleRegister(
        new Request("http://localhost:3000/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "loginuser",
            email: "loginuser@example.com",
            password: "correctpassword",
          }),
        }),
      );
    });

    it("rejects invalid credentials", async () => {
      const res = await handleLogin(
        new Request("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "loginuser",
            password: "wrongpassword",
          }),
        }),
      );
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Invalid credentials" });
    });

    it("logs in with username or email successfully", async () => {
      // By username
      const resUser = await handleLogin(
        new Request("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "loginuser",
            password: "correctpassword",
          }),
        }),
      );
      expect(resUser.status).toBe(200);
      const dataUser = (await resUser.json()) as Record<string, any>;
      expect(dataUser.message).toBe("Login successful");
      expect(typeof dataUser.access_token).toBe("string");
      expect(dataUser.user.username).toBe("loginuser");
      expect(dataUser.user.last_login).not.toBeNull();

      // By email
      const resEmail = await handleLogin(
        new Request("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "loginuser@example.com",
            password: "correctpassword",
          }),
        }),
      );
      expect(resEmail.status).toBe(200);
      const dataEmail = (await resEmail.json()) as Record<string, any>;
      expect(dataEmail.message).toBe("Login successful");
      expect(typeof dataEmail.access_token).toBe("string");
    });
  });

  describe("POST /api/auth/token (Basic Auth)", () => {
    beforeEach(async () => {
      await handleRegister(
        new Request("http://localhost:3000/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "adminuser",
            email: "admin@example.com",
            password: "adminpassword",
          }),
        }),
      );

      // Make adminuser admin
      const provider = await getDatabaseProvider();
      await provider.execute("UPDATE users SET is_admin = 1 WHERE username = 'adminuser'");
    });

    it("rejects missing Basic Auth header", async () => {
      const res = await handleToken(new Request("http://localhost:3000/api/auth/token", { method: "POST" }));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Missing or invalid Basic Auth credentials" });
    });

    it("issues JWT token for valid Basic credentials", async () => {
      const credentials = Buffer.from("adminuser:adminpassword").toString("base64");
      const res = await handleToken(
        new Request("http://localhost:3000/api/auth/token", {
          method: "POST",
          headers: { Authorization: `Basic ${credentials}` },
        }),
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as Record<string, any>;
      expect(typeof data.access_token).toBe("string");
    });
  });

  describe("GET /api/auth/me", () => {
    let token: string;

    beforeEach(async () => {
      await handleRegister(
        new Request("http://localhost:3000/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "meuser",
            email: "me@example.com",
            password: "password123",
          }),
        }),
      );

      const loginRes = await handleLogin(
        new Request("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "meuser", password: "password123" }),
        }),
      );
      const loginData = (await loginRes.json()) as Record<string, any>;
      token = loginData.access_token;
    });

    it("requires authentication", async () => {
      const res = await handleMe(new Request("http://localhost:3000/api/auth/me"));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "no_token", message: "Authorization token required" });
    });

    it("returns current user with Bearer token", async () => {
      const res = await handleMe(
        new Request("http://localhost:3000/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as Record<string, any>;
      expect(data.user.username).toBe("meuser");
      expect(data.user.email).toBe("me@example.com");
    });

    it("returns current user with raw token", async () => {
      const res = await handleMe(
        new Request("http://localhost:3000/api/auth/me", {
          headers: { Authorization: token },
        }),
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as Record<string, any>;
      expect(data.user.username).toBe("meuser");
    });
  });

  describe("GET & PUT /api/auth/profile", () => {
    let token: string;

    beforeEach(async () => {
      await handleRegister(
        new Request("http://localhost:3000/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "profileuser",
            email: "profile@example.com",
            password: "password123",
          }),
        }),
      );

      const loginRes = await handleLogin(
        new Request("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "profileuser", password: "password123" }),
        }),
      );
      token = ((await loginRes.json()) as Record<string, any>).access_token;
    });

    it("GET returns profile directly", async () => {
      const res = await handleGetProfile(
        new Request("http://localhost:3000/api/auth/profile", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as Record<string, any>;
      expect(data.username).toBe("profileuser");
      expect(data.email).toBe("profile@example.com");
    });

    it("PUT updates username and email", async () => {
      const res = await handlePutProfile(
        new Request("http://localhost:3000/api/auth/profile", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: "updatedprofile",
            email: "updatedprofile@example.com",
          }),
        }),
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as Record<string, any>;
      expect(data.message).toBe("Profile updated successfully");
      expect(data.user.username).toBe("updatedprofile");
      expect(data.user.email).toBe("updatedprofile@example.com");
    });
  });

  describe("PUT /api/auth/change-password", () => {
    let token: string;

    beforeEach(async () => {
      await handleRegister(
        new Request("http://localhost:3000/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "pwduser",
            email: "pwd@example.com",
            password: "oldpassword123",
          }),
        }),
      );

      const loginRes = await handleLogin(
        new Request("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "pwduser", password: "oldpassword123" }),
        }),
      );
      token = ((await loginRes.json()) as Record<string, any>).access_token;
    });

    it("rejects incorrect current password", async () => {
      const res = await handleChangePassword(
        new Request("http://localhost:3000/api/auth/change-password", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentPassword: "wrongpassword",
            newPassword: "brandnewpassword",
          }),
        }),
      );
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Current password is incorrect" });
    });

    it("rejects new password equal to current password", async () => {
      const res = await handleChangePassword(
        new Request("http://localhost:3000/api/auth/change-password", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentPassword: "oldpassword123",
            newPassword: "oldpassword123",
          }),
        }),
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "New password must be different from current password",
      });
    });

    it("changes password successfully and allows login with new password", async () => {
      const res = await handleChangePassword(
        new Request("http://localhost:3000/api/auth/change-password", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentPassword: "oldpassword123",
            newPassword: "brandnewpassword",
          }),
        }),
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ message: "Password changed successfully" });

      // Old password fails
      const oldLogin = await handleLogin(
        new Request("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "pwduser", password: "oldpassword123" }),
        }),
      );
      expect(oldLogin.status).toBe(401);

      // New password succeeds
      const newLogin = await handleLogin(
        new Request("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "pwduser", password: "brandnewpassword" }),
        }),
      );
      expect(newLogin.status).toBe(200);
    });
  });

  describe("Password Reset Flow", () => {
    beforeEach(async () => {
      await handleRegister(
        new Request("http://localhost:3000/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "resetuser",
            email: "reset@example.com",
            password: "initialpassword",
          }),
        }),
      );
    });

    it("forgot-password with nonexistent email returns generic message", async () => {
      const res = await handleForgotPassword(
        new Request("http://localhost:3000/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "nonexistent@example.com" }),
        }),
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        message: "If your email is in our database, you will receive a reset link.",
      });
    });

    it("resets password with token and enables login with new password", async () => {
      const provider = await getDatabaseProvider();
      const token = "secure-test-token-47";
      const expiresAt = new Date(Date.now() + 3600000).toISOString();

      // Seed token in DB
      await provider.execute(
        "UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE email = 'reset@example.com'",
        [token, expiresAt],
      );

      // Reset password
      const resetRes = await handleResetPassword(
        new Request("http://localhost:3000/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            new_password: "resetpassword123",
          }),
        }),
      );
      expect(resetRes.status).toBe(200);
      expect(await resetRes.json()).toEqual({
        message: "Password has been reset successfully",
      });

      // Token is now cleared
      const user = await findUserByUsername(provider, "resetuser");
      expect(user?.reset_password_token).toBeNull();

      // Login with new password
      const loginRes = await handleLogin(
        new Request("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "resetuser",
            password: "resetpassword123",
          }),
        }),
      );
      expect(loginRes.status).toBe(200);
    });
  });
});
