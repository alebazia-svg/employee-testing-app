import { employeeImageFormat } from './image-upload';
import { CASH_PHOTO_MAX_BYTES } from './cash-photo-protocol';

export const CASH_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';

export function cashPhotoFormat(header: Uint8Array, size: number, declaredType = '') {
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error('Снимок пустой. Откройте камеру ещё раз.');
  if (size > CASH_PHOTO_MAX_BYTES) throw new Error('Этот файл слишком большой для фото инкассации. Исходный файл не отправлен.');
  const format = employeeImageFormat(header);
  const mime = declaredType.toLowerCase();
  // Some camera providers omit MIME or use image/jpg. Header bytes still have
  // to identify the same supported image; never rely on its filename alone.
  if (!format || mime && mime !== 'application/octet-stream' && mime !== format.mime
    && !(format.mime === 'image/jpeg' && mime === 'image/jpg')) {
    throw new Error('Не удалось открыть снимок. Выберите фото через камеру приложения.');
  }
  return format;
}

export async function validateCashPhoto(file: File) {
  return cashPhotoFormat(new Uint8Array(await file.slice(0, 16).arrayBuffer()), file.size, file.type);
}
