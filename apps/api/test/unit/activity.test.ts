import { describe, expect, it } from "vitest";
import { summarize, type ActivityLog } from "../../src/domain/activity.js";

const log = (o: Partial<ActivityLog>): ActivityLog => ({
  id: Math.random().toString(),
  createdAt: "x",
  memberId: "m1",
  kind: "service_hours",
  quantity: 1,
  occurredOn: "2026-05-01",
  ...o,
});

describe("activity summarize", () => {
  it("totals quantities per kind for the member", () => {
    const logs = [
      log({ memberId: "m1", kind: "service_hours", quantity: 3 }),
      log({ memberId: "m1", kind: "service_hours", quantity: 2.5 }),
      log({ memberId: "m1", kind: "nights_camped", quantity: 2 }),
      log({ memberId: "m2", kind: "service_hours", quantity: 99 }), // other member
    ];
    expect(summarize(logs, "m1")).toEqual({
      service_hours: 5.5,
      nights_camped: 2,
      miles_hiked: 0,
    });
  });

  it("handles NUMERIC-as-string quantities (pg)", () => {
    const logs = [log({ quantity: "4" as unknown as number, kind: "miles_hiked" })];
    expect(summarize(logs, "m1").miles_hiked).toBe(4);
  });

  it("returns zeros for a member with no logs", () => {
    expect(summarize([], "nobody")).toEqual({
      service_hours: 0,
      nights_camped: 0,
      miles_hiked: 0,
    });
  });
});
