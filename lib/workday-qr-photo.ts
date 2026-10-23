import jsQR from 'jsqr';
import { parseWorkdayQrDepartment } from './workday-qr';

type PhotoRegion = { left: number; top: number; width: number; height: number; limit: number; enlarge?: boolean };

/** Resize a region with a white border so a close-up QR can touch the photo edge. */
function prepareRegion(data: Uint8ClampedArray, width: number, height: number, region: PhotoRegion) {
  const scale = Math.min(region.enlarge ? Infinity : 1, region.limit / Math.max(region.width, region.height));
  const innerWidth = Math.max(1, Math.round(region.width * scale));
  const innerHeight = Math.max(1, Math.round(region.height * scale));
  const border = 24;
  const targetWidth = innerWidth + border * 2;
  const targetHeight = innerHeight + border * 2;
  const target = new Uint8ClampedArray(targetWidth * targetHeight * 4).fill(255);
  for (let y = 0; y < innerHeight; y++) {
    const sy = Math.max(0, Math.min(height - 1, region.top + (y + 0.5) / scale - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(height - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < innerWidth; x++) {
      const sx = Math.max(0, Math.min(width - 1, region.left + (x + 0.5) / scale - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(width - 1, x0 + 1);
      const fx = sx - x0;
      const to = ((y + border) * targetWidth + x + border) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const upper = data[(y0 * width + x0) * 4 + channel] * (1 - fx) + data[(y0 * width + x1) * 4 + channel] * fx;
        const lower = data[(y1 * width + x0) * 4 + channel] * (1 - fx) + data[(y1 * width + x1) * 4 + channel] * fx;
        target[to + channel] = upper * (1 - fy) + lower * fy;
      }
    }
  }
  return { data: target, width: targetWidth, height: targetHeight };
}

/** Search the whole photo first, then overlapping enlarged regions automatically. */
export async function decodeWorkdayQrPhoto(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  userDepartment: string,
  isCurrent: () => boolean = () => true,
) {
  const whole = { left: 0, top: 0, width, height };
  // Smaller full-frame copies suppress monitor pixel patterns in camera photos.
  // Try these inexpensive passes before the more costly region search.
  const regions: PhotoRegion[] = [640, 960, 1280].map((limit) => ({ ...whole, limit }));
  // Overlap keeps QR codes on a tile boundary intact in another tile.
  const starts = [0, 0.225, 0.45];
  for (const top of starts) for (const left of starts) {
    regions.push({ left: Math.round(width * left), top: Math.round(height * top), width: Math.ceil(width * 0.55), height: Math.ceil(height * 0.55), limit: 960, enlarge: true });
  }
  if (Math.max(width, height) > 1280) regions.push({ ...whole, limit: 2560 });
  let sawOtherDepartment = false;
  let sawUnrelatedQr = false;
  for (const region of regions) {
    if (!isCurrent()) throw new DOMException('Photo reading cancelled', 'AbortError');
    const prepared = prepareRegion(data, width, height, region);
    const code = jsQR(prepared.data, prepared.width, prepared.height, { inversionAttempts: 'attemptBoth' });
    if (code?.data) {
      const department = parseWorkdayQrDepartment(code.data);
      if (department === userDepartment) return { department, qrPayload: code.data };
      if (department) sawOtherDepartment = true;
      else sawUnrelatedQr = true;
    }
    // Keep close/cancel responsive between attempts on slower phones.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  if (!isCurrent()) throw new DOMException('Photo reading cancelled', 'AbortError');
  if (sawOtherDepartment) throw new Error('Это QR-код другого отдела. Сфотографируйте QR своего отдела.');
  if (sawUnrelatedQr) throw new Error('Это не QR-код начала рабочего дня. Сфотографируйте QR-код отдела на рабочем месте.');
  throw new Error('QR-код не распознан. Он должен целиком попасть в кадр и быть различимым.');
}
