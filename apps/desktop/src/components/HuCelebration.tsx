import { useEffect, useState } from 'react';
import { SEAT_NAMES, type BaoZhuangReason, type ClientView, type Settlement } from '@pizhou/shared';
import { TileView } from './TileView';

const BAO_LABEL: Record<BaoZhuangReason, string> = {
  four_wait_seq: '四组听顺包庄',
  chow_wait_seq: '吃牌听顺包庄',
  xiang: '香牌包庄',
};

const BAO_BRIEF: Record<BaoZhuangReason, string> = {
  four_wait_seq: '四组单钓、不换张，点炮牌与手中单张相连成顺，按飘荤处理。',
  chow_wait_seq: '带吃单钓、不换张，点炮牌与手中单张相连成顺，按普通胡处理。',
  xiang: '三组两对但未选择两对关门，点炮牌此前从未出现，按香牌飘荤处理。',
};

interface HuCelebrationProps {
  view: ClientView;
  settlement: Settlement;
  onFinish: () => void;
}

export function HuCelebration({ view, settlement, onFinish }: HuCelebrationProps) {
  const [countdown, setCountdown] = useState(4);
  const isDraw = settlement.winType === 'liuju' || settlement.winnerSeat === null || settlement.winnerSeat === undefined;
  const winnerSeat = settlement.winnerSeat;
  const isMeWinner = winnerSeat === view.mySeat;
  const isMeDiscarder = view.lastDiscard?.fromSeat === view.mySeat && !isMeWinner && !settlement.selfDraw;

  const winnerPlayer = winnerSeat !== null && winnerSeat !== undefined ? view.players[winnerSeat] : null;
  const winnerName = winnerPlayer?.nickname || (winnerSeat !== null && winnerSeat !== undefined ? `${SEAT_NAMES[winnerSeat]}位` : '玩家');
  const winningHand = winnerPlayer && 'hand' in winnerPlayer ? (winnerPlayer as any).hand : [];

  const winTypeLabel = settlement.winType === 'qidong-gang-hu'
    ? '起手杠胡'
    : settlement.selfDraw
    ? '自摸胡牌'
    : '点炮胡牌';

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isDraw, onFinish]);

  return (
    <div className={`hu-celebration-overlay ${isDraw ? 'is-draw' : isMeWinner ? 'is-me-win' : 'is-other-win'}`}>
      <div className="hu-celebration-backdrop" onClick={onFinish} />

      <div className="hu-sunburst" />
      <div className="hu-shockwave-ring" />

      <div className="hu-celebration-card">
        {/* Top Calligraphy Badge */}
        <div className="hu-badge-banner">
          {isDraw ? '荒 牌 · 流 局' : settlement.winType === 'qidong-gang-hu' ? '起 手 杠 胡' : '牌 局 告 捷 · 胡 牌'}
        </div>

        {/* Main Title Banner */}
        <div className="hu-main-title">
          {isDraw ? (
            <h1 className="hu-title-text draw">牌墙摸尽 · 本局流局</h1>
          ) : isMeWinner ? (
            <h1 className="hu-title-text win">恭 喜 您 胡 牌 ！</h1>
          ) : (
            <h1 className="hu-title-text announce">
              【{SEAT_NAMES[winnerSeat!]}位 · {winnerName}】 {winTypeLabel}！
            </h1>
          )}
        </div>

        {/* Winning Hand Domino Reveal */}
        {!isDraw && winningHand && winningHand.length > 0 ? (
          <div className="hu-winning-tiles-tray">
            <span className="hu-tiles-tray-label">🀄 赢家胡牌面</span>
            <div className="hu-tiles-row">
              {winningHand.map((tile: any, idx: number) => (
                <div
                  key={tile.id || idx}
                  className="hu-domino-cell"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <TileView tile={tile} small pose="hand" />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Informative notification capsule for all players */}
        {!isDraw && (
          <div className="hu-meta-capsule">
            <div className="hu-meta-row">
              <span className="hu-meta-item">
                <b className="meta-tag">胡牌方式</b>
                <span className="meta-val">{winTypeLabel}</span>
              </span>
              <span className="hu-meta-item">
                <b className="meta-tag">牌面分值</b>
                <span className="meta-val highlight">{settlement.hu} 胡 {settlement.yao > 0 ? `${settlement.yao} 幺` : ''}</span>
              </span>
              {!isDraw && (
                <span className="hu-meta-item">
                  <b className="meta-tag">庄家对账</b>
                  <span className="meta-val gold">涉及庄家胡差 ×2</span>
                </span>
              )}
            </div>

            <p className="hu-notice-text">
              {isMeWinner
                ? '漂亮！已为您锁定胜局，所有玩家手牌已公开翻开。'
                : isMeDiscarder
                ? '您打出的牌被胡牌点炮，四家牌面已公开翻开。'
                : `【${winnerName}】已胡牌，本局结束，四家牌面已全部翻开。`}
            </p>

            {settlement.baoZhuang ? (
              <div className="hu-baozhuang-banner">
                <div className="hu-baozhuang-title">
                  判定包庄 · {BAO_LABEL[settlement.baoZhuang.reason]}
                </div>
                <p className="hu-baozhuang-desc">
                  {BAO_BRIEF[settlement.baoZhuang.reason]}{' '}
                  {settlement.baoZhuang.payerSeat === view.mySeat
                    ? '您是本次点炮方，需要代付另外两家原本应向胡家支付的正向份额；其他两两差胡仍照算，如有荤底三家荤底也由您承担。'
                    : `【${view.players[settlement.baoZhuang.payerSeat]?.nickname || `${SEAT_NAMES[settlement.baoZhuang.payerSeat]}位`}】是本次包庄者，将代付另外两家原本应向胡家支付的正向份额，其他两两差胡仍照算。`}
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* Action Button */}
        <div className="hu-action-row">
          <button type="button" className="btn-action hu-enter-btn" onClick={onFinish}>
            查看对账结算单 ({countdown}s) ▶
          </button>
        </div>
      </div>
    </div>
  );
}
