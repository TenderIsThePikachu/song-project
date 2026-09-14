import { Component, type ErrorInfo, type ReactNode } from 'react';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App render failed:', error, errorInfo);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          background: 'linear-gradient(135deg, #eefbf8 0%, #f4f6ff 100%)',
          color: '#152033',
          fontFamily: 'Inter, Pretendard, system-ui, sans-serif',
        }}
      >
        <section
          style={{
            width: 'min(720px, 100%)',
            padding: 32,
            borderRadius: 28,
            background: 'rgba(255, 255, 255, 0.94)',
            border: '1px solid rgba(174, 190, 214, 0.8)',
            boxShadow: '0 24px 80px rgba(34, 45, 70, 0.16)',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              marginBottom: 14,
              padding: '8px 13px',
              borderRadius: 999,
              background: '#ddfbf2',
              color: '#07856f',
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: '0.08em',
            }}
          >
            APP ERROR
          </span>
          <h1 style={{ margin: 0, fontSize: 30 }}>페이지를 불러오는 중 오류가 났어요.</h1>
          <p style={{ margin: '12px 0 22px', color: '#5e6b82', lineHeight: 1.7 }}>
            흰 화면 대신 오류를 표시하도록 바꿨어요. 아래 메시지를 보내주면 바로 이어서 잡을 수 있습니다.
          </p>
          <pre
            style={{
              overflow: 'auto',
              padding: 18,
              borderRadius: 18,
              background: '#111827',
              color: '#d7fbe8',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.55,
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20,
              padding: '12px 18px',
              borderRadius: 14,
              border: '1px solid #b8dfd5',
              background: '#20c79a',
              color: '#ffffff',
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            새로고침
          </button>
        </section>
      </main>
    );
  }
}
