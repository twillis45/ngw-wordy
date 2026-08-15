#!/usr/bin/env node
/**
 * TEMPORARY diagnostic: print React's UNMINIFIED hydration error.
 *
 * A production build minifies the failure to a number, which says a mismatch
 * happened and nothing about where. The dev build prints the component tree
 * with the offending props marked +/-, which is the only thing that has ever
 * named one of these. Point it at `next dev`.
 */
import { launch } from './lib/browser.mjs';

const BASE = process.argv[2] || 'http://localhost:3009';
const settle = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await launch();
const ctx = await b.createBrowserContext();
const p = await ctx.newPage();
const msgs = [];
p.on('pageerror', (e) => msgs.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error') msgs.push(m.text()); });
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await p.goto(BASE, { waitUntil: 'networkidle0' });
await settle(5000);
const h = msgs.find((m) => /hydrat/i.test(m));
console.log(h ? h.slice(0, 6000) : `no hydration error on ${BASE} (${msgs.length} console errors)`);
await b.close();
