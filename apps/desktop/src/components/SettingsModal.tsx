import { DEFAULT_WS_URL } from '@pizhou/shared';
import { useState, useEffect } from 'react';
import {
  getAudioSettings,
  updateAudioSettings,
  toggleMute,
  type AudioSettings,
  type VoiceMode,
} from '../audio/settings';
import { playDiscard } from '../audio/sfx';
import { speakAction } from '../audio/voice';

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
  const [audio, setAudio] = useState<AudioSettings>(getAudioSettings());

  useEffect(() => {
    setAudio(getAudioSettings());
  }, []);

  const handleVolumeChange = (field: 'masterVolume' | 'sfxVolume' | 'voiceVolume', val: number) => {
    const next = updateAudioSettings({ [field]: val });
    setAudio(next);
  };

  const handleVoiceModeChange = (mode: VoiceMode) => {
    const next = updateAudioSettings({ voiceMode: mode });
    setAudio(next);
  };

  const handleToggleMute = () => {
    toggleMute();
    setAudio(getAudioSettings());
  };

  const handleSave = () => {
    updateAudioSettings(audio);
    onSave(url);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="gold-line" />
        <h2>游戏与声音设置</h2>

        {/* ─── Volume Controls ─── */}
        <div className="settings-section" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label className="settings-field-label" style={{ margin: 0 }}>
              音量分级控制
            </label>
            <button
              type="button"
              className={`rate-chip ${audio.muted ? 'active' : ''}`}
              style={{
                padding: '4px 10px',
                minHeight: '26px',
                fontSize: '12px',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              onClick={handleToggleMute}
            >
              {audio.muted ? '🔇 已全局静音' : '🔊 声音已开启'}
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'rgba(2, 18, 12, 0.65)',
              border: '1px solid rgba(245, 214, 120, 0.2)',
            }}
          >
            {/* Master Volume */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#fef3c7', marginBottom: '4px' }}>
                <span>主音量 (Master)</span>
                <span style={{ fontWeight: 600 }}>{Math.round(audio.masterVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(audio.masterVolume * 100)}
                onChange={(e) => handleVolumeChange('masterVolume', Number(e.target.value) / 100)}
                style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
              />
            </div>

            {/* SFX Volume */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#fef3c7', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>物理打击音效 (SFX)</span>
                  <button
                    type="button"
                    style={{
                      background: 'rgba(245, 158, 11, 0.2)',
                      border: '1px solid rgba(245, 158, 11, 0.5)',
                      borderRadius: '4px',
                      color: '#fef08a',
                      fontSize: '10px',
                      padding: '1px 6px',
                      cursor: 'pointer',
                    }}
                    onClick={() => playDiscard()}
                  >
                    🔊 试听敲击
                  </button>
                </div>
                <span style={{ fontWeight: 600 }}>{Math.round(audio.sfxVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(audio.sfxVolume * 100)}
                onChange={(e) => handleVolumeChange('sfxVolume', Number(e.target.value) / 100)}
                style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
              />
            </div>

            {/* Voice Volume */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#fef3c7', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>战吼与报牌配音 (Voice)</span>
                  <button
                    type="button"
                    style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid rgba(16, 185, 129, 0.5)',
                      borderRadius: '4px',
                      color: '#6ee7b7',
                      fontSize: '10px',
                      padding: '1px 6px',
                      cursor: 'pointer',
                    }}
                    onClick={() => speakAction('hu')}
                  >
                    🗣️ 试听配音
                  </button>
                </div>
                <span style={{ fontWeight: 600 }}>{Math.round(audio.voiceVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(audio.voiceVolume * 100)}
                onChange={(e) => handleVolumeChange('voiceVolume', Number(e.target.value) / 100)}
                style={{ width: '100%', accentColor: '#34d399', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>

        {/* ─── Voice Pack Style ─── */}
        <div className="settings-section" style={{ marginBottom: '16px' }}>
          <label className="settings-field-label">牌桌配音与人声风格</label>
          <div className="settings-chips-grid">
            <button
              type="button"
              className={`rate-chip ${audio.voiceMode === 'pizhou' ? 'active' : ''}`}
              onClick={() => handleVoiceModeChange('pizhou')}
            >
              🀄 邳州老家话配音（豪爽地道苏北乡音）
            </button>
            <button
              type="button"
              className={`rate-chip ${audio.voiceMode === 'mandarin' ? 'active' : ''}`}
              onClick={() => handleVoiceModeChange('mandarin')}
            >
              🗣️ 甜美普通话（广播级标准清脆发音）
            </button>
            <button
              type="button"
              className={`rate-chip ${audio.voiceMode === 'off' ? 'active' : ''}`}
              onClick={() => handleVoiceModeChange('off')}
            >
              🔇 关闭语音（仅保留真实物理敲击声）
            </button>
          </div>
        </div>

        {/* ─── Server Settings ─── */}
        <div className="settings-section">
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
