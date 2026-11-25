import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary detectó un error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-800 font-sans">
          <div className="card-obsidian max-w-md w-full p-8 text-center space-y-4 shadow-xl border border-slate-200">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
              <AlertCircle size={28} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Panel en Recuperación</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {this.state.error?.message || "Se detectó una discrepancia en el estado visual. Puedes recargar de inmediato."}
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="btn-emerald py-2.5 px-5 text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md"
              >
                <RefreshCw size={14} />
                <span>Recargar Plataforma</span>
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
