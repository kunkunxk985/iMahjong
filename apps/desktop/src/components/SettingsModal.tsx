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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [voice, setVoice] = useState<VoiceMode>(getVoiceMode());

  const handleSave = () => {
    setVoiceMode(voice);
    onSave(url);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '440px' }}>
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

        <div className="settings-section" style={{ marginTop: '16px' }}>
          <label className="settings-field-label">联机服务器</label>
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(6, 78, 59, 0.4)',
              border: '1px solid rgba(52, 211, 153, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '13px',
              color: '#d1fae5',
            }}
          >
            <span>☁️ Cloudflare 云端官方服务</span>
            <span style={{ color: '#34d399', fontWeight: 600 }}>🟢 24h 在线</span>
          </div>

          <div style={{ marginTop: '10px', textAlign: 'right' }}>
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '11px',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? '收起高级设置' : '⚙️ 自定义私服地址（开发者）'}
            </button>
          </div>

          {showAdvanced ? (
            <div style={{ marginTop: '10px' }}>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder={DEFAULT_WS_URL}
                style={{ fontSize: '12px', width: '100%' }}
              />
              <p className="hint" style={{ fontSize: '11px', marginTop: '4px' }}>
                默认已直连官方云端，留空即自动恢复官方云端。
              </p>
            </div>
          ) : null}
        </div>

        <div className="row" style={{ marginTop: '20px' }}>
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
