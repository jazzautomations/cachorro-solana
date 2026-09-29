const { chromium } = require("playwright-core");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage();
  await p.goto("https://suno.com/s/4tYZjWlwznNdNNJj", { waitUntil: "domcontentloaded", timeout: 40000 });
  await p.waitForTimeout(6000);
  await p.screenshot({ path: "/tmp/suno-page.png" });
  const info = await p.evaluate(() => {
    const auds = Array.from(document.querySelectorAll("audio")).map(a => ({ src: (a.src || "").slice(0, 80), paused: a.paused, d: a.duration }));
    const btns = Array.from(document.querySelectorAll("button")).slice(0, 12).map(b => (b.textContent || b.getAttribute("aria-label") || "").trim().slice(0, 40));
    return { auds, btns, title: document.title };
  });
  console.log(JSON.stringify(info, null, 1));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
