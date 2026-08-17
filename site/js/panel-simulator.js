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

/* 有出處的兩個參照點：官方登記數（隨資料變動）與學術推估（固定引用）。
   除此之外的任何數值都沒有官方或學術依據。限定條件必須完整寫出——
   「5 萬」若不說明是【西拉雅一族、第一年、自願登記】，讀者會把它當成平埔族群的
   總人口推估，那是全頁誤讀風險最高的一處。 */

/* 官方參照點的數值、標籤與說明都由載入的資料導出，不寫死。
   寫死的「目前登記數為 0」在首批登記出現後就會與人口面板互相矛盾，
   而它不會自己失效——見 design 決策二。 */
function officialAnchor(registered) {
  return {
    value: registered,
    label: fmt(registered),
    caption: '目前官方登記數',
    nature: 'official-statistic',
    /* 這個數字隨載入資料變動，故須比照站台其他數字掛上來源與期別；
       只讓數值動態、說明仍寫死期別，就會變成溯源與數字不一致——見 design 決策六。 */
    traceField: '已登記平埔原住民人口',
    detail: registered > 0
      ? '內政部戶政司自民國 114 年 11 月起在官方統計中預留平埔族群欄位。'
        + `本期載入的資料中，已登記的平埔原住民為 ${fmt(registered)} 人。`
      : '內政部戶政司自民國 114 年 11 月起在官方統計中預留平埔族群欄位。'
        + '本期載入的資料中該欄位為 0——是「尚無人登記」，不是「沒有這個統計類別」。',
  };
}

const ESTIMATE_ANCHORS = [
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

function anchorsFor(registered) {
  return [officialAnchor(registered), ...ESTIMATE_ANCHORS];
}

const state = {
  /* 初始值在 render 時依載入資料覆寫為已登記平埔人口。這裡的 0 只是模組載入時的
     佔位，不是「現況為零」的主張。 */
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
  /* 收合但不隱藏：summary 自己就帶著「這是待決問題」與下一個期限，
     所以不展開也讀得到框架；展開才是六個節點的細節。
     節點數與期限日期由資料推導，新增節點時不必回頭改這行。 */
  const deadline = TIMELINE.find((e) => e.future);
  return `
    <details class="timeline-wrap">
      <summary>
        <h3>為什麼席次是一個待決問題</h3>
        <span class="tl-summary-hint">
          憲法法庭要求修法，下一個期限 ${deadline ? deadline.date : '未定'}
          ——共 ${TIMELINE.length} 個節點
        </span>
      </summary>
      <section class="timeline">
        <ol class="tl-list">${items}</ol>
        <p class="tl-note">
          上一次立法逼到距憲法期限剩 <strong>5 天</strong>才完成。
          下一個期限是 <strong>2028 年 10 月 23 日</strong>，關於平埔族群政治參與的立法
          目前尚未提出。各節點皆可點擊至全國法規資料庫或憲法法庭原文。
        </p>
      </section>
    </details>`;
}

function anchorMarkup(anchors) {
  return anchors.map((a) => `
    <div class="anchor" data-nature="${a.nature}">
      <p class="anchor-head"><strong${a.traceField ? ` data-role="anchor-official"` : ''}>${a.label}</strong> ${a.caption}</p>
      <p class="anchor-detail">${a.detail}</p>
    </div>`).join('');
}

function theme() {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return { dark, context: dark ? '#6b675c' : '#a09a8f' };
}

/* 固定假設第 2 條的量化對照。
 *
 * 為什麼需要：那條假設說「平埔族群是併入現行兩類、自成第三類、或另有安排，法律未定」，
 * 但本模擬器的算式採用其中一種（併入 6 席共同分攤），而那恰好是三者中效果最小的。
 * 只用文字說「法律未定」，讀者無從知道這個選擇改變了多少答案。
 *
 * 平埔族群按定義是【平地】原住民，因此「全部落在平原 3 席」不是三個選項中最牽強的，
 * 可能還是最自然的。以本站採用的 5 萬人推估計算，兩者的每席選民增幅差約兩倍。
 *
 * 用選舉人數而非人口數：席次分配的代表性比較在選舉人這個基數上才對得起來，
 * 且 CEC 的分類選舉人數是官方統計。⚠️ 這裡把 5 萬【當作選舉人】加入，
 * 是為了呈現兩種假設的相對差距，不是主張那 5 萬人都有投票權——
 * 登記者中有多少人達投票年齡是未知數，這一點在下方文案中明說。
 */
function assumptionContrast(byCategory, plainsEstimate) {
  const latest = Math.max(...byCategory.map((r) => r.年));
  const pick = (k) => byCategory.find((r) => r.年 === latest && r.類別 === k);
  const shan = pick('山原');
  const ping = pick('平原');
  if (!shan || !ping || !plainsEstimate) return null;

  const bothSeats = shan.席次 + ping.席次;
  const bothVoters = shan.選舉人數 + ping.選舉人數;
  const perSeatNow = bothVoters / bothSeats;
  const perSeatMerged = (bothVoters + plainsEstimate) / bothSeats;
  const perSeatPingOnly = (ping.選舉人數 + plainsEstimate) / ping.席次;

  return {
    year: latest,
    shanSeats: shan.席次,
    pingSeats: ping.席次,
    shanPerSeat: shan.每席選舉人數,
    pingPerSeat: ping.每席選舉人數,
    mergedPct: (perSeatMerged / perSeatNow - 1) * 100,
    pingOnlyPct: (perSeatPingOnly / (ping.選舉人數 / ping.席次) - 1) * 100,
    estimate: plainsEstimate,
  };
}

function render(container, [popData, elections, byCategoryData]) {
  const t = theme();
  /* 全國現況。分子分母同一份資料、同一基準日——避免跨機關的口徑落差。 */
  let indigenousNow = 0;
  let populationNow = 0;
  /* 官方統計中【已登記】的平埔人口。轉檔的 indigenous_total 定義為
     山地＋平地＋平埔，所以這些人已經在 indigenousNow 裡面了。
     滑桿代表「納入保障體系的平埔人口總數」而非增量，故計算基數時必須先扣除，
     否則已登記者會被算兩次——見 design 決策一。
     欄位不存在時（平埔欄位出現之前的歷史期別）以 0 計，行為與欄位存在且為 0 相同。 */
  let pingpuRegistered = 0;
  for (const r of popData.data) {
    indigenousNow += r.indigenous_total;
    populationNow += r.population_total;
    pingpuRegistered += r.indigenous_pingpu ?? 0;
  }
  /* 不含平埔的原住民人口。滑桿值加在這上面，才不會與已登記者重複。 */
  const indigenousExcludingPingpu = indigenousNow - pingpuRegistered;

  /* 現況＝把官方已登記的平埔人口納入。滑桿歸零代表「不納入已登記者」的反事實情境，
     不是現況——見 design 決策五。
     滑桿初始值只寫在下面的標記裡：update() 一律從 DOM 讀值，這裡再設一次 state.plains
     會變成第二個真相來源，兩者一旦不同步就很難查。 */
  const anchors = anchorsFor(pingpuRegistered);

  /* 固定假設第 2 條的量化對照。資料缺任一項就整段不顯示——寧可少一段說明，
     也不要顯示算不完整的對照數字。 */
  const estimateAnchor = ESTIMATE_ANCHORS.find((a) => a.nature === 'academic-estimate');
  const contrast = assumptionContrast(byCategoryData?.data ?? [], estimateAnchor?.value);
  const contrastMarkup = contrast ? `
    <div class="sim-contrast">
      <p class="sim-contrast-head">
        這個選擇改變多少答案（以 ${contrast.year} 年選舉人數與
        ${estimateAnchor.label}人推估計算）
      </p>
      <ul>
        <li>
          <strong>併入 6 席共同分攤</strong>——本模擬採用的算法。
          每席原民選民增加 <span data-role="contrast-merged">${contrast.mergedPct.toFixed(1)}%</span>。
        </li>
        <li>
          <strong>全部落在平原 ${contrast.pingSeats} 席</strong>——平埔族群按定義是平地原住民。
          每席平原選民增加 <span data-role="contrast-ping">${contrast.pingOnlyPct.toFixed(1)}%</span>，
          山原每席 ${fmt(Math.round(contrast.shanPerSeat))} 人不變。
        </li>
        <li>
          <strong>自成第三類</strong>——需要新的席次數，現行 ${contrast.shanSeats + contrast.pingSeats} 席不變。
        </li>
      </ul>
      <p class="sim-contrast-note">
        三者都在法律的可能範圍內，本站無從判斷何者會成立；列出來是因為
        <strong>選哪一個會讓答案差約兩倍</strong>，而模擬器只能採用其中一種。
        ⚠️ 此對照把推估人數當作選舉人計算，僅為呈現兩種假設的相對差距——
        登記者中有多少人達投票年齡是未知數，見上方「代表性的分母」切換至選舉人時的說明。
      </p>
    </div>` : '';

  const root = document.createElement('div');
  root.className = 'sim';
  root.innerHTML = `
    <div class="sim-basis">
      <span class="sim-basis-label">代表性的分母：</span>
      <label class="sim-radio-inline">
        <input type="radio" name="sim-basis" value="population" checked><span>人口</span>
      </label>
      <label class="sim-radio-inline">
        <input type="radio" name="sim-basis" value="electors"><span>選舉人</span>
      </label>
    </div>

    <!-- 結果放在控制項【之前】：初始狀態即為現況，所以這一區在使用者還沒動任何
         東西時就已經是有意義的內容——它是「現在的制度長什麼樣」。把它放在三段
         控制項與說明之後，會讓讀者滾過一屏才看到本面板真正的輸出。 -->
    <div class="sim-output" id="sim-output"></div>

    <div class="sim-controls">
      <div class="sim-control">
        <label for="sim-plains">平埔族群納入人口數</label>
        <!-- step 為 1：已登記平埔人口不必然是千的倍數（首批登記很可能是三位數），
             若沿用千人級距，初始值會被瀏覽器調整成合法值，畫面數字就與官方數字不符。 -->
        <input type="range" id="sim-plains" min="0" max="${indigenousNow}" step="1"
               value="${pingpuRegistered}">
        <output id="sim-plains-out">${fmt(pingpuRegistered)} 人</output>
        <p class="sim-scale-note" id="sim-plains-scale"></p>
        <div class="sim-anchors">${anchorMarkup(anchors)}</div>
        <p class="sim-caption">
          除了上面標出的 ${anchors.length} 個點以外，滑桿上的任何數值都
          <strong>沒有官方或學術依據</strong>。
        </p>
        <details class="sim-why">
          <summary>為什麼上限是 ${fmt(indigenousNow)} 人</summary>
          <p>
            選這個數字的理由只有一個——
            <strong>它是目前原住民族人口，是一個有出處的真實數字，方便當量級參照</strong>。
            它不代表平埔族群人口的推估、上限或合理範圍。
          </p>
        </details>
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
          這條滑桿只有「現行 ${STATUTORY.indigenous} 席」一個有依據的點，
          其餘範圍<strong>純為操作空間、無制度依據</strong>。
        </p>
        <details class="sim-why">
          <summary>⚠️ 為什麼滑桿的上限本身就帶有立場</summary>
          <p>
            上限 20 是任意設定。現況 ${STATUTORY.indigenous} 席因此落在偏左，
            幾何上看起來像是在暗示「往上調」。改成以現況為中心的對稱範圍同樣不中立——
            那會暗示「減少席次」與「增加席次」是同等可能的選項，而減少需要修憲推翻既有保障。
            兩種做法都帶有立場，這裡選擇把它講明而不是假裝解決。
          </p>
        </details>
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
          這兩者不是同一個算式，且<strong>都需要修法或修憲</strong>。
          本站不評價何者較佳，只呈現各自的算術結果。
        </p>
        <details class="sim-why">
          <summary>兩種算法差在哪裡</summary>
          <p>
            重分配是<strong>零和</strong>的——原住民增一席，區域立委就少一席；
            增額則是總席次變多、區域席次不變。
          </p>
        </details>
      </fieldset>
    </div>

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
          ${contrastMarkup}
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

  /* 官方參照點的數值來自載入的人口檔，性質為官方統計。與對照百分比分開處理：
     那兩個是本站計算值、且在對照資料缺失時整段不顯示，這一個則永遠存在。 */
  const officialAnchorEl = root.querySelector('[data-role="anchor-official"]');
  if (officialAnchorEl) {
    officialAnchorEl.textContent = '';
    officialAnchorEl.append(traceable(fmt(pingpuRegistered), {
      sourceId: popData._sourceId,
      field: '已登記平埔原住民人口',
      nature: popData._fieldNature?.indigenous_pingpu ?? 'official-statistic',
    }));
  }

  /* 對照的兩個百分比是本站計算值，掛上溯源。基底資料為 CEC 的分類選舉人數，
     故 sourceId 取自該檔；性質為 derived-by-this-project——官方從未發布過
     「若平埔族群落在某一類，每席選民會增加多少」這個數字。 */
  if (contrast) {
    const attach = (role, field, value) => {
      const el = root.querySelector(`[data-role="${role}"]`);
      if (!el) return;
      el.textContent = '';
      el.append(traceable(value, {
        sourceId: byCategoryData._sourceId,
        field,
        nature: 'derived-by-this-project',
      }));
    };
    attach('contrast-merged', '併入 6 席時每席原民選民增幅',
      `${contrast.mergedPct.toFixed(1)}%`);
    attach('contrast-ping', `全部落在平原 ${contrast.pingSeats} 席時每席平原選民增幅`,
      `${contrast.pingOnlyPct.toFixed(1)}%`);
  }

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
      ? '相當於現有原住民族人口的 0%——即不把任何平埔人口納入保障體系'
      : `相當於現有原住民族人口（${fmt(indigenousNow)} 人）的 ${pct(state.plains, indigenousNow).toFixed(1)}%`;

    state.basis = root.querySelector('input[name="sim-basis"]:checked').value;

    const seatsResult = compute(state.seats, state.method);
    /* 分母不變：平埔族人本來就是既有國民，取得身分不會改變全國人口。
       只有分子（原住民人口）改變。滑桿等於已登記數時，此式還原成官方總數。 */
    const indigenous = indigenousExcludingPingpu + state.plains;
    const seatShare = pct(seatsResult.indigenous, seatsResult.total);
    const popShare = pct(indigenous, populationNow);
    const gap = seatShare - popShare;

    const isStatusQuo = state.plains === pingpuRegistered && state.seats === STATUTORY.indigenous;

    /* 與現況的差值。兩種算法各自的代價都要一樣明顯——
       重分配讓區域立委減少、增額讓總席次膨脹，兩者都有人會反對。
       只顯示其中一邊的變動等於把另一邊的代價藏起來。 */
    const delta = (now, base) => {
      const d = now - base;
      if (d === 0) return '';
      return `<span class="sim-delta" data-dir="${d > 0 ? 'up' : 'down'}">${d > 0 ? '＋' : '−'}${Math.abs(d)}</span>`;
    };

    /* 占比的差值以百分點表示，不是百分比——「席次占比由 5.31% 變成 7.08%」
       的差是 1.77 個【百分點】，寫成 1.77% 會被讀成相對變化，那是另一個數字。
       小於 0.005 視為無變化，與 gapPhrase 的判準一致，避免顯示 ＋0.00。 */
    const deltaPP = (now, base) => {
      const d = now - base;
      if (Math.abs(d) < 0.005) return '';
      return `<span class="sim-delta" data-dir="${d > 0 ? 'up' : 'down'}">${d > 0 ? '＋' : '−'}${Math.abs(d).toFixed(2)} 個百分點</span>`;
    };

    /* 現況的兩個占比，作為卡片差值的基準。用 STATUTORY 與未納入平埔的人口，
       不是「使用者上一次的設定」——基準必須固定，否則差值失去參照。 */
    const statusQuoSeatShare = pct(STATUTORY.indigenous, STATUTORY.total);
    const statusQuoPopShare = pct(indigenousNow, populationNow);

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
      <p class="sim-result-head">
        ${isStatusQuo ? '現況' : '模擬結果'}
        ${isStatusQuo ? '' : '<span class="sim-badge">依你輸入的參數計算，不構成制度主張</span>'}
      </p>

      <!-- 三張卡片是答案，下面的表格是算式的組成。兩個占比【只】出現在卡片上，
           不在表格中重複——它們要掛可溯源元素，同一個數字出現兩次就會有一份
           沒有溯源，違反「每個呈現的數字都要追得到來源」。 -->
      <div class="sim-cards">
        <div class="sim-card">
          <p class="sim-card-label">原住民保障席次</p>
          <p class="sim-card-value">${seatsResult.indigenous} 席 ${delta(seatsResult.indigenous, STATUTORY.indigenous)}</p>
        </div>
        <div class="sim-card">
          <p class="sim-card-label">席次占比</p>
          <p class="sim-card-value" data-role="card-seat-share">${seatShare.toFixed(2)}% ${deltaPP(seatShare, statusQuoSeatShare)}</p>
        </div>
        <div class="sim-card">
          <p class="sim-card-label">人口占比</p>
          <p class="sim-card-value" data-role="card-pop-share">${popShare.toFixed(2)}% ${deltaPP(popShare, statusQuoPopShare)}</p>
        </div>
      </div>

      <p class="sim-gap">${gapPhrase}。</p>
      <table class="sim-table">
        <caption>計算依據</caption>
        <tbody>
          <tr><th>區域立委席次</th><td>${seatsResult.regional} 席 ${delta(seatsResult.regional, STATUTORY.regional)}</td></tr>
          <tr><th>立法院總席次</th><td>${seatsResult.total} 席 ${delta(seatsResult.total, STATUTORY.total)}</td></tr>
          <tr><th>原住民族人口</th><td>${fmt(indigenous)} 人 ${delta(indigenous, indigenousNow)}</td></tr>
          <tr><th>全國人口</th><td>${fmt(populationNow)} 人</td></tr>
        </tbody>
      </table>
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
    const seatCell = output.querySelector('[data-role="card-seat-share"]');
    if (seatCell) {
      const changed = seatCell.querySelector('.sim-delta');
      seatCell.textContent = '';
      seatCell.append(traceable(`${seatShare.toFixed(2)}%`, {
        sourceId: 'constitution-amendment-art4',
        field: '席次占比（保障席次 ÷ 總席次）',
        nature: 'derived-by-this-project',
      }));
      /* 差值標記在清空時被一併移除，重新掛回去——它不是可溯源的數字本身，
         而是與現況的比較，掛在溯源元素之外。 */
      if (changed) seatCell.append(' ', changed);
    }
    const popCell = output.querySelector('[data-role="card-pop-share"]');
    if (popCell) {
      const changed = popCell.querySelector('.sim-delta');
      popCell.textContent = '';
      popCell.append(traceable(`${popShare.toFixed(2)}%`, {
        sourceId: popData._sourceId,
        field: '人口占比（原住民人口 ÷ 全國人口）',
        nature: popData._fieldNature.indigenous_ratio_pct,
      }));
      if (changed) popCell.append(' ', changed);
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
    /* 山原／平原分項。合併後的 legislative-representation 看不出兩者是【各自】
       3 席的獨立選區，而固定假設第 2 條正好說那個區分在法律上未定。 */
    'processed/election-by-category.json',
  ],
  render,
});
