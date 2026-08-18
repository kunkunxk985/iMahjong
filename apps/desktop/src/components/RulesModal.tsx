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
          <p>查胡：四家各自算胡/幺，两两结差。胡牌 +10 胡。1 胡 = 1 分，1 幺 = 10 分。庄只翻胡数，幺不翻。</p>
          <p>手里有三张相同牌时会提示“坎上”；只有确认坎上才计坎胡，三张牌随即锁定且不能拆打。未坎上的三张不计胡。坎后接别人第四张算送杠，自己摸到第四张算自杠。</p>
          <p>吃不算。落地碰算坎。没胡的人只计落地碰杠和暗刻，散对不算。胡的人再加将和手里拆出的暗刻。</p>
          <p>对子 1/2 胡，坎 2/4 胡 1 幺，送杠 4/8 胡 2 幺，自杠 6/12 胡 3 幺。</p>
          <p>飘荤（三或四坎杠）：胡 ×2，另收每家 30 荤底。三种包庄：四坎听顺、吃牌听顺、香牌。两对时可关门。</p>
          <p>开局四家第一张打同一张：流局并下庄。</p>
        </div>
        <button type="button" className="btn-action" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  );
}
