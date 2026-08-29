export const LATENESS_SHADOW_POLICY_V1 = 'lateness-shadow-v1';

export type LatenessShadowResult = {
  policyVersion: typeof LATENESS_SHADOW_POLICY_V1;
  pointsX2: number;
};

export type LatenessShadowSnapshot = LatenessShadowResult & {
  lateMinutes: number;
};

// Half-points are stored as integers (1 = 0.5 points) so historical results
// never depend on floating-point rounding or a later policy revision.
export function evaluateLatenessShadowV1(lateMinutes: number): LatenessShadowResult {
  const normalizedMinutes = Math.max(0, Math.trunc(lateMinutes));
  let pointsX2 = 0;
  if (normalizedMinutes >= 41) pointsX2 = 6;
  else if (normalizedMinutes >= 21) pointsX2 = 4;
  else if (normalizedMinutes >= 11) pointsX2 = 2;
  else if (normalizedMinutes >= 6) pointsX2 = 1;

  return { policyVersion: LATENESS_SHADOW_POLICY_V1, pointsX2 };
}

export function buildLatenessShadowSnapshot(shiftStartMinutes: number | null, actualStartMinutes: number): LatenessShadowSnapshot {
  const lateMinutes = shiftStartMinutes === null ? 0 : Math.max(0, Math.trunc(actualStartMinutes) - shiftStartMinutes);
  return { lateMinutes, ...evaluateLatenessShadowV1(lateMinutes) };
}

export function formatShadowPoints(pointsX2: number) {
  return (pointsX2 / 2).toLocaleString('ru-RU', { maximumFractionDigits: 1 });
}
