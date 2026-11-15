type UnauthorizedListener = () => void;

let listener: UnauthorizedListener | null = null;
let redirecting = false;

/** AuthProvider registers so axios 401 can clear React state without import cycles. */
export function setUnauthorizedListener(next: UnauthorizedListener | null) {
  listener = next;
}

export function notifyUnauthorized() {
  if (redirecting) return;
  redirecting = true;
  try {
    listener?.();
  } finally {
    // Allow a later login after redirect settles.
    window.setTimeout(() => {
      redirecting = false;
    }, 1500);
  }
}
