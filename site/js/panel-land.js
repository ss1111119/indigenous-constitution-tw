/* 土地面板：原住民保留地所有權變遷
 *
 * 形式（依 dataviz 規範）：故事是「國有與私有的交叉」，那是兩個數列的對比，
 * 總面積只是脈絡——故用 emphasis：國有與私有各一個類別色，總計用低彩度的灰。
 *
 * 這張圖有三個必須誠實處理的狀態，任一處理錯都會變成誤導：
 *   1. 缺民國 108、109 年 → 該處【斷線】，不內插。x 軸仍列出這兩年，
 *      讓讀者看見「這兩年沒有資料」而不是以為資料本來就是四年一筆。
 *   2. 民國 107 年的總計是本站推算（來源缺該列）→ 該點用空心標記區別。
 *   3. 9 個縣市沒有保留地 → 顯示「此縣市無原住民保留地」，不畫任何圖，
 *      因為畫一條零線會讓人以為量到了 0 公頃。
 */

import { createPanel, fmt } from './panel.js';

/* 來源只有這五年。x 軸仍完整列出 107-113，缺的年度以 null 呈現為斷線。 */
const YEARS = [107, 108, 109, 110, 111, 112, 113];

const SERIES = [
  { key: 'state_owned', label: '國有', light: '#2a78d6', dark: '#3987e5' },
  { key: 'private', label: '私有', light: '#eb6834', dark: '#d95926' },
];

function theme() {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return {
    dark,
    ink: dark ? '#eeebe4' : '#1c1a17',
    inkMuted: dark ? '#a9a397' : '#5d574e',
    grid: dark ? '#3b382e' : '#e6e2da',
    context: dark ? '#6b675c' : '#a09a8f',
    surface: dark ? '#1f1e17' : '#ffffff',
  };
}

function totalOf(row) {
  /* 官方沒給總計的年度（民國107）用本站推算值。兩者在資料層是不同欄位，
     刻意不合併——性質不同的數字不該共用一個欄位。 */
  return row.total_official ?? row.total_derived ?? null;
}

function noLandNotice(container, name) {
  const box = document.createElement('div');
  box.className = 'zero-state';
  const h = document.createElement('h4');
  h.textContent = `${name}：無原住民保留地`;
  box.append(h);
  const p = document.createElement('p');
  p.className = 'zero-state-note';
  p.textContent = '全國 22 個縣市中有 13 個劃設原住民保留地。此縣市不在其中——'
    + '這是「沒有保留地」的事實，不是資料缺漏，因此不繪製任何圖形。'
    + '畫一條零線會讓人誤以為量測結果是 0 公頃。';
  box.append(p);
  container.append(box);
}

function render(container, [national, byCounty], region) {
  const t = theme();

  /* 保留地資料只到縣市層級。下鑽到鄉鎮時仍顯示所屬縣市的資料並註明，
     因為來源沒有更細的切分。 */
  const countyCode = region.level === 'national' ? null : region.code.slice(0, 5);
  const rows = countyCode
    ? byCounty.data.filter((r) => r.district_code === countyCode)
    : national.data;

  const h = document.createElement('h3');
  h.className = 'chart-title';
  h.textContent = countyCode
    ? `${rows[0]?.name ?? region.name}原住民保留地所有權`
    : '全國原住民保留地所有權';
  container.append(h);

  if (rows.length === 0) {
    noLandNotice(container, region.name);
    return;
  }

  const byYear = new Map(rows.map((r) => [r.roc_year, r]));
  const totals = YEARS.map((y) => (byYear.has(y) ? totalOf(byYear.get(y)) : null));

  const wrap = document.createElement('div');
  wrap.className = 'canvas-wrap';
  wrap.style.height = '22rem';
  const canvas = document.createElement('canvas');
  wrap.append(canvas);
  container.append(wrap);

  const datasets = [
    {
      label: '所有權部總計',
      data: totals,
      borderColor: t.context,
      backgroundColor: t.context,
      borderWidth: 2,
      borderDash: [5, 4],
      /* 官方未提供總計的年度（107）用空心點標示為本站推算值 */
      pointRadius: YEARS.map((y) => (byYear.has(y) ? 5 : 0)),
      pointStyle: YEARS.map((y) => (byYear.get(y)?.total_official == null ? 'circle' : 'circle')),
      pointBackgroundColor: YEARS.map((y) => (
        byYear.get(y)?.total_official == null ? t.surface : t.context)),
      pointBorderColor: t.context,
      pointBorderWidth: 2,
      tension: 0,
    },
    ...SERIES.map((s) => ({
      label: s.label,
      data: YEARS.map((y) => (byYear.has(y) ? byYear.get(y)[s.key] : null)),
      borderColor: t.dark ? s.dark : s.light,
      backgroundColor: t.dark ? s.dark : s.light,
      borderWidth: 2,
      pointRadius: YEARS.map((y) => (byYear.has(y) ? 5 : 0)),
      tension: 0,
    })),
  ];

  new window.Chart(canvas, {
    type: 'line',
    data: { labels: YEARS.map((y) => `民國${y}年`), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      /* spanGaps 預設為 false，null 值處即斷線。這是刻意的——
         連起來等於宣稱那兩年有測量值。 */
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { type: 'category', border: { display: false }, grid: { display: false }, ticks: { color: t.ink } },
        y: {
          border: { display: false },
          grid: { color: t.grid, drawTicks: false },
          ticks: { color: t.inkMuted, callback: (v) => fmt(v) },
          title: { display: true, text: '面積（公頃）', color: t.inkMuted },
        },
      },
      plugins: {
        legend: { labels: { color: t.ink, usePointStyle: true }, position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (c) => (c.parsed.y == null ? null
              : `${c.dataset.label} ${c.parsed.y.toLocaleString('zh-TW', { maximumFractionDigits: 3 })} 公頃`),
            afterBody: (items) => {
              const y = YEARS[items[0].dataIndex];
              const row = byYear.get(y);
              return row && row.total_official == null
                ? '⚠️ 該年度官方未提供總計，此值為公有＋私有的本站計算值'
                : '';
            },
          },
        },
      },
    },
  });

  /* --- 說明 --- */
  const missing = YEARS.filter((y) => !byYear.has(y));
  const derivedYears = YEARS.filter((y) => byYear.has(y) && byYear.get(y).total_official == null);

  const foot = document.createElement('div');
  foot.className = 'panel-explainer';

  const parts = [];
  if (countyCode && region.level === 'township') {
    parts.push('<p>保留地資料只到縣市層級，故此處顯示所屬縣市的數字，不隨鄉鎮變動。</p>');
  }

  const first = rows[0];
  const last = rows[rows.length - 1];
  if (first && last && first !== last) {
    const delta = last.private - first.private;
    const dir = delta > 0 ? '增加' : '減少';
    parts.push(`<p>民國 ${first.roc_year} 至 ${last.roc_year} 年間，私有保留地面積${dir} `
      + `<strong>${fmt(Math.round(Math.abs(delta)))} 公頃</strong>，`
      + `國有面積同期${last.state_owned > first.state_owned ? '增加' : '減少'} `
      + `<strong>${fmt(Math.round(Math.abs(last.state_owned - first.state_owned)))} 公頃</strong>，`
      + '總面積則幾乎不變。這是增劃編與所有權移轉的結果。</p>');
  }

  /* 黃金交叉：私有首度超過國有的年度 */
  const sorted = [...rows].sort((a, b) => a.roc_year - b.roc_year);
  const crossIdx = sorted.findIndex((r, i) => i > 0
    && sorted[i - 1].private <= sorted[i - 1].state_owned && r.private > r.state_owned);
  if (crossIdx > 0) {
    parts.push(`<p>民國 <strong>${sorted[crossIdx].roc_year}</strong> 年私有面積首度超過國有。</p>`);
  }

  if (missing.length) {
    parts.push(`<p><strong>缺少年度：</strong>來源沒有民國 ${missing.join('、')} 年的資料，`
      + '圖上該處斷線。不做內插——連起來等於宣稱那些年有測量值。</p>');
  }
  if (derivedYears.length) {
    parts.push(`<p><strong>推算值：</strong>民國 ${derivedYears.join('、')} 年官方未提供「所有權部總計」，`
      + '圖上以空心點標示，數值為公有加私有的本站計算值。'
      + '該年度的「其他單位」欄位亦為空值，故推算值可能少計約 0 至 100 公頃。</p>');
  }
  foot.innerHTML = parts.join('');
  container.append(foot);
}

export const landPanel = createPanel({
  el: '[data-role="land-chart"]',
  sources: () => [
    'processed/land-ownership-national.json',
    'processed/land-ownership-by-county.json',
  ],
  render,
});
