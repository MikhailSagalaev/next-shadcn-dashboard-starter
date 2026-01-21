/**
 * @file: src/hooks/use-confirm.ts
 * @description: Хук для программного вызова диалога подтверждения
 * @project: SaaS Bonus System
 * @dependencies: react
 * @created: 2026-01-21
 * @author: AI Assistant + User
 */

'use client';

import { useState, useCallback } from 'react';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
}

export interface UseConfirmResult {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  isOpen: boolean;
  options: ConfirmOptions | null;
  handleConfirm: () => void;
  handleCancel: () => void;
}

export function useConfirm(): UseConfirmResult {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolvePromise, setResolvePromise] = useState<
    ((value: boolean) => void) | null
  >(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setIsOpen(true);

    return new Promise<boolean>((resolve) => {
      setResolvePromise(() => resolve);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolvePromise?.(true);
    setIsOpen(false);
    setOptions(null);
    setResolvePromise(null);
  }, [resolvePromise]);

  const handleCancel = useCallback(() => {
    resolvePromise?.(false);
    setIsOpen(false);
    setOptions(null);
    setResolvePromise(null);
  }, [resolvePromise]);

  return {
    confirm,
    isOpen,
    options,
    handleConfirm,
    handleCancel
  };
}
