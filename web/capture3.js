const { chromium } = require("playwright-core");
const { spawn } = require("child_process");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required", "--use-pulse-audio"] });
  const p = await b.newPage();
  await p.goto("https://suno.com/s/4tYZjWlwznNdNNJj", { waitUntil: "domcontentloaded", timeout: 40000 });
  await p.waitForTimeout(6000);
  await p.mouse.click(640, 689);
  await p.waitForTimeout(2000);
  const playing = await p.evaluate(() => { const a = Array.from(document.querySelectorAll("audio")).find(x => !x.paused && x.duration > 1); return a ? a.currentTime : null });
  console.log("clock:", playing);
  if (playing === null) { await p.keyboard.press(" "); await p.waitForTimeout(2000); }
  const rec = spawn("parec", ["--device=catch.monitor", "--file-format=wav", "/tmp/vidwork/suno.wav"], { env: { ...process.env, XDG_RUNTIME_DIR: "/tmp/xdg" } });
  await p.waitForTimeout(76000);
  rec.kill();
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
