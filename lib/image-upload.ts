export const MAX_EMPLOYEE_IMAGE_BYTES = 8 * 1024 * 1024;

const formats = [
  { mime: 'image/jpeg', extension: 'jpg', matches: (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', extension: 'png', matches: (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a },
  { mime: 'image/webp', extension: 'webp', matches: (b: Uint8Array) => String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP' },
] as const;

export async function validateEmployeeImage(file: File) {
  if (file.size <= 0) throw new Error('Добавьте фото');
  if (file.size > MAX_EMPLOYEE_IMAGE_BYTES) throw new Error('Фото слишком большое. Максимальный размер — 8 МБ.');
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const format = formats.find((item) => item.matches(header));
  if (!format || file.type !== format.mime) throw new Error('Поддерживаются только настоящие JPG, PNG или WebP изображения.');
  return format;
}

export function requestBodyTooLarge(request: Request) {
  const length = Number(request.headers.get('content-length'));
  return Number.isFinite(length) && length > MAX_EMPLOYEE_IMAGE_BYTES + 1024 * 1024;
}
