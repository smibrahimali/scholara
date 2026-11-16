import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
};

/** Keeps the app shell alive if a child (e.g. chatbot) throws at runtime. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Scholara ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <p className="px-5 py-4 text-center text-sm text-muted-foreground">
            Something went wrong. Refresh the page to continue.
          </p>
        )
      );
    }
    return this.props.children;
  }
}
