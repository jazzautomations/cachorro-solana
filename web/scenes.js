const { chromium } = require("playwright-core");
const URL = "http://localhost:8790";
const SCENES = [
  // [name, seconds, action description — executed inline below]
  ["s1", 7.5, "hero"],
  ["s2", 11.5, "scroll"],
  ["s3", 9.8, "gate"],
  ["s4", 8.8, "stack"],
  ["s5", 9.8, "receipt-cert"],
  ["s6", 9.2, "verify"],
  ["s7", 6.0, "outro"],
];
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox"] });
  for (const [name, secs, kind] of SCENES) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: `/tmp/vidwork/scenes/${name}`, size: { width: 1280, height: 800 } } });
    const p = await ctx.newPage();
    const t0 = Date.now();
    const settle = () => p.waitForTimeout(Math.max(200, secs * 1000 - (Date.now() - t0)));
    try {
      if (kind === "hero") {
        await p.goto(URL + "/", { waitUntil: "networkidle", timeout: 30000 });
        await settle();
      } else if (kind === "scroll") {
        await p.goto(URL + "/", { waitUntil: "networkidle", timeout: 30000 });
        const steps = 10, per = Math.max(300, (secs * 1000) / steps - 300);
        for (let i = 0; i < steps; i++) { await p.mouse.wheel(0, 260); await p.waitForTimeout(per); }
      } else if (kind === "gate" || kind === "stack") {
        await p.goto(URL + "/", { waitUntil: "networkidle", timeout: 30000 });
        const probe = kind === "gate" ? "THE GATE" : "PROOF STACK";
        await p.evaluate((q) => { for (const el of document.querySelectorAll("h2")) if (el.textContent.includes(q)) { el.scrollIntoView({ block: "center" }); return } }, probe);
        await settle();
      } else if (kind === "receipt-cert") {
        await p.goto(URL + "/report/run_1790620755_96a5d2", { waitUntil: "networkidle", timeout: 30000 });
        await p.waitForTimeout(1400);
        await p.evaluate(() => window.scrollBy(0, 380));
        await settle();
      } else if (kind === "verify") {
        await p.goto(URL + "/verify", { waitUntil: "networkidle", timeout: 30000 });
        await p.fill("input", "3987b6c40166572aa501b7e58c571bac4d515afa9bce67ef62fb42333b26c701");
        await p.waitForTimeout(600);
        await p.click("text=VERIFY");
        await settle();
      } else if (kind === "outro") {
        await p.goto(URL + "/", { waitUntil: "networkidle", timeout: 30000 });
        await p.evaluate(() => window.scrollTo(0, 0));
        await settle();
      }
    } catch (e) { console.log(name, "warn:", e.message.slice(0, 80)); }
    await ctx.close();
    console.log(name, "done");
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
