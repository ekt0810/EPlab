import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "work/classroom-preview");
await fs.mkdir(dir, { recursive: true });
await fs.writeFile(path.join(dir, "stop"), "stop local classroom preview");
console.log(
  "Requested local classroom preview stop. Public EP LAB is unchanged.",
);
