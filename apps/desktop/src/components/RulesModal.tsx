export function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal rules-modal" onClick={(event) => event.stopPropagation()}>
        <div className="gold-line" />

        <header className="rules-heading">
          <h2>邳州麻将 · 小白规则</h2>
          <p>先会出牌，再看查胡；带“本房房规”的项目，是为了让线上四人局始终有唯一裁决。</p>
          <div className="rules-legend" aria-label="规则来源图例">
            <span className="rule-chip source">公开规则</span>
            <span>主要参考友友互动公开的“友友邳州麻将”规则</span>
            <span className="rule-chip house">本房房规</span>
            <span>公开资料未明确或线上对局必须固定的细节</span>
          </div>
        </header>

        <div className="rules-body">
          <section className="rules-section">
            <h3><span>1</span> 先会打</h3>
            <ul className="rules-list">
              <li><b>牌：</b>共 120 张，万、筒、条各 36 张，中发白 12 张；不用风牌、花牌和癞子。</li>
              <li><b>发牌：</b>庄家 14 张先出，其余三家 13 张；之后按摸一张、打一张进行。</li>
              <li><b>吃碰杠：</b>只能吃上家的牌；中发白不能成顺。多人争同一张牌时，胡 &gt; 杠 &gt; 碰 &gt; 吃。</li>
              <li><b>杠：</b>手里三张遇别人打来的第四张可送杠；已“坎上”的三张由自己摸来第四张可自杠；杠后从牌尾补一张。</li>
              <li><b>起手杠：</b>起手已有四张相同牌，可以直接杠胡，也可以继续打。</li>
              <li>
                <b>轮庄：</b>庄家胡牌连庄；闲家胡牌或流局，下一局由庄家的下一家坐庄。
                <small className="rule-caveat">公开页原文是“如果不是庄家胡牌，则轮庄”；它没有单列流局，本项目按这句话的完整语义处理。</small>
              </li>
            </ul>
          </section>

          <section className="rules-section">
            <h3><span>2</span> 查胡计分表</h3>
            <p className="rules-section-intro">一局结束后四家分别查自己的牌，再进行 6 组两两比较。吃和顺子不计胡，胡牌者另加 10 胡。</p>
            <div className="rules-table-wrap">
              <table className="rules-score-table">
                <thead>
                  <tr>
                    <th>牌组</th>
                    <th>普通牌</th>
                    <th>幺头牌</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>对</td><td>1 胡</td><td>2 胡</td></tr>
                  <tr><td>碰</td><td>1 胡</td><td>2 胡</td></tr>
                  <tr><td>坎</td><td>2 胡</td><td>4 胡 + 1 幺</td></tr>
                  <tr><td>送杠</td><td>4 胡</td><td>8 胡 + 2 幺</td></tr>
                  <tr><td>自杠</td><td>6 胡</td><td>12 胡 + 3 幺</td></tr>
                </tbody>
              </table>
            </div>
            <p className="rule-footnote">幺头牌：一、九万筒条和中、发、白。幺头对子与碰只加胡，不加幺。</p>

            <div className="rule-callout">
              <b>最容易算漏：</b>没胡的人也要查手里的对子和暗坎。普通对 1 胡、幺头对 2 胡；普通暗坎 2 胡、幺头暗坎 4 胡 1 幺。胡牌结构中的将牌同样按“对”计胡。
            </div>
            <ul className="rules-list compact">
              <li>“坎上”是把三张相同牌锁成一组，方便进入飘荤、关门、包庄并继续自杠；<b>不是</b>暗坎取得基础胡数的前提。</li>
              <li>点炮补成三张时，该组按碰；自摸补成三张时，该组按坎。放炮与自摸本身不再附加倍率。</li>
              <li>赢家按合法的“四组一对”拆牌，每张牌只用一次；有多种合法拆法时，本房按当前积分配置取分值较高的一种。</li>
            </ul>
          </section>

          <section className="rules-section">
            <h3><span>3</span> 两两结算顺序</h3>
            <ol className="rules-steps">
              <li>先算每家的牌面胡数和幺数。</li>
              <li>庄家只把<b>自己的胡数 ×2</b>；飘荤者只把<b>自己的胡数 ×2</b>；同一人既庄又飘则自己的胡数 ×4。</li>
              <li>两家各自折算后再相减；幺数不翻倍，最后另算幺差。</li>
              <li>飘荤胡家再向另外三家各收 30 分荤底；包庄时由包庄者承担相应份额。</li>
            </ol>
            <div className="rule-formula" aria-label="结算公式">
              <code>某家折算胡 = 牌面胡 × 庄家倍率 × 飘荤倍率</code>
              <code>两两胡差 = A 折算胡 − B 折算胡</code>
            </div>
            <div className="rule-example">
              <b>例：飘荤闲家 17 胡，对庄家 6 胡</b>
              <span>先算 17×2=34、6×2=12，所以胡差是 34−12=<strong>22 胡</strong>。</span>
              <small>不是把原始差 11 胡整体乘 4。</small>
            </div>
          </section>

          <details className="rules-advanced" open>
            <summary>4 · 进阶：飘荤、关门与三种包庄</summary>
            <div className="rules-advanced-body">
              <p><b>飘荤：</b>已有三组碰、坎或杠且手里剩两对，或已有四组碰、坎或杠且手里剩单张后胡牌。飘荤者本人胡数 ×2，并另收每家 30 分荤底。</p>
              <p><b>关门：</b>四组完成后单钓会自动关门；三组碰、坎或杠后剩两对，可以主动关门。两对关门后若拆对换听，关门立即失效；关门本身不加胡。</p>
              <ol className="rules-bao-list">
                <li><b>四组单钓听顺：</b>四组都是碰、坎或杠，始终未换手中单张；别人打出的牌与该单张能组成顺子并点炮，按飘荤包庄。</li>
                <li><b>含吃单钓听顺：</b>四组中含吃，始终未换手中单张；别人打出的牌与该单张能组成顺子并点炮，按普通胡包庄。</li>
                <li><b>包香不包臭：</b>三组碰、坎或杠加两对，未两对关门时，被关门前全桌从未出现过的“香牌”点炮，按飘荤包庄；已经出现过的是“臭牌”，不包。</li>
              </ol>
              <p className="rule-footnote">包庄表示点炮者代付另外两家原本应向胡家支付的份额；若有荤底，三家的荤底也由包庄者承担。两对关门玩家免“包香”。</p>
            </div>
          </details>

          <section className="rules-section house-rules-section">
            <h3><span>5</span> 本房房规与实现边界</h3>
            <ul className="rules-list">
              <li><span className="rule-chip house">房规</span> 第一局由房主坐庄；牌墙摸完无人胡则流局且不结算。流局后的庄位按上文标明的实现解释处理。</li>
              <li><span className="rule-chip house">房规</span> 积分按 1 胡 = 1 分、1 幺 = 10 分；胡底与幺底以后可再做成房间配置。</li>
              <li><span className="rule-chip house">房规</span> 不设碰后补杠和抢杠胡；杠上开花按普通自摸，不额外加番。</li>
              <li><span className="rule-chip house">房规</span> 一炮多人可胡时，只取从出牌者起按行牌顺序最近的一家。</li>
              <li><span className="rule-chip house">房规</span> 四家开局第一张弃牌相同则直接流局；庄位仍按上文的实现解释处理。</li>
              <li><span className="rule-chip house">房规</span> 四张相同但未声明杠，查胡只按一坎加一张散牌；只有起手杠胡或已声明自杠才按自杠档计分。</li>
              <li><span className="rule-chip house">房规</span> 当前只支持“四组一对”和公开规则中的特殊包庄胡法，七对不作为胡型。</li>
            </ul>
          </section>

          <p className="rules-source-note">地方牌桌可能有不同口径。这里将公开资料能确认的规则与项目固定房规分开写明，实际线上对局以服务端和本页显示为唯一裁决。</p>
        </div>

        <button type="button" className="btn-action primary rules-close" onClick={onClose}>
          我知道了
        </button>
      </div>
    </div>
  );
}
