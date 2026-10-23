import jsQR from 'jsqr';
import { parseWorkdayQrDepartment } from './workday-qr';

export function decodeWorkdayQrPhoto(data: Uint8ClampedArray, width: number, height: number, userDepartment: string) {
  const code = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
  if (!code?.data) throw new Error('QR-код не распознан. Сфотографируйте его целиком, крупнее и без бликов.');
  const department = parseWorkdayQrDepartment(code.data);
  if (!department) throw new Error('Это не QR-код начала рабочего дня. Сфотографируйте QR-код отдела на рабочем месте.');
  if (department !== userDepartment) throw new Error('Это QR-код другого отдела. Сфотографируйте QR своего отдела.');
  return { department, qrPayload: code.data };
}
