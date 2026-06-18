import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";

const ENV = {
  NODE_ENV: "test",
  API_AUTH_TOKENS: "admintok:admin,leadertok:leader,parenttok:parent,scouttok:scout",
  FLAG_REGISTRATION_REMINDERS: "true",
} as NodeJS.ProcessEnv;

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

let app: FastifyInstance;
beforeAll(async () => {
  app = (await buildApp(loadConfig(ENV))).app;
  await app.ready();
});
afterAll(async () => app.close());

describe("health & ops endpoints", () => {
  it("GET /healthz is public", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
  it("GET /metrics exposes Prometheus text", async () => {
    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("http_requests_total");
  });
});

describe("members CRUD + registration reminders", () => {
  let memberId: string;

  it("rejects unauthenticated access (OWASP A01)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/members" });
    expect(res.statusCode).toBe(401);
  });

  it("creates a member (leader)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/members",
      headers: auth("leadertok"),
      payload: {
        firstName: "Alex",
        lastName: "Scout",
        kind: "youth",
        program: "troop",
        registrationExpiresOn: "2026-07-17",
      },
    });
    expect(res.statusCode).toBe(201);
    memberId = res.json().data.id;
    expect(memberId).toBeTruthy();
  });

  it("rejects invalid input with 400 + details (OWASP A03)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/members",
      headers: auth("leadertok"),
      payload: { firstName: "", kind: "alien", program: "troop" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("validation_error");
  });

  it("forbids parents from creating members (RBAC)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/members",
      headers: auth("parenttok"),
      payload: { firstName: "X", lastName: "Y", kind: "adult", program: "pack" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("computes registration reminders for leaders only", async () => {
    const ok = await app.inject({
      method: "GET",
      url: "/api/members/registration/reminders",
      headers: auth("leadertok"),
    });
    expect(ok.statusCode).toBe(200);
    expect(Array.isArray(ok.json().data)).toBe(true);

    const denied = await app.inject({
      method: "GET",
      url: "/api/members/registration/reminders",
      headers: auth("scouttok"),
    });
    expect(denied.statusCode).toBe(403);
  });
});

describe("advancement Scoutbook export", () => {
  it("returns a pipe-delimited attachment", async () => {
    await app.inject({
      method: "POST",
      url: "/api/advancement",
      headers: auth("admintok"),
      payload: {
        bsaMemberId: "12345",
        memberName: "Alex Scout",
        advancementType: "rank",
        advancement: "Tenderfoot",
        dateCompleted: "2026-05-01",
        approved: true,
      },
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/advancement/export/scoutbook",
      headers: auth("admintok"),
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.body).toContain("12345|Alex|Scout|rank|Tenderfoot");
  });
});

describe("events RSVP", () => {
  it("accepts an RSVP against a real event", async () => {
    const ev = await app.inject({
      method: "POST",
      url: "/api/events",
      headers: auth("leadertok"),
      payload: {
        title: "Fall Campout",
        type: "campout",
        startsAt: "2026-09-12T16:00:00Z",
        endsAt: "2026-09-14T12:00:00Z",
      },
    });
    const id = ev.json().data.id;
    const rsvp = await app.inject({
      method: "POST",
      url: `/api/events/${id}/rsvp`,
      headers: auth("parenttok"),
      payload: { memberId: "m1", response: "going", guests: 1 },
    });
    expect(rsvp.statusCode).toBe(201);
    expect(rsvp.json().data.response).toBe("going");
  });

  it("rejects an event with endsAt before startsAt", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/events",
      headers: auth("leadertok"),
      payload: {
        title: "Bad",
        type: "meeting",
        startsAt: "2026-09-14T12:00:00Z",
        endsAt: "2026-09-12T16:00:00Z",
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("communication youth-protection guard", () => {
  it("blocks a 1-on-1 adult↔youth message", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/messages",
      headers: auth("leadertok"),
      payload: {
        subject: "Hi",
        body: "Meet me",
        participants: [
          { id: "a1", kind: "adult" },
          { id: "y1", kind: "youth" },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("youth_protection");
  });

  it("persists a compliant message and exposes it in the audit view", async () => {
    const post = await app.inject({
      method: "POST",
      url: "/api/messages",
      headers: auth("leadertok"),
      payload: {
        subject: "Committee sync",
        body: "Agenda attached",
        participants: [
          { id: "a1", kind: "adult" },
          { id: "a2", kind: "adult" },
        ],
      },
    });
    expect(post.statusCode).toBe(201);
    expect(post.json().data.id).toBeTruthy();

    const audit = await app.inject({
      method: "GET",
      url: "/api/messages",
      headers: auth("admintok"),
    });
    expect(audit.statusCode).toBe(200);
    const found = audit.json().data.find((m: { subject: string }) => m.subject === "Committee sync");
    expect(found).toBeTruthy();
    expect(found.participants).toHaveLength(2); // round-tripped from JSON
    expect(found.senderRole).toBe("leader");

    // Youth must not see the audit view (A01).
    const denied = await app.inject({
      method: "GET",
      url: "/api/messages",
      headers: auth("scouttok"),
    });
    expect(denied.statusCode).toBe(403);
  });
});

describe("photo consent filter (COPPA)", () => {
  it("hides photos tagging a youth without consent", async () => {
    const mk = async (photoConsent: boolean) =>
      (
        await app.inject({
          method: "POST",
          url: "/api/members",
          headers: auth("leadertok"),
          payload: { firstName: "Y", lastName: "S", kind: "youth", program: "troop", photoConsent },
        })
      ).json().data.id as string;

    const consented = await mk(true);
    const notConsented = await mk(false);

    const addPhoto = (taggedYouthIds: string[]) =>
      app.inject({
        method: "POST",
        url: "/api/photos",
        headers: auth("leadertok"),
        payload: { albumId: "consent-test", storageKey: `k/${Math.random()}`, taggedYouthIds },
      });
    await addPhoto([consented]);
    await addPhoto([notConsented]);
    await addPhoto([consented, notConsented]); // mixed -> hidden

    const res = await app.inject({
      method: "GET",
      url: "/api/galleries/consent-test",
      headers: auth("parenttok"),
    });
    expect(res.statusCode).toBe(200);
    const photos = res.json().data;
    // Only the all-consented photo is visible.
    expect(photos).toHaveLength(1);
    expect(photos[0].taggedYouthIds).toEqual([consented]);
  });
});

describe("settings configurable durations", () => {
  it("returns defaults and accepts admin updates", async () => {
    const get = await app.inject({
      method: "GET",
      url: "/api/settings",
      headers: auth("leadertok"),
    });
    expect(get.json().data.medicalValidityMonths).toBe(12);

    const put = await app.inject({
      method: "PUT",
      url: "/api/settings",
      headers: auth("admintok"),
      payload: { rsvpWindowDays: 10 },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().data.rsvpWindowDays).toBe(10);

    const denied = await app.inject({
      method: "PUT",
      url: "/api/settings",
      headers: auth("leadertok"),
      payload: { rsvpWindowDays: 3 },
    });
    expect(denied.statusCode).toBe(403);
  });
});
