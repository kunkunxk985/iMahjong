import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ACTION_TIMEOUT_MS,
  isPrivatePlayerView,
  SEAT_NAMES,
  tileLabel,
  type AvailableAction,
  type ClientView,
  type GameAction,
  type Meld,
} from '@pizhou/shared';
import { getDiscardTenpaiOptions, type DiscardTenpaiOption } from '@pizhou/rules';
import { ActionBar } from '../components/ActionBar';
import { ActionSplash } from '../components/ActionSplash';
import { Melds } from '../components/Melds';
import { TileView } from '../components/TileView';
import { QuickChat } from '../components/QuickChat';
import { ChatBubbleOverlay, type ActiveChatBubble } from '../components/ChatBubble';
import { useSoundEffects } from '../audio/useSoundEffects';
import { isMuted, toggleMute } from '../audio/sfx';
import { BoardPlayer, ConcealedHand, DiscardRiver, relativeSeat } from '../table/BoardSeats';
import { countVisibleTiles, TenpaiBar } from '../table/TenpaiBar';
import { GameClock, useCountdown } from '../table/clock';

interface TableProps {
  view: ClientView;
  onAction: (action: GameAction) => void;
  onRules?: () => void;
  onLeave?: () => void;
  networkStatus?: 'connecting' | 'open' | 'closed';
  practice?: boolean;
}

/* ─── Main Table Component ─────────────────────────────────── */

export function Table({ view, onAction, onRules, onLeave, networkStatus, practice = false }: TableProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredTileKey, setHoveredTileKey] = useState<string | null>(null);
  const [hoveredTileId, setHoveredTileId] = useState<string | null>(null);
  const [enteringId, setEnteringId] = useState<string | undefined>(undefined);
  const [muted, setMuted] = useState(isMuted());
  const [showQuickChat, setShowQuickChat] = useState(false);
  const [chatBubbles, setChatBubbles] = useState<ActiveChatBubble[]>([]);

  const handleSendChat = (message: string, isEmote = false) => {
    const bubbleId = Date.now() + Math.random();
    const newBubble: ActiveChatBubble = {
      id: bubbleId,
      seat: view.mySeat,
      position: 'bottom',
      message,
      isEmote,
    };
    setChatBubbles((prev) => [...prev, newBubble]);
    setTimeout(() => {
      setChatBubbles((prev) => prev.filter((b) => b.id !== bubbleId));
    }, 3200);

    // In companion / practice mode: simulate occasional AI companion response
    if (practice) {
      setTimeout(() => {
        const randSeat = (view.mySeat + 1 + Math.floor(Math.random() * 3)) % 4;
        const rel = relativeSeat(randSeat, view.mySeat);
        const posMap: Record<number, 'bottom' | 'top' | 'left' | 'right'> = {
          0: 'bottom',
          1: 'right',
          2: 'top',
          3: 'left',
        };
        const aiQuotes = ['碰得好！', '别急别急，慢慢来', '这把看谁先胡', '🍵 喝口水压压惊', '手气挺旺啊'];
        const aiMsg = aiQuotes[Math.floor(Math.random() * aiQuotes.length)]!;
        const aiBubbleId = Date.now() + Math.random();
        setChatBubbles((prev) => [
          ...prev,
          {
            id: aiBubbleId,
            seat: randSeat,
            position: posMap[rel] || 'top',
            message: aiMsg,
            isEmote: aiMsg.startsWith('🍵'),
          },
        ]);
        setTimeout(() => {
          setChatBubbles((prev) => prev.filter((b) => b.id !== aiBubbleId));
        }, 3200);
      }, 1200);
    }
  };

  const noteDiscardSource = useCallback((_tileId: string) => {
    // No-op
  }, []);

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
    // Only react to an actual NEW drawn tile; never clear early on unrelated
    // view.sequence bumps, or the 0.48s arc gets cut off mid-flight.
    if (!lastDrawnId || lastDrawnId === prevDrawnRef.current) return;
    setEnteringId(lastDrawnId);
    prevDrawnRef.current = lastDrawnId;
    // Keep the class until draw-arc-in (0.48s) fully finishes
    const timer = setTimeout(() => setEnteringId(undefined), 540);
    return () => clearTimeout(timer);
  }, [lastDrawnId]);

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
  }, [myHand]);

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

  // Player is in Bao-Zhuang risk phase if having >= 3 melds and NOT closed
  const inXiangRiskPhase = Boolean(me && me.melds.length >= 3 && !me.closed);

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
  const phaseText =
    view.gamePhase === 'qidong'
      ? '起手杠：可胡可过'
      : claiming
        ? '有人打出，要不要'
        : myTurn
          ? '轮到你出牌'
          : `${currentPlayer?.nickname ?? '下家'} 出牌`;

  return (
    <div className="mahjong-board" ref={boardRef}>
      <div className="board-felt" />

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
        <div className="board-top-tools">
          <GameClock />
          <button
            type="button"
            className="board-icon-button"
            onClick={() => setShowQuickChat((prev) => !prev)}
            title="快捷互动与表情"
            aria-label="快捷互动与表情"
          >
            💬
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

      {/* ── Central Grand Mahjong Compass Disc ── */}
      {(() => {
        const currentRel = view.currentSeat !== null && view.currentSeat !== undefined
          ? relativeSeat(view.currentSeat, view.mySeat)
          : null;
        return (
          <div className={`board-controller ${myTurn || claiming ? 'is-active' : ''}`}>
            <div className="compass-meta-bar">
              <span className="meta-wall">剩余 <b>{view.wallCount}</b> 张</span>
              <span className="meta-dot">·</span>
              <span className="meta-round">第 <b>{view.round || 1}</b> 局</span>
            </div>

            <div className="board-compass-disc" style={{ background: `conic-gradient(#f3c34f ${ring}%, rgba(255, 255, 255, 0.08) 0)` }}>
              <div className="compass-disc-inner">
                <div className={`compass-wind-node wind-top ${currentRel === 2 ? 'is-turn' : ''}`}>
                  <span className="wind-label">{SEAT_NAMES[(view.mySeat + 2) % 4]}</span>
                  <i className="wind-pointer">▲</i>
                </div>
                <div className={`compass-wind-node wind-right ${currentRel === 1 ? 'is-turn' : ''}`}>
                  <span className="wind-label">{SEAT_NAMES[(view.mySeat + 1) % 4]}</span>
                  <i className="wind-pointer">▶</i>
                </div>
                <div className={`compass-wind-node wind-bottom ${currentRel === 0 ? 'is-turn' : ''}`}>
                  <span className="wind-label">{SEAT_NAMES[view.mySeat]}</span>
                  <i className="wind-pointer">▼</i>
                </div>
                <div className={`compass-wind-node wind-left ${currentRel === 3 ? 'is-turn' : ''}`}>
                  <span className="wind-label">{SEAT_NAMES[(view.mySeat + 3) % 4]}</span>
                  <i className="wind-pointer">◀</i>
                </div>

                <div className="compass-countdown">
                  <strong className="countdown-number">{left > 0 ? left : '--'}</strong>
                </div>
              </div>
            </div>

            <div className="compass-phase-badge">{phaseText}</div>
          </div>
        );
      })()}

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
                onClick={() => setSelectedId(tile.id === selectedId ? null : tile.id)}
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
              canDiscard={canDiscard && Boolean(selectedId)}
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
    </div>
  );
}
