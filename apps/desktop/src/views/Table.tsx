import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ACTION_TIMEOUT_MS,
  isPrivatePlayerView,
  tileLabel,
  type ClientView,
  type GameChatMessage,
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
import { isMuted } from '../audio/sfx';
import { subscribeAudioSettings } from '../audio/settings';
import { SettingsModal } from '../components/SettingsModal';
import { BoardPlayer, ConcealedHand, DiscardRiver, relativeSeat } from '../table/BoardSeats';
import { DiscardFlightLayer } from '../table/DiscardFlight';
import { countVisibleTiles, TenpaiBar } from '../table/TenpaiBar';
import { TableTopbar } from '../table/TableTopbar';
import { SideActions } from '../table/SideActions';
import { CenterCompass } from '../table/CenterCompass';
import { useTableInteraction } from '../table/useTableInteraction';
import { useTableAnimations } from '../table/useTableAnimations';

interface TableProps {
  view: ClientView;
  onAction: (action: GameAction) => void;
  onRules?: () => void;
  onSettings?: () => void;
  onLeave?: () => void;
  onOpenProfile?: () => void;
  onSendChat?: (message: string, isEmote?: boolean) => void;
  incomingChat?: GameChatMessage | null;
  networkStatus?: 'connecting' | 'open' | 'closed';
  practice?: boolean;
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
  onSettings,
  onLeave,
  onOpenProfile,
  onSendChat,
  incomingChat,
  networkStatus,
  practice = false,
}: TableProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);

  const [is3DMode, setIs3DMode] = useState<boolean>(() => {
    try {
      // 默认使用清晰、地道、稳定且具备 2.5D 实体玉石质感的竞技牌桌
      return localStorage.getItem('pizhou_render_mode') === '3d';
    } catch {
      return false;
    }
  });

  // 3D 渲染器按需加载：three.js 约 600KB，静态导入会让只用 2D 的玩家
  // 白白下载并解析一整份 3D 引擎。切到 3D 时才拉取，切换期间显示占位。
  const [Table3DView, setTable3DView] = useState<typeof import('../table3d/Table3DView')['Table3DView'] | null>(null);

  useEffect(() => {
    if (!is3DMode || Table3DView) return;
    let cancelled = false;
    void import('../table3d/Table3DView').then((module) => {
      if (!cancelled) setTable3DView(() => module.Table3DView);
    }).catch(() => {
      // 加载失败时退回 2D，而不是留一块空白区域。
      if (!cancelled) setIs3DMode(false);
    });
    return () => { cancelled = true; };
  }, [is3DMode, Table3DView]);

  // 渲染模式由用户在牌桌上切换并持久化，启动时不再强制回退到 2D。
  // 旧实现在挂载时无条件写回 '2d'，导致用户选了 3D 后刷新就被悄悄重置。

  const toggleRenderMode = () => {
    setIs3DMode((prev) => {
      const next = !prev;
      try { localStorage.setItem('pizhou_render_mode', next ? '3d' : '2d'); } catch {}
      return next;
    });
  };

  const [hoveredTileKey, setHoveredTileKey] = useState<string | null>(null);
  const [hoveredTileId, setHoveredTileId] = useState<string | null>(null);
  const [muted, setMuted] = useState(isMuted());
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    setMuted(isMuted());
    return subscribeAudioSettings((s) => {
      setMuted(s.muted);
    });
  }, []);
  const [showQuickChat, setShowQuickChat] = useState(false);
  const [chatBubbles, setChatBubbles] = useState<ActiveChatBubble[]>([]);

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

  const { enteringId, noteDiscardSource, discardFlight, flyingDiscardId, flyingDiscardIdRef, finishDiscardFlight }
    = useTableAnimations(boardRef, view, myHand, lastDrawnId);

  // Sound effects hook
  useSoundEffects(view);

  const { selectedId, setSelectedId, discardTile, discard, handleAction } = useTableInteraction({
    hand: myHand, lastDrawnId, canDiscard, sequence: view.sequence,
    actions: view.availableActions, onAction, noteDiscardSource,
  });

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
    return getDiscardTenpaiOptions(myHand, myMelds.length, myMelds);
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
      className={`mahjong-board turn-${currentPosition} ${myTurn ? 'is-my-turn' : ''} ${is3DMode ? 'is-3d-mode' : ''}`}
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

      {is3DMode && Table3DView ? (
        <Table3DView
          view={view}
          selectedTileId={selectedId}
          onSelectTile={(tileId) => setSelectedId(tileId)}
          onDiscardTile={discardTile}
          onTileHover={(tileKey, tileId) => {
            setHoveredTileKey(tileKey);
            setHoveredTileId(tileId);
          }}
        />
      ) : null}

      <TableTopbar
        view={view} me={me} practice={practice} is3DMode={is3DMode} muted={muted}
        onRules={onRules} onSettings={onSettings} onLeave={onLeave} onOpenProfile={onOpenProfile}
        toggleRenderMode={toggleRenderMode} setShowQuickChat={setShowQuickChat}
        setShowSettings={setShowSettings} setMuted={setMuted}
      />

      <SideActions
        muted={muted}
        onSettings={onSettings}
        setShowQuickChat={setShowQuickChat}
        setShowSettings={setShowSettings}
        setMuted={setMuted}
      />

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
              flyingDiscardIdRef={flyingDiscardIdRef}
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
                    discardTile(tile.id);
                  } else {
                    setSelectedId(tile.id);
                  }
                }}
                // 不再有 onDoubleClick：onClick 已经实现了"再点一次即出牌"，
                // 双击会走 click→click→dblclick 三条路径，对同一张牌发出两次
                // discard，第二次被服务端判为"操作已过期"，玩家会看到莫名报错。
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
      {showSettings ? (
        <SettingsModal
          onClose={() => setShowSettings(false)}
        />
      ) : null}
      {discardFlight ? (
        <DiscardFlightLayer key={discardFlight.flightId} flight={discardFlight} onDone={finishDiscardFlight} />
      ) : null}
    </div>
  );
}
