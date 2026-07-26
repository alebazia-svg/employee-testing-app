'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { startVisibleSync } from '@/lib/visible-sync';

const adminWorkdaySyncIntervalMs = 5_000;
const refreshRetryIntervalMs = 15_000;

export function AdminWorkdayAutoRefresh({ date, revision }: { date: string; revision: string }) {
  const router = useRouter();
  const renderedRevisionRef = useRef(revision);
  const requestAbortRef = useRef<AbortController | null>(null);
  const refreshRequestRef = useRef<{ revision: string; requestedAt: number } | null>(null);

  useEffect(() => {
    renderedRevisionRef.current = revision;
    refreshRequestRef.current = null;
  }, [date, revision]);

  const checkForUpdates = useCallback(async () => {
    if (requestAbortRef.current) return;

    const controller = new AbortController();
    requestAbortRef.current = controller;

    try {
      const response = await fetch(`/api/admin/workday/revision?date=${encodeURIComponent(date)}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) return;

      const payload: unknown = await response.json();
      if (!payload || typeof payload !== 'object' || !('revision' in payload) || typeof payload.revision !== 'string') return;
      if (payload.revision === renderedRevisionRef.current) return;

      const previousRequest = refreshRequestRef.current;
      if (previousRequest?.revision === payload.revision && Date.now() - previousRequest.requestedAt < refreshRetryIntervalMs) return;

      refreshRequestRef.current = {
        revision: payload.revision,
        requestedAt: Date.now(),
      };
      router.refresh();
    } catch {
      // Keep the rendered server snapshot and retry on the next scheduled check.
    } finally {
      if (requestAbortRef.current === controller) requestAbortRef.current = null;
    }
  }, [date, router]);

  useEffect(() => {
    const stopVisibleSync = startVisibleSync(checkForUpdates, adminWorkdaySyncIntervalMs);
    return () => {
      stopVisibleSync();
      requestAbortRef.current?.abort();
      requestAbortRef.current = null;
    };
  }, [checkForUpdates]);

  return <span hidden aria-hidden='true' data-testid='admin-workday-live-revision' data-revision={revision} />;
}
