import { useEffect, useMemo, useState } from 'react';
import {
  isPrivatePlayerView,
  SEAT_NAMES,
  type AvailableAction,
  type ClientView,
  type GameAction,
  type PublicPlayerView,
} from '@pizhou/shared';
import { ActionBar } from '../components/ActionBar';
import { Melds } from '../components/Melds';
import { TileView } from '../components/TileView';
import { TableScene } from '../scene/TableScene';

interface TableProps {
  view: ClientView;
  onAction: (action: GameAction) => void;
  onRules?: () => void;
  onLeave?: () => void;
}

function relative(seat: number, me: number): number {
  return (seat - me + 4) % 4;
}

function useCountdown(deadline: number | null): number {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!deadline) {
      setLeft(0);
      return;
    }
    const tick = () => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [deadline]);
  return left;
}

function Plaque({
  player,
  you,
  current,
}: {
  player: PublicPlayerView;
  you?: boolean;
  current: boolean;
}) {
  return (
    <div className={`plaque-card ${current ? 'current' : ''} ${player.online ? '' : 'offline'}`}>
      <i className="wind">{SEAT_NAMES[player.seat]}</i>
      <div className="meta">
        <strong>
          {player.nickname}
          {you ? ' · 你' : ''}
          {player.isBot ? ' · 陪练' : ''}
        </strong>
        <span>
          {player.isDealer ? <b className="dealer">庄</b> : null}
          {player.isHost && !player.isBot ? ' 房主' : ''}
          {player.online ? '' : ' 离线'}
        </span>
      </div>
      <em>{player.score}</em>
    </div>
  );
}

export function Table({ view, onAction, onRules, onLeave }: TableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const left = useCountdown(view.turnDeadline);
  const me = view.players.find((player) => player.seat === view.mySeat);
  const myHand = me && isPrivatePlayerView(me) ? me.hand : [];
  const lastDrawnId = me && isPrivatePlayerView(me) ? me.lastDrawnId : undefined;
  const canDiscard = view.availableActions.some((action) => action.kind === 'discard');
  const currentPlayer = view.players.find((player) => player.seat === view.currentSeat);
  const myTurn = view.gamePhase === 'self-turn' && view.currentSeat === view.mySeat;
  const claiming = view.gamePhase === 'claim-window' && view.availableActions.some((item) => item.kind !== 'discard');

  useEffect(() => {
    if (lastDrawnId && canDiscard) setSelectedId(lastDrawnId);
  }, [lastDrawnId, canDiscard, view.sequence]);

  const byRel = useMemo(() => {
    const map: Record<number, (typeof view.players)[number] | undefined> = {};
    for (const player of view.players) {
      map[relative(player.seat, view.mySeat)] = player;
    }
    return map;
  }, [view]);

  const discard = () => {
    if (!selectedId || !canDiscard) return;
    onAction({ kind: 'discard', tileId: selectedId });
    setSelectedId(null);
  };

  const handleAction = (action: AvailableAction | GameAction) => {
    if (action.kind === 'discard') {
      discard();
      return;
    }
    onAction({
      kind: action.kind,
      tileId: action.tileId,
      tileIds: action.tileIds,
      key: action.key,
    });
  };

  const ring = Math.max(0, Math.min(100, (left / 18) * 100));
  const phaseText =
    view.gamePhase === 'qidong'
      ? '起手杠：可胡可过'
      : claiming
        ? '有人打出，要不要'
        : myTurn
          ? '轮到你出牌'
          : `${currentPlayer?.nickname ?? '下家'} 出牌`;

  return (
    <div className="table-shell">
      <TableScene view={view} />

      <header className="table-hud">
        <div className="hud-chip">{view.roomCode ? (view.roomCode === '单机' ? '单机练习' : `房间 ${view.roomCode}`) : '对局中'}</div>
        <div className="hud-chip">第 {view.round || 1} 局</div>
        <div className="hud-chip">余牌 {view.wallCount}</div>
        <div className={`turn-banner ${myTurn || claiming ? 'mine' : ''}`}>{phaseText}</div>
        <div className={`timer ${left <= 5 ? 'urgent' : ''}`} style={{ background: `conic-gradient(#e0c36a ${ring}%, rgba(0,0,0,.28) 0)` }}>
          <span>{left > 0 ? left : '--'}</span>
        </div>
        {onRules ? (
          <button type="button" className="btn-action ghost hud-btn" onClick={onRules}>
            规则
          </button>
        ) : null}
        {onLeave ? (
          <button type="button" className="btn-action ghost hud-btn" onClick={onLeave}>
            回大厅
          </button>
        ) : null}
      </header>

      {byRel[2] ? (
        <div className="overlay-seat top">
          <Plaque player={byRel[2]} current={view.currentSeat === byRel[2].seat} />
        </div>
      ) : null}
      {byRel[3] ? (
        <div className="overlay-seat left">
          <Plaque player={byRel[3]} current={view.currentSeat === byRel[3].seat} />
        </div>
      ) : null}
      {byRel[1] ? (
        <div className="overlay-seat right">
          <Plaque player={byRel[1]} current={view.currentSeat === byRel[1].seat} />
        </div>
      ) : null}

      {me ? (
        <div className={`self-area ${myTurn ? 'my-turn' : ''}`}>
          <Plaque player={me} you current={view.currentSeat === me.seat} />
          <Melds melds={me.melds} />
          <div className="own-hand">
            {myHand.map((tile) => (
              <TileView
                key={tile.id}
                tile={tile}
                selected={selectedId === tile.id}
                drawn={lastDrawnId === tile.id}
                onClick={() => setSelectedId(tile.id === selectedId ? null : tile.id)}
                onDoubleClick={() => {
                  if (!canDiscard) return;
                  onAction({ kind: 'discard', tileId: tile.id });
                  setSelectedId(null);
                }}
              />
            ))}
          </div>
          <ActionBar
            actions={view.availableActions}
            onAction={handleAction}
            onDiscard={discard}
            canDiscard={canDiscard && Boolean(selectedId)}
          />
        </div>
      ) : null}
    </div>
  );
}
