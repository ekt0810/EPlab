import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import sharp from "sharp";
import { pool } from "../apps/api/src/db.js";
import { migrate } from "../apps/api/src/migrate.js";
import { seed } from "../apps/api/src/seed.js";
import { hashPassword } from "../apps/api/src/auth.js";
import { reserveAdmins } from "../scripts/admin.js";
import { normalizeImages } from "../apps/api/src/practice/validation.js";
import { inspectAttachments } from "../apps/api/src/practice/attachments.js";

/** Representative data for round-trip integrity, never a production seed. */
export async function seedBackupFixtures() {
  assert.match(
    (await pool.query("SELECT current_database() AS name")).rows[0].name,
    /^eplab_test_backup_[a-f0-9]{12}$/,
  );
  await migrate();
  await seed();
  await reserveAdmins(["one@example.test", "two@example.test"]);
  const hashed = await hashPassword(randomBytes(24).toString("hex"));
  await pool.query(
    "UPDATE users SET password_hash=$1,verified=true,setup_pending=false WHERE role='admin'",
    [hashed],
  );
  const admin = (await pool.query("SELECT id FROM users WHERE admin_slot=1"))
    .rows[0].id;
  const user = (
    await pool.query(
      "INSERT INTO users(email,name,password_hash,phone,verified) VALUES('backup@example.test','Backup fixture',$1,'0900000099',true) RETURNING id",
      [hashed],
    )
  ).rows[0].id;
  await pool.query(
    "INSERT INTO lab_memberships(user_id,status,tracks,message,reviewed_by,reviewed_at) VALUES($1,'approved',ARRAY['embedded','kicad','solidworks'],'Isolated backup fixture',$2,now())",
    [user, admin],
  );
  await pool.query(
    "INSERT INTO sessions(id,user_id,csrf,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
    [randomBytes(32).toString("hex"), user, randomBytes(32).toString("hex")],
  );
  const lesson = (
    await pool.query("SELECT id FROM lessons WHERE preview LIMIT 1")
  ).rows[0].id;
  await pool.query(
    "INSERT INTO progress(user_id,lesson_id,completed,note) VALUES($1,$2,true,'Private backup fixture note')",
    [user, lesson],
  );
  const order = (
    await pool.query(
      "INSERT INTO orders(user_id,code,amount,status,bank_snapshot,expires_at) VALUES($1,'BACKUP-FIXTURE',150000,'paid','{}',now()+interval '1 day') RETURNING id",
      [user],
    )
  ).rows[0].id;
  await pool.query(
    "INSERT INTO payment_transactions(order_id,reference,amount,verified_by,source,note) VALUES($1,'BACKUP-HISTORY',150000,$2,'fixture','Synthetic historical record; no bank transaction')",
    [order, admin],
  );
  await pool.query("INSERT INTO entitlements(user_id,order_id) VALUES($1,$2)", [
    user,
    order,
  ]);
  const image = await sharp({
    create: { width: 300, height: 200, channels: 3, background: "#e5eeee" },
  })
    .png()
    .toBuffer();
  const images = JSON.stringify(await normalizeImages([image]));
  const digest = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  for (const [track, exerciseId, filename, content] of [
    ["embedded", "c01", "main.c", "int main(void) { return 0; }\n"],
    [
      "solidworks",
      "s02",
      "part.step",
      "ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n",
    ],
  ] as const) {
    const exercise = (
      await pool.query("SELECT body FROM exercises WHERE id=$1", [exerciseId])
    ).rows[0].body;
    const attachments = inspectAttachments(
      [{ name: filename, bytes: Buffer.from(content) }],
      track,
    );
    const assignment = (
      await pool.query(
        "INSERT INTO assignments(exercise_id,student_id,created_by,instructions) VALUES($1,$2,$3,'Backup fixture assignment') RETURNING id",
        [exerciseId, user, admin],
      )
    ).rows[0].id;
    const result = {
      score: 100,
      status: "visual_pass",
      feedback: "Backup fixture review",
      criteria: [],
    };
    const submission = (
      await pool.query(
        "INSERT INTO submissions(user_id,exercise_id,assignment_id,status,notes,images,image_count,image_hash,fingerprint,rubric,attachments,result,revision) VALUES($1,$2,$3,'visual_pass','Backup fixture submission',$4,1,$5,$6,$7,$8,$9,1) RETURNING id",
        [
          user,
          exerciseId,
          assignment,
          images,
          digest(images),
          digest(exerciseId),
          JSON.stringify(exercise),
          JSON.stringify(attachments),
          JSON.stringify(result),
        ],
      )
    ).rows[0].id;
    await pool.query(
      "INSERT INTO submission_reviews(submission_id,reviewer_id,result) VALUES($1,$2,$3)",
      [submission, admin, JSON.stringify(result)],
    );
    const thread = (
      await pool.query(
        "INSERT INTO practice_threads(exercise_id,participant_id,subject) VALUES($1,$2,'Backup fixture discussion') RETURNING id",
        [exerciseId, user],
      )
    ).rows[0].id;
    await pool.query(
      "INSERT INTO practice_messages(thread_id,author_id,client_id,body) VALUES($1,$2,$3,'Private fixture message')",
      [thread, user, randomUUID()],
    );
  }
  await pool.query(
    "INSERT INTO classroom_progress(user_id,track,lesson_id,scene,note,checklist,completed) VALUES($1,'solidworks','s02',2,'Private visual-learning draft','[true,false]',true)",
    [user],
  );
  await pool.query(
    "INSERT INTO classroom_messages(user_id,track,lesson_id,role,question,answer,mode,evidence) VALUES($1,'solidworks','s02','teacher','Fixture question','Fixture answer','guide',$2)",
    [
      user,
      JSON.stringify({
        lessons: ["s02"],
        videos: [{ title: "Fixture video" }],
      }),
    ],
  );
  await pool.query("UPDATE submissions SET self_checks=$1 WHERE user_id=$2", [
    JSON.stringify([
      { index: 0, status: "fail", observed: "Private self-check fixture" },
    ]),
    user,
  ]);
}
