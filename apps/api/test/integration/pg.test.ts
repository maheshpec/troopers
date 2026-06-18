import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";

/**
 * Postgres-backed integration tests. These run only when TEST_DATABASE_URL is
 * set (locally + in CI with a postgres service), so the default `npm test` on a
 * machine with no DB still passes on the in-memory backend.
 *
 * Bring up a DB and apply db/migrations/*.sql, then:
 *   TEST_DATABASE_URL=postgres://... npm test
 */
const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;

const ENV = {
  NODE_ENV: "test",
  API_AUTH_TOKENS: "admintok:admin,leadertok:leader,parenttok:parent",
  DATABASE_URL: URL,
} as NodeJS.ProcessEnv;

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

let app: FastifyInstance;
beforeAll(async () => {
  app = (await buildApp(loadConfig(ENV))).app;
  await app.ready();
});
afterAll(async () => app?.close());

d("Postgres persistence", () => {
  it("uses the postgres backend", () => {
    expect(app.repos.backend).toBe("postgres");
  });

  it("persists a member across reads (create -> list -> get)", async () => {
    // Unique id so the test is re-runnable against a persistent DB.
    const bsaMemberId = String(Date.now()).slice(-9);
    const created = await app.inject({
      method: "POST",
      url: "/api/members",
      headers: auth("leadertok"),
      payload: {
        firstName: "Persist",
        lastName: "Test",
        kind: "youth",
        program: "troop",
        bsaMemberId,
        registrationExpiresOn: "2026-12-31",
      },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().data.id;
    expect(id).toMatch(/[0-9a-f-]{36}/);

    const got = await app.inject({
      method: "GET",
      url: `/api/members/${id}`,
      headers: auth("leadertok"),
    });
    expect(got.statusCode).toBe(200);
    // DATE round-trips as a plain YYYY-MM-DD string (no TZ shift).
    expect(got.json().data.registrationExpiresOn).toBe("2026-12-31");
    expect(got.json().data.bsaMemberId).toBe(bsaMemberId);
  });

  it("patches and deletes", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/members",
      headers: auth("leadertok"),
      payload: { firstName: "Temp", lastName: "Row", kind: "adult", program: "pack" },
    });
    const id = created.json().data.id;

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/members/${id}`,
      headers: auth("leadertok"),
      payload: { lastName: "Updated" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().data.lastName).toBe("Updated");

    const del = await app.inject({
      method: "DELETE",
      url: `/api/members/${id}`,
      headers: auth("admintok"),
    });
    expect(del.statusCode).toBe(204);

    const gone = await app.inject({
      method: "GET",
      url: `/api/members/${id}`,
      headers: auth("leadertok"),
    });
    expect(gone.statusCode).toBe(404);
  });

  it("persists array columns (photos tagged youth ids)", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/photos",
      headers: auth("leadertok"),
      payload: {
        albumId: "fall-2026",
        storageKey: "r2/abc.jpg",
        tags: ["campout", "cooking"],
        taggedYouthIds: ["y1", "y2"],
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().data.tags).toEqual(["campout", "cooking"]);
    expect(created.json().data.taggedYouthIds).toEqual(["y1", "y2"]);
  });

  it("upserts an RSVP on (event, member)", async () => {
    const ev = await app.inject({
      method: "POST",
      url: "/api/events",
      headers: auth("leadertok"),
      payload: {
        title: "Pinewood Derby",
        type: "ceremony",
        startsAt: "2026-10-01T18:00:00Z",
        endsAt: "2026-10-01T20:00:00Z",
      },
    });
    const eventId = ev.json().data.id;
    // RSVP references a real member (FK), so create one first.
    const m = await app.inject({
      method: "POST",
      url: "/api/members",
      headers: auth("leadertok"),
      payload: { firstName: "Rsvp", lastName: "Kid", kind: "youth", program: "pack" },
    });
    const memberId = m.json().data.id;

    const first = await app.inject({
      method: "POST",
      url: `/api/events/${eventId}/rsvp`,
      headers: auth("parenttok"),
      payload: { memberId, response: "going", guests: 2 },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: "POST",
      url: `/api/events/${eventId}/rsvp`,
      headers: auth("parenttok"),
      payload: { memberId, response: "not_going", guests: 0 },
    });
    expect(second.statusCode).toBe(200); // updated, not duplicated

    const list = await app.inject({
      method: "GET",
      url: `/api/events/${eventId}/rsvps`,
      headers: auth("leadertok"),
    });
    const mine = list.json().data.filter((r: { memberId: string }) => r.memberId === memberId);
    expect(mine).toHaveLength(1);
    expect(mine[0].response).toBe("not_going");
  });
});
