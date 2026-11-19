import { pool } from "../apps/api/src/db.js";
const mode = process.argv[2];
if (!["on", "off"].includes(mode))
  throw new Error("Dùng: npm run maintenance -- on|off");
await pool.query(
  "UPDATE settings SET value=$1::jsonb WHERE key='maintenance'",
  [JSON.stringify(mode === "on")],
);
console.log(`Maintenance ${mode}`);
await pool.end();
