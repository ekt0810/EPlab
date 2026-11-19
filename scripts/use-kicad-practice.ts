import { migrate } from "../apps/api/src/migrate.js";
import { pool, tx } from "../apps/api/src/db.js";
import { installKicadPractice } from "../apps/api/src/practice/install.js";
try {
  await migrate();
  console.log(JSON.stringify(await tx(installKicadPractice)));
} finally {
  await pool.end();
}
