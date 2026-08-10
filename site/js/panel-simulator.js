/* 席次模擬器
 *
 * 本站存在的理由。它回答的問題是：
 *   「如果平埔族群納入原住民保障體系，席次數學會變成什麼樣？」
 *
 * 設計上的界線（design 決策三、四）：
 *   - 只暴露三個控制項。另兩個未決參數（是否計入原住民選舉人名冊、是否另立類別）
 *     寫成明示的固定假設，因為它們法制未決、使用者無從判斷該選什麼。
 *   - 「增額」與「113 席內重分配」不是參數而是【兩套不同的算式】。
 *     重分配是零和的，增額不是。把它藏起來等於代替使用者選了一種制度設計。
 *   - 初始狀態即現況，不預設任何立場。
 *   - 任何配置都不標示為建議或預期。輸出是使用者輸入的算術結果，不是主張。
 */

import { createPanel, fmt } from './panel.js';

/* 憲法增修條文第 4 條第 1 項：立法委員自第七屆起一百一十三人；
   第 2 款：自由地區平地原住民及山地原住民各三人。
   第 2 項的「依人口比例分配」只適用第一款（區域立委）——
   原住民席次是固定數額，這正是模擬器要讓使用者動的那個數字。
   來源見 data/sources.json 的 constitution-amendment-art4。 */
const STATUTORY = { total: 113, indigenous: 6, regional: 73 };

/* 有出處的兩個參照點。除此之外的任何數值都沒有官方或學術依據。
   限定條件必須完整寫出——「5 萬」若不說明是【西拉雅一族、第一年、自願登記】，
   讀者會把它當成平埔族群的總人口推估，那是全頁誤讀風險最高的一處。 */
const ANCHORS = [
  {
    value: 0,
    label: '0',
    caption: '目前官方登記數',
    nature: 'official-statistic',
    detail: '內政部戶政司自民國 114 年 11 月起在官方統計中預留平埔族群欄位，2026 年 6 月的值為 0。',
  },
  {
    value: 50000,
    label: '5 萬',
    caption: '西拉雅族第一年登記推估',
    nature: 'academic-estimate',
    detail: '⚠️ 僅涵蓋西拉雅【一族】的【第一年】，且登記為【自願】。'
      + '原住民族委員會主秘王美蘋轉述專家學者評估：「經專家學者評估，第一年預估會有 5 萬人登記，'
      + '不過還是要按照個人意願回復身分。」（中央社 2026-07-30）'
      + '因為登記出於個人意願，這個數字在結構上就不是人口推估——'
      + '它不會隨時間補齊到某個「真實的族群人口」。目前另有 8 族提出申請但尚未核定。',
  },
];

const state = {
  plains: 0,
  seats: STATUTORY.indigenous,
  method: 'reallocate',
};

/* 兩套算式。差別不在參數而在制度設計：
     reallocate 在固定的 113 席內移動席次，是零和的——原住民增一席，區域就少一席。
     expand 增加總席次，區域席次不變。
   哪一種都需要修法或修憲，本站不評價何者較佳。 */
function compute(seats, method) {
  if (method === 'expand') {
    const delta = seats - STATUTORY.indigenous;
    return { indigenous: seats, regional: STATUTORY.regional, total: STATUTORY.total + delta };
  }
  const delta = seats - STATUTORY.indigenous;
  return { indigenous: seats, regional: STATUTORY.regional - delta, total: STATUTORY.total };
}

function pct(n, d) {
  return d === 0 ? 0 : (n * 100) / d;
}

function anchorMarkup() {
  return ANCHORS.map((a) => `
    <div class="anchor" data-nature="${a.nature}">
      <p class="anchor-head"><strong>${a.label}</strong> ${a.caption}</p>
      <p class="anchor-detail">${a.detail}</p>
    </div>`).join('');
}

function render(container, [popData]) {
  /* 全國現況。分子分母同一份資料、同一基準日——避免跨機關的口徑落差。 */
  let indigenousNow = 0;
  let populationNow = 0;
  for (const r of popData.data) {
    indigenousNow += r.indigenous_total;
    populationNow += r.population_total;
  }

  const root = document.createElement('div');
  root.className = 'sim';
  root.innerHTML = `
    <div class="sim-controls">
      <div class="sim-control">
        <label for="sim-plains">平埔族群納入人口數</label>
        <input type="range" id="sim-plains" min="0" max="${indigenousNow}" step="1000" value="0">
        <output id="sim-plains-out">0 人</output>
        <p class="sim-scale-note" id="sim-plains-scale"></p>
        <div class="sim-anchors">${anchorMarkup()}</div>
        <p class="sim-caption">
          滑桿上限為 ${fmt(indigenousNow)} 人。選這個數字的理由只有一個——
          <strong>它是目前原住民族人口，是一個有出處的真實數字，方便當量級參照</strong>。
          它不代表平埔族群人口的推估、上限或合理範圍。
          除了上面標出的兩個點以外，滑桿上的任何數值都沒有官方或學術依據。
        </p>
      </div>

      <div class="sim-control">
        <label for="sim-seats">原住民保障席次</label>
        <input type="range" id="sim-seats" min="0" max="20" step="1" value="${STATUTORY.indigenous}">
        <output id="sim-seats-out">${STATUTORY.indigenous} 席</output>
        <div class="sim-anchors">
          <div class="anchor" data-nature="official-statistic">
            <p class="anchor-head"><strong>${STATUTORY.indigenous} 席</strong> 現行席次</p>
            <p class="anchor-detail">
              憲法增修條文第 4 條第 1 項第 2 款：「自由地區平地原住民及山地原住民各三人」。
              這是固定數額，不隨人口調整；變更需要修憲。
            </p>
          </div>
        </div>
        <p class="sim-caption">
          這條滑桿只有「現行 ${STATUTORY.indigenous} 席」一個有依據的點，其餘範圍純為操作空間、無制度依據。
          <br>
          ⚠️ 上限 20 是任意設定。現況 ${STATUTORY.indigenous} 席因此落在偏左，
          幾何上看起來像是在暗示「往上調」。改成以現況為中心的對稱範圍同樣不中立——
          那會暗示「減少席次」與「增加席次」是同等可能的選項，而減少需要修憲推翻既有保障。
          兩種做法都帶有立場，這裡選擇把它講明而不是假裝解決。
        </p>
      </div>

      <fieldset class="sim-control">
        <legend>席次來源</legend>
        <label class="sim-radio">
          <input type="radio" name="sim-method" value="reallocate" checked>
          <span>在 113 席內重分配</span>
        </label>
        <label class="sim-radio">
          <input type="radio" name="sim-method" value="expand">
          <span>增額至 113 席以上</span>
        </label>
        <p class="sim-caption">
          這兩者不是同一個算式。重分配是<strong>零和</strong>的——原住民增一席，區域立委就少一席；
          增額則是總席次變多、區域席次不變。兩者都需要修法或修憲。
          本站不評價何者較佳，只呈現各自的算術結果。
        </p>
      </fieldset>
    </div>

    <div class="sim-output" id="sim-output"></div>
  `;
  container.append(root);

  const plainsInput = root.querySelector('#sim-plains');
  const seatsInput = root.querySelector('#sim-seats');
  const plainsOut = root.querySelector('#sim-plains-out');
  const seatsOut = root.querySelector('#sim-seats-out');
  const output = root.querySelector('#sim-output');

  function update() {
    state.plains = Number(plainsInput.value);
    state.seats = Number(seatsInput.value);
    state.method = root.querySelector('input[name="sim-method"]:checked').value;

    plainsOut.textContent = `${fmt(state.plains)} 人`;
    seatsOut.textContent = `${state.seats} 席`;

    /* 量級關係在整條滑桿上都看得到，而不是只有端點被貼上一句敘事。 */
    const scaleNote = root.querySelector('#sim-plains-scale');
    scaleNote.textContent = state.plains === 0
      ? '相當於現有原住民族人口的 0%'
      : `相當於現有原住民族人口（${fmt(indigenousNow)} 人）的 ${pct(state.plains, indigenousNow).toFixed(1)}%`;

    const seatsResult = compute(state.seats, state.method);
    /* 分母不變：平埔族人本來就是既有國民，取得身分不會改變全國人口。
       只有分子（原住民人口）增加。 */
    const indigenous = indigenousNow + state.plains;
    const seatShare = pct(seatsResult.indigenous, seatsResult.total);
    const popShare = pct(indigenous, populationNow);
    const gap = seatShare - popShare;

    const isStatusQuo = state.plains === 0 && state.seats === STATUTORY.indigenous;

    /* 與現況的差值。兩種算法各自的代價都要一樣明顯——
       重分配讓區域立委減少、增額讓總席次膨脹，兩者都有人會反對。
       只顯示其中一邊的變動等於把另一邊的代價藏起來。 */
    const delta = (now, base) => {
      const d = now - base;
      if (d === 0) return '';
      return `<span class="sim-delta" data-dir="${d > 0 ? 'up' : 'down'}">${d > 0 ? '＋' : '−'}${Math.abs(d)}</span>`;
    };

    /* 「超額代表」帶價值判斷，改用中性描述讓讀者自行判斷
       這是保障的成效還是過度。 */
    const gapPhrase = Math.abs(gap) < 0.005
      ? '席次占比與人口占比相同'
      : `席次占比${gap > 0 ? '高於' : '低於'}人口占比 ${Math.abs(gap).toFixed(2)} 個百分點`;

    output.innerHTML = `
      <table class="sim-table">
        <caption>
          ${isStatusQuo ? '現況' : '模擬結果'}
          ${isStatusQuo ? '' : '<span class="sim-badge">依你輸入的參數計算，不構成制度主張</span>'}
        </caption>
        <tbody>
          <tr><th>原住民保障席次</th><td>${seatsResult.indigenous} 席 ${delta(seatsResult.indigenous, STATUTORY.indigenous)}</td></tr>
          <tr><th>區域立委席次</th><td>${seatsResult.regional} 席 ${delta(seatsResult.regional, STATUTORY.regional)}</td></tr>
          <tr><th>立法院總席次</th><td>${seatsResult.total} 席 ${delta(seatsResult.total, STATUTORY.total)}</td></tr>
          <tr class="sim-row-key"><th>席次占比</th><td>${seatShare.toFixed(2)}%</td></tr>
          <tr><th>原住民族人口</th><td>${fmt(indigenous)} 人 ${delta(indigenous, indigenousNow)}</td></tr>
          <tr><th>全國人口</th><td>${fmt(populationNow)} 人</td></tr>
          <tr class="sim-row-key"><th>人口占比</th><td>${popShare.toFixed(2)}%</td></tr>
        </tbody>
      </table>
      <p class="sim-gap">${gapPhrase}。</p>
      ${isStatusQuo ? '' : `<p class="sim-cost">
        此配置相對於現況的變動：${state.method === 'reallocate'
    ? `區域立委由 ${STATUTORY.regional} 席減為 ${seatsResult.regional} 席，立法院總席次不變。`
    : `立法院總席次由 ${STATUTORY.total} 席增為 ${seatsResult.total} 席，區域立委席次不變。`}
      </p>`}
    `;
  }

  root.querySelectorAll('input').forEach((el) => el.addEventListener('input', update));
  update();
}

export const simulatorPanel = createPanel({
  el: '[data-role="simulator"]',
  sources: () => ['processed/population-by-county.json'],
  render,
});
