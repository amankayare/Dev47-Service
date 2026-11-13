import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJwtToken } from "@/lib/auth/jwt";
import { getDatabaseProvider, resetDatabaseProvider } from "@/lib/database";
import { POST as handleSubmitContact } from "./route";
import { GET as handleGetMessages } from "./admin/messages/route";
import { DELETE as handleDeleteMessage } from "./admin/messages/[id]/route";
import { PUT as handleToggleRead } from "./admin/messages/[id]/toggle-read/route";
import { PUT as handleMarkAllRead } from "./admin/messages/mark-all-read/route";
import { GET as handleGetDashboard } from "../admin/dashboard/route";
import { GET as handleGetAdminUsers } from "../admin/users/route";
import { PUT as handleToggleUserAdmin } from "../admin/users/[id]/toggle-admin/route";
import { createUser } from "@/lib/auth/user-repository";

describe("Contact & Admin Management Routes", () => {
  let dbFile: string;
  let adminToken: string;
  let userToken: string;

  beforeEach(async () => {
    vi.stubEnv("DATABASE_BACKEND", "SQLAlchemy");
    vi.stubEnv("JWT_SECRET", "test-contact-admin-secret-47");
    vi.stubEnv("JWT_EXP_MINUTES", "60");

    dbFile = path.join(
      process.cwd(),
      `test-contact-admin-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`,
    );
    vi.stubEnv("DATABASE_URL", `sqlite:///${dbFile.replace(/\\/g, "/")}`);
    resetDatabaseProvider();

    const provider = await getDatabaseProvider();
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), "migrations", "sqlite", "0001_initial.sql"),
      "utf-8",
    );

    const statements = migrationSql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const sql of statements) {
      await provider.execute(sql);
    }

    // Create admin user and normal user
    await createUser(provider, {
      username: "adminboss",
      email: "admin@dev47.com",
      passwordHash: "dummyhash",
      isAdmin: true,
    });
    await createUser(provider, {
      username: "regularjoe",
      email: "joe@dev47.com",
      passwordHash: "dummyhash",
      isAdmin: false,
    });

    adminToken = createJwtToken("adminboss", 1, true, "test-contact-admin-secret-47");
    userToken = createJwtToken("regularjoe", 2, false, "test-contact-admin-secret-47");
  });

  afterEach(async () => {
    resetDatabaseProvider();
    vi.unstubAllEnvs();
    if (dbFile && fs.existsSync(dbFile)) {
      try {
        fs.unlinkSync(dbFile);
      } catch {
        // ignore
      }
    }
  });

  describe("Contact Form & Admin Messages", () => {
    it("submits a contact message with camelCase or snake_case preferred contact method", async () => {
      const res = await handleSubmitContact(
        new Request("http://localhost:3000/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Alice Recruiter",
            email: "alice@recruiter.com",
            subject: "Exciting Role",
            message: "We loved your portfolio and would like to chat.",
            phone: "+1 555-0199",
            preferredContactMethod: "email",
          }),
        }),
      );
      expect(res.status).toBe(201);
      const data = (await res.json()) as Record<string, any>;
      expect(data.name).toBe("Alice Recruiter");
      expect(data.preferred_contact_method).toBe("email");
      expect(data.is_read).toBe(false);
      expect(data.read_at).toBeNull();
    });

    it("requires admin for admin messages endpoints", async () => {
      const unauth = await handleGetMessages(new Request("http://localhost:3000/api/contact/admin/messages"));
      expect(unauth.status).toBe(401);

      const forbidden = await handleGetMessages(
        new Request("http://localhost:3000/api/contact/admin/messages", {
          headers: { Authorization: `Bearer ${userToken}` },
        }),
      );
      expect(forbidden.status).toBe(403);
    });

    it("lists, toggles, marks all read, and deletes messages", async () => {
      // Create 2 messages
      await handleSubmitContact(
        new Request("http://localhost:3000/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Msg 1",
            email: "m1@example.com",
            subject: "Topic 1",
            message: "Body 1",
          }),
        }),
      );
      const msg2Res = await handleSubmitContact(
        new Request("http://localhost:3000/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Msg 2",
            email: "m2@example.com",
            subject: "Topic 2",
            message: "Body 2",
          }),
        }),
      );
      const msg2 = (await msg2Res.json()) as Record<string, any>;

      // Get messages list with filter counts
      const listRes = await handleGetMessages(
        new Request("http://localhost:3000/api/contact/admin/messages", {
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
      );
      expect(listRes.status).toBe(200);
      const listData = (await listRes.json()) as Record<string, any>;
      expect(listData.total).toBe(2);
      expect(listData.counts.all).toBe(2);
      expect(listData.counts.unread).toBe(2);
      expect(listData.counts.read).toBe(0);

      // Toggle read on msg2
      const toggleRes = await handleToggleRead(
        new Request(`http://localhost:3000/api/contact/admin/messages/${msg2.id}/toggle-read`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
        { params: Promise.resolve({ id: String(msg2.id) }) },
      );
      expect(toggleRes.status).toBe(200);
      const toggleData = (await toggleRes.json()) as Record<string, any>;
      expect(toggleData.is_read).toBe(true);
      expect(toggleData.read_at).not.toBeNull();

      // Mark all read
      const markAllRes = await handleMarkAllRead(
        new Request("http://localhost:3000/api/contact/admin/messages/mark-all-read", {
          method: "PUT",
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
      );
      expect(markAllRes.status).toBe(200);
      const markAllData = (await markAllRes.json()) as Record<string, any>;
      expect(markAllData.updated_count).toBe(1); // msg1 was still unread

      // Delete message
      const delRes = await handleDeleteMessage(
        new Request(`http://localhost:3000/api/contact/admin/messages/${msg2.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
        { params: Promise.resolve({ id: String(msg2.id) }) },
      );
      expect(delRes.status).toBe(200);
    });
  });

  describe("Admin Dashboard & Users", () => {
    it("returns dashboard counts", async () => {
      const res = await handleGetDashboard(
        new Request("http://localhost:3000/api/admin/dashboard", {
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
      );
      expect(res.status).toBe(200);
      const stats = (await res.json()) as Record<string, any>;
      expect(stats.users_count).toBe(2);
      expect(stats.projects_count).toBe(0);
      expect(stats.blogs_count).toBe(0);
      expect(stats.certifications_count).toBe(0);
      expect(stats.contact_messages_count).toBe(0);
    });

    it("lists paginated users and toggles admin status", async () => {
      // Get users
      const usersRes = await handleGetAdminUsers(
        new Request("http://localhost:3000/api/admin/users", {
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
      );
      expect(usersRes.status).toBe(200);
      const usersData = (await usersRes.json()) as Record<string, any>;
      expect(usersData.total).toBe(2);
      expect(usersData.users.length).toBe(2);

      // Toggle admin status of regularjoe (id: 2)
      const toggleRes = await handleToggleUserAdmin(
        new Request("http://localhost:3000/api/admin/users/2/toggle-admin", {
          method: "PUT",
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
        { params: Promise.resolve({ id: "2" }) },
      );
      expect(toggleRes.status).toBe(200);
      const toggleData = (await toggleRes.json()) as Record<string, any>;
      expect(toggleData.message).toBe("User admin status updated");
      expect(toggleData.user.is_admin).toBe(true);
    });
  });
});
