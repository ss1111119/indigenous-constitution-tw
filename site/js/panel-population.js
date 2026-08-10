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

import { createPanel, fmt } from './panel.js';
import { traceable } from './provenance.js';

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
       但族別總數與原民會月報一致（見 sources.json 的 natureRule）。 */
    const total = { indigenous_total: 0 };
    for (const [key] of [...RECOGNISED, ...PINGPU, ['undeclared']]) total[key] = 0;
    for (const r of dataset.data) {
      total.indigenous_total += r.indigenous_total;
      for (const k of Object.keys(total)) {
        if (k !== 'indigenous_total') total[k] += r[k];
      }
    }
    return total;
  }
  return dataset.data.find((r) => r.district_code === region.code) ?? null;
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
  canvasWrap.append(canvas);
  container.append(canvasWrap);

  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const ink = dark ? '#eeebe4' : '#1c1a17';
  const inkMuted = dark ? '#a9a397' : '#5d574e';
  const gridLine = dark ? '#3b382e' : '#e6e2da';

  new window.Chart(canvas, {
    type: 'bar',
    data: {
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
    },
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

  /* --- 平埔族群：狀態而非量值 --- */
  const pingpuTotal = PINGPU.reduce((sum, [key]) => sum + row[key], 0);
  const box = document.createElement('div');
  box.className = 'zero-state';

  const h = document.createElement('h4');
  h.textContent = `平埔族群 10 族：尚無登記（${fmt(pingpuTotal)} 人）`;
  box.append(h);

  const list = document.createElement('p');
  list.className = 'zero-state-list';
  list.textContent = PINGPU.map(([, name]) => name).join('、');
  box.append(list);

  const note = document.createElement('p');
  note.className = 'zero-state-note';
  note.textContent = '戶政司自民國 114 年 11 月起在官方統計中預留這 10 個欄位，'
    + '目前值為 0——是「還沒有人登記」的官方事實，不是資料缺漏。'
    + '西拉雅族已於 2026-07-30 核定為第 17 族，身分登記自 2026 年 8 月中開始。';
  box.append(note);

  /* 三種狀態必須在畫面上分得開，否則讀者無從判斷 0 的意義。
     這張表本身就是規格——把抽象的紀律變成看得見的對照。 */
  const states = document.createElement('table');
  states.className = 'state-table';
  states.innerHTML = `
    <caption>平埔族群人口的三種狀態</caption>
    <thead>
      <tr><th>期間</th><th>官方欄位</th><th>本站呈現</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>民國 114 年 10 月以前</td>
        <td>欄位<strong>不存在</strong></td>
        <td data-state="absent">時間序列不繪點，也不繪為 0</td>
      </tr>
      <tr>
        <td>民國 114 年 11 月起</td>
        <td>欄位存在，值為 <strong>0</strong></td>
        <td data-state="zero">顯示「尚無登記」</td>
      </tr>
      <tr>
        <td>2026 年 8 月中起</td>
        <td>預期出現非零值</td>
        <td data-state="future">實線，標註「登記自 2026-08 起算」</td>
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

  /* --- 組成加總必須等於原住民合計，否則圓餅圖式的呈現會誤導 --- */
  const sum = bars.reduce((s, d) => s + d.value, 0) + pingpuTotal;
  const foot = document.createElement('p');
  foot.className = 'chart-foot';
  foot.textContent = sum === row.indigenous_total
    ? `以上各族與未申報合計 ${fmt(sum)} 人，等於原住民人口總數。`
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
