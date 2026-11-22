// Records the app demo loop (the /demo-screen page) into the video that plays inside the hero phone.
//
//   npm run dev                       (in another terminal; or set DEMO_URL)
//   npm run record:demo
//
// Needs Chrome (CHROME_PATH, default /usr/bin/google-chrome) and ffmpeg on PATH.
// Writes public/videos/app-demo.mp4 (H.264), app-demo.webm (VP9) and app-demo-poster.jpg.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const URL = process.env.DEMO_URL ?? 'http://localhost:3000/demo-screen?record';
// Same proportions as the phone screen in the 3D model (9:19.5)
const WIDTH = 302;
const HEIGHT = 654;
const SCALE = 2.5;
// One full loop of AppDemoScreen (DEMO_LOOP_MS), so the video loops seamlessly
const LOOP_MS = 13400;

const FPS = 30;
const out = 'public/videos';
const work = mkdtempSync(join(tmpdir(), 'demo-video-'));

// Installed in the page just before the loop starts: a clock the recorder steps by hand. Date,
// performance.now, timers and animation frames read it, and CSS animations are seeked to it, so
// every frame is exact however slow the screenshots are.
const installClock = () => {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  const frames = new Map();
  const started = new WeakMap();
  const realDateNow = Date.now.bind(Date);
  const epoch = realDateNow();
  Date.now = () => epoch + now;
  performance.now = () => now;
  window.setTimeout = (callback, delay = 0, ...args) => {
    const id = nextId++;
    timers.set(id, { at: now + Math.max(0, delay), callback: () => callback(...args) });
    return id;
  };
  window.clearTimeout = id => timers.delete(id);
  window.setInterval = (callback, delay = 0) => {
    const id = nextId++;
    const tick = () => {
      timers.set(id, { at: now + Math.max(1, delay), callback: () => (callback(), tick()) });
    };
    tick();
    return id;
  };
  window.clearInterval = id => timers.delete(id);
  window.requestAnimationFrame = callback => {
    const id = nextId++;
    frames.set(id, callback);
    return id;
  };
  window.cancelAnimationFrame = id => frames.delete(id);

  window.__advanceClock = ms => {
    const target = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      now = Math.max(now, due[1].at);
      due[1].callback();
    }
    now = target;
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback(now));
  };
  window.__seekAnimations = () => {
    for (const animation of document.getAnimations()) {
      if (!started.has(animation)) started.set(animation, now);
      animation.pause();
      animation.currentTime = now - started.get(animation);
    }
  };
};

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  defaultViewport: { width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE },
  args: ['--hide-scrollbars'],
});
const settle = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.querySelector('.animate-fadeIn'), { timeout: 30_000 });
  // Hide the Next.js dev badge if recording from `npm run dev`
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(installClock);
  await page.evaluate(() => window.dispatchEvent(new Event('demo-start')));

  const total = Math.round((LOOP_MS / 1000) * FPS);
  for (let frame = 0; frame < total; frame++) {
    // Let React render what the last step changed, then line CSS animations up with the clock
    await settle(25);
    await page.evaluate(() => window.__seekAnimations());
    await page.screenshot({ path: join(work, `frame-${String(frame).padStart(4, '0')}.png`) });
    await page.evaluate(ms => window.__advanceClock(ms), 1000 / FPS);
  }
} finally {
  await browser.close();
}

const size = `${Math.round((WIDTH * SCALE) / 2) * 2}:${Math.round((HEIGHT * SCALE) / 2) * 2}`;
const frames = ['-framerate', String(FPS), '-i', join(work, 'frame-%04d.png')];
const ffmpeg = args => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });

ffmpeg([
  ...frames,
  '-vf',
  `scale=${size}:flags=lanczos`,
  '-c:v',
  'libx264',
  '-pix_fmt',
  'yuv420p',
  '-crf',
  '20',
  '-preset',
  'slow',
  '-movflags',
  '+faststart',
  '-an',
  join(out, 'app-demo.mp4'),
]);
ffmpeg([
  ...frames,
  '-vf',
  `scale=${size}:flags=lanczos`,
  '-c:v',
  'libvpx-vp9',
  '-b:v',
  '0',
  '-crf',
  '34',
  '-row-mt',
  '1',
  '-an',
  join(out, 'app-demo.webm'),
]);
ffmpeg(['-i', join(out, 'app-demo.mp4'), '-frames:v', '1', '-q:v', '3', join(out, 'app-demo-poster.jpg')]);
rmSync(work, { recursive: true, force: true });
console.log('Saved public/videos/app-demo.{mp4,webm} and app-demo-poster.jpg');
