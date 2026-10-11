'use client';
import React, { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

// Keep action handlers in the form, while the dialog owns their visible position.
export const DeliveryDialogActionContext = createContext<{ target: HTMLElement | null; moreTarget?: HTMLElement | null; enabled: boolean } | null>(null);
export function ProcurementDeliveryDialogActions({ children }: { children: React.ReactNode }) {
  const placement = useContext(DeliveryDialogActionContext);
  if (placement && !placement.enabled) return null;
  return placement?.target ? createPortal(children, placement.target) : <>{children}</>;
}

export function ProcurementDeliveryAdditionalAction({ children }: { children: React.ReactNode }) {
  const placement = useContext(DeliveryDialogActionContext);
  if (placement && !placement.enabled) return null;
  return placement?.moreTarget ? createPortal(children, placement.moreTarget) : <>{children}</>;
}
