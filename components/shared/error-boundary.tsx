'use client';

import { Component, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary] Caught error:', error.message, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <h3 className="text-base font-semibold text-red-900">Terjadi Kesalahan</h3>
          <p className="mt-2 text-sm text-red-600">
            Terjadi kesalahan saat memuat halaman ini. Silakan coba refresh.
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error ? (
            <pre className="mt-4 max-h-32 overflow-auto rounded bg-red-100 p-2 text-left text-xs text-red-800">
              {this.state.error.message}
            </pre>
          ) : null}
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 rounded-lg bg-red-900 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Coba Lagi
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
