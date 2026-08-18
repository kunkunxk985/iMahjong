import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

interface ErrorBoundaryState {
  error: Error | null;
}

class AppErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fatal-error">
        <div className="fatal-error-card">
          <p className="eyebrow">牌 桌 启 动 失 败</p>
          <h1>邳州麻将暂时没能打开</h1>
          <p>程序本身已经启动，但界面渲染时遇到了问题。请重新加载一次；如果仍然出现，请把下面这段信息发给开发者。</p>
          <code>{this.state.error.message || '未知渲染错误'}</code>
          <button type="button" className="btn-action primary" onClick={() => window.location.reload()}>
            重新加载
          </button>
        </div>
      </div>
    );
  }
}

const root = document.getElementById('root');
if (!root) throw new Error('root missing');
createRoot(root).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
