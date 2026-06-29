export const AUTH_TOKEN_RECOVERY_EVENT = 'finance-ops:auth-token-recovery';

export function isMissingAuthTokenMessage(message: string | null | undefined) {
  return String(message || '').toLowerCase().includes('missing auth token');
}

export function triggerAuthTokenRecovery(message?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTH_TOKEN_RECOVERY_EVENT, {
    detail: {
      message: message || 'Refreshing session.',
    },
  }));
}

export function handleAuthTokenRecoveryMessage(message: string | null | undefined) {
  if (!isMissingAuthTokenMessage(message)) return false;
  triggerAuthTokenRecovery('Refreshing session.');
  return true;
}
