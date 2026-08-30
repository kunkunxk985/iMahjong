import { useState } from 'react';
import { SEAT_NAMES } from '@pizhou/shared';
import { clearMatchHistory, getMatchHistory, type MatchRecord } from '../storage/history';

interface MatchHistoryModalProps {
  onClose: () => void;
  onSelectReplay?: (record: MatchRecord) => void;
}

export function MatchHistoryModal({ onClose }: MatchHistoryModalProps) {
  const [history, setHistory] = useState<MatchRecord[]>(() => getMatchHistory());
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  const handleClear = () => {
    if (window.confirm('确定要清空所有历史对战记录吗？')) {
      clearMatchHistory();
      setHistory([]);
    }
  };

  const handleCopySummary = (record: MatchRecord) => {
    const lines = [
      `🀄 【邳州麻将·对局结算单】`,
      `📅 时间: ${record.dateStr} (房间: ${record.roomCode})`,
      `🏆 结果: ${record.liuju ? '牌墙摸尽·流局' : `${record.winnerNickname ?? '玩家'} 胡牌 (${record.hu}胡${record.yao ? `${record.yao}幺` : ''})`}`,
      record.baoZhuang ? `⚠️ 包庄: 由【${SEAT_NAMES[record.baoZhuang.payerSeat]}位】全额包赔` : '',
      `-----------------------`,
      `📊 四家对账总流水:`,
      ...record.scores.map(
        (s) => `• ${SEAT_NAMES[s.seat]}家 [${s.nickname}]: ${s.score > 0 ? `+${s.score}` : s.score} 分`
      ),
      `-----------------------`,
      `邳州正统查胡两两结 · 欢迎下局再战！`,
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopyNotice(`已复制【${record.roomCode}】对账单！`);
      setTimeout(() => setCopyNotice(null), 2500);
    });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gold-line" />

        <div className="history-header">
          <h2>📜 历史战绩与战报</h2>
          {history.length > 0 && (
            <button type="button" className="btn-action ghost sm" onClick={handleClear}>
              清空战绩
            </button>
          )}
        </div>

        {copyNotice && <div className="history-toast">{copyNotice}</div>}

        <div className="history-content">
          {history.length === 0 ? (
            <div className="history-empty">
              <span className="empty-icon">🀄</span>
              <p>暂无对局历史，快去开一局吧！</p>
            </div>
          ) : (
            <div className="history-list">
              {history.map((record) => {
                const isDraw = record.liuju;
                const winnerScore = record.scores.find((s) => s.isWinner);

                return (
                  <div key={record.id} className="history-card">
                    <div className="history-card-top">
                      <div className="history-card-meta">
                        <span className="history-date">{record.dateStr}</span>
                        <span className="history-room-tag">房号 {record.roomCode}</span>
                        {record.hunDi ? <span className="history-piao-tag">飘荤</span> : null}
                        {record.baoZhuang ? <span className="history-bao-tag">包庄</span> : null}
                      </div>
                      <button
                        type="button"
                        className="history-copy-btn"
                        onClick={() => handleCopySummary(record)}
                        title="复制对账文字长图"
                      >
                        📋 复制战报
                      </button>
                    </div>

                    <div className="history-main-row">
                      <div className="history-winner-block">
                        {isDraw ? (
                          <span className="winner-label draw">💨 荒牌流局</span>
                        ) : (
                          <>
                            <span className="winner-crown">👑</span>
                            <div className="winner-info">
                              <b className="winner-name">{record.winnerNickname ?? '玩家'} 胡牌</b>
                              <span className="winner-hu">
                                {record.hu} 胡 {record.yao ? `${record.yao} 幺` : ''} · {record.winType}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {winnerScore && (
                        <div className="history-win-points">
                          +{winnerScore.score} <span className="pts">分</span>
                        </div>
                      )}
                    </div>

                    <div className="history-scores-grid">
                      {record.scores.map((s) => (
                        <div
                          key={s.seat}
                          className={`score-pill ${s.isWinner ? 'winner' : ''} ${s.score >= 0 ? 'plus' : 'minus'}`}
                        >
                          <span className="seat-prefix">{SEAT_NAMES[s.seat]}</span>
                          <span className="player-nick">{s.nickname}</span>
                          <b className="score-val">{s.score > 0 ? `+${s.score}` : s.score}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="row" style={{ marginTop: '16px' }}>
          <button type="button" className="btn-action primary" onClick={onClose}>
            返回大厅
          </button>
        </div>
      </div>
    </div>
  );
}
