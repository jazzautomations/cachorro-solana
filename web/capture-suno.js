const { chromium } = require("playwright-core");
const { spawn } = require("child_process");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage();
  // start capture BEFORE play
  const rec = spawn("parec", ["--device=catch.monitor", "--file-format=wav", "/tmp/vidwork/suno.wav"], { env: { ...process.env, XDG_RUNTIME_DIR: "/tmp/xdg" } });
  await p.goto("https://suno.com/s/4tYZjWlwznNdNNJj", { waitUntil: "domcontentloaded", timeout: 40000 });
  await p.waitForTimeout(5000);
  // try to click the play button / song title
  const sels = ["button[aria-label*='Play' i]", "[data-testid*='play' i]", "button:has-text('Play')", "[role='button']"];
  for (const s of sels) {
    const els = await p.$$(s);
    for (const el of els.slice(0, 4)) {
      await el.click().catch(() => {});
      await p.waitForTimeout(300);
    }
  }
  // also press space
  await p.keyboard.press(" ");
  await p.waitForTimeout(76000); // ~76s of audio
  rec.kill();
  await b.close();
  console.log("captured");
})().catch((e) => { console.error(e.message); process.exit(1); });
