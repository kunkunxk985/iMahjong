import { TileShowcase } from '../components/TileView';

interface LobbyProps {
  nickname: string;
  setNickname: (value: string) => void;
  error: string;
  onStart: () => void;
  onRules: () => void;
}

export function Lobby({ nickname, setNickname, error, onStart, onRules }: LobbyProps) {
  return (
    <div className="hall">
      <div className="hall-vignette" />
      <div className="hall-card">
        <div className="gold-line" />
        <p className="eyebrow">查 胡 · 单 机 桌</p>
        <h1>邳州麻将</h1>
        <p className="sub">双击开打 · 三位陪练 · 联网以后再加</p>
        <TileShowcase />

        <label>
          昵称
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={12} placeholder="你的昵称" />
        </label>

        <button type="button" className="btn-action hero" onClick={onStart}>
          开始对局
          <small>和三位陪练打一局</small>
        </button>

        <button type="button" className="btn-action ghost wide" onClick={onRules}>
          规则说明
        </button>

        <p className="hint">双击手牌出牌。陪练会吃碰杠，出牌有思考时间。联网以后再加。</p>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  );
}
