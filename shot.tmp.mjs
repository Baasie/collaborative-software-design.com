import { chromium } from 'playwright';
import { preview } from 'astro';
const s = await preview({ logLevel: 'error', server: { port: 4399, host: '127.0.0.1' } });
const b = await chromium.launch();
const paths = ['/training/', '/training/collaborative-software-design-how-to-facilitate-domain-modelling-decisions/'];
for (let i = 0; i < paths.length; i++) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.goto('http://127.0.0.1:4399' + paths[i], { waitUntil: 'networkidle' });
  await p.evaluate(() => new Promise(r => { window.scrollTo(0, 99999); setTimeout(r, 700); }));
  await p.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 300));
  await p.screenshot({ path: process.argv[2 + i], fullPage: true });
  console.error(paths[i], 'overflow', await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));
  await p.close();
}
await b.close(); await s.stop();
