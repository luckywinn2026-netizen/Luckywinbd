import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen navy-gradient flex items-center justify-center p-6">
          <div className="bg-card rounded-2xl gold-border p-8 max-w-md text-center space-y-4">
            <div className="flex justify-center">
              <AlertTriangle size={48} className="text-amber-500" />
            </div>
            <h1 className="font-heading font-bold text-xl text-foreground">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">{this.state.error.message}</p>
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gold-gradient font-heading font-bold text-primary-foreground"
            >
              <RefreshCw size={18} />
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
