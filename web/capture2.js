const { chromium } = require("playwright-core");
const { spawn } = require("child_process");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage();
  await p.goto("https://suno.com/s/4tYZjWlwznNdNNJj", { waitUntil: "domcontentloaded", timeout: 40000 });
  await p.waitForTimeout(6000);
  // the bottom player bar play button (▶ icon at ~640,689)
  await p.mouse.click(640, 689);
  await p.waitForTimeout(2500);
  const playing = await p.evaluate(() => {
    const a = Array.from(document.querySelectorAll("audio")).find(x => !x.paused && x.duration > 1);
    return a ? { t: a.currentTime, d: a.duration } : null;
  });
  console.log("playing:", JSON.stringify(playing));
  const rec = spawn("parec", ["--device=catch.monitor", "--file-format=wav", "/tmp/vidwork/suno.wav"], { env: { ...process.env, XDG_RUNTIME_DIR: "/tmp/xdg" } });
  await p.waitForTimeout(75000);
  rec.kill();
  const st = await p.evaluate(() => Array.from(document.querySelectorAll("audio")).map(x => x.currentTime));
  console.log("audio clocks:", JSON.stringify(st));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
