const { chromium } = require("playwright-core");
const URL = "http://localhost:8790";
const ONRE = "run_1789568330_9453f2";
const DIGEST = "86d7ba5abc03289a1fa6891659375c3a0a2e3cdf440b28f9d6330ede7f872782";
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox"] });
  const scenes = [
    ["s5", 9.8, async (p) => {
      await p.goto(`${URL}/report/${ONRE}`, { waitUntil: "networkidle", timeout: 30000 });
      await p.waitForTimeout(1500);
      await p.evaluate(() => window.scrollBy(0, 380));
      await p.waitForTimeout(2200);
      await p.evaluate(() => window.scrollBy(0, 380));
      await p.waitForTimeout(2000);
    }],
    ["s6", 9.2, async (p) => {
      await p.goto(`${URL}/verify`, { waitUntil: "networkidle", timeout: 30000 });
      await p.fill("input", DIGEST);
      await p.waitForTimeout(600);
      await p.click("text=VERIFY");
      await p.waitForTimeout(5500);
    }],
  ];
  for (const [name, secs, act] of scenes) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: `/tmp/vidwork/scenes/${name}`, size: { width: 1280, height: 800 } } });
    const p = await ctx.newPage();
    const t0 = Date.now();
    try { await act(p); await p.waitForTimeout(Math.max(200, secs * 1000 - (Date.now() - t0))); }
    catch (e) { console.log(name, "warn:", e.message.slice(0, 80)); }
    await ctx.close();
    console.log(name, "done");
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
