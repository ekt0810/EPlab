import { migrate } from "../apps/api/src/migrate.js";
import { pool, tx } from "../apps/api/src/db.js";
import { installPathways } from "../apps/api/src/practice/install-pathways.js";
try {
  await migrate();
  console.log(JSON.stringify(await tx(installPathways)));
} finally {
  await pool.end();
}
