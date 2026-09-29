const { chromium } = require("playwright-core");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: "/tmp/vidwork/scenes2fix/s2", size: { width: 1280, height: 800 } } });
  const p = await ctx.newPage();
  await p.goto("http://localhost:8790/bounties", { waitUntil: "networkidle", timeout: 30000 });
  await p.waitForTimeout(2500);
  for (let i = 0; i < 16; i++) { await p.mouse.wheel(0, 240); await p.waitForTimeout(650); }
  await ctx.close(); await b.close();
  console.log("s2 redone");
})().catch((e) => { console.error(e); process.exit(1); });
