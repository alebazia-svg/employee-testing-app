// Rasterize the approved vector mark; do not redraw or change its geometry.
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { createHash } from 'node:crypto';

const mark = await fs.readFile(new URL('../public/brand/mobo-master/mobo-symbol-copper-ui.svg', import.meta.url), 'utf8');
if (createHash('sha256').update(mark).digest('hex') !== 'aebb312cbb4c759a712fa640a0025ccf0f3093509d4b66bbdfeffcc4f8dae929') throw Error('Approved mark changed');
// One filter-free vector master for both header and home-screen icon.
const contour = mark.match(/<path d="([^"]+)"/)[1];
const parts = contour.split(/(?=M )/).filter(Boolean).map(x => x.trim());
if (parts.length !== 4) throw Error('Expected four approved logo elements');
const compactMark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-22 -22 760 625">
<defs>
<linearGradient id="copperFace" x1="0" y1="0" x2=".8" y2="1">
<stop stop-color="#efbd93"/><stop offset=".35" stop-color="#dca16e"/><stop offset=".75" stop-color="#cb8956"/><stop offset="1" stop-color="#b96c36"/>
</linearGradient>
<linearGradient id="copperRim" x1="0" y1="0" x2=".5" y2="1">
<stop stop-color="#f5cca8"/><stop offset=".45" stop-color="#d79b68"/><stop offset="1" stop-color="#a05c30"/>
</linearGradient>
${parts.map((d,i)=>`<path id="part${i}" d="${d}"/>`).join('')}
</defs>
<g fill="#77462b" transform="translate(0 4)">${parts.map((_,i)=>`<use href="#part${i}"/>`).join('')}</g>
<g fill="url(#copperFace)" stroke="url(#copperRim)" stroke-width="2" stroke-linejoin="round">${parts.map((_,i)=>`<use href="#part${i}"/>`).join('')}</g>
</svg>`;
await fs.writeFile(new URL('../public/brand/mobo-master/mobo-symbol-copper-compact.svg', import.meta.url), compactMark);
const embedded = Buffer.from(compactMark).toString('base64');
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
