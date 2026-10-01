import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "@/lib/error-logger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, `React render (${info.componentStack?.split("\n")[1]?.trim() ?? "?"})`);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream-50 p-8 text-center">
          <h1 className="text-xl font-bold text-forest-950">Algo deu errado</h1>
          <p className="text-sm text-ink-muted">O erro já foi registrado. Recarregue a página pra continuar.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-forest-950 px-5 py-2.5 text-sm font-semibold text-cream-50"
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
