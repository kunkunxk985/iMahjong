import { AvatarView } from './AvatarView';

export interface ActiveChatBubble {
  id: number;
  seat: number;
  position: 'bottom' | 'top' | 'left' | 'right';
  message: string;
  isEmote?: boolean;
  senderNickname?: string;
  senderAvatar?: string;
}

export function ChatBubbleOverlay({ bubbles }: { bubbles: ActiveChatBubble[] }) {
  if (bubbles.length === 0) return null;

  return (
    <div className="chat-bubble-container" aria-live="polite">
      {bubbles.map((bubble) => (
        <div
          key={bubble.id}
          className={`chat-bubble pos-${bubble.position} ${bubble.isEmote ? 'is-emote' : 'is-text'}`}
          aria-label={bubble.senderNickname ? `${bubble.senderNickname}：${bubble.message}` : bubble.message}
        >
          <div className="bubble-arrow" />
          {bubble.senderNickname ? (
            <span className="bubble-sender">
              <AvatarView avatar={bubble.senderAvatar} className="bubble-sender-avatar" alt="" />
              <span>{bubble.senderNickname}</span>
            </span>
          ) : null}
          <span className="bubble-content">{bubble.message}</span>
        </div>
      ))}
    </div>
  );
}
