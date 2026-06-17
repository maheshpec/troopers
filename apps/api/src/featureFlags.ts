/**
 * Minimal feature-flag service. YAGNI: no external SaaS (LaunchDarkly) yet —
 * flags are env-driven (12-factor) with safe defaults. The interface is the
 * upgrade seam.
 *
 * ponytail: in-process env flags. Upgrade path -> back with a `feature_flags`
 * table + admin UI (PRD §5.14 FR-CFG-7) or a provider behind this same
 * `FeatureFlags` interface, so call sites never change.
 */
export type FlagName = "registration_reminders" | "photo_galleries";

const DEFAULTS: Record<FlagName, boolean> = {
  registration_reminders: true,
  photo_galleries: false,
};

export interface FeatureFlags {
  isEnabled(flag: FlagName): boolean;
  all(): Record<FlagName, boolean>;
}

export function createFeatureFlags(
  env: NodeJS.ProcessEnv = process.env,
): FeatureFlags {
  const resolved = { ...DEFAULTS };
  for (const name of Object.keys(DEFAULTS) as FlagName[]) {
    const raw = env[`FLAG_${name.toUpperCase()}`];
    if (raw !== undefined) resolved[name] = raw === "true";
  }
  return {
    isEnabled: (flag) => resolved[flag] ?? false,
    all: () => ({ ...resolved }),
  };
}
