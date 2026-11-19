import { migrate } from "../apps/api/src/migrate.js";
import { pool, tx } from "../apps/api/src/db.js";
import { installCourseExercises } from "../apps/api/src/practice/course-exercises.js";
try {
  await migrate();
  console.log(JSON.stringify(await tx(installCourseExercises)));
} finally {
  await pool.end();
}
