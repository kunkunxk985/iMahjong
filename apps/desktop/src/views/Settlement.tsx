import { useEffect, useState, useMemo, useRef } from 'react';
import { type ClientView, type Settlement } from '@pizhou/shared';
import { saveMatchToHistory } from '../storage/history';
import { apiSaveMatch } from '../api/auth';
import { AvatarView } from '../components/AvatarView';
import { exportBattleReportPoster, downloadBattleReportPoster, type PosterData } from '../utils/canvasPoster';
import '../styles/lobby.css';

import { BAO_LABEL, BAO_EXPLANATION, WIN_LABEL, SEAT_NAMES, getNickname as nicknameForSeat, getSettlementPresentation } from './settlement/presentation';
import { ReplayHands } from './settlement/ReplayHands';
import { SettlementResult } from './settlement/SettlementResult';
import { SettlementSummary, SettlementLedger, SettlementBreakdown } from './settlement/SettlementBilling';

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
  const presentation = useMemo(() => getSettlementPresentation(view, settlement), [view, settlement]);
  const {
    roomRate, ratePerPoint, bao, drawText, baoZhuangTotalPoints, baoZhuangTotalMoney,
    hunDiTotalMoney, hunDiPerPlayerMoney, chaHuPoints, chaHuMoney,
    winnerHand, winnerMelds, winningDiscardId, maxDelta,
  } = presentation;
  const [activeTab, setActiveTab] = useState<'podium' | 'summary' | 'ledger' | 'breakdown' | 'replay'>('podium');
  const [showMoney, setShowMoney] = useState<boolean>(roomRate > 0);

  const [minimized, setMinimized] = useState(false);
  const [posterDataUrl, setPosterDataUrl] = useState<string | null>(null);
  const [showPosterModal, setShowPosterModal] = useState(false);
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  // Match History Save
  //
  // 这个 effect 依赖 settlement 对象，而每次 WebSocket 广播都是新的 JSON 对象，
  // 所以同一局会重复触发。历史记录靠 record.id 去重，因此 id 必须是**稳定键**；
  // 早先用 Date.now() 导致每��渲染都是新 id，去重失效、同一局被写入多次
  // （本地多条 + 重复上传云端，污染排行榜）。
  const savedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    // 稳定键：房号 + 局号 + 赢家 + 胡牌类型。同一局无论渲染多少次都是同一个 id。
    const stableId = [
      view.roomCode || '888888',
      view.round ?? 0,
      settlement.winnerSeat ?? 'draw',
      settlement.winType,
      settlement.liuju ? 'liuju' : 'hu',
    ].join('-');
    if (savedKeyRef.current === stableId) return;
    savedKeyRef.current = stableId;

    const now = new Date();
    const dateStr = `${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const myScoreObj = settlement.scores.find((s) => s.seat === view.mySeat);
    const myDeltaScore = myScoreObj?.delta ?? 0;
    const myIsWinner = view.mySeat === settlement.winnerSeat;

    const record = {
      id: stableId,
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

  const getNickname = (seat: number) => nicknameForSeat(settlement, seat);

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
      <div className={`settlement ledger-modal quiet-settlement ${activeTab === 'podium' ? 'is-overview' : ''}`}>
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
            {settlement.liuju ? '' : settlement.selfDraw ? ' · 自摸' : ' · 点炮'}
            {settlement.hunDi ? ' · 飘荤' : ''}
            {bao ? ` · ${bao}` : ''}
          </p>
          {drawText ? <p className="sub">{drawText}</p> : null}

          {/* Hun Di & Bao Zhuang Fund Highlight Badges */}
          {activeTab !== 'podium' && (settlement.hunDi || settlement.baoZhuang) && !settlement.liuju ? (
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
            本局结果
          </button>
          {!settlement.liuju ? (
            <>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
                onClick={() => setActiveTab('summary')}
              >
                收付明细
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
                onClick={() => setActiveTab('ledger')}
              >
                {settlement.baoZhuang ? '包庄前流水' : '两两流水'}
              </button>
              {settlement.breakdown.length > 0 ? (
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'breakdown' ? 'active' : ''}`}
                  onClick={() => setActiveTab('breakdown')}
                >
                  胡数明细
                </button>
              ) : null}
            </>
          ) : null}
          <button
            type="button"
            className={`tab-btn ${activeTab === 'replay' ? 'active' : ''}`}
            onClick={() => setActiveTab('replay')}
          >
            四家牌面
          </button>
        </div>

        {/* Rate Converter Toolbar */}
        {!settlement.liuju && roomRate > 0 ? (
          <div className="rate-toolbar" style={{ margin: '8px 0' }}>
            <div className="rate-presets">
              <span className="rate-label">底分</span>
              <span className="rate-chip active locked">¥{roomRate} / 分</span>
              <button
                type="button"
                className={`rate-chip ${showMoney ? 'active' : ''}`}
                onClick={() => setShowMoney((prev) => !prev)}
              >
                {showMoney ? '只看分数' : '显示金额'}
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
              <details className="baozhuang-desc"><summary>包庄说明</summary><p>
                {BAO_EXPLANATION[settlement.baoZhuang.reason]} 另外两家原本应向胡家支付给赢家的正向份额由【{getNickname(settlement.baoZhuang.payerSeat)}】代付；其他两两差胡仍照算{settlement.hunDi ? '；本局飘荤荤底（3份共90分）也全部由包庄者承担。' : '。'}
                {chaHuPoints > 0 ? ` 查胡分差包赔: ${chaHuPoints}分${showMoney ? ` (¥${chaHuMoney})` : ''}。` : ''}
              </p></details>
            </div>
          </div>
        ) : null}

        {/* Content Body */}
        <div className="settlement-body">
          {activeTab === 'podium' ? (
            <SettlementResult view={view} settlement={settlement} showMoney={showMoney} presentation={presentation} />
          ) : activeTab === 'replay' ? (
            <ReplayHands view={view} settlement={settlement} />
          ) : settlement.liuju ? (
            <div className="liuju-notice">
              <p>本局流局，不进行查胡结算与分数结算。</p>
            </div>
          ) : activeTab === 'summary' ? (
            <SettlementSummary settlement={settlement} showMoney={showMoney} ratePerPoint={ratePerPoint} />
          ) : activeTab === 'ledger' ? (
            <SettlementLedger settlement={settlement} />
          ) : (
            <SettlementBreakdown settlement={settlement} />
          )}
        </div>

        {/* Footer Actions */}
        <div className="split slim settlement-actions">
          <button type="button" className="btn-action primary" disabled={alreadyReady} onClick={onAgain}>
            {alreadyReady ? '已准备，等朋友' : '再来一局'}
          </button>
          <button
            type="button"
            className="btn-action ghost"
            disabled={isGeneratingPoster}
            onClick={handleGeneratePoster}
          >
            {isGeneratingPoster ? '正在生成战报…' : '生成战报'}
          </button>
          <button type="button" className="btn-action ghost" onClick={() => setMinimized(true)}>
            查看牌桌
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
