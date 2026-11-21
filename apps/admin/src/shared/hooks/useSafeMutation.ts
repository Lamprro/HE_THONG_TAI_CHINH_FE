import { useState, useRef } from 'react';
import { useMutation, type UseMutationOptions } from '@tanstack/react-query';

export interface SafeMutationConfig<TData, TVariables> {
  actionName: string;
  mutationFn: (variables: TVariables & { reason: string; idempotencyKey: string }) => Promise<TData>;
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
}

export function useSafeMutation<TData = unknown, TVariables = unknown>({
  actionName,
  mutationFn,
  onSuccess,
  onError,
}: SafeMutationConfig<TData, TVariables>) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingVariables, setPendingVariables] = useState<TVariables | null>(null);
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const activeIdempotencyKeyRef = useRef<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (vars: TVariables & { reason: string; idempotencyKey: string }) => {
      return mutationFn(vars);
    },
    onSuccess: data => {
      isSubmittingRef.current = false;
      activeIdempotencyKeyRef.current = null;
      setIsOpen(false);
      setPendingVariables(null);
      setReason('');
      setErrorMsg(null);
      onSuccess?.(data);
    },
    onError: (err: Error) => {
      isSubmittingRef.current = false;
      setErrorMsg(err.message || 'Lỗi thực thi');
      onError?.(err);
    },
  });

  const requestAction = (vars: TVariables) => {
    setPendingVariables(vars);
    setReason('');
    setErrorMsg(null);
    activeIdempotencyKeyRef.current = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    isSubmittingRef.current = false;
    setIsOpen(true);
  };

  const confirmAction = () => {
    if (isSubmittingRef.current || mutation.isPending) return;
    if (!reason.trim() || reason.trim().length < 8) {
      setErrorMsg('Vui lòng nhập lý do tối thiểu 8 ký tự.');
      return;
    }
    if (!pendingVariables) return;

    if (!activeIdempotencyKeyRef.current) {
      activeIdempotencyKeyRef.current = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }

    isSubmittingRef.current = true;
    setErrorMsg(null);
    mutation.mutate({
      ...pendingVariables,
      reason: reason.trim(),
      idempotencyKey: activeIdempotencyKeyRef.current,
    });
  };

  const cancelAction = () => {
    if (isSubmittingRef.current || mutation.isPending) return;
    isSubmittingRef.current = false;
    activeIdempotencyKeyRef.current = null;
    setIsOpen(false);
    setPendingVariables(null);
    setReason('');
    setErrorMsg(null);
  };

  return {
    isOpen,
    isPending: mutation.isPending,
    reason,
    setReason,
    errorMsg,
    pendingVariables,
    requestAction,
    confirmAction,
    cancelAction,
  };
}
