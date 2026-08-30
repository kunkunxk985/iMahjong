export interface ActiveChatBubble {
  id: number;
  seat: number;
  position: 'bottom' | 'top' | 'left' | 'right';
  message: string;
  isEmote?: boolean;
}

export function ChatBubbleOverlay({ bubbles }: { bubbles: ActiveChatBubble[] }) {
  if (bubbles.length === 0) return null;

  return (
    <div className="chat-bubble-container" aria-live="polite">
      {bubbles.map((bubble) => (
        <div
          key={bubble.id}
          className={`chat-bubble pos-${bubble.position} ${bubble.isEmote ? 'is-emote' : 'is-text'}`}
        >
          <div className="bubble-arrow" />
          <span className="bubble-content">{bubble.message}</span>
        </div>
      ))}
    </div>
  );
}
