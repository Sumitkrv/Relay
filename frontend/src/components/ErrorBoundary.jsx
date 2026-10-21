import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Relay CRM captured runtime boundary error:', error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 20px',
          background: 'transparent'
        }}>
          <div style={{
            maxWidth: '480px',
            width: '100%',
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '32px 28px',
            textAlign: 'center',
            boxShadow: '0 8px 30px rgba(15, 23, 42, 0.06)'
          }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: '#fef2f2',
              color: '#dc2626',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 16px'
            }}>
              <AlertTriangle size={24} />
            </div>
            <h2 style={{
              fontFamily: 'Manrope, sans-serif',
              fontSize: '18px',
              fontWeight: 700,
              color: '#182b23',
              margin: '0 0 8px'
            }}>
              Something didn't load quite right
            </h2>
            <p style={{
              fontSize: '12px',
              color: '#788b81',
              lineHeight: 1.6,
              margin: '0 0 20px'
            }}>
              An unexpected display issue occurred in this section. Your underlying data and settings remain safe in MongoDB.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                onClick={this.reset}
                className="outline-btn"
                style={{ margin: 0, padding: '9px 14px', fontSize: '11px', gap: '6px' }}
              >
                <RefreshCw size={13} /> Try again
              </button>
              <button
                onClick={() => { window.location.href = '/'; }}
                className="primary-btn small"
                style={{ padding: '9px 14px', fontSize: '11px', gap: '6px' }}
              >
                <Home size={13} /> Return to overview
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
