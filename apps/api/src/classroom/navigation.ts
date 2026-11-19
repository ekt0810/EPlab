import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";
import { auth, canLearn, hasAdminAccess } from "../security.js";
import { courses } from "./catalog.js";
import type { Track } from "./model.js";

const base = (track: Track) =>
  track === "embedded" ? "/nhung-c" : `/${track}`;
export async function classroomNavigation(app: FastifyInstance) {
  app.get("/api/classroom", async (req) => {
    const statuses = (await pool.query("SELECT category,status FROM courses"))
      .rows;
    return Object.values(courses).flatMap((course) => {
      const status = statuses.find((s) => s.category === course.track)?.status;
      if (status !== "published" && !hasAdminAccess(req.actor)) return [];
      return [
        {
          track: course.track,
          title: course.title,
          description: course.description,
          version: course.version,
          lessonCount: course.lessons.length,
          moduleCount: course.modules.length,
          previews: course.lessons
            .filter((l) => l.preview)
            .map((l) => ({ id: l.id, title: l.title, minutes: l.minutes })),
        },
      ];
    });
  });
  app.get("/api/classroom/progress", async (req) => {
    const user = auth(req);
    const statuses = (await pool.query("SELECT category,status FROM courses"))
      .rows;
    const rows = (
      await pool.query(
        "SELECT track,lesson_id,completed,scene,updated_at FROM classroom_progress WHERE user_id=$1 ORDER BY updated_at DESC",
        [user.id],
      )
    ).rows;
    return rows.flatMap((row) => {
      const track = row.track as Track,
        course = courses[track];
      const lesson = course?.lessons.find((l) => l.id === row.lesson_id);
      if (
        !lesson ||
        !canLearn(req.actor, {
          status: "published",
          course_status:
            statuses.find((s) => s.category === track)?.status || "draft",
          preview: lesson.preview,
        })
      )
        return [];
      return [
        {
          ...row,
          slug: `${track}-${lesson.id}`,
          title: lesson.title,
          course_title: course.title,
          href: `${base(track)}/lop-hoc/${lesson.id}`,
        },
      ];
    });
  });
}
