import React from 'react';

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? 'https://medcheck-api-fptv.onrender.com' : 'http://localhost:8000');

const MAX_ERROR_CHARS = 500;
const MAX_STACK_CHARS = 4000;

function clamp(value, limit) {
  const text = String(value ?? '');
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

function EditorialWarningIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      <polygon points="12,3 22,20 2,20" />
      <path d="M12 9.5v5" />
      <path d="M12 17.2v0.4" />
    </svg>
  );
}

/**
 * Top-level render-error boundary.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('MEDCHECK Clinical UI Error caught by boundary:', error, errorInfo);
    try {
      fetch(`${API_BASE}/api/client-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: clamp(error?.toString() || 'Unknown UI Error', MAX_ERROR_CHARS),
          stack: clamp(errorInfo?.componentStack || error?.stack || '', MAX_STACK_CHARS)
        })
      }).catch(() => {});
    } catch {
      // ignore client reporting failure
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex items-center justify-center p-6 bg-[#f8f6f0] text-[#1a1a18] font-ibm-serif rounded-none shadow-none"
          role="alert"
        >
          <div className="p-8 max-w-md w-full text-center bg-[#f0ede1] border border-[#8b2500] rounded-none shadow-none">
            <div className="w-11 h-11 bg-[#f3e9e4] text-[#8b2500] border border-[#8b2500] flex items-center justify-center mx-auto mb-4 rounded-none shadow-none">
              <EditorialWarningIcon />
            </div>
            <h2 className="text-[22px] font-semibold font-newsreader text-[#1a1a18] leading-snug mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-[#2d2b26] font-ibm-serif leading-relaxed mb-6">
              This page hit an unexpected error. Your medicines and results are saved.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center justify-center px-5 py-2.5 min-h-[44px] bg-[#1a1a18] hover:bg-[#8b2500] text-[#f8f6f0] border border-[#1a1a18] hover:border-[#8b2500] font-ibm-mono text-xs uppercase tracking-[0.08em] font-medium rounded-none shadow-none transition-colors cursor-pointer"
              >
                Reload page
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center px-5 py-2.5 min-h-[44px] bg-[#f8f6f0] hover:bg-[#1a1a18] text-[#1a1a18] hover:text-[#f8f6f0] border border-[#1a1a18] font-ibm-mono text-xs uppercase tracking-[0.08em] font-medium rounded-none shadow-none transition-colors"
              >
                Back to home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
