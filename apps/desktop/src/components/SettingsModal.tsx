import { DEFAULT_WS_URL } from '@pizhou/shared';
import { useState } from 'react';

export function SettingsModal({
  serverUrl,
  onSave,
  onClose,
  onNewWindow,
}: {
  serverUrl: string;
  onSave: (url: string) => void;
  onClose: () => void;
  onNewWindow?: () => void;
}) {
  const [url, setUrl] = useState(serverUrl);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="gold-line" />
        <h2>设置</h2>
        <label>
          服务器地址
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="留空则用本机内置服务" />
        </label>
        <p className="hint">
          单机和本机开房留空即可。去朋友电脑上打时，填那台电脑打印的地址，例如 {DEFAULT_WS_URL.replace('localhost', '192.168.1.8')}。
        </p>
        <div className="row">
          <button type="button" className="btn-action primary" onClick={() => onSave(url)}>
            保存并连接
          </button>
          {onNewWindow ? (
            <button type="button" className="btn-action" onClick={onNewWindow}>
              新开窗口
            </button>
          ) : null}
          <button type="button" className="btn-action ghost" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
