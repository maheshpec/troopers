import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../auth.js";
import { registerResource, type Entity, type Repository } from "../core/resource.js";

/**
 * PRD §5.15 Photos & Media. COPPA / youth-protection invariant: a photo that
 * tags a youth WITHOUT that youth's consent flag is excluded from shared
 * galleries. Enforced in the read path, not just the UI.
 */
export const PhotoSchema = z
  .object({
    albumId: z.string().min(1).max(64),
    storageKey: z.string().min(1).max(256), // object-storage key (Cloudflare R2)
    tags: z.array(z.string().max(40)).max(30).default([]),
    taggedYouthIds: z.array(z.string().max(64)).max(50).default([]),
  })
  .strict();

export type Photo = z.infer<typeof PhotoSchema> & Entity;

/** Photos are visible only if every tagged youth has consent. */
export function visiblePhotos(
  photos: ReadonlyArray<Photo>,
  consentedYouthIds: ReadonlySet<string>,
): Photo[] {
  return photos.filter((p) =>
    p.taggedYouthIds.every((id) => consentedYouthIds.has(id)),
  );
}

export function registerPhotos(
  app: FastifyInstance,
  /** Returns the set of youth ids whose guardians have granted photo consent. */
  consentedYouthIds: () => Promise<ReadonlySet<string>>,
) {
  const repo = registerResource(app, {
    name: "photos",
    schema: PhotoSchema,
    columns: ["album_id", "storage_key", "tags", "tagged_youth_ids"],
    writeRoles: ["admin", "leader"],
  }) as Repository<Photo>;

  app.get(
    "/api/galleries/:albumId",
    { preHandler: requireRole("admin", "leader", "parent", "scout") },
    async (req) => {
      const { albumId } = req.params as { albumId: string };
      const all = (await repo.list()).filter((p) => p.albumId === albumId);
      const consented = await consentedYouthIds();
      return { data: visiblePhotos(all, consented) };
    },
  );

  return repo;
}
