export function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="gold-line" />
        <h2>邳州麻将规则</h2>
        <div className="rules-body">
          <p>120 张：万、筒、条各 36 张，中发白 12 张。不用风牌、花牌、癞子。</p>
          <p>四人，房主第一局坐庄。庄家胡或流局连庄，闲家胡则顺时针轮庄。</p>
          <p>庄家起手 14 张先出，其余 13 张。牌墙摸完无人胡则流局，流局不结算。</p>
          <p>操作优先级：胡 &gt; 杠 &gt; 碰 &gt; 吃。只能吃上家。中发白不能成顺。</p>
          <p>支持暗杠、明杠、补杠。杠后从牌尾补牌。一局只胡一家。</p>
          <p>起手有杠可选择直接胡，也可继续打。</p>
          <p>胡牌固定 10 胡。对子 1/2 胡，坎 2/4 胡 1 幺，明杠 4/8 胡 2 幺，暗杠或自杠 6/12 胡 3 幺。</p>
          <p>1 胡 = 1 分，1 幺 = 1 分。庄家只翻胡数。吃和明碰不计分。</p>
        </div>
        <button type="button" className="btn-action" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  );
}
