import { useState } from 'react';

interface QuickChatProps {
  onSend: (message: string, isEmote?: boolean) => void;
  onClose: () => void;
}

const PIZHOU_QUOTES = [
  '催什么催，在算胡呢！',
  '你小子敢闯香牌？点炮包全桌！',
  '看我这把四坎一张飘荤大满贯！',
  '别碰了，把我的坎都碰散了！',
  '手气正好，再来一圈！',
  '手气背到家，摸啥啥不来！',
  '稳住别慌，老子马上关门！',
  '快点打呀，天都要亮了！',
];

const EMOTES = [
  { emoji: '🍵', label: '悠闲喝茶' },
  { emoji: '🚬', label: '抽根烟压惊' },
  { emoji: '🙏', label: '求张好牌' },
  { emoji: '💦', label: '汗流浃背' },
  { emoji: '💥', label: '愤怒砸桌' },
  { emoji: '💰', label: '恭喜发财' },
  { emoji: '🔥', label: '手气火热' },
  { emoji: '🎉', label: '开心欢呼' },
];

export function QuickChat({ onSend, onClose }: QuickChatProps) {
  const [tab, setTab] = useState<'quotes' | 'emotes'>('quotes');

  return (
    <div className="quick-chat-popover">
      <div className="quick-chat-tabs">
        <button
          type="button"
          className={`chat-tab-btn ${tab === 'quotes' ? 'active' : ''}`}
          onClick={() => setTab('quotes')}
        >
          🀄 邳州老家金句
        </button>
        <button
          type="button"
          className={`chat-tab-btn ${tab === 'emotes' ? 'active' : ''}`}
          onClick={() => setTab('emotes')}
        >
          😄 牌桌表情
        </button>
        <button type="button" className="chat-close-x" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="quick-chat-body">
        {tab === 'quotes' ? (
          <div className="quotes-list">
            {PIZHOU_QUOTES.map((quote) => (
              <button
                key={quote}
                type="button"
                className="quote-item-btn"
                onClick={() => {
                  onSend(quote, false);
                  onClose();
                }}
              >
                {quote}
              </button>
            ))}
          </div>
        ) : (
          <div className="emotes-grid">
            {EMOTES.map(({ emoji, label }) => (
              <button
                key={emoji}
                type="button"
                className="emote-item-btn"
                onClick={() => {
                  onSend(emoji, true);
                  onClose();
                }}
                title={label}
              >
                <span className="emote-icon">{emoji}</span>
                <span className="emote-name">{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
