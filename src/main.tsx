import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { testFirestoreConnection } from './firebase';

// Validate Firestore & Storage connectivity on boot without blocking UI render
try {
  testFirestoreConnection().catch(() => {});
} catch {}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class RootErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error || 'Unknown error'),
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    console.error('[RootErrorBoundary] Caught runtime error:', error, errorInfo);
    try {
      const autoRecovered = sessionStorage.getItem('syoumax_auto_recovered');
      if (!autoRecovered) {
        sessionStorage.setItem('syoumax_auto_recovered', 'true');
        localStorage.removeItem('chayef_assoc_current_admin_session_v1');
        localStorage.removeItem('chayef_assoc_logged_in_member_id_v1');
        this.setState({ hasError: false, errorMessage: '' });
      }
    } catch {}
  }

  handleResetAndReload = () => {
    try {
      sessionStorage.clear();
      localStorage.removeItem('chayef_assoc_current_admin_session_v1');
      localStorage.removeItem('chayef_assoc_logged_in_member_id_v1');
    } catch {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6 font-['Cairo',sans-serif]"
        >
          <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white font-black text-xl flex items-center justify-center mx-auto shadow-md">
              S
            </div>
            <h1 className="text-xl font-black text-slate-900">syoumax منصة العمل الجمعوي</h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              حدث خطأ مؤقت أثناء تحميل بيانات الجلسة. اضغط على الزر أدناه لتحديث الواجهة فوراً.
            </p>
            <button
              type="button"
              onClick={this.handleResetAndReload}
              className="w-full py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
            >
              تحديث وإعادة فتح المنصة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

let rootElement = document.getElementById('root');
if (!rootElement) {
  rootElement = document.createElement('div');
  rootElement.id = 'root';
  document.body.appendChild(rootElement);
}

createRoot(rootElement).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>
);
