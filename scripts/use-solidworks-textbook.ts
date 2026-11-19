import { pool, tx } from "../apps/api/src/db.js";
import { migrate } from "../apps/api/src/migrate.js";
import { installSolidworksTextbook } from "../apps/api/src/content/install-solidworks-textbook.js";
try {
  await migrate();
  console.log(JSON.stringify(await tx(installSolidworksTextbook), null, 2));
} finally {
  await pool.end();
}
