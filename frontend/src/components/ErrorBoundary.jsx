import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
          error: error?.toString() || 'Unknown UI Error',
          stack: errorInfo?.componentStack || error?.stack || ''
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
        <div className="min-h-[400px] flex items-center justify-center p-6" role="alert">
          <div className="card-surface p-8 max-w-md w-full text-center border-l-4 border-l-red-500 shadow-xl rounded-xl">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold font-serif text-slate-900 mb-2">
              Clinical Interface Exception
            </h2>
            <p className="text-sm text-slate-600 mb-6">
              The clinical visualization encountered an unexpected rendering error. Your data is preserved.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="btn-primary flex items-center justify-center gap-2 text-sm py-2 px-4 shadow-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Reload Interface
              </button>
              <a
                href="/"
                className="btn-secondary flex items-center justify-center gap-2 text-sm py-2 px-4"
              >
                <Home className="w-4 h-4" />
                Return Home
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
