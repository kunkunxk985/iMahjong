import { DEFAULT_WS_URL } from '@pizhou/shared';
import { useState } from 'react';
import { getVoiceMode, setVoiceMode, type VoiceMode } from '../audio/voice';

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
  const [voice, setVoice] = useState<VoiceMode>(getVoiceMode());

  const handleSave = () => {
    setVoiceMode(voice);
    onSave(url);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="gold-line" />
        <h2>游戏设置</h2>

        <div className="settings-section">
          <label className="settings-field-label">牌桌配音与人声风格</label>
          <div className="settings-chips-grid">
            <button
              type="button"
              className={`rate-chip ${voice === 'pizhou' ? 'active' : ''}`}
              onClick={() => setVoice('pizhou')}
            >
              🀄 邳州老家话配音
            </button>
            <button
              type="button"
              className={`rate-chip ${voice === 'mandarin' ? 'active' : ''}`}
              onClick={() => setVoice('mandarin')}
            >
              🗣️ 甜美普通话
            </button>
            <button
              type="button"
              className={`rate-chip ${voice === 'off' ? 'active' : ''}`}
              onClick={() => setVoice('off')}
            >
              🔇 关闭语音（仅敲击声）
            </button>
          </div>
        </div>

        <label className="settings-field-label" style={{ marginTop: '14px' }}>
          服务器连接地址
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="留空则用本机内置服务" />
        </label>
        <p className="hint">
          单机和本机开房留空即可。去朋友电脑或云服务器打时，填云服务器公网 IP 或域名，例如 {DEFAULT_WS_URL.replace('localhost', '192.168.1.8')}。
        </p>

        <div className="row">
          <button type="button" className="btn-action primary" onClick={handleSave}>
            保存设置
          </button>
          {onNewWindow ? (
            <button type="button" className="btn-action" onClick={onNewWindow}>
              新开窗口
            </button>
          ) : null}
          <button type="button" className="btn-action ghost" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
