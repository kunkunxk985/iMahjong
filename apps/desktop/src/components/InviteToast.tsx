import { useEffect } from 'react';
import type { FriendInvite } from '@pizhou/shared';
import { AvatarView } from './AvatarView';

interface InviteToastProps {
  invite: FriendInvite;
  onAccept: (roomCode: string) => void;
  onDecline: () => void;
}

export function InviteToast({ invite, onAccept, onDecline }: InviteToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDecline();
    }, 15000);
    return () => clearTimeout(timer);
  }, [onDecline]);

  return (
    <div className="invite-toast-container">
      <div className="invite-toast-card">
        <div className="invite-toast-avatar">
          <AvatarView avatar={invite.fromAvatar} alt={`${invite.fromNickname}头像`} />
        </div>
        <div className="invite-toast-body">
          <div className="invite-toast-title">
            <b>{invite.fromNickname}</b> 邀请你对局
          </div>
          <div className="invite-toast-desc">
            房间号: <span className="room-badge">{invite.roomCode}</span> · 四人对战
          </div>
        </div>
        <div className="invite-toast-actions">
          <button
            type="button"
            className="btn-action primary sm invite-accept-btn"
            onClick={() => onAccept(invite.roomCode)}
          >
            接受并加入
          </button>
          <button
            type="button"
            className="btn-action ghost sm invite-decline-btn"
            onClick={onDecline}
          >
            婉拒
          </button>
        </div>
      </div>
    </div>
  );
}
