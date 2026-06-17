import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { registerResource } from "../core/resource.js";

/**
 * The remaining feature areas (PRD §5.1 households, §5.2 roles, §5.8 activity
 * logs, §5.9 documents, §5.10 equipment, §5.13 reminder rules, §5.12
 * registrations). Each gets the non-negotiables — validation, RBAC, error
 * handling — via the shared resource factory. Deeper per-area logic is layered
 * on as those areas are prioritized (ponytail).
 */
export function registerSimpleResources(app: FastifyInstance) {
  // §5.1 Households
  registerResource(app, {
    name: "households",
    schema: z
      .object({
        name: z.string().min(1).max(120),
        guardianIds: z.array(z.string().max(64)).default([]),
        scoutIds: z.array(z.string().max(64)).default([]),
      })
      .strict(),
  });

  // §5.2 Roles & position-based permissions
  registerResource(app, {
    name: "roles",
    schema: z
      .object({
        position: z.string().min(1).max(80),
        personId: z.string().max(64).optional(),
        permissions: z.array(z.string().max(40)).default([]),
        termStart: z.string().date().optional(),
        termEnd: z.string().date().optional(),
      })
      .strict(),
    writeRoles: ["admin"],
  });

  // §5.8 Activity logs (service hours, nights camped, miles)
  registerResource(app, {
    name: "activity-logs",
    schema: z
      .object({
        memberId: z.string().min(1).max(64),
        kind: z.enum(["service_hours", "nights_camped", "miles_hiked"]),
        quantity: z.number().nonnegative(),
        occurredOn: z.string().date(),
        eventId: z.string().max(64).optional(),
      })
      .strict(),
  });

  // §5.9 Documents & forms (medical access is restricted to leaders/admins)
  registerResource(app, {
    name: "documents",
    schema: z
      .object({
        title: z.string().min(1).max(160),
        type: z.enum(["medical", "permission_slip", "form", "file"]),
        storageKey: z.string().min(1).max(256),
        expiresOn: z.string().date().optional(),
      })
      .strict(),
    readRoles: ["admin", "leader"], // medical/PII not exposed to youth
    writeRoles: ["admin", "leader"],
  });

  // §5.10 Equipment / quartermaster
  registerResource(app, {
    name: "equipment",
    schema: z
      .object({
        name: z.string().min(1).max(120),
        condition: z.enum(["new", "good", "fair", "poor", "retired"]).default("good"),
        checkedOutTo: z.string().max(64).optional(),
      })
      .strict(),
  });

  // §5.13 Reminder rules (configurable lead times / recipients / channels)
  registerResource(app, {
    name: "reminder-rules",
    schema: z
      .object({
        type: z.enum([
          "registration_renewal",
          "training_expiry",
          "medical_expiry",
          "dues_unpaid",
          "rsvp_deadline",
          "advancement_stalled",
        ]),
        leadDays: z.array(z.number().int().nonnegative()).min(1),
        channels: z.array(z.enum(["push", "email", "sms", "in_app"])).min(1),
        recipientRoles: z.array(z.string().max(40)).default(["parent"]),
        enabled: z.boolean().default(true),
      })
      .strict(),
    writeRoles: ["admin", "leader"],
  });

  // §5.12 Registrations (per-member term/anniversary records)
  registerResource(app, {
    name: "registrations",
    schema: z
      .object({
        memberId: z.string().min(1).max(64),
        anniversaryOn: z.string().date(),
        expiresOn: z.string().date(),
        status: z
          .enum(["registered", "expiring", "lapsed", "dropped"])
          .default("registered"),
        feePaid: z.boolean().default(false),
      })
      .strict(),
    writeRoles: ["admin", "leader"],
  });
}
