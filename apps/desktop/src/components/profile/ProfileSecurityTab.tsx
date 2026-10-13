import React from 'react';
import type { UserProfile } from '@pizhou/shared';

interface ProfileSecurityTabProps {
  effectiveUser: UserProfile;
  onOpenSecurity: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export function ProfileSecurityTab({ effectiveUser, onOpenSecurity, onOpenAuth, onLogout }: ProfileSecurityTabProps): React.ReactElement {
  return (
    <div className="deck-pane security-pane">
      {effectiveUser.isGuest ? (
        <div className="dossier-guest-banner">
          <div className="guest-banner-icon">⚡</div>
          <div className="guest-banner-text">
            <h4>当前为免密游客账号</h4>
            <p>换设备或清理缓存后数据可能会丢失，建议立即升级为正式账号永久绑定战绩。</p>
          </div>
          <button
            type="button"
            className="btn-action primary sm"
            onClick={onOpenSecurity}
          >
            一键升级转正
          </button>
        </div>
      ) : null}

      <div className="dossier-security-list">
        <div className="security-row">
          <div className="security-meta">
            <span className="sec-label">登录账号</span>
            <strong className="sec-val">{effectiveUser.username}</strong>
          </div>
          <span className="sec-status-tag ok">正常使用中</span>
        </div>

        <div className="security-row">
          <div className="security-meta">
            <span className="sec-label">账号认证级别</span>
            <strong className="sec-val">{effectiveUser.isGuest ? '游客模式' : '云端正式雀士'}</strong>
          </div>
          {!effectiveUser.isGuest ? (
            <button
              type="button"
              className="btn-action ghost sm"
              onClick={onOpenSecurity}
            >
              修改密码
            </button>
          ) : null}
        </div>

        <div className="security-row">
          <div className="security-meta">
            <span className="sec-label">多设备漫游凭据</span>
            <small className="sec-sub">支持换电脑输入卡号与密码无缝同步</small>
          </div>
          <button
            type="button"
            className="btn-action ghost sm"
            onClick={onOpenAuth}
          >
            切换账号
          </button>
        </div>

        <div className="security-row logout-row">
          <div className="security-meta">
            <span className="sec-label">退出登录</span>
            <small className="sec-sub">清除本机当前会话凭证，返回登录页面</small>
          </div>
          <button
            type="button"
            className="btn-action ghost sm danger"
            onClick={onLogout}
          >
            退出当前登录
          </button>
        </div>
      </div>
    </div>
  );
}
