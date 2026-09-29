const { chromium } = require("playwright-core");
const URL = "http://localhost:8790";
const CLIPS = [
  ["c_hero",    4.5, URL + "/",                      async (p) => { await p.waitForTimeout(3000); }],
  ["c_board",   4.0, URL + "/bounties",              async (p) => { for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, 300); await p.waitForTimeout(500); } }],
  ["c_feed",    5.0, URL + "/scan/run_1790620755_96a5d2", async (p) => { for (let i = 0; i < 5; i++) { await p.mouse.wheel(0, 260); await p.waitForTimeout(600); } }],
  ["c_gate",    4.0, URL + "/",                      async (p) => { await p.evaluate(() => { for (const el of document.querySelectorAll("h2")) if (el.textContent.includes("GATE")) { el.scrollIntoView({ block: "center" }); return } }); await p.waitForTimeout(2500); }],
  ["c_stack",   4.0, URL + "/",                      async (p) => { await p.evaluate(() => { for (const el of document.querySelectorAll("h2")) if (el.textContent.includes("PROOF STACK")) { el.scrollIntoView({ block: "center" }); return } }); await p.waitForTimeout(2500); }],
  ["c_cert",    4.5, URL + "/report/run_1789568330_9453f2", async (p) => { await p.waitForTimeout(1500); await p.evaluate(() => window.scrollBy(0, 300)); await p.waitForTimeout(1500); }],
  ["c_verify",  6.0, URL + "/verify",                async (p) => { await p.fill("input", "86d7ba5abc03289a1fa6891659375c3a0a2e3cdf440b28f9d6330ede7f872782"); await p.waitForTimeout(400); await p.click("text=VERIFY"); await p.waitForTimeout(4500); }],
  ["c_price",   3.5, URL + "/pricing",               async (p) => { await p.waitForTimeout(2500); }],
  ["c_labs",    3.5, URL + "/labs",                  async (p) => { await p.waitForTimeout(2500); }],
  ["c_explorer",5.0, "https://explorer.solana.com/tx/5QT94gfLhdDQE3USrU2JFiqoFadEcEsgEocYcUynEbcd4rY6zMmfcAMAWQ1V1DdTR9kYKTfXNXg4Nde2UXLjxW4h?cluster=devnet", async (p) => { await p.waitForTimeout(3500); }],
  ["c_github",  3.5, "https://github.com/jazzautomations/cachorro-solana", async (p) => { await p.waitForTimeout(2800); }],
];
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox"] });
  for (const [name, secs, url, act] of CLIPS) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: `/tmp/vidwork/v3/${name}`, size: { width: 1280, height: 800 } } });
    const p = await ctx.newPage();
    const t0 = Date.now();
    try { await p.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 }); await act(p); }
    catch (e) { console.log(name, "warn:", e.message.slice(0, 80)); }
    const left = secs * 1000 - (Date.now() - t0);
    if (left > 0) await p.waitForTimeout(left);
    await ctx.close();
    console.log(name, "done");
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
