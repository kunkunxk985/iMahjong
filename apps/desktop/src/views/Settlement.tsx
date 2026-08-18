import type { BaoZhuangReason, Settlement } from '@pizhou/shared';

const WIN_LABEL: Record<string, string> = {
  'ping-hu': '平胡',
  'qidong-gang-hu': '起手杠胡',
  liuju: '流局',
};

const BAO_LABEL: Record<BaoZhuangReason, string> = {
  four_wait_seq: '四坎听顺包庄',
  chow_wait_seq: '吃牌听顺包庄',
  xiang: '香牌包庄',
};

const DRAW_LABEL: Record<string, string> = {
  four_same: '开局四同张流局',
  wall: '牌墙摸完流局',
};

export function SettlementModal({
  settlement,
  onAgain,
  onLeave,
}: {
  settlement: Settlement;
  onAgain: () => void;
  onLeave?: () => void;
  readyCount: number;
}) {
  const bao = settlement.baoZhuang
    ? BAO_LABEL[settlement.baoZhuang.reason]
    : null;
  const drawText = settlement.drawReason ? DRAW_LABEL[settlement.drawReason] ?? settlement.drawReason : null;

  return (
    <div className="overlay">
      <div className="settlement">
        <div className="gold-line" />
        <h2>{settlement.liuju ? '流局' : `${settlement.winnerNickname ?? '玩家'} 胡牌`}</h2>
        <p className="sub">
          {WIN_LABEL[settlement.winType] ?? settlement.winType}
          {settlement.hunDi ? ' · 飘荤' : ''}
          {bao ? ` · ${bao}` : ''}
        </p>
        {drawText ? <p className="sub">{drawText}</p> : null}
        {!settlement.liuju ? (
          <div className="score-grid">
            <div>
              <span>胡数</span>
              <strong>{settlement.hu}</strong>
            </div>
            <div>
              <span>翻倍前</span>
              <strong>{settlement.huBeforeDealer}</strong>
            </div>
            <div>
              <span>幺数</span>
              <strong>{settlement.yao}</strong>
            </div>
            <div>
              <span>庄家倍数</span>
              <strong>×{settlement.dealerMultiplier}</strong>
            </div>
            <div>
              <span>本局分</span>
              <strong>{settlement.hu + settlement.yao * 10}</strong>
            </div>
          </div>
        ) : (
          <p>流局不结算分数</p>
        )}
        {settlement.breakdown.length > 0 ? (
          <ul className="breakdown">
            {settlement.breakdown.map((item, index) => (
              <li key={`${item.label}-${index}`}>
                {item.label} {item.hu}胡{item.yao ? ` ${item.yao}幺` : ''}
              </li>
            ))}
          </ul>
        ) : null}
        <table>
          <thead>
            <tr>
              <th>玩家</th>
              <th>胡</th>
              <th>幺</th>
              <th>本局</th>
              <th>累计</th>
            </tr>
          </thead>
          <tbody>
            {settlement.scores.map((item) => (
              <tr key={item.seat} className={item.seat === settlement.winnerSeat ? 'winner' : ''}>
                <td>
                  {item.nickname}
                  {item.isDealer ? ' 庄' : ''}
                  {item.piaoHun ? ' 飘' : ''}
                </td>
                <td>{item.hu ?? 0}</td>
                <td>{item.yao ?? 0}</td>
                <td className={item.delta > 0 ? 'up' : item.delta < 0 ? 'down' : ''}>
                  {item.delta > 0 ? `+${item.delta}` : item.delta}
                </td>
                <td>{item.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {settlement.scores.some((item) => item.notes && item.notes.length > 0) ? (
          <ul className="breakdown">
            {settlement.scores.flatMap((item) =>
              (item.notes ?? []).map((note, index) => (
                <li key={`${item.seat}-${index}`}>
                  {item.nickname} {note}
                </li>
              )),
            )}
          </ul>
        ) : null}
        <div className="split slim">
          <button type="button" className="btn-action primary" onClick={onAgain}>
            再来一局
          </button>
          {onLeave ? (
            <button type="button" className="btn-action ghost" onClick={onLeave}>
              回大厅
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
