const { chromium } = require("playwright-core");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: "/tmp/vidwork/v3/c_explorer2", size: { width: 1280, height: 800 } } });
  const p = await ctx.newPage();
  await p.goto("https://explorer.solana.com/tx/5QT94gfLhdDQE3USrU2JFiqoFadEcEsgEocYcUynEbcd4rY6zMmfcAMAWQ1V1DdTR9kYKTfXNXg4Nde2UXLjxW4h?cluster=devnet", { waitUntil: "domcontentloaded", timeout: 40000 });
  try {
    await p.waitForSelector("text=Overview", { timeout: 15000 });
  } catch {}
  await p.waitForTimeout(3500);
  // scroll to show the memo/program data
  await p.evaluate(() => { const el = Array.from(document.querySelectorAll("h2,h3,td,div")).find(e => /memo|instruction|program data/i.test(e.textContent || "")); if (el) el.scrollIntoView({ block: "center" }); });
  await p.waitForTimeout(2500);
  await ctx.close(); await b.close();
  console.log("explorer re-recorded");
})().catch((e) => { console.error(e.message); process.exit(1); });
