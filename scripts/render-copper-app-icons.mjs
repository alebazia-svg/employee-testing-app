// Rasterize the approved vector mark; do not redraw or change its geometry.
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { createHash } from 'node:crypto';

const mark = await fs.readFile(new URL('../public/brand/mobo-master/mobo-symbol-copper-ui.svg', import.meta.url), 'utf8');
if (createHash('sha256').update(mark).digest('hex') !== 'aebb312cbb4c759a712fa640a0025ccf0f3093509d4b66bbdfeffcc4f8dae929') throw Error('Approved mark changed');
const embedded = Buffer.from(mark).toString('base64');
// Small UI mark: retain vector geometry and copper palette. An inner bevel
// preserves the crisp silhouette; its highlights do not blur the outer edge.
const compactSurface = `<filter id="surface" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="18" result="height"/>
  <feSpecularLighting in="height" surfaceScale="16" specularConstant=".5" specularExponent="10" lighting-color="#f5d1b0" result="light"><feDistantLight azimuth="225" elevation="48"/></feSpecularLighting>
  <feComposite in="light" in2="SourceAlpha" operator="in" result="cutlight"/>
  <feBlend in="SourceGraphic" in2="cutlight" mode="screen" result="lit"/>
  <feOffset in="SourceAlpha" dx="0" dy="5" result="down"/>
  <feComposite in="SourceAlpha" in2="down" operator="out" result="topEdge"/>
  <feFlood flood-color="#ffe0bf" flood-opacity=".65" result="rim"/>
  <feComposite in="rim" in2="topEdge" operator="in" result="highlight"/>
  <feOffset in="SourceAlpha" dx="0" dy="-6" result="up"/>
  <feComposite in="SourceAlpha" in2="up" operator="out" result="bottomEdge"/>
  <feFlood flood-color="#693b24" flood-opacity=".55" result="shade"/>
  <feComposite in="shade" in2="bottomEdge" operator="in" result="shadowEdge"/>
  <feMerge><feMergeNode in="lit"/><feMergeNode in="highlight"/><feMergeNode in="shadowEdge"/></feMerge>
</filter>`;
const compactMark = mark.replace(/<filter id="surface"[\s\S]*?<\/filter>/, compactSurface)
  .replace(/<filter id="shadow"[\s\S]*?<\/filter>/, '').replace(' filter="url(#shadow)"', '');
await fs.writeFile(new URL('../public/brand/mobo-master/mobo-symbol-copper-compact.svg', import.meta.url), compactMark);
function artwork(maskable) {
  const width = 512 * (maskable ? .64 : .78);
  const height = width * 625 / 760;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#383e42"/><stop offset=".37" stop-color="#252b2e"/><stop offset=".73" stop-color="#151a1d"/><stop offset="1" stop-color="#252b2e"/></linearGradient>
    <radialGradient id="glow" cx=".08" cy=".02" r=".70"><stop stop-color="#ecefeb" stop-opacity=".24"/><stop offset=".92" stop-color="#ecefeb" stop-opacity="0"/></radialGradient>
    <linearGradient id="sweep" x1="0" y1="0" x2="1" y2=".78"><stop offset=".08" stop-color="#dbe3e6" stop-opacity="0"/><stop offset=".25" stop-color="#dbe3e6" stop-opacity=".075"/><stop offset=".48" stop-color="#dbe3e6" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#base)"/><rect width="512" height="512" fill="url(#glow)"/><rect width="512" height="512" fill="url(#sweep)"/>
  <image x="${(512-width)/2}" y="${(512-height)/2}" width="${width}" height="${height}" href="data:image/svg+xml;base64,${embedded}"/>
  </svg>`;
}
// Full-bleed background: iOS/Android apply their own corner masks.
for (const [name, size, maskable] of [
  ['portal-app-copper-180.png',180,false], ['portal-app-copper-192.png',192,false],
  ['portal-app-copper-512.png',512,false], ['portal-app-copper-maskable-512.png',512,true],
]) {
  await sharp(Buffer.from(artwork(maskable)), { density: 288 }).resize(size,size).removeAlpha().png().toFile(new URL(`../public/${name}`,import.meta.url).pathname);
}
