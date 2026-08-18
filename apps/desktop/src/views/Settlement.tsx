import type { Settlement } from '@pizhou/shared';

const WIN_LABEL: Record<string, string> = {
  'ping-hu': '平胡',
  'qidong-gang-hu': '起手杠胡',
  liuju: '流局',
};

export function SettlementModal({
  settlement,
  onAgain,
  readyCount,
}: {
  settlement: Settlement;
  onAgain: () => void;
  readyCount: number;
}) {
  return (
    <div className="overlay">
      <div className="settlement">
        <div className="gold-line" />
        <h2>{settlement.liuju ? '流局' : `${settlement.winnerNickname ?? '玩家'} 胡牌`}</h2>
        <p className="sub">{WIN_LABEL[settlement.winType] ?? settlement.winType}</p>
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
              <span>最终分数</span>
              <strong>{settlement.hu + settlement.yao}</strong>
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
              <th>变化</th>
              <th>总分</th>
            </tr>
          </thead>
          <tbody>
            {settlement.scores.map((item) => (
              <tr key={item.seat} className={item.seat === settlement.winnerSeat ? 'winner' : ''}>
                <td>{item.nickname}</td>
                <td className={item.delta > 0 ? 'up' : item.delta < 0 ? 'down' : ''}>
                  {item.delta > 0 ? `+${item.delta}` : item.delta}
                </td>
                <td>{item.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="btn-action primary wide" onClick={onAgain}>
          再来一局
        </button>
      </div>
    </div>
  );
}
