export function isWorkdayQrMode(value: unknown): value is 'SCAN' | 'PHOTO' {
  return value === 'SCAN' || value === 'PHOTO';
}

export function usesWorkdayQrPhotoFallback(user: { qrScanMode?: string }) {
  return user.qrScanMode === 'PHOTO';
}
