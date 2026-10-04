export function checklistScrollTarget(scrollY: number, top: number, bottom: number, visibleBottom: number): number | null {
  if (top >= 12 && bottom <= visibleBottom - 12) return null;
  return Math.max(0, scrollY + top - 12);
}
