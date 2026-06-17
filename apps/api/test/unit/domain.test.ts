import { describe, expect, it } from "vitest";
import { createFeatureFlags } from "../../src/featureFlags.js";
import { loadConfig } from "../../src/config.js";
import { toScoutbookFile, type AdvancementRecord } from "../../src/domain/advancement.js";
import { balanceForAccount, type Transaction } from "../../src/domain/money.js";
import {
  youthProtectionViolation,
  type MessageInput,
} from "../../src/domain/communication.js";
import { reconcileRoster } from "../../src/domain/sync.js";
import { visiblePhotos, type Photo } from "../../src/domain/photos.js";
import type { Member } from "../../src/domain/members/member.js";

describe("feature flags", () => {
  it("uses defaults when no env override", () => {
    const flags = createFeatureFlags({});
    expect(flags.isEnabled("registration_reminders")).toBe(true);
    expect(flags.isEnabled("photo_galleries")).toBe(false);
  });
  it("honors env overrides", () => {
    const flags = createFeatureFlags({ FLAG_PHOTO_GALLERIES: "true" });
    expect(flags.isEnabled("photo_galleries")).toBe(true);
  });
});

describe("config", () => {
  it("fails fast on invalid PORT", () => {
    expect(() => loadConfig({ PORT: "-1" } as NodeJS.ProcessEnv)).toThrow(
      /Invalid configuration/,
    );
  });
  it("parses lead days CSV", () => {
    const cfg = loadConfig({ REGISTRATION_REMINDER_LEAD_DAYS: "45,7" } as NodeJS.ProcessEnv);
    expect(cfg.reminders.registrationLeadDays).toEqual([45, 7]);
  });
  it("parses auth token:role pairs", () => {
    const cfg = loadConfig({ API_AUTH_TOKENS: "t1:admin,t2:parent" } as NodeJS.ProcessEnv);
    expect(cfg.authTokens.get("t1")).toBe("admin");
  });
});

describe("Scoutbook export (advancement)", () => {
  const rec = (o: Partial<AdvancementRecord>): AdvancementRecord => ({
    id: "1",
    createdAt: "x",
    bsaMemberId: "123",
    memberName: "Alex Scout",
    advancementType: "rank",
    advancement: "Tenderfoot",
    dateCompleted: "2026-05-01",
    approved: true,
    ...o,
  });
  it("includes only approved, un-submitted records, pipe-delimited", () => {
    const file = toScoutbookFile([
      rec({ id: "1" }),
      rec({ id: "2", approved: false }),
      rec({ id: "3", submittedToCouncilOn: "2026-06-01" }),
    ]);
    expect(file.count).toBe(1);
    expect(file.content.split("\n")[0]).toContain("BSA Member ID|");
    expect(file.content).toContain("123|Alex|Scout|rank|Tenderfoot|2026-05-01|Yes");
  });
  it("escapes pipe characters in data", () => {
    const file = toScoutbookFile([rec({ advancement: "First|Aid" })]);
    expect(file.content).toContain("First Aid");
  });
});

describe("money balance", () => {
  const t = (accountId: string, amountCents: number): Transaction => ({
    id: Math.random().toString(),
    createdAt: "x",
    accountId,
    amountCents,
    kind: "adjustment",
  });
  it("sums only the account's transactions", () => {
    const txns = [t("a", 5000), t("a", -2000), t("b", 999)];
    expect(balanceForAccount(txns, "a")).toBe(3000);
    expect(balanceForAccount(txns, "b")).toBe(999);
  });
});

describe("youth-protection messaging invariant", () => {
  const p = (kind: "adult" | "youth", isParentOfYouth = false) => ({
    id: Math.random().toString(),
    kind,
    isParentOfYouth,
  });
  const msg = (participants: MessageInput["participants"]): MessageInput => ({
    subject: "s",
    body: "b",
    participants,
  });
  it("blocks 1-on-1 adult↔youth", () => {
    expect(youthProtectionViolation(msg([p("adult"), p("youth")]))).toMatch(
      /Youth-protection/,
    );
  });
  it("allows adult↔youth with a second adult", () => {
    expect(
      youthProtectionViolation(msg([p("adult"), p("adult"), p("youth")])),
    ).toBeNull();
  });
  it("allows adult↔youth with a parent present", () => {
    expect(
      youthProtectionViolation(msg([p("adult"), p("youth"), p("adult", true)])),
    ).toBeNull();
  });
  it("allows adult-only and youth-only threads", () => {
    expect(youthProtectionViolation(msg([p("adult"), p("adult")]))).toBeNull();
    expect(youthProtectionViolation(msg([p("youth"), p("youth")]))).toBeNull();
  });
});

describe("roster reconcile (sync)", () => {
  it("classifies adds, drops, and matches by BSA id", () => {
    const local = [
      { bsaMemberId: "1" } as Member,
      { bsaMemberId: "2" } as Member,
    ];
    const council = [
      { bsaMemberId: "2", firstName: "B", lastName: "B" },
      { bsaMemberId: "3", firstName: "C", lastName: "C" },
    ];
    const r = reconcileRoster(local, council);
    expect(r.matched).toEqual(["2"]);
    expect(r.toAdd).toEqual(["3"]);
    expect(r.toDrop).toEqual(["1"]);
  });
});

describe("photo consent filter", () => {
  const photo = (taggedYouthIds: string[]): Photo => ({
    id: Math.random().toString(),
    createdAt: "x",
    albumId: "a",
    storageKey: "k",
    tags: [],
    taggedYouthIds,
  });
  it("hides photos tagging a youth without consent", () => {
    const photos = [photo(["y1"]), photo(["y1", "y2"]), photo([])];
    const out = visiblePhotos(photos, new Set(["y1"]));
    expect(out).toHaveLength(2); // the y1-only and the untagged
  });
});
