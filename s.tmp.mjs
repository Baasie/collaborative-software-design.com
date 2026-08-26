import { chromium } from 'playwright';
import { preview } from 'astro';
const s = await preview({ logLevel: 'error', server: { port: 4399, host: '127.0.0.1' } });
const b = await chromium.launch();
const SP = process.argv[2];
const URL = 'http://127.0.0.1:4399/training/collaborative-software-design-how-to-facilitate-domain-modelling-decisions/';
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(URL, { waitUntil: 'networkidle' });
// force every lazy image to load before the full-page shot
await p.evaluate(async () => {
  document.querySelectorAll('img').forEach(i => i.loading = 'eager');
  for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
  window.scrollTo(0, 0);
  await Promise.all([...document.images].filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r; })));
});
await new Promise(r => setTimeout(r, 500));
await p.screenshot({ path: `${SP}/img2-full.png`, fullPage: true });
// close-ups
const about = await p.$('#about-the-workshop');
const y1 = await p.evaluate(() => Math.round(document.querySelector('#about-the-workshop').getBoundingClientRect().y + scrollY) - 40);
await p.evaluate(y => window.scrollTo(0, y), y1);
await new Promise(r => setTimeout(r, 300));
await p.screenshot({ path: `${SP}/img2-about.png` });
const y2 = await p.evaluate(() => { const im = document.querySelectorAll('.workshop-body img')[1]; return Math.round(im.getBoundingClientRect().y + scrollY) - 120; });
await p.evaluate(y => window.scrollTo(0, y), y2);
await new Promise(r => setTimeout(r, 300));
await p.screenshot({ path: `${SP}/img2-band.png` });
await b.close(); await s.stop();
