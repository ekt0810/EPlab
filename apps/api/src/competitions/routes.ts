import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { admin } from "../security.js";
import { setting } from "../db.js";
import { presentCompetitions } from "./model.js";
import {
  readCompetitions,
  importCompetitions,
  setCompetitionHidden,
} from "./store.js";
export async function competitionRoutes(app: FastifyInstance) {
  app.get("/api/competitions", async () => {
    const result = presentCompetitions(await readCompetitions());
    const schedule = await setting("embedded_competitions_schedule");
    return { ...result, scheduleActive: schedule?.active === true };
  });
  app.get("/api/admin/competitions", async (req) => {
    admin(req);
    return {
      ...presentCompetitions(await readCompetitions(), true),
      schedule: await setting("embedded_competitions_schedule"),
    };
  });
  app.put(
    "/api/admin/competitions",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (req) => importCompetitions(req.body, admin(req).id),
  );
  app.patch("/api/admin/competitions/:id", async (req) => {
    const actor = admin(req),
      { id } = z
        .object({
          id: z
            .string()
            .regex(/^[a-z0-9-]+$/)
            .max(100),
        })
        .parse(req.params);
    const b = z
      .object({
        hidden: z.boolean(),
        expectedRevision: z.number().int().min(0),
      })
      .strict()
      .parse(req.body);
    return setCompetitionHidden(id, b.hidden, b.expectedRevision, actor.id);
  });
}
