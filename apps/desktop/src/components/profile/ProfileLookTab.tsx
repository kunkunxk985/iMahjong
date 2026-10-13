import React from 'react';
import { BIO_MAX, NICKNAME_MAX, PRESET_AVATARS, GUOFENG_AVATAR_PRESETS, isImageAvatar } from '@pizhou/shared';
import { GuofengAvatar } from '../GuofengAvatar';

interface ProfileLookTabProps {
  avatar: string;
  nickname: string;
  title: string;
  bio: string;
  avatarTab: 'guofeng' | 'custom';
  uploadingAvatar: boolean;
  avatarError: string | null;
  unlockedTitles: string[];
  setAvatar: (value: string) => void;
  setNickname: (value: string) => void;
  setTitle: (value: string) => void;
  setBio: (value: string) => void;
  setAvatarTab: (value: 'guofeng' | 'custom') => void;
  handleAvatarFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ProfileLookTab({ avatar, nickname, title, bio, avatarTab, uploadingAvatar, avatarError, unlockedTitles, setAvatar, setNickname, setTitle, setBio, setAvatarTab, handleAvatarFile }: ProfileLookTabProps) {
  return (
    <div className="deck-pane look-pane">
      {/* Avatar Picker Header & Mode Toggle */}
      <details className="form-section quiet-avatar-options"><summary>更换头像</summary>
        <div className="section-head-row">
          <label className="deck-field-label" style={{ margin: 0 }}>头像</label>
          <div className="sub-pill-toggle">
            <button
              type="button"
              className={avatarTab === 'guofeng' ? 'active' : ''}
              onClick={() => setAvatarTab('guofeng')}
            >
              预设头像
            </button>
            <button
              type="button"
              className={avatarTab === 'custom' ? 'active' : ''}
              onClick={() => setAvatarTab('custom')}
            >
              上传头像
            </button>
          </div>
        </div>

        {avatarTab === 'guofeng' ? (
          /* 12 Curated Guofeng Avatars Grid: 6 columns x 2 rows, NO SCROLLBAR */
          <div className="guofeng-avatar-matrix">
            {GUOFENG_AVATAR_PRESETS.map((preset) => {
              const isSelected = avatar === preset.id;
              return (
                <div
                  key={preset.id}
                  className={`guofeng-card ${isSelected ? 'active' : ''}`}
                  onClick={() => setAvatar(preset.id)}
                  title={`${preset.name} · ${preset.desc}`}
                >
                  <div className="guofeng-avatar-wrap">
                    <GuofengAvatar id={preset.id} size={42} />
                    {isSelected && <span className="guofeng-check">✓</span>}
                  </div>
                  <span className="guofeng-title">{preset.name.slice(0, 2)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          /* Custom Upload & Legacy Emoji Picker */
          <div style={{ padding: '8px 0' }}>
            <div className="dossier-avatar-picker">
              {PRESET_AVATARS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`dossier-avatar-chip ${avatar === emoji ? 'active' : ''}`}
                  onClick={() => setAvatar(emoji)}
                  title={`选用 ${emoji} 头像`}
                >
                  {emoji}
                </button>
              ))}
              <label
                className={`dossier-avatar-upload ${isImageAvatar(avatar) ? 'active' : ''} ${uploadingAvatar ? 'is-loading' : ''}`}
                title="上传本地自定义头像"
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarFile}
                  disabled={uploadingAvatar}
                />
                <span>{uploadingAvatar ? '…' : '📷'}</span>
                <small>上传</small>
              </label>
            </div>
            {avatarError && <p className="avatar-error" style={{ color: '#ef4444', fontSize: '11px', marginTop: '6px' }}>{avatarError}</p>}
          </div>
        )}
      </details>

      {/* 2-Column Row: Nickname & Title */}
      <div className="dossier-two-col">
        <div className="form-section">
          <div className="field-label-row">
            <label className="deck-field-label">昵称</label>
            <span className="field-count">{nickname.length}/{NICKNAME_MAX}</span>
          </div>
          <input
            type="text"
            className="input-field dossier-input"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={NICKNAME_MAX}
            placeholder="输入你的昵称"
          />
        </div>

        <div className="form-section">
          <div className="field-label-row">
            <label className="deck-field-label">称号</label>

          </div>
          <select className="input-field dossier-input" aria-label="称号" value={title} onChange={(event) => setTitle(event.target.value)}>
            {unlockedTitles.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </div>

      {/* Personal Bio / Motto */}
      <div className="form-section">
        <div className="field-label-row">
          <label className="deck-field-label">签名</label>
          <span className="field-count">{bio.length}/{BIO_MAX}</span>
        </div>
        <textarea
          className="input-field dossier-input dossier-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={BIO_MAX}
          rows={2}
          placeholder="写点关于自己的话"
        />

      </div>
    </div>
  );
}
