import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ORDER_SUBMISSION_MINIMUM_MS, useOrderSubmissionGuard } from '../../lib/hooks/useOrderSubmissionGuard';

let guard: ReturnType<typeof useOrderSubmissionGuard>;
let root: ReturnType<typeof create>;
function Probe() { guard = useOrderSubmissionGuard(); return null; }
beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  await act(async () => { root = create(createElement(Probe)); });
});
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers(); });

describe('checkout confirmation lock', () => {
  it('blocks rapid repeated clicks before a render and stays locked after success', async () => {
    act(() => {
      expect(guard.start()).toBe(true);
      expect(guard.start()).toBe(false);
      expect(guard.start()).toBe(false);
    });
    expect(guard.isProcessing).toBe(true);
    let finished = false;
    const completion = guard.complete(true).then(() => { finished = true; });
    await act(async () => { await vi.advanceTimersByTimeAsync(ORDER_SUBMISSION_MINIMUM_MS - 1); });
    expect(finished).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); await completion; });
    expect(finished).toBe(true);
    expect(guard.isProcessing).toBe(true);
    expect(guard.start()).toBe(false);
  });

  it('unlocks a failed submission only after the visible loading interval', async () => {
    act(() => { guard.start(); });
    const completion = guard.complete(false);
    expect(guard.start()).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(ORDER_SUBMISSION_MINIMUM_MS); await completion; });
    expect(guard.isProcessing).toBe(false);
    act(() => { expect(guard.start()).toBe(true); });
  });

  it('keeps a slow request locked beyond the minimum and does not add delay afterwards', async () => {
    act(() => { guard.start(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(guard.isProcessing).toBe(true);
    expect(guard.start()).toBe(false);
    await act(async () => { await guard.complete(false); });
    expect(guard.isProcessing).toBe(false);
  });
});
