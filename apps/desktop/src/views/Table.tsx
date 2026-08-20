import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ACTION_TIMEOUT_MS,
  isPrivatePlayerView,
  SEAT_NAMES,
  tileLabel,
  TILE_COPIES,
  type AvailableAction,
  type ClientView,
  type GameAction,
  type Meld,
  type PublicPlayerView,
  type Tile,
} from '@pizhou/shared';
import { getDiscardTenpaiOptions, type DiscardTenpaiOption } from '@pizhou/rules';
import { ActionBar } from '../components/ActionBar';
import { Melds } from '../components/Melds';
import { TileView } from '../components/TileView';
import { useSoundEffects } from '../audio/useSoundEffects';
import { isMuted, toggleMute } from '../audio/sfx';

interface TableProps {
  view: ClientView;
  onAction: (action: GameAction) => void;
  onRules?: () => void;
  onLeave?: () => void;
  networkStatus?: 'connecting' | 'open' | 'closed';
  practice?: boolean;
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

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

type ViewPlayer = ClientView['players'][number];
type BoardPosition = 'top' | 'right' | 'bottom' | 'left';

function BoardPlayer({
  player,
  position,
  you,
  current,
}: {
  player: ViewPlayer;
  position: BoardPosition;
  you?: boolean;
  current: boolean;
}) {
  const avatar = player.isBot ? '陪' : player.nickname.slice(0, 1);
  return (
    <div className={`board-player board-player-${position} ${current ? 'is-current' : ''} ${you ? 'is-you' : ''}`}>
      <div className={`board-avatar avatar-${player.seat}`}>
        <span>{avatar}</span>
        <i>{SEAT_NAMES[player.seat]}</i>
      </div>
      <div className="board-player-copy">
        <strong>{player.nickname}{you ? ' · 你' : ''}</strong>
        <span>
          {player.isDealer ? <b className="board-dealer">庄</b> : null}
          {player.isBot ? '陪练' : player.isHost ? '房主' : player.online ? '在线' : '离线'}
        </span>
      </div>
      <em>{player.score}</em>
    </div>
  );
}

function WallRail({ position, wallCount }: { position: BoardPosition; wallCount: number }) {
  const maxCount = position === 'top' ? 14 : 7;
  const count = Math.min(maxCount, Math.max(0, Math.ceil(wallCount / 6)));
  if (count === 0) return null;
  return (
    <div className={`board-wall board-wall-${position}`} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <TileView key={`${position}-wall-${index}`} back small className="board-wall-tile" />
      ))}
    </div>
  );
}

function ConcealedHand({ player, position }: { player: ViewPlayer; position: BoardPosition }) {
  const count = Math.min(player.handCount, 14);
  if (count === 0) return null;
  return (
    <div className={`board-concealed board-concealed-${position}`} aria-label={`${SEAT_NAMES[player.seat]}手牌背面`}>
      {Array.from({ length: count }, (_, index) => (
        <TileView key={`${player.seat}-hand-${index}`} back small className="board-concealed-tile" />
      ))}
    </div>
  );
}

function DiscardRiver({
  player,
  position,
  lastDiscardId,
  highlightKey,
  onTileHover,
}: {
  player: PublicPlayerView;
  position: BoardPosition;
  lastDiscardId?: string;
  highlightKey?: string | null;
  onTileHover?: (key: string | null) => void;
}) {
  const discards = player.discards;
  if (discards.length === 0) return null;

  return (
    <div className={`board-discard board-discard-${position}`} aria-label={`${SEAT_NAMES[player.seat]}弃牌区`}>
      <div className="board-discard-meta">
        <span className="river-seat-mark">{SEAT_NAMES[player.seat]}</span>
        <span className="river-count">{String(discards.length).padStart(2, '0')}</span>
      </div>
      <div className="board-discard-grid">
        {discards.map((tile) => (
          <TileView
            key={tile.id}
            tile={tile}
            small
            last={tile.id === lastDiscardId}
            highlightSame={Boolean(highlightKey && tile.key === highlightKey)}
            onHover={(hovered) => onTileHover?.(hovered ? tile.key : null)}
            className="board-discard-tile"
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Count visible tiles to compute remaining for tenpai ──── */

function countVisibleTiles(view: ClientView, myHand: Tile[]): Record<string, number> {
  const seen: Record<string, number> = {};
  const add = (key: string) => {
    if (key && key !== 'back') {
      seen[key] = (seen[key] ?? 0) + 1;
    }
  };

  // My hand
  for (const tile of myHand) add(tile.key);

  // All players' discards and melds
  for (const player of view.players) {
    for (const tile of player.discards) add(tile.key);
    for (const meld of player.melds) {
      if (player.seat === view.mySeat || (meld.type !== 'kan' && meld.type !== 'an-gang')) {
        for (const tile of meld.tiles) add(tile.key);
      }
    }
  }

  return seen;
}

function remainingCount(key: string, visible: Record<string, number>): number {
  return Math.max(0, TILE_COPIES - (visible[key] ?? 0));
}

/* ─── Tenpai Info Bar Component ────────────────────────────── */

function TenpaiBar({
  waits,
  visible,
  previewLabel,
  elevated,
}: {
  waits: string[];
  visible: Record<string, number>;
  previewLabel?: string;
  elevated?: boolean;
}) {
  if (waits.length === 0) return null;
  const totalRemaining = waits.reduce((sum, key) => sum + remainingCount(key, visible), 0);

  return (
    <div className={`tenpai-bar ${elevated ? 'elevated' : ''}`}>
      <span className="tenpai-label">{previewLabel ? `打【${previewLabel}】听` : '听'}</span>
      {waits.map((key) => {
        const left = remainingCount(key, visible);
        return (
          <span key={key} className={`wait-tile ${left === 0 ? 'is-empty' : ''}`}>
            {tileLabel(key)}
            <span className="wait-count">×{left}</span>
          </span>
        );
      })}
      <span className="wait-total">共{totalRemaining}张</span>
    </div>
  );
}

/* ─── Main Table Component ─────────────────────────────────── */

export function Table({ view, onAction, onRules, onLeave, networkStatus, practice = false }: TableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredTileKey, setHoveredTileKey] = useState<string | null>(null);
  const [hoveredTileId, setHoveredTileId] = useState<string | null>(null);
  const [enteringId, setEnteringId] = useState<string | undefined>(undefined);
  const [muted, setMuted] = useState(isMuted());
  const left = useCountdown(view.turnDeadline);
  const me = view.players.find((player) => player.seat === view.mySeat);
  const myHand = me && isPrivatePlayerView(me) ? me.hand : [];
  const myMelds: Meld[] = me ? me.melds : [];
  const lastDrawnId = me && isPrivatePlayerView(me) ? me.lastDrawnId : undefined;
  const canDiscard = view.availableActions.some((action) => action.kind === 'discard');
  const currentPlayer = view.players.find((player) => player.seat === view.currentSeat);
  const myTurn = view.gamePhase === 'self-turn' && view.currentSeat === view.mySeat;
  const claiming = view.gamePhase === 'claim-window' && view.availableActions.some((item) => item.kind !== 'discard');

  // Track previous lastDrawnId to detect new draws for entering animation
  const prevDrawnRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (lastDrawnId && lastDrawnId !== prevDrawnRef.current) {
      setEnteringId(lastDrawnId);
      // Clear entering state after animation completes
      const timer = setTimeout(() => setEnteringId(undefined), 350);
      prevDrawnRef.current = lastDrawnId;
      return () => clearTimeout(timer);
    }
    setEnteringId(undefined);
    prevDrawnRef.current = lastDrawnId;
  }, [lastDrawnId, view.sequence]);

  // Sound effects hook
  useSoundEffects(view);

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

  // Focus key for highlighting: hovered tile's key, or selected tile's key
  const selectedTile = useMemo(() => myHand.find((t) => t.id === selectedId), [myHand, selectedId]);
  const focusKey = hoveredTileKey ?? selectedTile?.key ?? null;

  // ── Tenpai calculation ──
  const tenpaiOptions = useMemo((): DiscardTenpaiOption[] => {
    if (!canDiscard || myHand.length === 0) return [];
    return getDiscardTenpaiOptions(myHand, myMelds.length);
  }, [myHand, myMelds.length, canDiscard]);

  const tenpaiTileIds = useMemo(() => {
    return new Set(tenpaiOptions.map((opt) => opt.discardTileId));
  }, [tenpaiOptions]);

  // Hovered or selected tenpai waits
  const activeTenpaiInfo = useMemo(() => {
    if (hoveredTileId) {
      const opt = tenpaiOptions.find((o) => o.discardTileId === hoveredTileId);
      if (opt && opt.waits.length > 0) {
        const tile = myHand.find((t) => t.id === hoveredTileId);
        return {
          waits: opt.waits,
          previewLabel: tile ? tileLabel(tile) : undefined,
        };
      }
    }
    if (selectedId) {
      const opt = tenpaiOptions.find((o) => o.discardTileId === selectedId);
      if (opt && opt.waits.length > 0) {
        const tile = myHand.find((t) => t.id === selectedId);
        return {
          waits: opt.waits,
          previewLabel: tile ? tileLabel(tile) : undefined,
        };
      }
    }
    return null;
  }, [hoveredTileId, selectedId, tenpaiOptions, myHand]);

  const visibleTiles = useMemo(() => countVisibleTiles(view, myHand), [view, myHand]);

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

  // Keyboard navigation & shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      ) {
        return;
      }

      const key = e.key;
      let cardIndex: number | null = null;
      if (key >= '1' && key <= '9') {
        cardIndex = Number(key) - 1;
      } else if (key === '0') {
        cardIndex = 9;
      } else if (key === '-') {
        cardIndex = 10;
      } else if (key === '=') {
        cardIndex = 11;
      }

      if (cardIndex !== null && cardIndex < myHand.length) {
        e.preventDefault();
        const targetTile = myHand[cardIndex];
        if (targetTile) {
          setSelectedId(targetTile.id);
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (myHand.length === 0) return;
        if (!selectedId) {
          const def = lastDrawnId ? myHand.find((t) => t.id === lastDrawnId) : myHand[myHand.length - 1];
          if (def) setSelectedId(def.id);
        } else {
          const currIdx = myHand.findIndex((t) => t.id === selectedId);
          if (currIdx > 0) {
            setSelectedId(myHand[currIdx - 1]!.id);
          } else {
            setSelectedId(myHand[myHand.length - 1]!.id);
          }
        }
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (myHand.length === 0) return;
        if (!selectedId) {
          setSelectedId(myHand[0]!.id);
        } else {
          const currIdx = myHand.findIndex((t) => t.id === selectedId);
          if (currIdx >= 0 && currIdx < myHand.length - 1) {
            setSelectedId(myHand[currIdx + 1]!.id);
          } else {
            setSelectedId(myHand[0]!.id);
          }
        }
        return;
      }

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (canDiscard && selectedId) {
          discard();
          return;
        }
        if (view.availableActions.length > 0) {
          const hu = view.availableActions.find((a) => a.kind === 'hu');
          if (hu) {
            handleAction(hu);
            return;
          }
          const nonPass = view.availableActions.filter((a) => a.kind !== 'pass' && a.kind !== 'discard');
          if (nonPass.length === 1) {
            handleAction(nonPass[0]!);
            return;
          }
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        if (selectedId) {
          setSelectedId(null);
          return;
        }
        const pass = view.availableActions.find((a) => a.kind === 'pass');
        if (pass) {
          handleAction(pass);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [myHand, selectedId, lastDrawnId, canDiscard, view.availableActions, view.sequence]);

  const timeoutSeconds = practice ? 18 : ACTION_TIMEOUT_MS / 1000;
  const ring = Math.max(0, Math.min(100, (left / timeoutSeconds) * 100));
  const clock = useClock();
  const phaseText =
    view.gamePhase === 'qidong'
      ? '起手杠：可胡可过'
      : claiming
        ? '有人打出，要不要'
        : myTurn
          ? '轮到你出牌'
          : `${currentPlayer?.nickname ?? '下家'} 出牌`;

  return (
    <div className="mahjong-board">
      <div className="board-wood" />
      <div className="board-felt" />
      <div className="board-corners" aria-hidden="true">
        <span className="board-corner tl" />
        <span className="board-corner tr" />
        <span className="board-corner bl" />
        <span className="board-corner br" />
      </div>

      <header className="board-topbar">
        <div className="board-room-info">
          {onRules ? (
            <button type="button" className="board-icon-button" onClick={onRules} aria-label="打开规则">
              ⚙
            </button>
          ) : null}
          <span>房间号</span>
          <strong>{practice ? '单机练习' : view.roomCode}</strong>
        </div>
        <div className="board-title">邳州麻将</div>
        <div className="board-top-tools">
          <span className="board-clock">{clock}</span>
          <button
            type="button"
            className="board-icon-button"
            onClick={() => {
              const next = toggleMute();
              setMuted(next);
            }}
            title={muted ? '取消静音' : '静音'}
            aria-label={muted ? '取消静音' : '静音'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          {onLeave ? (
            <button type="button" className="board-exit-button" onClick={onLeave} aria-label="回大厅">
              ↪
            </button>
          ) : null}
        </div>
      </header>

      {networkStatus && networkStatus !== 'open' ? (
        <div className="board-network">
          <span className={`net-dot ${networkStatus}`} />
          {networkStatus === 'connecting' ? '牌桌连接中…' : '网络已断开，正在重连…'}
        </div>
      ) : null}

      <WallRail position="top" wallCount={view.wallCount} />
      <WallRail position="left" wallCount={view.wallCount} />
      <WallRail position="right" wallCount={view.wallCount} />

      {byRel[2] ? <BoardPlayer player={byRel[2]} position="top" current={view.currentSeat === byRel[2].seat} /> : null}
      {byRel[3] ? <BoardPlayer player={byRel[3]} position="left" current={view.currentSeat === byRel[3].seat} /> : null}
      {byRel[1] ? <BoardPlayer player={byRel[1]} position="right" current={view.currentSeat === byRel[1].seat} /> : null}
      {me ? <BoardPlayer player={me} position="bottom" you current={view.currentSeat === me.seat} /> : null}

      {byRel[2] ? <ConcealedHand player={byRel[2]} position="top" /> : null}
      {byRel[3] ? <ConcealedHand player={byRel[3]} position="left" /> : null}
      {byRel[1] ? <ConcealedHand player={byRel[1]} position="right" /> : null}

      {/* Opponents' melds (open melds visible, kan melds concealed with tile backs) */}
      {byRel[2]?.melds && byRel[2].melds.length > 0 ? (
        <div className="board-opponent-melds board-melds-top">
          <Melds melds={byRel[2].melds} isOpponent highlightKey={focusKey} onTileHover={setHoveredTileKey} />
        </div>
      ) : null}
      {byRel[3]?.melds && byRel[3].melds.length > 0 ? (
        <div className="board-opponent-melds board-melds-left">
          <Melds melds={byRel[3].melds} vertical isOpponent highlightKey={focusKey} onTileHover={setHoveredTileKey} />
        </div>
      ) : null}
      {byRel[1]?.melds && byRel[1].melds.length > 0 ? (
        <div className="board-opponent-melds board-melds-right">
          <Melds melds={byRel[1].melds} vertical isOpponent highlightKey={focusKey} onTileHover={setHoveredTileKey} />
        </div>
      ) : null}

      <div className="board-watermark">邳州麻将</div>

      <div className={`board-controller ${myTurn || claiming ? 'is-active' : ''}`}>
        <div className="board-counter board-counter-left">
          <b>{view.wallCount}</b>
          <span>张</span>
        </div>
        <div className="board-dial" style={{ background: `conic-gradient(#f3c34f ${ring}%, rgba(255, 255, 255, 0.08) 0)` }}>
          <div className="board-dial-inner">
            <i className="dial-arrow dial-arrow-top">◆</i>
            <i className="dial-arrow dial-arrow-right">◆</i>
            <i className="dial-arrow dial-arrow-bottom">◆</i>
            <i className="dial-arrow dial-arrow-left">◆</i>
            <strong>{left > 0 ? left : '--'}</strong>
            <small>{view.round || 1} 局</small>
          </div>
        </div>
        <div className="board-counter board-counter-right">
          <b>{view.round || 1}</b>
          <span>局</span>
        </div>
        <div className="board-turn-copy">{phaseText}</div>
      </div>

      <div className="board-discard-layer" aria-label="四方弃牌">
        {([0, 1, 2, 3] as const).map((rel) => {
          const player = byRel[rel];
          if (!player) return null;
          const position = rel === 0 ? 'bottom' : rel === 1 ? 'right' : rel === 2 ? 'top' : 'left';
          return (
            <DiscardRiver
              key={player.seat}
              player={player}
              position={position}
              lastDiscardId={view.lastDiscard?.tile.id}
              highlightKey={focusKey}
              onTileHover={setHoveredTileKey}
            />
          );
        })}
      </div>

      {me ? (
        <div className="board-hand-area">
          <Melds melds={me.melds} highlightKey={focusKey} onTileHover={setHoveredTileKey} />
          <div className="board-own-hand">
            {myHand.map((tile) => (
              <TileView
                key={tile.id}
                tile={tile}
                selected={selectedId === tile.id}
                drawn={lastDrawnId === tile.id}
                tenpaiHint={tenpaiTileIds.has(tile.id)}
                entering={enteringId === tile.id}
                highlightSame={Boolean(focusKey && tile.key === focusKey)}
                onHover={(hovered) => {
                  setHoveredTileKey(hovered ? tile.key : null);
                  setHoveredTileId(hovered ? tile.id : null);
                }}
                onClick={() => setSelectedId(tile.id === selectedId ? null : tile.id)}
                onDoubleClick={() => {
                  if (!canDiscard) return;
                  onAction({ kind: 'discard', tileId: tile.id });
                  setSelectedId(null);
                }}
              />
            ))}
          </div>
          {activeTenpaiInfo ? (
            <TenpaiBar
              waits={activeTenpaiInfo.waits}
              visible={visibleTiles}
              previewLabel={activeTenpaiInfo.previewLabel}
              elevated={view.availableActions.filter((a) => a.kind !== 'discard').length > 0 || (canDiscard && Boolean(selectedId))}
            />
          ) : null}
          <div className="board-action-area">
            <ActionBar
              actions={view.availableActions}
              onAction={handleAction}
              onDiscard={discard}
              canDiscard={canDiscard && Boolean(selectedId)}
            />
          </div>
        </div>
      ) : null}

      <div className="board-bottom-rule" />
    </div>
  );
}
