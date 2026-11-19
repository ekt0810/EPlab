import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../apps/api/src/config.js";
import { pool } from "../apps/api/src/db.js";
const category = process.argv
  .find((x) => x.startsWith("--category="))
  ?.split("=")[1];
if (category && !["embedded", "kicad", "solidworks"].includes(category))
  throw new Error("Danh mục không hợp lệ.");
const videos = (
  await pool.query(
    "SELECT l.id,l.slug,l.video_url FROM lessons l JOIN chapters ch ON ch.id=l.chapter_id JOIN courses c ON c.id=ch.course_id WHERE l.preview AND l.video_url IS NOT NULL AND ($1::text IS NULL OR c.category=$1) ORDER BY c.position,l.position",
    [category || null],
  )
).rows;
const browser = await chromium.launch({ channel: "msedge", headless: true });
const results = [];
for (const v of videos) {
  const id = new URL(v.video_url).searchParams.get("v");
  const page = await browser.newPage();
  let metadata: any = {};
  try {
    const r = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(v.video_url)}&format=json`,
    );
    if (r.ok) metadata = await r.json();
  } catch {}
  await page.route("**/__video-probe", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body><div id="player"></div><script>window.events=[];function onYouTubeIframeAPIReady(){window.p=new YT.Player('player',{host:'https://www.youtube-nocookie.com',width:640,height:360,videoId:'${id}',playerVars:{origin:'${config.url}',autoplay:1,mute:1,playsinline:1},events:{onReady:e=>{events.push('ready');e.target.mute();e.target.playVideo()},onStateChange:e=>events.push('state:'+e.data),onError:e=>events.push('error:'+e.data)}})}</script><script src="https://www.youtube.com/iframe_api"></script></body></html>`,
    }),
  );
  await page.goto(config.url + "/__video-probe");
  await page
    .waitForFunction(
      () =>
        ((window as any).events || []).some(
          (x: string) => x === "state:1" || x.startsWith("error:"),
        ),
      {},
      { timeout: 18000 },
    )
    .catch(() => {});
  const events = await page.evaluate(() => (window as any).events || []);
  const playable = events.includes("state:1");
  results.push({
    slug: v.slug,
    url: v.video_url,
    title: metadata.title || null,
    author: metadata.author_name || null,
    authorUrl: metadata.author_url || null,
    events,
    playable,
    checkedAt: new Date().toISOString(),
  });
  await pool.query(
    "UPDATE lessons SET video_type=$1,embed_verified=$2,source_checked_at=now() WHERE id=$3 AND video_url=$4",
    [playable ? "youtube" : "reference", playable, v.id, v.video_url],
  );
  console.log(
    `${v.slug}: ${playable ? "PLAYING VERIFIED" : "REFERENCE FALLBACK"} ${events.join(", ")}`,
  );
  await page.close();
}
await browser.close();
await fs.mkdir(path.join(config.root, "test-results"), { recursive: true });
await fs.writeFile(
  path.join(
    config.root,
    `test-results/video-check${category ? "-" + category : ""}.json`,
  ),
  JSON.stringify(results, null, 2),
);
await pool.end();
