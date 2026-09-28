const { chromium } = require("playwright-core");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox"] });
  const ctx = await b.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: "videos", size: { width: 1280, height: 800 } },
  });
  const p = await ctx.newPage();
  const cap = (t) => p.evaluate((t) => {
    let d = document.getElementById("__cap");
    if (!d) {
      d = document.createElement("div");
      d.id = "__cap";
      d.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;background:rgba(0,0,0,.88);border:1px solid #00ff41;color:#00ff41;font-family:monospace;font-size:15px;padding:8px 18px;pointer-events:none";
      document.body.appendChild(d);
    }
    d.textContent = t;
  }, t);
  const uncap = () => p.evaluate(() => { const d = document.getElementById("__cap"); if (d) d.remove(); });

  await p.goto("http://localhost:8790/", { waitUntil: "networkidle", timeout: 30000 });
  await cap("cachorro — proof, not opinion"); await p.waitForTimeout(2500);
  await cap("test your contract, wallet, protocol — like an attacker");
  for (let i = 0; i < 14; i++) { await p.mouse.wheel(0, 300); await p.waitForTimeout(400); }
  await cap("the gate: nothing promotes without proof"); await p.waitForTimeout(1300);
  for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, 300); await p.waitForTimeout(400); }
  await cap("receipts anchored on-chain — devnet"); await p.waitForTimeout(1400);

  await p.goto("http://localhost:8790/report/run_1790620755_96a5d2", { waitUntil: "networkidle", timeout: 30000 });
  await cap("audit certificate — GMTrade full hunt"); await p.waitForTimeout(2300);
  await p.evaluate(() => window.scrollBy(0, 420));
  await cap("self-audit + coverage + anchored receipt"); await p.waitForTimeout(2300);

  await p.goto("http://localhost:8790/verify", { waitUntil: "networkidle", timeout: 30000 });
  await cap("verify yourself — no trust in this site"); await p.waitForTimeout(1400);
  await p.fill("input", "3987b6c40166572aa501b7e58c571bac4d515afa9bce67ef62fb42333b26c701");
  await p.click("text=VERIFY ▸");
  await cap("digest recomputed · memo found on-chain · slot confirmed");
  await p.waitForTimeout(4200);
  await uncap();
  await ctx.close(); await b.close();
  console.log("done");
})().catch((e) => { console.error(e); process.exit(1); });
