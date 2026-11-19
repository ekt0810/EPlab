import { installParticipantHandbooks } from "../apps/api/src/content/install-participant-handbooks.js";
import { pool } from "../apps/api/src/db.js";
try {
  console.log(JSON.stringify(await installParticipantHandbooks()));
} finally {
  await pool.end();
}
