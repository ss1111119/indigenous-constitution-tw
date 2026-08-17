/* 人口面板：族別組成
 *
 * 形式選擇（依 dataviz 規範）：資料的工作是「比較量值」，故為長條圖 + 單一色相，
 * 【不是】類別色。27 個族別遠超過類別色 7–8 個的上限，用類別色會做出無法辨識的圖。
 * 長度本身就是編碼，所有長條同一個藍。
 *
 * 平埔族群的 0 不畫成長條——10 根長度為零的長條沒有意義，而且會讓人以為是圖表壞了。
 * 改以獨立區塊呈現「尚無登記」，那是一個【狀態】不是一個量值。
 * 這對應 data-provenance 的要求：0 是有意義的官方事實，不是空白也不是 N/A。
 */

import { createPanel, fmt, chartTable } from './panel.js';
import { traceable, periodOf } from './provenance.js';

const RECOGNISED = [
  ['amis', '阿美族'], ['atayal', '泰雅族'], ['paiwan', '排灣族'], ['bunun', '布農族'],
  ['rukai', '魯凱族'], ['pinuyumayan', '卑南族'], ['cou', '鄒族'], ['saisiyat', '賽夏族'],
  ['yami', '雅美族'], ['thao', '邵族'], ['kavalan', '噶瑪蘭族'], ['truku', '太魯閣族'],
  ['sakizaya', '撒奇萊雅族'], ['sediq', '賽德克族'], ['hlaalua', '拉阿魯哇族'],
  ['kanakanavu', '卡那卡那富族'],
];

const PINGPU = [
  ['siraya', '西拉雅族'], ['ketagalan', '凱達格蘭族'], ['taokas', '道卡斯族'],
  ['pazeh', '巴宰族'], ['papora', '拍瀑拉族'], ['babuza', '巴布薩族'],
  ['hoanya', '洪雅族'], ['kaxabu', '噶哈巫族'], ['taivoan', '大武壠族'],
  ['makatau', '馬卡道族'],
];

const BAR_COLOR_LIGHT = '#2a78d6';
const BAR_COLOR_DARK = '#3987e5';

function rowFor(dataset, region) {
  if (region.level === 'national') {
    /* 全國：各縣市加總。這是本站計算而非官方直接發布的分區彙總，
       但族別總數與原民會月報一致（見 sources.json 的 natureRule）。

       只彙總【資料裡真的有】的欄位。若照著常數清單一律建 0 再累加，
       來源沒有的欄位會被這一步變成「值為 0」，三態就此塌成兩態——
       「該期沒有這個統計類別」與「有這個類別但沒人登記」再也分不開。 */
    const first = dataset.data[0] ?? {};
    const keys = [...RECOGNISED, ...PINGPU, ['undeclared']]
      .map(([key]) => key)
      .filter((key) => key in first);

    const total = { indigenous_total: 0 };
    for (const key of keys) total[key] = 0;
    for (const r of dataset.data) {
      total.indigenous_total += r.indigenous_total;
      for (const key of keys) total[key] += r[key];
    }
    return total;
  }
  return dataset.data.find((r) => r.district_code === region.code) ?? null;
}

/* 平埔族群的三種狀態，判定依據【只有載入的資料】。
   不看當前日期、不看登記開放日、不看任何寫死的旗標——以日期判定會在 ODRP
   延遲發布時說謊：登記已開放但該期資料還沒出來時，頁面會宣稱有登記數，
   而實際載入的仍是零。見 design 決策四。 */
function pingpuState(row) {
  const present = PINGPU.filter(([key]) => typeof row[key] === 'number');
  if (present.length === 0) return { state: 'absent', total: null, present };
  const total = present.reduce((sum, [key]) => sum + row[key], 0);
  return { state: total > 0 ? 'registered' : 'zero', total, present };
}

function render(container, [dataset], region) {
  const row = rowFor(dataset, region);

  if (!row) {
    const p = document.createElement('p');
    p.className = 'panel-note';
    p.textContent = '此地區沒有可用的族別資料。';
    container.append(p);
    return;
  }

  /* --- 有人口的族別，由大到小 --- */
  const bars = RECOGNISED
    .map(([key, name]) => ({ name, value: row[key] }))
    .concat([{ name: '未申報族別', value: row.undeclared }])
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const heading = document.createElement('h3');
  heading.className = 'chart-title';
  heading.append(`${region.name}原住民族人口 `);
  heading.append(traceable(fmt(row.indigenous_total), {
    sourceId: dataset._sourceId,
    field: '原住民族人口',
    nature: dataset._fieldNature.indigenous_total,
  }));
  heading.append(' 人');
  container.append(heading);

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'canvas-wrap';
  /* 每根長條含間距約 26px，加上上下留白。橫向長條圖的高度隨類別數變動。 */
  canvasWrap.style.height = `${bars.length * 26 + 40}px`;
  const canvas = document.createElement('canvas');
  /* canvas 對輔助技術不透明，須自帶名稱。這個 aria-label 不能被下方的表格取代——
     收合的 details 不在無障礙樹中。 */
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label',
    `橫向長條圖：${region.name}原住民族各族人口數，`
    + `共 ${bars.length} 個族別，由多到少排列，`
    + `最多為${bars[0].name} ${fmt(bars[0].value)} 人。完整數值見下方表格。`);
  canvasWrap.append(canvas);
  container.append(canvasWrap);

  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const ink = dark ? '#eeebe4' : '#1c1a17';
  const inkMuted = dark ? '#a9a397' : '#5d574e';
  const gridLine = dark ? '#3b382e' : '#e6e2da';

  /* 傳給 Chart.js 與傳給表格的是同一個物件——兩者的數值不可能分歧。 */
  const chartData = {
    labels: bars.map((d) => d.name),
    datasets: [{
      data: bars.map((d) => d.value),
      backgroundColor: dark ? BAR_COLOR_DARK : BAR_COLOR_LIGHT,
      /* 資料端 4px 圓角、基線端維持方角 */
      borderRadius: { topLeft: 0, bottomLeft: 0, topRight: 4, bottomRight: 4 },
      borderSkipped: false,
      /* 長條不填滿整個帶寬，留下的空氣即是相鄰長條間的間隔 */
      barPercentage: 0.72,
      maxBarThickness: 24,
    }],
  };

  new window.Chart(canvas, {
    type: 'bar',
    data: chartData,
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      /* 單一數列不需要圖例——標題已經指明它是什麼 */
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${fmt(ctx.parsed.x)} 人（占原住民人口 ${(ctx.parsed.x * 100 / row.indigenous_total).toFixed(2)}%）`,
          },
        },
      },
      scales: {
        x: {
          border: { display: false },
          grid: { color: gridLine, drawTicks: false },
          ticks: { color: inkMuted, callback: (v) => fmt(v) },
        },
        y: {
          border: { display: false },
          grid: { display: false },
          ticks: { color: ink, font: { size: 13 } },
        },
      },
    },
  });

  container.append(chartTable(
    chartData, `${region.name}原住民族各族人口`, '族別', (v) => `${fmt(v)} 人`,
  ));

  /* --- 平埔族群：狀態而非量值 --- */
  const pingpu = pingpuState(row);
  const box = document.createElement('div');
  box.className = 'zero-state';
  box.dataset.state = pingpu.state;

  const h = document.createElement('h4');
  const list = document.createElement('p');
  list.className = 'zero-state-list';
  const note = document.createElement('p');
  note.className = 'zero-state-note';

  if (pingpu.state === 'absent') {
    h.textContent = '平埔族群 10 族：該期官方統計尚無此欄位';
    list.textContent = PINGPU.map(([, name]) => name).join('、');
    note.textContent = '本期載入的資料沒有平埔族群欄位——不是值為 0，而是這個統計類別'
      + '在該期尚未產生。此狀態下不繪點也不補零：把「法律上還不存在這個身分」'
      + '記成「有 0 個人」是錯的。';
  } else if (pingpu.state === 'zero') {
    h.textContent = `平埔族群 10 族：尚無登記（${fmt(pingpu.total)} 人）`;
    list.textContent = PINGPU.map(([, name]) => name).join('、');
    note.textContent = '戶政司自民國 114 年 11 月起在官方統計中預留這 10 個欄位，'
      + '本期值為 0——是「還沒有人登記」的官方事實，不是資料缺漏。'
      + '西拉雅族已於 2026-07-30 核定為第 17 族，身分登記自 2026 年 8 月中開始。';
  } else {
    /* 非零：顯示數字，並標註它屬於哪一期——沒有期別的登記人數無法解讀，
       讀者無從判斷這是本月新增還是累計到哪一期。 */
    h.append('平埔族群 10 族：');
    h.append(traceable(fmt(pingpu.total), {
      sourceId: dataset._sourceId,
      field: '平埔族群人口',
      nature: dataset._fieldNature[pingpu.present[0][0]] ?? 'official-statistic',
    }));
    h.append(' 人');

    const periodTag = document.createElement('span');
    periodTag.className = 'zero-state-period';
    h.append(periodTag);
    periodOf(dataset._sourceId).then((period) => {
      /* 不加外層括號：dataDate 本身就帶括號（如「2026-06（民國115年6月）」），
         再包一層會變成巢狀括號。 */
      periodTag.textContent = `　期別 ${period}`;
    });

    const registered = pingpu.present.filter(([key]) => row[key] > 0);
    list.textContent = registered
      .map(([key, name]) => `${name} ${fmt(row[key])} 人`)
      .join('、')
      + (registered.length < pingpu.present.length ? '；其餘尚無登記。' : '');
    /* 不宣稱「首次」：本站一次只載入一個期別，沒有前期可比對，因此無從判定
       該期是否為第一個非零期別。寫死的「首次」在下一期就會變成假話。
       待逐月時序產出物存在後，若屆時有判定依據再行恢復。 */
    note.textContent = '這是官方統計中的平埔族群戶籍登記人口。'
      + '數字與期別均取自載入的資料本身，不由當前日期推定。';
  }

  box.append(h);
  box.append(list);
  box.append(note);

  /* 三種狀態必須在畫面上分得開，否則讀者無從判斷 0 的意義。
     這張表本身就是規格——把抽象的紀律變成看得見的對照。

     表以【載入資料的欄位狀態】為鍵，日期只列為參考：判定依據是資料不是日曆，
     兩者在來源延遲發布時會不一致，而屆時該相信的是資料。 */
  const states = document.createElement('table');
  states.className = 'state-table';
  states.innerHTML = `
    <caption>平埔族群人口的三種狀態（目前為第 ${
      { absent: 1, zero: 2, registered: 3 }[pingpu.state]
    } 列）</caption>
    <thead>
      <tr><th>載入資料的欄位</th><th>本站呈現</th><th>對應期間（參考）</th></tr>
    </thead>
    <tbody>
      <tr${pingpu.state === 'absent' ? ' aria-current="true"' : ''}>
        <td>欄位<strong>不存在</strong></td>
        <td data-state="absent">標為「該期尚無此欄位」，不繪點也不繪為 0</td>
        <td>民國 114 年 10 月以前</td>
      </tr>
      <tr${pingpu.state === 'zero' ? ' aria-current="true"' : ''}>
        <td>欄位存在，值為 <strong>0</strong></td>
        <td data-state="zero">顯示「尚無登記」</td>
        <td>民國 114 年 11 月起</td>
      </tr>
      <tr${pingpu.state === 'registered' ? ' aria-current="true"' : ''}>
        <td>欄位存在，值<strong>大於 0</strong></td>
        <td data-state="registered">顯示人數，並標註所屬期別</td>
        <td>登記自 2026 年 8 月中開始</td>
      </tr>
    </tbody>
  `;
  box.append(states);

  const why = document.createElement('p');
  why.className = 'zero-state-note';
  why.innerHTML = '<strong>為什麼要分：</strong>把「法律上還不存在這個身分」畫成「有 0 個人」是錯的。'
    + '民國 114 年 10 月以前欄位根本不存在，那段期間沒有「平埔原住民人口為零」這回事，'
    + '而是這個統計類別尚未產生。';
  box.append(why);

  container.append(box);

  /* --- 組成加總必須等於原住民合計，否則圓餅圖式的呈現會誤導 ---
     欄位不存在時以 0 計入加總，這不是把缺欄位當成零值呈現——畫面上仍標示為
     「該期尚無此欄位」，這裡只是讓加總在該期沒有這個類別時仍然成立。 */
  const sum = bars.reduce((s, d) => s + d.value, 0) + (pingpu.total ?? 0);
  const foot = document.createElement('p');
  foot.className = 'chart-foot';
  /* 「以上」不足以涵蓋加總範圍：平埔族群即使非零也呈現於圖表下方的獨立區塊，
     不在長條之中。數字本來就是對的，錯的是指涉。 */
  foot.textContent = sum === row.indigenous_total
    ? `圖中各族、未申報，加上下方的平埔族群，合計 ${fmt(sum)} 人，等於原住民人口總數。`
    : `⚠️ 各族合計 ${fmt(sum)} 人與原住民人口總數 ${fmt(row.indigenous_total)} 人不符，請回報。`;
  container.append(foot);
}

export const populationPanel = createPanel({
  el: '[data-role="tribe-chart"]',
  /* 只有下鑽到鄉鎮才載入 245KB 的鄉鎮族別檔；全國與縣市層級都用 16KB 的縣市檔。 */
  sources: (region) => [region.level === 'township'
    ? 'processed/tribes-by-township.json'
    : 'processed/tribes-by-county.json'],
  render,
});
