type AuthListener = () => void;

let unauthorizedListener: AuthListener | null = null;
let forbiddenListener: AuthListener | null = null;
let unauthorizedRedirecting = false;
let forbiddenRedirecting = false;

/** AuthProvider registers so axios 401 can clear React state without import cycles. */
export function setUnauthorizedListener(next: AuthListener | null) {
  unauthorizedListener = next;
}

/** Soft 403 handler: redirect to role home without wiping the session. */
export function setForbiddenListener(next: AuthListener | null) {
  forbiddenListener = next;
}

export function notifyUnauthorized() {
  if (unauthorizedRedirecting) return;
  unauthorizedRedirecting = true;
  try {
    unauthorizedListener?.();
  } finally {
    window.setTimeout(() => {
      unauthorizedRedirecting = false;
    }, 1500);
  }
}

export function notifyForbidden() {
  if (forbiddenRedirecting) return;
  forbiddenRedirecting = true;
  try {
    forbiddenListener?.();
  } finally {
    window.setTimeout(() => {
      forbiddenRedirecting = false;
    }, 1500);
  }
}
