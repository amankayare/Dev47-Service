import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJwtToken } from "@/lib/auth/jwt";
import { getDatabaseProvider, resetDatabaseProvider } from "@/lib/database";
import {
  GET as handleGetAbout,
  POST as handleCreateAbout,
  PUT as handleUpdateAbout,
  DELETE as handleDeleteAbout,
} from "../about/route";
import {
  GET as handleGetCerts,
  POST as handleCreateCert,
} from "../certifications/route";
import {
  GET as handleGetCertById,
  PUT as handleUpdateCert,
  DELETE as handleDeleteCert,
} from "../certifications/[id]/route";
import {
  GET as handleGetExperiences,
  POST as handleCreateExperience,
} from "../experiences/route";
import {
  GET as handleGetExpById,
  PUT as handleUpdateExp,
  DELETE as handleDeleteExp,
} from "../experiences/[id]/route";
import {
  GET as handleGetSkills,
  POST as handleCreateSkill,
} from "../technical-skills/route";
import {
  GET as handleGetSkillById,
  PUT as handleUpdateSkill,
  DELETE as handleDeleteSkill,
} from "../technical-skills/[id]/route";

describe("Portfolio Content Routes (About, Certifications, Experiences, Technical Skills)", () => {
  let dbFile: string;
  let adminToken: string;
  let userToken: string;

  beforeEach(async () => {
    vi.stubEnv("DATABASE_BACKEND", "SQLAlchemy");
    vi.stubEnv("JWT_SECRET", "test-content-secret-key-47");
    vi.stubEnv("JWT_EXP_MINUTES", "60");

    dbFile = path.join(
      process.cwd(),
      `test-content-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`,
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

    adminToken = createJwtToken("admin", 1, true, "test-content-secret-key-47");
    userToken = createJwtToken("user", 2, false, "test-content-secret-key-47");
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

  describe("/api/about", () => {
    it("GET returns empty object when no about record exists", async () => {
      const res = await handleGetAbout(new Request("http://localhost:3000/api/about"));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({});
    });

    it("POST creates about and PUT updates it", async () => {
      // Create
      const postRes = await handleCreateAbout(
        new Request("http://localhost:3000/api/about", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            name: "Aman Kayare",
            headline: "Software Engineer",
            bio: "Full Stack Engineer & Cloud Architect",
            social_links: { github: "https://github.com/amankayare" },
          }),
        }),
      );
      expect(postRes.status).toBe(201);
      const postData = (await postRes.json()) as Record<string, any>;
      expect(postData.name).toBe("Aman Kayare");
      expect(postData.social_links).toEqual({ github: "https://github.com/amankayare" });

      // Reject second create
      const dupRes = await handleCreateAbout(
        new Request("http://localhost:3000/api/about", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({ name: "Duplicate" }),
        }),
      );
      expect(dupRes.status).toBe(400);

      // PUT update
      const putRes = await handleUpdateAbout(
        new Request("http://localhost:3000/api/about", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            headline: "Senior Software Engineer",
            location: "San Francisco, CA",
          }),
        }),
      );
      expect(putRes.status).toBe(200);
      const putData = (await putRes.json()) as Record<string, any>;
      expect(putData.headline).toBe("Senior Software Engineer");
      expect(putData.location).toBe("San Francisco, CA");
      expect(putData.name).toBe("Aman Kayare"); // preserved

      // DELETE
      const delRes = await handleDeleteAbout(
        new Request("http://localhost:3000/api/about", {
          method: "DELETE",
          headers: { Authorization: `Bearer ${userToken}` },
        }),
      );
      expect(delRes.status).toBe(204);

      // Subsequent GET returns empty object
      const getRes = await handleGetAbout(new Request("http://localhost:3000/api/about"));
      expect(await getRes.json()).toEqual({});
    });
  });

  describe("/api/certifications", () => {
    it("manages certifications with admin privileges", async () => {
      // POST certification
      const postRes = await handleCreateCert(
        new Request("http://localhost:3000/api/certifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            name: "AWS Solutions Architect",
            issuer: "Amazon Web Services",
            date: "2023-05-01",
            credential_url: "https://aws.amazon.com/verify",
            skills: [{ name: "Cloud" }, { name: "Architecture" }],
            is_visible: true,
          }),
        }),
      );
      expect(postRes.status).toBe(201);
      const created = (await postRes.json()) as Record<string, any>;
      expect(created.name).toBe("AWS Solutions Architect");
      expect(created.skills).toEqual(["Cloud", "Architecture"]);
      const certId = created.id;

      // GET list
      const listRes = await handleGetCerts(new Request("http://localhost:3000/api/certifications"));
      expect(listRes.status).toBe(200);
      const listData = (await listRes.json()) as Array<Record<string, any>>;
      expect(listData.length).toBe(1);

      // PUT update
      const updateRes = await handleUpdateCert(
        new Request(`http://localhost:3000/api/certifications/${certId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            name: "AWS Solutions Architect Professional",
          }),
        }),
        { params: Promise.resolve({ id: String(certId) }) },
      );
      expect(updateRes.status).toBe(200);
      const updated = (await updateRes.json()) as Record<string, any>;
      expect(updated.name).toBe("AWS Solutions Architect Professional");

      // DELETE
      const delRes = await handleDeleteCert(
        new Request(`http://localhost:3000/api/certifications/${certId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
        { params: Promise.resolve({ id: String(certId) }) },
      );
      expect(delRes.status).toBe(204);
    });
  });

  describe("/api/experiences", () => {
    it("handles visibility filtering and current experience toggle", async () => {
      // Create first experience (current=true)
      const exp1Res = await handleCreateExperience(
        new Request("http://localhost:3000/api/experiences", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            title: "Senior Engineer",
            company: "Tech Corp",
            start_date: "2023-01-01",
            is_current: true,
            is_visible: true,
            order: 2,
          }),
        }),
      );
      expect(exp1Res.status).toBe(201);
      const exp1 = ((await exp1Res.json()) as Record<string, any>).experience;
      expect(exp1.is_current).toBe(true);
      expect(exp1.period).toContain("Present");

      // Create second experience (hidden, is_visible=false)
      const exp2Res = await handleCreateExperience(
        new Request("http://localhost:3000/api/experiences", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            title: "Junior Engineer",
            company: "Startup Inc",
            start_date: "2021-01-01",
            end_date: "2022-12-31",
            is_current: false,
            is_visible: false,
            order: 1,
          }),
        }),
      );
      expect(exp2Res.status).toBe(201);

      // Public view returns only visible (1 item)
      const publicRes = await handleGetExperiences(new Request("http://localhost:3000/api/experiences"));
      expect(publicRes.status).toBe(200);
      const publicData = (await publicRes.json()) as Array<Record<string, any>>;
      expect(publicData.length).toBe(1);
      expect(publicData[0].title).toBe("Senior Engineer");

      // Admin query param view returns both (2 items)
      const adminRes = await handleGetExperiences(new Request("http://localhost:3000/api/experiences?admin=true"));
      expect(adminRes.status).toBe(200);
      const adminData = (await adminRes.json()) as Array<Record<string, any>>;
      expect(adminData.length).toBe(2);
      expect(adminData[0].title).toBe("Senior Engineer"); // order 2
      expect(adminData[1].title).toBe("Junior Engineer"); // order 1

      // GET by ID
      const singleRes = await handleGetExpById(
        new Request(`http://localhost:3000/api/experiences/${exp1.id}`),
        { params: Promise.resolve({ id: String(exp1.id) }) },
      );
      expect(singleRes.status).toBe(200);

      // DELETE
      const delRes = await handleDeleteExp(
        new Request(`http://localhost:3000/api/experiences/${exp1.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
        { params: Promise.resolve({ id: String(exp1.id) }) },
      );
      expect(delRes.status).toBe(200);
    });
  });

  describe("/api/technical-skills", () => {
    it("handles technical skill categories and items", async () => {
      // POST skill category
      const postRes = await handleCreateSkill(
        new Request("http://localhost:3000/api/technical-skills", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            title: "Frontend Development",
            skills: ["React", "TypeScript", "Next.js", "Tailwind CSS"],
            color: "from-blue-500 to-cyan-500",
            icon: "Code",
            order: 1,
            is_visible: true,
          }),
        }),
      );
      expect(postRes.status).toBe(201);
      const created = (await postRes.json()) as Record<string, any>;
      expect(created.title).toBe("Frontend Development");
      expect(created.skills).toEqual(["React", "TypeScript", "Next.js", "Tailwind CSS"]);
      const skillId = created.id;

      // GET list
      const getRes = await handleGetSkills(new Request("http://localhost:3000/api/technical-skills"));
      expect(getRes.status).toBe(200);
      const listData = (await getRes.json()) as Array<Record<string, any>>;
      expect(listData.length).toBe(1);

      // PUT update
      const putRes = await handleUpdateSkill(
        new Request(`http://localhost:3000/api/technical-skills/${skillId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            skills: ["React 19", "TypeScript 5", "Next.js 16"],
          }),
        }),
        { params: Promise.resolve({ id: String(skillId) }) },
      );
      expect(putRes.status).toBe(200);
      const updated = (await putRes.json()) as Record<string, any>;
      expect(updated.skills).toEqual(["React 19", "TypeScript 5", "Next.js 16"]);

      // DELETE
      const delRes = await handleDeleteSkill(
        new Request(`http://localhost:3000/api/technical-skills/${skillId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${userToken}` },
        }),
        { params: Promise.resolve({ id: String(skillId) }) },
      );
      expect(delRes.status).toBe(200);
      expect(((await delRes.json()) as Record<string, any>).message).toBe(
        "Technical skill deleted successfully",
      );
    });
  });
});
