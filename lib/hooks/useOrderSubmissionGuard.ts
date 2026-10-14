import { useRef, useState } from 'react';

export const ORDER_SUBMISSION_MINIMUM_MS = 5000;

/** Lock synchronously, before React renders the disabled confirmation button. */
export function useOrderSubmissionGuard() {
  const locked = useRef(false);
  const startedAt = useRef(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const start = () => {
    if (locked.current) return false;
    locked.current = true;
    startedAt.current = Date.now();
    setIsProcessing(true);
    return true;
  };

  const complete = async (succeeded: boolean) => {
    const remaining = ORDER_SUBMISSION_MINIMUM_MS - (Date.now() - startedAt.current);
    if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
    // Success stays locked while navigation opens the order's tracking screen.
    if (!succeeded) {
      locked.current = false;
      setIsProcessing(false);
    }
  };

  return { isProcessing, start, complete };
}
