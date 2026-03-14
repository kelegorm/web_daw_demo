import { createContext, useContext } from 'react';
import type { TransportControllerState, TransportControllerActions } from '../hooks/useTransportController';

export const TransportStateCtx = createContext<TransportControllerState | null>(null);
export const TransportActionsCtx = createContext<TransportControllerActions | null>(null);

export function useTransportState(): TransportControllerState {
  const ctx = useContext(TransportStateCtx);
  if (!ctx) throw new Error('useTransportState must be used within TransportProvider');
  return ctx;
}

export function useTransportActions(): TransportControllerActions {
  const ctx = useContext(TransportActionsCtx);
  if (!ctx) throw new Error('useTransportActions must be used within TransportProvider');
  return ctx;
}
