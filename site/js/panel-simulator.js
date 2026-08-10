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
import { traceable } from './provenance.js';

/* 憲法增修條文第 4 條第 1 項：立法委員自第七屆起一百一十三人；
   第 2 款：自由地區平地原住民及山地原住民各三人。
   第 2 項的「依人口比例分配」只適用第一款（區域立委）——
   原住民席次是固定數額，這正是模擬器要讓使用者動的那個數字。
   來源見 data/sources.json 的 constitution-amendment-art4。 */
const STATUTORY = { total: 113, indigenous: 6, regional: 73, party: 34 };

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
  basis: 'population',
};

/* 兩套算式。差別不在參數而在制度設計：
     reallocate 在固定的 113 席內移動席次，是零和的——原住民增一席，區域就少一席。
     expand 增加總席次，區域席次不變。
   哪一種都需要修法或修憲，本站不評價何者較佳。 */
function compute(seats, method) {
  const delta = seats - STATUTORY.indigenous;
  /* 不分區及僑居國外立委 34 席在兩種算法下都不變。
     重分配時的席次是從區域立委移轉——這是一個【假設】而非唯一可能，
     理論上也可以從不分區移轉。此假設已列入固定假設清單。 */
  if (method === 'expand') {
    return {
      indigenous: seats,
      regional: STATUTORY.regional,
      party: STATUTORY.party,
      total: STATUTORY.total + delta,
    };
  }
  return {
    indigenous: seats,
    regional: STATUTORY.regional - delta,
    party: STATUTORY.party,
    total: STATUTORY.total,
  };
}

function pct(n, d) {
  return d === 0 ? 0 : (n * 100) / d;
}

/* 議會席次圖：手寫 SVG（design 決策七——113 個小方塊用任何圖表函式庫都比手寫麻煩）。
   半圓形排列，內圈到外圈依半徑分配席次數。 */
function hemicycle(indigenous, regional, other, t) {
  const total = indigenous + regional + other;
  const ROWS = 6;
  const R_INNER = 42;
  const R_OUTER = 100;

  /* 每一圈的席次數與其半徑成正比，這樣座位密度在各圈大致相同。 */
  const radii = Array.from({ length: ROWS }, (_, i) => R_INNER + ((R_OUTER - R_INNER) * i) / (ROWS - 1));
  const weight = radii.reduce((s, r) => s + r, 0);
  const perRow = radii.map((r) => Math.max(1, Math.round((total * r) / weight)));
  /* 四捨五入會讓總和偏離，把差額補在最外圈。 */
  perRow[ROWS - 1] += total - perRow.reduce((s, n) => s + n, 0);

  const seats = [];
  radii.forEach((r, row) => {
    const n = perRow[row];
    for (let i = 0; i < n; i += 1) {
      /* 由左（π）掃到右（0）。單一席次的圈置中。 */
      const frac = n === 1 ? 0.5 : i / (n - 1);
      const angle = Math.PI - frac * Math.PI;
      seats.push({
        x: 110 + r * Math.cos(angle),
        y: 108 - r * Math.sin(angle),
        /* 排序鍵用【角度】而非 x 座標。用 x 排序會讓同一黨團的席次
           變成左緣的垂直長條；議會座位圖的慣例是沿弧線分區，
           故同一角度的各圈席次要相鄰。 */
        angle,
      });
    }
  });

  /* 由左而右上色：原住民、區域、其他（不分區及僑居）。
     順序固定，不隨數量變動而重新配色。 */
  seats.sort((a, b) => (b.angle - a.angle) || (a.y - b.y));
  const colors = [
    ...Array(indigenous).fill({ fill: t.dark ? '#3987e5' : '#2a78d6', label: '原住民保障席次' }),
    ...Array(regional).fill({ fill: t.dark ? '#d95926' : '#eb6834', label: '區域立委' }),
    ...Array(other).fill({ fill: t.context, label: '不分區及僑居國外立委' }),
  ];

  const dots = seats.map((s, i) => {
    const c = colors[i] ?? { fill: t.context, label: '' };
    return `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="3.1" fill="${c.fill}"><title>${c.label}</title></circle>`;
  }).join('');

  return `<svg viewBox="0 0 220 120" role="img" class="hemicycle"
    aria-label="立法院 ${total} 席座位圖：原住民保障席次 ${indigenous} 席、區域立委 ${regional} 席、不分區及僑居國外立委 ${other} 席">
    ${dots}
  </svg>`;
}

/* 法制時間軸。
 *
 * 這一段在四面板改版時一度掉了——原本是可行性研究 F 節的獨立區塊，
 * 轉成儀表板後沒有對應的位置。併入模擬器是對的：時間軸的作用本來就是
 * 解釋「席次問題為何是待決事項」，跟模擬器是同一個論述。
 *
 * 每個節點都連到一手來源。距期限的間隔是重點——上一次立法逼到剩 5 天，
 * 這件事說明立法是被憲法期限推著走的，也預示 2028 年那次可能同樣拖到最後。
 */
const TIMELINE = [
  {
    date: '2022-06-28',
    title: '憲法法庭言詞辯論',
    body: '111 年憲判字第 17 號（西拉雅族原住民身分案）。',
    href: 'https://cons.judicial.gov.tw/docdata.aspx?fid=38&id=310021',
  },
  {
    date: '2022-10-28',
    title: '憲判 17 號宣示，三年期限起算',
    body: '認定原住民身分法第 2 條未涵蓋其他臺灣原住民族，違反憲法第 22 條，'
      + '命相關機關於 3 年內修法或另定特別法。⚠️ 判決聚焦身分認定，未觸及政治參與或席次。',
    href: 'https://cons.judicial.gov.tw/docdata.aspx?fid=38&id=310021',
    deadline: '期限至 2025-10-28',
  },
  {
    date: '2025-10-17',
    title: '立法院三讀《平埔原住民族群身分法》',
    body: '距憲法期限剩 11 天。',
    href: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0130053',
    gap: '距期限 11 天',
  },
  {
    date: '2025-10-23',
    title: '總統公布施行，全文 24 條',
    body: '距憲法期限剩 5 天。第 22 條使文化類權利立即適用；'
      + '第 23 條把政治參與留給三年內的後續立法。',
    href: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0130053',
    gap: '距期限 5 天',
  },
  {
    date: '2026-07-30',
    title: '行政院核定西拉雅族為第 17 族',
    body: '平埔族群首例。身分登記自 2026 年 8 月中開始。另有 8 族已提出申請。',
    href: 'https://www.cip.gov.tw/',
  },
  {
    date: '2028-10-23',
    title: '第 23 條立法期限',
    body: '政府應於身分法施行後三年內，制定或修正相關法律保障平埔族群的'
      + '政治參與、交通水利、衛生醫療、經濟土地及社會福利等權利。'
      + '⚠️ 條文未指定政治參與的形式。',
    href: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0130053',
    future: true,
  },
];

function timelineMarkup() {
  const items = TIMELINE.map((e) => `
    <li class="tl-item${e.future ? ' tl-future' : ''}">
      <time datetime="${e.date}">${e.date}</time>
      <div class="tl-body">
        <p class="tl-title">
          <a href="${e.href}" rel="noopener" target="_blank">${e.title}</a>
          ${e.gap ? `<span class="tl-gap">${e.gap}</span>` : ''}
          ${e.deadline ? `<span class="tl-deadline">${e.deadline}</span>` : ''}
        </p>
        <p class="tl-text">${e.body}</p>
      </div>
    </li>`).join('');
  return `
    <section class="timeline">
      <h3>為什麼席次是一個待決問題</h3>
      <ol class="tl-list">${items}</ol>
      <p class="tl-note">
        上一次立法逼到距憲法期限剩 <strong>5 天</strong>才完成。
        下一個期限是 <strong>2028 年 10 月 23 日</strong>，關於平埔族群政治參與的立法
        目前尚未提出。各節點皆可點擊至全國法規資料庫或憲法法庭原文。
      </p>
    </section>`;
}

function anchorMarkup() {
  return ANCHORS.map((a) => `
    <div class="anchor" data-nature="${a.nature}">
      <p class="anchor-head"><strong>${a.label}</strong> ${a.caption}</p>
      <p class="anchor-detail">${a.detail}</p>
    </div>`).join('');
}

function theme() {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return { dark, context: dark ? '#6b675c' : '#a09a8f' };
}

function render(container, [popData, elections]) {
  const t = theme();
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

    <div class="sim-basis">
      <span class="sim-basis-label">代表性的分母：</span>
      <label class="sim-radio-inline">
        <input type="radio" name="sim-basis" value="population" checked><span>人口</span>
      </label>
      <label class="sim-radio-inline">
        <input type="radio" name="sim-basis" value="electors"><span>選舉人</span>
      </label>
    </div>

    <div class="sim-output" id="sim-output"></div>

    <details class="sim-assumptions">
      <summary>本模擬固定不變的假設（3 項）</summary>
      <ol>
        <li>
          <strong>平埔原住民計入原住民立委選舉人名冊。</strong>
          《平埔原住民族群身分法》沒有規定這件事。取得原住民身分是否等同取得
          原住民立委的選舉權，屬於第 23 條所稱「政治參與」的立法範圍，尚未決定。
        </li>
        <li>
          <strong>不另立席次類別，平埔族群併入現行原住民保障席次。</strong>
          現行制度分山地原住民、平地原住民各 3 席。平埔族群是併入這兩類、
          自成第三類、或另有安排，法律未定。
        </li>
        <li>
          <strong>「113 席內重分配」時席次從區域立委移轉。</strong>
          理論上也可以從不分區及僑居國外立委（34 席）移轉。本模擬固定為前者，
          因為區域席次與人口比例掛鉤，是討論代表性時的自然對照；
          但這是本站的選擇，不是法律規定。
        </li>
      </ol>
      <p class="sim-undetermined">
        <strong>更根本的一點：</strong>《平埔原住民族群身分法》全文 24 條
        <strong>沒有出現「選舉」「被選舉」「保障席次」「民意代表」任何一個詞</strong>。
        第 23 條要求政府於 2028 年 10 月 23 日前就平埔族群的「政治參與」立法，
        但未指定形式——政治參與可以是投票權、參選權、諮詢機制，
        <strong>不必然是保障席次</strong>。憲法法庭 111 年憲判字第 17 號同樣
        只處理身分認定，未觸及席次。保障席次只是諸多可能形式中的一種；
        這個模擬器呈現的是「若採取這個形式，數字會如何」，不是「法律將會如此」。
      </p>
    </details>
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

    state.basis = root.querySelector('input[name="sim-basis"]:checked').value;

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

    /* 選舉人基數。
       ⚠️ 不能拿 2026-06 的人口占比（2.74%）直接對上 2024 的選舉人占比（2.25%）——
       那會把「年份差異」和「基數差異」混成一團。要看基數的影響，兩邊都必須用
       同一年的資料，故此處固定用 2024 年中選會的數字並明說。
       ⚠️ 選舉人檢視【不模擬】平埔納入：登記者中有多少達投票年齡是未知數，
       套用現有原住民的選舉人／人口比會是憑空推估。 */
    const e2024 = elections.data.find((r) => r.年 === 2024);
    let basisNote = '';
    if (state.basis === 'electors' && e2024) {
      const electorTotal = e2024.原民選舉人數 + e2024.區域選舉人數;
      const electorShare = pct(e2024.原民選舉人數, electorTotal);
      const popShare2024 = e2024.人口占比_pct;
      basisNote = `
        <div class="sim-basis-note">
          <h4>以選舉人為分母（2024 年，中央選舉委員會）</h4>
          <table class="sim-table">
            <tbody>
              <tr><th>原住民選舉人數</th><td>${fmt(e2024.原民選舉人數)} 人</td></tr>
              <tr><th>區域選舉人數</th><td>${fmt(e2024.區域選舉人數)} 人</td></tr>
              <tr class="sim-row-key"><th>選舉人占比</th><td>${electorShare.toFixed(2)}%</td></tr>
              <tr class="sim-row-key"><th>同年的人口占比</th><td>${popShare2024.toFixed(2)}%</td></tr>
            </tbody>
          </table>
          <p>
            <strong>這個選擇不中立。</strong>同樣是 2024 年的資料，用人口當分母得到
            ${popShare2024.toFixed(2)}%，用選舉人得到 ${electorShare.toFixed(2)}%，
            相差 ${Math.abs(popShare2024 - electorShare).toFixed(2)} 個百分點。
            原因是原住民人口的未成年比例較高——原住民選舉人占其人口
            ${pct(e2024.原民選舉人數, e2024.原民人口).toFixed(1)}%，
            區域為 ${pct(e2024.區域選舉人數, e2024.區域人口).toFixed(1)}%。
            <strong>用人口當分母對原住民較有利，用選舉人較不利。</strong>
            本站主圖用人口，因為憲法增修條文第 4 條第 2 項的席次分配依據是人口；
            但這是一個選擇，不是唯一正解。
          </p>
          <p class="sim-basis-caveat">
            ⚠️ 兩個數字都是 2024 年——不可拿上方 2026 年 6 月的人口占比與此處的
            選舉人占比直接相比，那會把年份差異和基數差異混在一起。
            <br>
            ⚠️ 此檢視<strong>不模擬</strong>平埔族群納入。登記者中有多少人達投票年齡是未知數，
            套用現有原住民的選舉人比例會是憑空推估。
          </p>
        </div>`;
    }

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
      ${state.seats === STATUTORY.indigenous ? '' : `<p class="sim-cost">
        此配置相對於現況的變動：${state.method === 'reallocate'
    ? `區域立委由 ${STATUTORY.regional} 席減為 ${seatsResult.regional} 席，立法院總席次不變。`
    : `立法院總席次由 ${STATUTORY.total} 席增為 ${seatsResult.total} 席，區域立委席次不變。`}
      </p>`}
      <figure class="sim-figure">
        ${hemicycle(seatsResult.indigenous, seatsResult.regional, seatsResult.party, t)}
        <figcaption>
          立法院 ${seatsResult.total} 席
          <span class="sim-key"><i style="background:${t.dark ? '#3987e5' : '#2a78d6'}"></i>原住民 ${seatsResult.indigenous}</span>
          <span class="sim-key"><i style="background:${t.dark ? '#d95926' : '#eb6834'}"></i>區域 ${seatsResult.regional}</span>
          <span class="sim-key"><i style="background:${t.context}"></i>不分區及僑居 ${seatsResult.party}</span>
        </figcaption>
      </figure>
      ${basisNote}
    `;

    /* 兩個關鍵占比可查來源。席次占比來自憲法（固定數額），
       人口占比是本站計算——性質不同，點開就看得出來。 */
    const seatCell = [...output.querySelectorAll('tr')]
      .find((tr) => tr.querySelector('th')?.textContent === '席次占比')?.querySelector('td');
    if (seatCell) {
      seatCell.textContent = '';
      seatCell.append(traceable(`${seatShare.toFixed(2)}%`, {
        sourceId: 'constitution-amendment-art4',
        field: '席次占比（保障席次 ÷ 總席次）',
        nature: 'derived-by-this-project',
      }));
    }
    const popCell = [...output.querySelectorAll('tr')]
      .find((tr) => tr.querySelector('th')?.textContent === '人口占比')?.querySelector('td');
    if (popCell) {
      popCell.textContent = '';
      popCell.append(traceable(`${popShare.toFixed(2)}%`, {
        sourceId: popData._sourceId,
        field: '人口占比（原住民人口 ÷ 全國人口）',
        nature: popData._fieldNature.indigenous_ratio_pct,
      }));
    }
  }

  root.querySelectorAll('input').forEach((el) => el.addEventListener('input', update));
  update();
}

export const timelinePanel = createPanel({
  el: '[data-role="timeline"]',
  sources: () => [],
  render: (container) => { container.innerHTML = timelineMarkup(); },
});

export const simulatorPanel = createPanel({
  el: '[data-role="simulator"]',
  sources: () => [
    'processed/population-by-county.json',
    'processed/legislative-representation.json',
  ],
  render,
});
