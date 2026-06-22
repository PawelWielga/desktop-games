import React from "react";

export type WindowErrorBoundaryLabels = {
  title: string;
  message: string;
  close: string;
  technicalDetails: string;
  errorMessage: string;
  stackTrace: string;
  componentStack: string;
};

type WindowErrorBoundaryProps = {
  children: React.ReactNode;
  labels: WindowErrorBoundaryLabels;
  onClose: () => void;
  windowTitle: string;
};

type WindowErrorBoundaryState = {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
};

const getErrorMessage = (error: Error): string => error.message || error.name || "Unknown error";

export function shouldShowTechnicalErrorDetails(): boolean {
  return import.meta.env.DEV;
}

export class WindowErrorBoundary extends React.Component<
  WindowErrorBoundaryProps,
  WindowErrorBoundaryState
> {
  state: WindowErrorBoundaryState = {
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): Partial<WindowErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ error, errorInfo });
  }

  render(): React.ReactNode {
    const { error, errorInfo } = this.state;

    if (!error) {
      return this.props.children;
    }

    const showDetails = shouldShowTechnicalErrorDetails();
    const errorMessage = getErrorMessage(error);
    const stackTrace = error.stack;
    const componentStack = errorInfo?.componentStack;

    return (
      <div className="window-error-boundary" role="alert" aria-live="assertive">
        <div className="window-error-boundary__icon" aria-hidden="true">
          ⚠️
        </div>
        <div className="window-error-boundary__body">
          <h2>{this.props.labels.title}</h2>
          <p>{this.props.labels.message}</p>
          <button className="window-error-boundary__close" type="button" onClick={this.props.onClose}>
            {this.props.labels.close}
          </button>
        </div>
        {showDetails && (
          <details className="window-error-boundary__details">
            <summary>{this.props.labels.technicalDetails}</summary>
            <dl>
              <dt>{this.props.labels.errorMessage}</dt>
              <dd>{errorMessage}</dd>
              {stackTrace && (
                <>
                  <dt>{this.props.labels.stackTrace}</dt>
                  <dd>
                    <pre>{stackTrace}</pre>
                  </dd>
                </>
              )}
              {componentStack && (
                <>
                  <dt>{this.props.labels.componentStack}</dt>
                  <dd>
                    <pre>{componentStack}</pre>
                  </dd>
                </>
              )}
            </dl>
          </details>
        )}
      </div>
    );
  }
}
