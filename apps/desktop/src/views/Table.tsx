import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ACTION_TIMEOUT_MS,
  isPrivatePlayerView,
  tileLabel,
  type AvailableAction,
  type ClientView,
  type GameChatMessage,
  type GameAction,
  type Meld,
} from '@pizhou/shared';
import { getDiscardTenpaiOptions, type DiscardTenpaiOption } from '@pizhou/rules';
import { ActionBar } from '../components/ActionBar';
import { ActionSplash } from '../components/ActionSplash';
import { AvatarView } from '../components/AvatarView';
import { Melds } from '../components/Melds';
import { faceSrc, TileView } from '../components/TileView';
import { QuickChat } from '../components/QuickChat';
import { ChatBubbleOverlay, type ActiveChatBubble } from '../components/ChatBubble';
import { useSoundEffects } from '../audio/useSoundEffects';
import { isMuted, toggleMute } from '../audio/sfx';
import { BoardPlayer, ConcealedHand, DiscardRiver, relativeSeat } from '../table/BoardSeats';
import { DiscardFlightLayer, type DiscardFlight } from '../table/DiscardFlight';
import { countVisibleTiles, TenpaiBar } from '../table/TenpaiBar';
import { GameClock } from '../table/clock';
import { CenterCompass } from '../table/CenterCompass';

interface TableProps {
  view: ClientView;
  onAction: (action: GameAction) => void;
  onRules?: () => void;
  onLeave?: () => void;
  onOpenProfile?: () => void;
  onSendChat?: (message: string, isEmote?: boolean) => void;
  incomingChat?: GameChatMessage | null;
  networkStatus?: 'connecting' | 'open' | 'closed';
  practice?: boolean;
}

type BoardIconName = 'rules' | 'chat' | 'sound' | 'muted' | 'leave';

function BoardIcon({ name }: { name: BoardIconName }) {
  const common = {
    className: 'board-tool-icon',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (name === 'rules') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M19.2 13.4v-2.8l-2-.7a7 7 0 0 0-.7-1.6l.9-1.9-2-2-1.9.9a7 7 0 0 0-1.6-.7l-.7-2H8.4l-.7 2a7 7 0 0 0-1.6.7l-1.9-.9-2 2 .9 1.9a7 7 0 0 0-.7 1.6l-2 .7v2.8l2 .7a7 7 0 0 0 .7 1.6l-.9 1.9 2 2 1.9-.9a7 7 0 0 0 1.6.7l.7 2h2.8l.7-2a7 7 0 0 0 1.6-.7l1.9.9 2-2-.9-1.9a7 7 0 0 0 .7-1.6z" />
      </svg>
    );
  }
  if (name === 'chat') {
    return (
      <svg {...common}>
        <path d="M5.2 17.7 3 21l.6-4.8A8.2 8.2 0 1 1 7 19" />
        <path d="M8 10h8M8 14h5" />
      </svg>
    );
  }
  if (name === 'sound') {
    return (
      <svg {...common}>
        <path d="M5 10v4h3l4 3V7l-4 3H5z" />
        <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
      </svg>
    );
  }
  if (name === 'muted') {
    return (
      <svg {...common}>
        <path d="M5 10v4h3l4 3V7l-4 3H5zM16 10l5 5M21 10l-5 5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" />
    </svg>
  );
}

function chatPosition(seat: number, mySeat: number): ActiveChatBubble['position'] {
  const relative = relativeSeat(seat, mySeat);
  return relative === 0 ? 'bottom' : relative === 1 ? 'right' : relative === 2 ? 'top' : 'left';
}

/* ─── Main Table Component ─────────────────────────────────── */

export function Table({
  view,
  onAction,
  onRules,
  onLeave,
  onOpenProfile,
  onSendChat,
  incomingChat,
  networkStatus,
  practice = false,
}: TableProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const pendingDiscardRef = useRef<{
    tileId: string;
    from: DOMRect;
    face: string;
    submittedSequence: number;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredTileKey, setHoveredTileKey] = useState<string | null>(null);
  const [hoveredTileId, setHoveredTileId] = useState<string | null>(null);
  const [enteringId, setEnteringId] = useState<string | undefined>(undefined);
  const [muted, setMuted] = useState(isMuted());
  const [showQuickChat, setShowQuickChat] = useState(false);
  const [chatBubbles, setChatBubbles] = useState<ActiveChatBubble[]>([]);
  const [discardFlight, setDiscardFlight] = useState<DiscardFlight | null>(null);
  const [flyingDiscardId, setFlyingDiscardId] = useState<string | null>(null);
  const seenDiscardIdRef = useRef<string | null>(null);
  const hasSeenDiscardRef = useRef(false);
  const seenIncomingChatRef = useRef<string | null>(null);

  const addChatBubble = useCallback((
    seat: number,
    message: string,
    isEmote = false,
    identity?: { nickname: string; avatar: string },
  ) => {
    const bubbleId = Date.now() + Math.random();
    const sender = identity ?? view.players.find((player) => player.seat === seat);
    const newBubble: ActiveChatBubble = {
      id: bubbleId,
      seat,
      position: chatPosition(seat, view.mySeat),
      message,
      isEmote,
      senderNickname: sender?.nickname,
      senderAvatar: sender?.avatar,
    };
    setChatBubbles((prev) => [...prev, newBubble]);
      setTimeout(() => {
        setChatBubbles((prev) => prev.filter((b) => b.id !== bubbleId));
      }, 3200);
  }, [view.mySeat, view.players]);

  useEffect(() => {
    if (!incomingChat || incomingChat.id === seenIncomingChatRef.current) return;
    seenIncomingChatRef.current = incomingChat.id;
    addChatBubble(
      incomingChat.seat,
      incomingChat.message,
      Boolean(incomingChat.isEmote),
      { nickname: incomingChat.nickname, avatar: incomingChat.avatar },
    );
  }, [addChatBubble, incomingChat]);

  const handleSendChat = (message: string, isEmote = false) => {
    if (onSendChat) {
      onSendChat(message, isEmote);
    } else {
      addChatBubble(view.mySeat, message, isEmote);
    }

    // In companion / practice mode: simulate occasional AI companion response
    if (practice) {
      setTimeout(() => {
        const randSeat = (view.mySeat + 1 + Math.floor(Math.random() * 3)) % 4;
        const aiQuotes = ['碰得好！', '别急别急，慢慢来', '这把看谁先胡', '🍵 喝口水压压惊', '手气挺旺啊'];
        const aiMsg = aiQuotes[Math.floor(Math.random() * aiQuotes.length)]!;
        addChatBubble(randSeat, aiMsg, aiMsg.startsWith('🍵'));
      }, 1200);
    }
  };

  const me = view.players.find((player) => player.seat === view.mySeat);
  const myHand = me && isPrivatePlayerView(me) ? me.hand : [];
  const myMelds: Meld[] = me ? me.melds : [];
  const lastDrawnId = me && isPrivatePlayerView(me) ? me.lastDrawnId : undefined;
  const canDiscard = view.availableActions.some((action) => action.kind === 'discard');
  const currentPlayer = view.players.find((player) => player.seat === view.currentSeat);
  const myTurn = view.gamePhase === 'self-turn' && view.currentSeat === view.mySeat;
  const claiming = view.gamePhase === 'claim-window' && view.availableActions.some((item) => item.kind !== 'discard');

  const noteDiscardSource = useCallback((tileId: string) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const tile = myHand.find((item) => item.id === tileId);
    const sourceElement = Array.from(
      boardRef.current?.querySelectorAll<HTMLElement>('.board-own-hand .tile[data-tile-id]') ?? [],
    ).find((element) => element.dataset.tileId === tileId);
    const source = sourceElement?.getBoundingClientRect();
    if (!tile || !source) return;
    pendingDiscardRef.current = {
      tileId,
      from: source,
      face: faceSrc(tile),
      submittedSequence: view.sequence,
    };
  }, [myHand, view.sequence]);

  useLayoutEffect(() => {
    const pending = pendingDiscardRef.current;
    if (!pending || view.sequence <= pending.submittedSequence) return;
    const currentMe = view.players.find((player) => player.seat === view.mySeat);
    const myDiscardWasAccepted = Boolean(
      currentMe && isPrivatePlayerView(currentMe) && !currentMe.hand.some((tile) => tile.id === pending.tileId),
    );
    if (!myDiscardWasAccepted) {
      pendingDiscardRef.current = null;
      return;
    }
    const target = Array.from(
      boardRef.current?.querySelectorAll<HTMLElement>('[data-discard-tile-id]') ?? [],
    ).find((element) => element.dataset.discardTileId === pending.tileId);
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect) return;
    const fallbackTarget = new DOMRect(
      boardRect.left + boardRect.width / 2 - 18,
      boardRect.top + boardRect.height * 0.65 - 26,
      36,
      52,
    );

    setFlyingDiscardId(target ? pending.tileId : null);
    setDiscardFlight({
      flightId: view.sequence,
      from: pending.from,
      to: target?.getBoundingClientRect() ?? fallbackTarget,
      face: pending.face,
    });
    pendingDiscardRef.current = null;
  }, [view.players, view.mySeat, view.sequence]);

  // Opponent discards do not have a local hand element we can measure before
  // the server update.  Once the authoritative discard lands in the view,
  // animate it from that seat's concealed rack into the matching river cell.
  // The first snapshot is intentionally ignored so reconnecting mid-hand does
  // not replay an old discard as if it were a new move.
  useLayoutEffect(() => {
    const discard = view.lastDiscard;
    const discardId = discard?.tile.id ?? null;

    if (!hasSeenDiscardRef.current) {
      hasSeenDiscardRef.current = true;
      seenDiscardIdRef.current = discardId;
      return;
    }

    if (!discardId) {
      seenDiscardIdRef.current = null;
      return;
    }
    if (!discard) return;
    if (discardId === seenDiscardIdRef.current) return;
    seenDiscardIdRef.current = discardId;

    // Manual discards already use the exact hand-tile origin captured by
    // noteDiscardSource().  Skip them here to avoid rendering two flights.
    if (discard.fromSeat === view.mySeat || view.settlement) return;

    const board = boardRef.current;
    if (!board) return;

    const relative = relativeSeat(discard.fromSeat, view.mySeat);
    const position = relative === 0
      ? 'bottom'
      : relative === 1
        ? 'right'
        : relative === 2
          ? 'top'
          : 'left';
    const sourceGroup = board.querySelector<HTMLElement>(`.board-concealed-${position}`);
    const sourceElement = sourceGroup?.querySelector<HTMLElement>('.board-concealed-tile') ?? sourceGroup;
    const source = sourceElement?.getBoundingClientRect();
    const target = Array.from(
      board.querySelectorAll<HTMLElement>('[data-discard-tile-id]'),
    ).find((element) => element.dataset.discardTileId === discardId);
    if (!source || !target) return;

    setFlyingDiscardId(discardId);
    setDiscardFlight({
      flightId: view.sequence,
      from: source,
      to: target.getBoundingClientRect(),
      face: faceSrc(discard.tile),
    });
  }, [view.lastDiscard?.tile.id, view.lastDiscard?.fromSeat, view.mySeat, view.sequence, view.settlement]);

  const finishDiscardFlight = useCallback(() => {
    setDiscardFlight(null);
    setFlyingDiscardId(null);
  }, []);

  // Track previous lastDrawnId to detect new draws for entering animation
  const prevDrawnRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    // Only react to an actual NEW drawn tile; never clear early on unrelated
    // view.sequence bumps, or the 0.48s arc gets cut off mid-flight.
    if (!lastDrawnId || lastDrawnId === prevDrawnRef.current) return;
    setEnteringId(lastDrawnId);
    prevDrawnRef.current = lastDrawnId;
    // Keep the class until draw-arc-in (0.48s) fully finishes
    const timer = setTimeout(() => setEnteringId(undefined), 540);
    return () => clearTimeout(timer);
  }, [lastDrawnId]);

  const myHandIds = myHand.map((t) => t.id).join(',');
  // ── Smooth hand re-sorting: FLIP-slide tiles whose position changed ──
  const handRectsRef = useRef<Map<string, DOMRect>>(new Map());
  useLayoutEffect(() => {
    const row = boardRef.current?.querySelector<HTMLElement>('.board-own-hand');
    if (!row) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const els = Array.from(row.querySelectorAll<HTMLElement>('.tile[data-tile-id]'));
    const prev = handRectsRef.current;
    const next = new Map<string, DOMRect>();
    const animations: Array<{ el: HTMLElement; dx: number }> = [];

    // Read phase: measure all rects without layout thrashing
    for (const el of els) {
      const key = el.dataset.tileId!;
      const rect = el.getBoundingClientRect();
      next.set(key, rect);
      const old = prev.get(key);
      if (old && !el.classList.contains('entering')) {
        const dx = old.left - rect.left;
        if (dx !== 0 && Math.abs(dx) < 400) {
          animations.push({ el, dx });
        }
      }
    }
    handRectsRef.current = next;

    // Animate phase: batch start GPU-accelerated transforms
    for (const { el, dx } of animations) {
      el.animate(
        [
          { transform: `translate3d(${dx}px, 0, 0)` },
          { transform: 'translate3d(0, 0, 0)' },
        ],
        { duration: 200, easing: 'cubic-bezier(0.2, 0.85, 0.25, 1)' },
      );
    }
  }, [myHandIds]);

  // Sound effects hook
  useSoundEffects(view);

  useEffect(() => {
    if (lastDrawnId && canDiscard) setSelectedId(lastDrawnId);
  }, [lastDrawnId, canDiscard, view.sequence]);

  const byRel = useMemo(() => {
    const map: Record<number, (typeof view.players)[number] | undefined> = {};
    for (const player of view.players) {
      map[relativeSeat(player.seat, view.mySeat)] = player;
    }
    return map;
  }, [view]);

  // Focus key for highlighting: hovered tile's key, or selected tile's key
  const selectedTile = useMemo(() => myHand.find((t) => t.id === selectedId), [myHand, selectedId]);
  const focusKey = hoveredTileKey ?? selectedTile?.key ?? null;

  // ── Close gate candidate calculation ──
  const closeGateAction = view.availableActions.find((a) => a.kind === 'close-gate');
  const closeGateTileIds = useMemo(() => {
    return new Set(closeGateAction?.tileIds ?? []);
  }, [closeGateAction]);

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
    const targetId = hoveredTileId ?? selectedId;
    if (targetId) {
      const opt = tenpaiOptions.find((o) => o.discardTileId === targetId);
      if (opt && opt.waits.length > 0) {
        const tile = myHand.find((t) => t.id === targetId);
        const isClose = closeGateTileIds.has(targetId);
        return {
          waits: opt.waits,
          previewLabel: tile ? `${tileLabel(tile)}${isClose ? ' · 关门' : ''}` : undefined,
        };
      }
    }
    return null;
  }, [hoveredTileId, selectedId, tenpaiOptions, myHand, closeGateTileIds]);

  const visibleTiles = useMemo(() => countVisibleTiles(view, myHand), [view, myHand]);

  // Full table discard keys (for Xiang/Chou detection)
  const allTableDiscards = useMemo(() => {
    const set = new Set<string>();
    for (const player of view.players) {
      for (const t of player.discards) {
        set.add(t.key);
      }
    }
    return set;
  }, [view.players]);

  // Player is in Bao-Zhuang risk phase ONLY when at least one OPPONENT has declared Guan-Men (closed)
  const hasClosedOpponent = Boolean(view.players.some((p) => p.seat !== view.mySeat && p.closed));
  const inXiangRiskPhase = Boolean(hasClosedOpponent && !me?.closed);

  const discard = () => {
    if (!selectedId || !canDiscard) return;
    const tile = myHand.find((t) => t.id === selectedId);
    if (tile) noteDiscardSource(tile.id);
    onAction({ kind: 'discard', tileId: selectedId });
    setSelectedId(null);
  };

  const handleAction = (action: AvailableAction | GameAction) => {
    if (action.kind === 'discard') {
      discard();
      return;
    }
    if (action.kind === 'close-gate' && action.tileId) {
      noteDiscardSource(action.tileId);
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
  const phaseText =
    view.gamePhase === 'qidong'
      ? '起手杠：可胡可过'
      : claiming
        ? '有人打出，要不要'
        : myTurn
          ? '轮到你出牌'
          : `${currentPlayer?.nickname ?? '下家'} 出牌`;
  const currentRel = view.currentSeat !== null && view.currentSeat !== undefined
    ? relativeSeat(view.currentSeat, view.mySeat)
    : null;
  const currentPosition = currentRel === 0
    ? 'bottom'
    : currentRel === 1
      ? 'right'
      : currentRel === 2
        ? 'top'
        : currentRel === 3
          ? 'left'
          : 'none';

  return (
    <div
      className={`mahjong-board turn-${currentPosition} ${myTurn ? 'is-my-turn' : ''}`}
      ref={boardRef}
    >
      <img className="board-wood-texture" src="./assets/wood.jpg" alt="" draggable={false} />
      <div className="board-felt">
        <img className="board-felt-texture" src="./assets/felt.jpg" alt="" draggable={false} />
      </div>
      <div className="board-atmosphere" aria-hidden="true" />
      <div className="board-table-geometry" aria-hidden="true"><span /></div>
      {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((corner) => (
        <img
          key={corner}
          className={`board-corner board-corner-${corner}`}
          src="./assets/corner.png"
          alt=""
          draggable={false}
        />
      ))}
      {currentPosition !== 'none' ? (
        <div key={view.currentSeat} className={`board-turn-glow is-${currentPosition}`} aria-hidden="true" />
      ) : null}

      <header className="board-topbar">
        <div className="board-room-info">
          {onRules ? (
            <button type="button" className="board-icon-button" onClick={onRules} aria-label="打开规则">
              <BoardIcon name="rules" />
            </button>
          ) : null}
          <span className="board-room-label">牌局</span>
          <strong>{practice ? '单机练习' : view.roomCode}</strong>
          {(view.pointRate ?? 0) > 0 ? (
            <span className="board-rate-pill" title={`本局底分单价：¥${view.pointRate}/分`}>
              💰 ¥{view.pointRate}/分
            </span>
          ) : null}
        </div>
        <div className="board-top-tools">
          <GameClock />
          {onOpenProfile ? (
            <button
              type="button"
              className="board-profile-button"
              onClick={onOpenProfile}
              title="打开我的账号资料"
              aria-label="打开我的账号资料"
            >
              <AvatarView
                avatar={me?.isBot ? '陪' : me?.avatar}
                className="board-profile-avatar"
                alt="我的头像"
              />
              <span className="board-profile-label">{me?.nickname ?? '我的资料'}</span>
            </button>
          ) : null}
          <button
            type="button"
            className="board-icon-button"
            onClick={() => setShowQuickChat((prev) => !prev)}
            title="快捷互动与表情"
            aria-label="快捷互动与表情"
          >
            <BoardIcon name="chat" />
          </button>
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
            <BoardIcon name={muted ? 'muted' : 'sound'} />
          </button>
          {onLeave ? (
            <button type="button" className="board-exit-button" onClick={onLeave} aria-label="回大厅">
              <BoardIcon name="leave" />
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

      {byRel[2] ? <BoardPlayer player={byRel[2]} position="top" current={view.currentSeat === byRel[2].seat} /> : null}
      {byRel[3] ? <BoardPlayer player={byRel[3]} position="left" current={view.currentSeat === byRel[3].seat} /> : null}
      {byRel[1] ? <BoardPlayer player={byRel[1]} position="right" current={view.currentSeat === byRel[1].seat} /> : null}
      {me ? <BoardPlayer player={me} position="bottom" you current={view.currentSeat === me.seat} /> : null}

      {byRel[2] ? <ConcealedHand player={byRel[2]} position="top" reveal={view.phase === 'settlement'} /> : null}
      {byRel[3] ? <ConcealedHand player={byRel[3]} position="left" reveal={view.phase === 'settlement'} /> : null}
      {byRel[1] ? <ConcealedHand player={byRel[1]} position="right" reveal={view.phase === 'settlement'} /> : null}

      {/* Opponents' melds */}
      {byRel[2]?.melds && byRel[2].melds.length > 0 ? (
        <div className="board-opponent-melds board-melds-top" aria-label="对家副露区">
          <Melds melds={byRel[2].melds} isOpponent highlightKey={focusKey} onTileHover={setHoveredTileKey} />
        </div>
      ) : null}
      {byRel[3]?.melds && byRel[3].melds.length > 0 ? (
        <div className="board-opponent-melds board-melds-left" aria-label="左家副露区">
          <Melds melds={byRel[3].melds} vertical isOpponent highlightKey={focusKey} onTileHover={setHoveredTileKey} />
        </div>
      ) : null}
      {byRel[1]?.melds && byRel[1].melds.length > 0 ? (
        <div className="board-opponent-melds board-melds-right" aria-label="右家副露区">
          <Melds melds={byRel[1].melds} vertical isOpponent highlightKey={focusKey} onTileHover={setHoveredTileKey} />
        </div>
      ) : null}

      {/* ── Central Grand Mahjong Compass Disc (Isolated from Table re-renders) ── */}
      <CenterCompass
        deadline={view.turnDeadline}
        timeoutSeconds={timeoutSeconds}
        mySeat={view.mySeat}
        currentRel={currentRel ?? 0}
        myTurn={myTurn}
        claiming={claiming}
        wallCount={view.wallCount}
        round={view.round || 1}
        phaseText={phaseText}
      />

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
              flyingDiscardId={flyingDiscardId}
              highlightKey={focusKey}
              onTileHover={setHoveredTileKey}
            />
          );
        })}
      </div>

      {me ? (
        <div className="board-hand-area">
          {me.melds.length > 0 ? (
            <div className="board-own-melds" aria-label="我的副露区">
              <Melds melds={me.melds} highlightKey={focusKey} onTileHover={setHoveredTileKey} />
            </div>
          ) : null}
          <div className="board-own-hand">
            {myHand.map((tile) => (
              <TileView
                key={tile.id}
                tile={tile}
                selected={selectedId === tile.id}
                drawn={lastDrawnId === tile.id}
                tenpaiHint={tenpaiTileIds.has(tile.id)}
                closeGateHint={closeGateTileIds.has(tile.id)}
                xiangHint={inXiangRiskPhase && !closeGateTileIds.has(tile.id) && !tenpaiTileIds.has(tile.id) && !allTableDiscards.has(tile.key)}
                chouHint={inXiangRiskPhase && !closeGateTileIds.has(tile.id) && !tenpaiTileIds.has(tile.id) && allTableDiscards.has(tile.key)}
                entering={enteringId === tile.id}
                pose="hand"
                dataTileId={tile.id}
                highlightSame={Boolean(focusKey && tile.key === focusKey)}
                onHover={(hovered) => {
                  setHoveredTileKey(hovered ? tile.key : null);
                  setHoveredTileId(hovered ? tile.id : null);
                }}
                onClick={() => {
                  if (selectedId === tile.id && canDiscard) {
                    noteDiscardSource(tile.id);
                    onAction({ kind: 'discard', tileId: tile.id });
                    setSelectedId(null);
                  } else {
                    setSelectedId(tile.id);
                  }
                }}
                onDoubleClick={() => {
                  if (!canDiscard) return;
                  noteDiscardSource(tile.id);
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
              isClosed={Boolean(me?.closed)}
              meldsCount={me?.melds.length ?? 0}
              elevated={view.availableActions.filter((a) => a.kind !== 'discard').length > 0 || (canDiscard && Boolean(selectedId))}
            />
          ) : null}
          <div className="board-action-area">
            <ActionBar
              actions={view.availableActions}
              onAction={handleAction}
              onDiscard={discard}
              canDiscard={canDiscard}
              selectedTileId={selectedId}
            />
          </div>
        </div>
      ) : null}

      <div className="board-bottom-rule" />
      <ActionSplash view={view} />
      <ChatBubbleOverlay bubbles={chatBubbles} />
      {showQuickChat ? (
        <QuickChat onSend={handleSendChat} onClose={() => setShowQuickChat(false)} />
      ) : null}
      {discardFlight ? (
        <DiscardFlightLayer key={discardFlight.flightId} flight={discardFlight} onDone={finishDiscardFlight} />
      ) : null}
    </div>
  );
}
