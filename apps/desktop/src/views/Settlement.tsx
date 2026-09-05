import { useEffect, useState, useMemo } from 'react';
import { isPrivatePlayerView, type BaoZhuangReason, type ClientView, type Settlement } from '@pizhou/shared';
import { Melds } from '../components/Melds';
import { TileView } from '../components/TileView';
import { saveMatchToHistory } from '../storage/history';
import { apiSaveMatch } from '../api/auth';
import { AvatarView } from '../components/AvatarView';
import { exportBattleReportPoster, downloadBattleReportPoster, type PosterData } from '../utils/canvasPoster';
import '../styles/lobby.css';

const SEAT_NAMES = ['东', '南', '西', '北'] as const;

const WIN_LABEL: Record<string, string> = {
  'ping-hu': '平胡',
  'qidong-gang-hu': '起手杠胡',
  liuju: '流局',
};

const BAO_LABEL: Record<BaoZhuangReason, string> = {
  four_wait_seq: '四组听顺包庄',
  chow_wait_seq: '吃牌听顺包庄',
  xiang: '香牌包庄',
};

const BAO_EXPLANATION: Record<BaoZhuangReason, string> = {
  four_wait_seq: '胡家已有四组碰、坎或杠，单张听牌且始终未换张；该点炮牌与手中单张能相连成顺，本局按飘荤结算。',
  chow_wait_seq: '胡家已有四组牌且其中含吃，单张听牌且始终未换张；该点炮牌与手中单张能相连成顺，本局按普通胡结算。',
  xiang: '胡家已有三组碰、坎或杠，手里保留两对但尚未选择两对关门；该点炮牌此前全桌从未打出，属于香牌，由点炮者按飘荤包庄。',
};

const DRAW_LABEL: Record<string, string> = {
  four_same: '开局四同张流局',
  wall: '牌墙摸完流局',
};

const PODIUM_RANK_NAMES = ['🥇 壹', '🥈 贰', '🥉 叁', '肆'];

function ReplayHands({ view, settlement }: { view: ClientView; settlement: Settlement }) {
  return (
    <div className="settlement-replay">
      <div className="settlement-replay-intro">
        <strong>本局牌面复盘</strong>
        <span>结算后公开四家手牌，副露与牌河清晰展示，便于核对查胡分。</span>
      </div>
      <div className="settlement-replay-grid">
        {view.players.map((player) => {
          const hand = isPrivatePlayerView(player) ? player.hand : [];
          const winner = player.seat === settlement.winnerSeat;
          const winningDiscardId = !settlement.selfDraw && winner ? view.lastDiscard?.tile.id : undefined;
          const score = settlement.scores.find((item) => item.seat === player.seat);
          const delta = score?.delta ?? 0;
          const deltaLabel = delta > 0 ? `+${delta}` : String(delta);

          return (
            <article key={player.seat} className={`replay-player-card ${winner ? 'is-winner' : ''}`}>
              <div className="replay-card-header">
                <div className="replay-card-identity">
                  <AvatarView avatar={player.avatar} className="replay-player-avatar" alt={`${player.nickname}头像`} />
                  <span className="seat-badge">{SEAT_NAMES[player.seat]}</span>
                  <b className="replay-player-name">{player.nickname}</b>
                  {player.title ? <span className="replay-player-title">{player.title}</span> : null}
                  {player.isDealer ? <span className="tag-dealer">庄</span> : null}
                  {winner ? <span className="tag-winner">胡牌</span> : null}
                  {player.closed ? <span className="tag-closed">关门</span> : null}
                  <span className="replay-hand-count">{hand.length}张手牌</span>
                </div>

                <div className="replay-card-score">
                  <strong className={`score-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>{deltaLabel}</strong>
                  <span className="score-detail">{score?.hu ?? 0}胡 · {score?.yao ?? 0}幺</span>
                  <small className="score-type">{score?.piaoHun ? '飘荤' : winner ? '本局赢家' : '两两对账'}</small>
                </div>
              </div>

              <div className="replay-card-body">
                <div className="replay-main-row">
                  {player.melds.length > 0 ? (
                    <div className="replay-melds-cluster">
                      <Melds melds={player.melds} highlightKey={null} />
                    </div>
                  ) : null}

                  {hand.length > 0 ? (
                    <div className="replay-hand-cluster" aria-label={`${player.nickname}手牌`}>
                      {hand.map((tile) => (
                        <TileView
                          key={tile.id}
                          tile={tile}
                          pose="hand"
                          last={tile.id === winningDiscardId}
                          className="replay-tile"
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="replay-empty">手牌未公开</span>
                  )}
                </div>

                {player.discards.length > 0 ? (
                  <div className="replay-discards-row">
                    <span className="replay-discards-label">弃牌</span>
                    <div className="replay-discard-tiles">
                      {player.discards.map((tile) => (
                        <TileView key={tile.id} tile={tile} small pose="lie" className="replay-discard-tile" />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function SettlementModal({
  view,
  settlement,
  onAgain,
  onLeave,
  readyCount,
  alreadyReady = false,
  gameMode = 'online',
  serverUrl,
  token,
  onOpenProfile,
}: {
  view: ClientView;
  settlement: Settlement;
  onAgain: () => void;
  onLeave?: () => void;
  readyCount: number;
  alreadyReady?: boolean;
  gameMode?: 'online' | 'local';
  serverUrl?: string;
  token?: string | null;
  onOpenProfile?: () => void;
}) {
  const roomRate = view.pointRate ?? 0.1;
  const [activeTab, setActiveTab] = useState<'podium' | 'summary' | 'ledger' | 'breakdown' | 'replay'>('podium');
  const ratePerPoint = roomRate > 0 ? roomRate : 0.1;
  const [showMoney, setShowMoney] = useState<boolean>(roomRate > 0);

  const [minimized, setMinimized] = useState(false);
  const [posterDataUrl, setPosterDataUrl] = useState<string | null>(null);
  const [showPosterModal, setShowPosterModal] = useState(false);
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const bao = settlement.baoZhuang
    ? BAO_LABEL[settlement.baoZhuang.reason]
    : null;
  const drawText = settlement.drawReason ? DRAW_LABEL[settlement.drawReason] ?? settlement.drawReason : null;

  const baoZhuangPayerScore = settlement.baoZhuang
    ? settlement.scores.find((s) => s.seat === settlement.baoZhuang!.payerSeat)
    : null;
  // 包庄者可能同时从高胡玩家处收到正常差胡；展示包庄款应看实际应付总额，不能用净 delta。
  const baoZhuangTotalPoints = baoZhuangPayerScore?.payable ?? 0;
  const baoZhuangTotalMoney = (baoZhuangTotalPoints * ratePerPoint).toFixed(1);
  const hunDiTotalPoints = settlement.hunDi ? 90 : 0;
  const hunDiTotalMoney = (hunDiTotalPoints * ratePerPoint).toFixed(1);
  const hunDiPerPlayerMoney = ((30) * ratePerPoint).toFixed(1);
  const chaHuPoints = Math.max(0, baoZhuangTotalPoints - hunDiTotalPoints);
  const chaHuMoney = (chaHuPoints * ratePerPoint).toFixed(1);

  // Winner data extraction
  const winnerSeat = settlement.winnerSeat;
  const winnerPlayer = winnerSeat !== null ? view.players[winnerSeat] : null;
  const winnerHand = (winnerPlayer && isPrivatePlayerView(winnerPlayer)) ? winnerPlayer.hand : [];
  const winnerMelds = winnerPlayer ? winnerPlayer.melds : [];
  const winningDiscardId = !settlement.selfDraw && winnerSeat !== null ? view.lastDiscard?.tile.id : undefined;

  // 4-player ranking calculations
  const sortedScores = useMemo(() => {
    return [...settlement.scores].sort((a, b) => b.delta - a.delta);
  }, [settlement.scores]);

  const maxDelta = useMemo(() => {
    return Math.max(...settlement.scores.map((s) => s.delta));
  }, [settlement.scores]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  // Match History Save
  useEffect(() => {
    const now = new Date();
    const dateStr = `${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const myScoreObj = settlement.scores.find((s) => s.seat === view.mySeat);
    const myDeltaScore = myScoreObj?.delta ?? 0;
    const myIsWinner = view.mySeat === settlement.winnerSeat;

    const record = {
      id: `${view.roomCode || '888888'}-${settlement.winnerSeat ?? 'draw'}-${Date.now()}`,
      mode: gameMode,
      timestamp: Date.now(),
      dateStr,
      roomCode: gameMode === 'online' ? (view.roomCode || '888888') : '单机练习',
      winType: WIN_LABEL[settlement.winType] ?? settlement.winType,
      winnerNickname: settlement.winnerNickname ?? undefined,
      winnerSeat: settlement.winnerSeat,
      hu: settlement.hu,
      yao: settlement.yao,
      dealerMultiplier: settlement.dealerMultiplier,
      hunDi: Boolean(settlement.hunDi),
      liuju: Boolean(settlement.liuju),
      drawReason: settlement.drawReason ?? undefined,
      baoZhuang: settlement.baoZhuang,
      myDeltaScore,
      myIsWinner,
      scores: settlement.scores.map((s) => ({
        seat: s.seat,
        nickname: s.nickname,
        score: s.total ?? s.delta ?? 0,
        isWinner: Boolean(s.isWinner),
        isDealer: Boolean(s.isDealer),
        notes: s.notes,
      })),
    };

    saveMatchToHistory(record);

    if (token && serverUrl) {
      apiSaveMatch(serverUrl, token, record).catch((err) => {
        console.warn('Auto upload match record to Cloudflare failed:', err);
      });
    }
  }, [settlement, view.roomCode, view.mySeat, gameMode, token, serverUrl]);

  // Generate Battle Report Poster
  const handleGeneratePoster = async () => {
    setIsGeneratingPoster(true);
    try {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const posterData: PosterData = {
        roomCode: view.roomCode || '888888',
        gameMode,
        timestamp: Date.now(),
        dateStr,
        pointRate: roomRate > 0 ? roomRate : undefined,
        winnerSeat: settlement.winnerSeat,
        winnerNickname: settlement.winnerNickname,
        winType: WIN_LABEL[settlement.winType] ?? settlement.winType,
        isDraw: Boolean(settlement.liuju),
        drawReason: drawText,
        dealerMultiplier: settlement.dealerMultiplier,
        hunDi: Boolean(settlement.hunDi),
        baoZhuang: settlement.baoZhuang
          ? {
              payerSeat: settlement.baoZhuang.payerSeat,
              reason: BAO_LABEL[settlement.baoZhuang.reason] ?? settlement.baoZhuang.reason,
            }
          : null,
        winningHand: winnerHand.map((t) => ({ suit: t.suit, rank: t.rank, id: t.id })),
        winningMelds: winnerMelds.map((m) => ({
          type: m.type,
          tiles: m.tiles.map((t) => ({ suit: t.suit, rank: t.rank, id: t.id })),
        })),
        winningTileId: winningDiscardId,
        players: settlement.scores.map((s) => {
          const p = view.players[s.seat];
          return {
            seat: s.seat,
            nickname: s.nickname || p?.nickname || `${SEAT_NAMES[s.seat]}家`,
            avatar: p?.avatar,
            title: p?.title,
            scoreDelta: s.delta,
            totalScore: s.total ?? 0,
            hu: s.hu ?? 0,
            yao: s.yao ?? 0,
            isDealer: Boolean(s.isDealer),
            isWinner: Boolean(s.isWinner),
            isMvp: s.delta === maxDelta && maxDelta > 0,
            piaoHun: Boolean(s.piaoHun),
            closed: Boolean(p?.closed),
            notes: s.notes,
          };
        }),
      };

      const url = await exportBattleReportPoster(posterData);
      setPosterDataUrl(url);
      setShowPosterModal(true);
      setToastMsg('战报海报已成功生成！');
    } catch (err) {
      console.error('Failed to generate poster:', err);
      setToastMsg('生成战报海报失败，请重试');
    } finally {
      setIsGeneratingPoster(false);
    }
  };

  const handleDownloadPoster = () => {
    if (!posterDataUrl) return;
    downloadBattleReportPoster(
      posterDataUrl,
      `pizhou-battle-report-${view.roomCode || '888888'}-${Date.now()}.png`,
    );
    setToastMsg('战报海报图片已下载到本地！');
  };

  const handleCopyPoster = async () => {
    if (!posterDataUrl) return;
    try {
      const res = await fetch(posterDataUrl);
      const blob = await res.blob();
      if (typeof window !== 'undefined' && 'ClipboardItem' in window && navigator.clipboard) {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        setToastMsg('战报图片已复制到剪贴板！');
      } else {
        handleDownloadPoster();
        setToastMsg('已为您直接下载战报图片！');
      }
    } catch {
      handleDownloadPoster();
      setToastMsg('已为您直接下载战报图片！');
    }
  };

  const getNickname = (seat: number) => {
    const found = settlement.scores.find((s) => s.seat === seat);
    return found?.nickname || `${SEAT_NAMES[seat]}家`;
  };

  const isDealer = (seat: number) => {
    const found = settlement.scores.find((s) => s.seat === seat);
    return Boolean(found?.isDealer);
  };

  if (minimized) {
    return (
      <div className="settlement-floating-bar">
        <button type="button" className="btn-action primary" onClick={() => setMinimized(false)}>
          📊 展开对账结算单
        </button>
        <button type="button" className="btn-action" disabled={alreadyReady} onClick={onAgain}>
          {alreadyReady ? '已准备，等朋友' : '再来一局'}
        </button>
        {onLeave ? (
          <button type="button" className="btn-action ghost" onClick={onLeave}>
            回大厅
          </button>
        ) : null}
        <span className="floating-ready-pill">已准备 {readyCount}/4</span>
      </div>
    );
  }

  return (
    <div className="overlay">
      <div className="settlement ledger-modal">
        <div className="gold-line" />

        <header className="settlement-header">
          {onOpenProfile ? (
            <button
              type="button"
              className="settlement-profile-button"
              onClick={onOpenProfile}
              title="打开我的账号资料"
            >
              <AvatarView
                avatar={view.players[view.mySeat]?.avatar}
                className="settlement-profile-avatar"
                alt="我的头像"
              />
              <span>
                <strong>{view.players[view.mySeat]?.nickname ?? '我的资料'}</strong>
                <small>{view.players[view.mySeat]?.title ?? '账号资料'}</small>
              </span>
            </button>
          ) : null}
          <h2>{settlement.liuju ? '本局流局' : `${settlement.winnerNickname ?? '玩家'} 胡牌！`}</h2>
          <p className="sub">
            {WIN_LABEL[settlement.winType] ?? settlement.winType}
            {settlement.selfDraw ? ' (自摸)' : ' (点炮)'}
            {settlement.hunDi ? ' · 飘荤' : ''}
            {bao ? ` · ${bao}` : ''}
          </p>
          {drawText ? <p className="sub">{drawText}</p> : null}

          {/* Hun Di & Bao Zhuang Fund Highlight Badges */}
          {(settlement.hunDi || settlement.baoZhuang) && !settlement.liuju ? (
            <div className="settlement-fund-pills">
              {settlement.hunDi ? (
                <div className="settlement-fund-pill hun-di">
                  🍲 <b>飘荤底分：</b>
                  <span>全桌共计 <b>90分</b> {showMoney ? `(¥${hunDiTotalMoney})` : ''} · 每家 30分 {showMoney ? `(¥${hunDiPerPlayerMoney})` : ''}</span>
                </div>
              ) : null}
              {settlement.baoZhuang ? (
                <div className="settlement-fund-pill bao-zhuang">
                  💥 <b>包庄清算：</b>
                  <span>包庄者承担对应包庄款 <b>{baoZhuangTotalPoints}分</b> {showMoney ? `(¥${baoZhuangTotalMoney})` : ''}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </header>

        {/* Navigation Tabs */}
        <div className="settlement-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'podium' ? 'active' : ''}`}
            onClick={() => setActiveTab('podium')}
          >
            🏆 荣耀战绩榜
          </button>
          {!settlement.liuju ? (
            <>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
                onClick={() => setActiveTab('summary')}
              >
                📊 查胡收付账单
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
                onClick={() => setActiveTab('ledger')}
              >
                {settlement.baoZhuang ? '🧾 包庄前查胡流水' : '🧾 6组两两查胡流水'}
              </button>
              {settlement.breakdown.length > 0 ? (
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'breakdown' ? 'active' : ''}`}
                  onClick={() => setActiveTab('breakdown')}
                >
                  🀄 牌面番数细则
                </button>
              ) : null}
            </>
          ) : null}
          <button
            type="button"
            className={`tab-btn ${activeTab === 'replay' ? 'active' : ''}`}
            onClick={() => setActiveTab('replay')}
          >
            🀄 牌局复盘
          </button>
        </div>

        {/* Rate Converter Toolbar */}
        {!settlement.liuju && roomRate > 0 ? (
          <div className="rate-toolbar" style={{ margin: '8px 0' }}>
            <div className="rate-presets">
              <span className="rate-label">🔒 底分单价:</span>
              <span className="rate-chip active locked">¥{roomRate} / 分 (开局已固定)</span>
              <button
                type="button"
                className={`rate-chip ${showMoney ? 'active' : ''}`}
                onClick={() => setShowMoney((prev) => !prev)}
              >
                {showMoney ? '切换为仅看计分' : '切换为展示金额'}
              </button>
            </div>
          </div>
        ) : null}

        {/* Bao-Zhuang Alert */}
        {settlement.baoZhuang ? (
          <div className="settlement-baozhuang-card">
            <div className="baozhuang-icon">⚠️</div>
            <div className="baozhuang-content">
              <div className="baozhuang-header-row">
                <b className="baozhuang-title">
                  判定包庄 · 【{getNickname(settlement.baoZhuang.payerSeat)}】{BAO_LABEL[settlement.baoZhuang.reason]}
                </b>
                <span className="baozhuang-total-badge">
                  包庄代付: <b>{baoZhuangTotalPoints}分</b> {showMoney ? <b className="baozhuang-money-val">¥{baoZhuangTotalMoney}</b> : null}
                </span>
              </div>
              <p className="baozhuang-desc">
                {BAO_EXPLANATION[settlement.baoZhuang.reason]} 另外两家原本应向胡家支付给赢家的正向份额由【{getNickname(settlement.baoZhuang.payerSeat)}】代付；其他两两差胡仍照算{settlement.hunDi ? '；本局飘荤荤底（3份共90分）也全部由包庄者承担。' : '。'}
                {chaHuPoints > 0 ? ` 查胡分差包赔: ${chaHuPoints}分${showMoney ? ` (¥${chaHuMoney})` : ''}。` : ''}
              </p>
            </div>
          </div>
        ) : null}

        {/* Content Body */}
        <div className="settlement-body">
          {activeTab === 'podium' ? (
            /* 1. Shenghun-Style Podium Cards & Winning Hand Domino Showcase */
            <div className="shenghun-settlement">
              {/* Winning Hand Domino Decomposition Tray */}
              <div className="winning-hand-tray">
                <div className="winning-tray-header">
                  <div className="winning-tray-title">
                    <span>🀄 {settlement.liuju ? '局终牌面展示' : `赢家胡牌面拆解 (${settlement.winnerNickname || '胡家'})`}</span>
                  </div>
                  <div className="winning-fan-pills">
                    {settlement.selfDraw ? (
                      <span className="fan-chip win-type">自摸</span>
                    ) : !settlement.liuju ? (
                      <span className="fan-chip win-type">点炮胡</span>
                    ) : null}
                    <span className="fan-chip win-type">{WIN_LABEL[settlement.winType] ?? settlement.winType}</span>
                    {winnerPlayer?.closed ? <span className="fan-chip closed">两对关门</span> : null}
                    {settlement.hunDi ? <span className="fan-chip hun-di">飘荤 (+90分)</span> : null}
                    {!settlement.liuju ? <span className="fan-chip dealer">涉及庄家的两两胡差×2</span> : null}
                    {settlement.baoZhuang ? <span className="fan-chip baozhuang">包庄全赔</span> : null}
                  </div>
                </div>

                {!settlement.liuju && (winnerMelds.length > 0 || winnerHand.length > 0) ? (
                  <div className="winning-domino-row">
                    {winnerMelds.length > 0 ? (
                      <>
                        <div className="domino-melds-group">
                          <Melds melds={winnerMelds} highlightKey={null} />
                        </div>
                        <div className="domino-group-sep" />
                      </>
                    ) : null}

                    {winnerHand.length > 0 ? (
                      <div className="domino-hand-group">
                        {winnerHand.map((tile) => (
                          <TileView
                            key={tile.id}
                            tile={tile}
                            pose="hand"
                            last={tile.id === winningDiscardId}
                            className="winning-tray-tile"
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: '13px', padding: '8px 0' }}>
                    {settlement.liuju ? '本局未形成有效胡牌，所有牌面已归档复盘。' : '牌面已归集两两对账账册。'}
                  </div>
                )}
              </div>

              {/* 4-Player Podium Cards Grid */}
              <div className="shenghun-podium-grid">
                {sortedScores.map((score, rankIdx) => {
                  const player = view.players[score.seat];
                  const isMvp = score.delta === maxDelta && maxDelta > 0;
                  const deltaMoney = (score.delta * ratePerPoint).toFixed(1);

                  return (
                    <div
                      key={score.seat}
                      className={`podium-player-card rank-${rankIdx + 1} ${isMvp ? 'is-mvp' : ''}`}
                    >
                      {/* MVP Laurel Crest */}
                      {isMvp ? <div className="mvp-crest-badge">👑 MVP 最佳雀士</div> : null}

                      {/* Rank Medal */}
                      <div className={`podium-rank-badge rank-${rankIdx + 1}`}>
                        {PODIUM_RANK_NAMES[rankIdx] || String(rankIdx + 1)}
                      </div>

                      {/* Avatar */}
                      <div className="podium-avatar-wrap">
                        <AvatarView avatar={player?.avatar} alt={score.nickname} />
                        <span className="podium-seat-tag">{SEAT_NAMES[score.seat]}</span>
                      </div>

                      {/* Name & Title */}
                      <div className="podium-player-name" title={score.nickname}>
                        {score.nickname}
                      </div>

                      {/* Badges Row */}
                      <div className="podium-tags-row">
                        {score.isDealer ? <span className="podium-mini-tag dealer">庄家</span> : null}
                        {player?.closed ? <span className="podium-mini-tag closed">关门</span> : null}
                        {score.piaoHun ? <span className="podium-mini-tag piao">飘荤</span> : null}
                        {score.isWinner ? <span className="podium-mini-tag winner">胡牌</span> : null}
                      </div>

                      {/* Large Score Delta */}
                      <div
                        className={`podium-score-delta ${
                          score.delta > 0 ? 'positive' : score.delta < 0 ? 'negative' : 'zero'
                        }`}
                      >
                        {score.delta > 0 ? `+${score.delta}` : score.delta} 分
                      </div>

                      {showMoney && (
                        <div style={{ fontSize: '12px', color: score.delta > 0 ? '#fde047' : '#f87171' }}>
                          {score.delta > 0 ? `+¥${deltaMoney}` : `¥${deltaMoney}`}
                        </div>
                      )}

                      {/* Hu & Yao count */}
                      <div className="podium-hu-detail">
                        {score.hu}胡 · {score.yao}幺
                      </div>

                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        累计: {score.total}分
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : activeTab === 'replay' ? (
            <ReplayHands view={view} settlement={settlement} />
          ) : settlement.liuju ? (
            <div className="liuju-notice">
              <p>本局流局，不进行查胡结算与分数结算。</p>
            </div>
          ) : activeTab === 'summary' ? (
            <div className="summary-view">
              <table className="balance-table">
                <thead>
                  <tr>
                    <th>玩家</th>
                    <th>牌面胡/幺</th>
                    <th>总应收</th>
                    <th>总应付</th>
                    <th>本局净结余</th>
                    {showMoney ? <th>折算金额</th> : null}
                    <th>累计总分</th>
                  </tr>
                </thead>
                <tbody>
                  {settlement.scores.map((item) => {
                    const netMoney = (item.delta * ratePerPoint).toFixed(1);
                    return (
                      <tr key={item.seat} className={item.seat === settlement.winnerSeat ? 'winner' : ''}>
                        <td>
                          <span className="seat-badge">{SEAT_NAMES[item.seat]}</span>
                          <span className="player-name">{item.nickname}</span>
                          {item.isDealer ? <span className="tag-dealer">庄</span> : null}
                          {item.isWinner ? <span className="tag-winner">胡</span> : null}
                          {item.piaoHun ? <span className="tag-piao">飘</span> : null}
                        </td>
                        <td>
                          <b>{item.hu ?? 0}</b> 胡 / <b>{item.yao ?? 0}</b> 幺
                        </td>
                        <td className="up">{item.receivable ? `+${item.receivable}` : '0'}</td>
                        <td className="down">{item.payable ? `-${item.payable}` : '0'}</td>
                        <td className={`delta-cell ${item.delta > 0 ? 'up' : item.delta < 0 ? 'down' : ''}`}>
                          <strong>{item.delta > 0 ? `+${item.delta}` : item.delta}</strong>
                        </td>
                        {showMoney ? (
                          <td className={`money-cell ${item.delta > 0 ? 'up' : item.delta < 0 ? 'down' : ''}`}>
                            <strong>{item.delta > 0 ? `+¥${netMoney}` : item.delta < 0 ? `-¥${Math.abs(Number(netMoney))}` : '¥0.0'}</strong>
                          </td>
                        ) : null}
                        <td>{item.total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : activeTab === 'ledger' ? (
            <div className="ledger-view">
              {settlement.baoZhuang ? (
                <div className="settlement-ledger-note">
                  <b>包庄说明：</b>下面六组是包庄前的两两查胡参考流水；实际收付已按包庄规则合并为【{getNickname(settlement.baoZhuang.payerSeat)}】一人承担，最终金额请以“查胡收付账单”为准。
                </div>
              ) : null}
              <div className="tx-grid">
                {(settlement.transactions ?? []).map((tx, idx) => {
                  const nameA = getNickname(tx.seatA);
                  const nameB = getNickname(tx.seatB);
                  const isDealerA = isDealer(tx.seatA);
                  const isDealerB = isDealer(tx.seatB);
                  const seatNameA = SEAT_NAMES[tx.seatA];
                  const seatNameB = SEAT_NAMES[tx.seatB];
                  const isTie = tx.points === 0;
                  const winnerName = tx.points > 0 ? nameA : nameB;
                  const loserName = tx.points > 0 ? nameB : nameA;
                  const winnerSeat = tx.points > 0 ? seatNameA : seatNameB;
                  const loserSeat = tx.points > 0 ? seatNameB : seatNameA;
                  const absPoints = Math.abs(tx.points);
                  const rawDeltaHu = typeof tx.rawDeltaHu === 'number' ? tx.rawDeltaHu : tx.huA - tx.huB;
                  const piaoMultiplier = typeof tx.piaoMultiplier === 'number' ? tx.piaoMultiplier : 1;
                  const dealerMultiplier = typeof tx.dealerMultiplier === 'number'
                    ? tx.dealerMultiplier
                    : (tx.isDealerPair ? 2 : 1);
                  const settledDeltaHu = rawDeltaHu * piaoMultiplier * dealerMultiplier;
                  const deltaYao = typeof tx.deltaYao === 'number' ? tx.deltaYao : tx.yaoA - tx.yaoB;

                  return (
                    <div key={idx} className={`tx-flow-card ${isTie ? 'is-tie' : ''}`}>
                      <div className="tx-main-row">
                        {isTie ? (
                          <div className="tx-tie-wrap">
                            <span>{nameA} 与 {nameB} 双方平手 (0分)</span>
                          </div>
                        ) : (
                          <div className="tx-transfer-wrap">
                            <div className="tx-party is-winner">
                              <span className="seat-badge">{winnerSeat}</span>
                              <b>{winnerName}</b>
                              {(tx.points > 0 ? isDealerA : isDealerB) ? <span className="tag-dealer">庄</span> : null}
                            </div>
                            <div className="tx-arrow-pill">
                              <span className="tx-arrow-label">收取</span>
                              <strong className="tx-points-val">+{absPoints}分</strong>
                            </div>
                            <div className="tx-party is-loser">
                              <span className="seat-badge">{loserSeat}</span>
                              <b>{loserName}</b>
                              {(tx.points > 0 ? isDealerB : isDealerA) ? <span className="tag-dealer">庄</span> : null}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="tx-formula-bar">
                        <span className="tx-formula-text">
                          胡差 {rawDeltaHu} × {piaoMultiplier} × {dealerMultiplier} = {settledDeltaHu} 胡
                          {'；'}幺差 {deltaYao}（幺不翻）
                        </span>
                        <span className="tx-mult-tag">{piaoMultiplier > 1 ? '飘荤结算' : '普通结算'}</span>
                        {dealerMultiplier > 1 ? <span className="tx-mult-tag">涉及庄家×2</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="breakdown-view">
              <ul className="breakdown-list">
                {settlement.breakdown.map((item, index) => (
                  <li key={`${item.label}-${index}`}>
                    <span className="item-label">{item.label}</span>
                    <span className="item-val">+{item.hu}胡{item.yao ? ` +${item.yao}幺` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="split slim settlement-actions">
          <button type="button" className="btn-action primary" disabled={alreadyReady} onClick={onAgain}>
            {alreadyReady ? '已准备，等朋友' : '再来一局'}
          </button>
          <button
            type="button"
            className="btn-action"
            style={{
              background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
              border: '1px solid #fef08a',
              color: '#fffbeb',
              fontWeight: 800,
            }}
            disabled={isGeneratingPoster}
            onClick={handleGeneratePoster}
          >
            {isGeneratingPoster ? '正在生成战报…' : '🎨 生成战报海报'}
          </button>
          <button type="button" className="btn-action ghost" onClick={() => setMinimized(true)}>
            👁️ 查看牌桌
          </button>
          {onLeave ? (
            <button type="button" className="btn-action ghost" onClick={onLeave}>
              返回大厅
            </button>
          ) : null}
        </div>
        <p className="hint settlement-ready">已准备 {readyCount}/4{alreadyReady ? ' · 你已准备' : ''}</p>
      </div>

      {/* Poster Preview Modal */}
      {showPosterModal && posterDataUrl && (
        <div className="poster-modal-overlay" onClick={() => setShowPosterModal(false)}>
          <div className="poster-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="poster-modal-header">
              <h3 className="poster-modal-title">🀄 邳州麻将 · 高清战报海报</h3>
              <button
                type="button"
                className="poster-modal-close"
                onClick={() => setShowPosterModal(false)}
              >
                ×
              </button>
            </div>
            <div className="poster-img-container">
              <img
                className="poster-preview-img"
                src={posterDataUrl}
                alt="邳州麻将终局战报海报"
              />
            </div>
            <div className="poster-modal-footer">
              <button
                type="button"
                className="btn-poster-copy"
                onClick={handleCopyPoster}
              >
                📋 复制海报
              </button>
              <button
                type="button"
                className="btn-poster-download"
                onClick={handleDownloadPoster}
              >
                💾 保存海报图片 (PNG)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toastMsg && <div className="poster-toast">{toastMsg}</div>}
    </div>
  );
}
