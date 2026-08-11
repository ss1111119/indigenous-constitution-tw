/* 選舉面板：投票率與代表性倍數差距
 *
 * 兩張圖，形式不同（依 dataviz 規範）：
 *   投票率——三個【互相區別】的數列（山原／平原／區域），故用類別色 + 圖例 + 直接標註。
 *   倍數差距——單一數列的時間趨勢，用一個色相即可，不需圖例（標題已指明它是什麼）。
 *
 * ⚠️ 類別色的 aqua 在白底對比為 2.82:1，低於 3:1。調色盤驗證器對此發出 WARN，
 * 規定必須配可見標籤或表格檢視作為補償——這是為什麼末端直接標註是必須的，不是裝飾。
 *
 * 本面板【不隨地區選擇器變動】：原住民立委選舉區是山地、平地兩個全國性選區，
 * 在資料層就不是行政區，無法依縣市切分。
 */

import { createPanel, fmt, chartTable } from './panel.js';
import { traceable } from './provenance.js';

const SERIES = [
  { key: '山原', label: '山地原住民', light: '#2a78d6', dark: '#3987e5' },
  { key: '平原', label: '平地原住民', light: '#eb6834', dark: '#d95926' },
  { key: '區域', label: '區域立委', light: '#1baf7a', dark: '#199e70' },
];

const RATIO_COLOR_LIGHT = '#2a78d6';
const RATIO_COLOR_DARK = '#3987e5';

/* 在每條線的末端寫上數列名稱與數值。
   對比不足的補償措施，也讓讀者不必在圖例與線之間來回對照。 */
const endLabels = {
  id: 'endLabels',
  afterDatasetsDraw(chart, args, opts) {
    const { ctx } = chart;
    ctx.save();
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    chart.data.datasets.forEach((ds, i) => {
      const meta = chart.getDatasetMeta(i);
      const last = meta.data[meta.data.length - 1];
      if (!last) return;
      ctx.fillStyle = opts.color ?? ds.borderColor;
      ctx.fillText(opts.format(ds, i), last.x + 8, last.y);
    });
    ctx.restore();
  },
};

function theme() {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return {
    dark,
    ink: dark ? '#eeebe4' : '#1c1a17',
    inkMuted: dark ? '#a9a397' : '#5d574e',
    grid: dark ? '#3b382e' : '#e6e2da',
  };
}

function baseOptions(t, yTitle, extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    /* 末端標註需要右側空間，否則會被切掉 */
    layout: { padding: { right: 96 } },
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        /* ⚠️ 必須明確指定 category。年份若以數字傳入 labels，Chart.js 會把 x 軸
           推斷為線性刻度，然後拿資料索引 0..4 當座標值畫在 2008~2024 的軸上，
           所有點會擠在最左端——看起來像資料錯了，其實是刻度型別錯了。 */
        type: 'category',
        border: { display: false },
        grid: { display: false },
        ticks: { color: t.ink },
      },
      y: {
        border: { display: false },
        grid: { color: t.grid, drawTicks: false },
        ticks: { color: t.inkMuted },
        title: { display: true, text: yTitle, color: t.inkMuted },
        ...extra,
      },
    },
  };
}

function renderTurnout(container, rows) {
  const t = theme();
  const years = [...new Set(rows.map((r) => r.年))].sort().map(String);

  const h = document.createElement('h3');
  h.className = 'chart-title';
  h.textContent = '歷屆立委選舉投票率';
  container.append(h);

  const wrap = document.createElement('div');
  wrap.className = 'canvas-wrap';
  wrap.style.height = '20rem';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label',
    `折線圖：${years[0]} 至 ${years[years.length - 1]} 年立委選舉投票率，`
    + `共 ${years.length} 屆，分${SERIES.map((s) => s.label).join('、')}三類。`
    + '完整數值見下方表格。');
  wrap.append(canvas);
  container.append(wrap);

  /* 同一個物件同時給 Chart.js 與表格，數值不可能分歧。 */
  const chartData = {
    labels: years,
    datasets: SERIES.map((s) => ({
      label: s.label,
      data: years.map((y) => rows.find((r) => String(r.年) === y && r.類別 === s.key)?.投票率 ?? null),
      borderColor: t.dark ? s.dark : s.light,
      backgroundColor: t.dark ? s.dark : s.light,
      borderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0,
    })),
  };

  new window.Chart(canvas, {
    type: 'line',
    data: chartData,
    options: {
      ...baseOptions(t, '投票率（%）'),
      plugins: {
        legend: { labels: { color: t.ink, usePointStyle: true }, position: 'bottom' },
        tooltip: { callbacks: { label: (c) => `${c.dataset.label} ${c.parsed.y}%` } },
        endLabels: { format: (ds) => `${ds.label} ${ds.data[ds.data.length - 1]}%` },
      },
    },
    plugins: [endLabels],
  });

  container.append(chartTable(
    chartData, '歷屆立委選舉投票率', '年度', (v) => `${v}%`,
  ));
}

function renderRatio(container, metrics, meta) {
  const t = theme();

  const h = document.createElement('h3');
  h.className = 'chart-title';
  h.textContent = '每席區域立委選民數 ÷ 每席原住民立委選民數';
  container.append(h);

  const wrap = document.createElement('div');
  wrap.className = 'canvas-wrap';
  wrap.style.height = '18rem';
  const canvas = document.createElement('canvas');
  wrap.append(canvas);
  container.append(wrap);

  const years = metrics.map((m) => String(m.年));
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label',
    `折線圖：每席區域立委選民數除以每席原住民立委選民數的倍數差距，`
    + `${years[0]} 至 ${years[years.length - 1]} 年共 ${years.length} 屆，`
    + `由 ${metrics[0].倍數差距} 倍變為 ${metrics[metrics.length - 1].倍數差距} 倍。`
    + '完整數值見下方表格。');

  const chartData = {
    labels: years,
    datasets: [{
      label: '倍數差距',
      data: metrics.map((m) => m.倍數差距),
      borderColor: t.dark ? RATIO_COLOR_DARK : RATIO_COLOR_LIGHT,
      backgroundColor: t.dark ? RATIO_COLOR_DARK : RATIO_COLOR_LIGHT,
      borderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 7,
      tension: 0,
    }],
  };

  new window.Chart(canvas, {
    type: 'line',
    data: chartData,
    options: {
      ...baseOptions(t, '倍數', { beginAtZero: false }),
      plugins: {
        /* 單一數列不需要圖例——標題已經指明它是什麼 */
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (c) => {
              const m = metrics[c.dataIndex];
              return [
                `倍數差距 ${m.倍數差距} 倍`,
                `每席原住民立委代表 ${fmt(m.每席原民選民)} 位選民`,
                `每席區域立委代表 ${fmt(m.每席區域選民)} 位選民`,
              ];
            },
          },
        },
        endLabels: { format: (ds) => `${ds.data[ds.data.length - 1]} 倍`, color: t.ink },
      },
    },
    plugins: [endLabels],
  });

  container.append(chartTable(
    chartData, '每席區域立委選民數 ÷ 每席原住民立委選民數', '年度', (v) => `${v} 倍`,
  ));

  /* 制度成因。這不是圖表的裝飾文字——沒有它，讀者會把收斂誤讀為
     「原住民代表性正在改善」，但實際上是超額代表的程度被人口成長稀釋。 */
  const note = document.createElement('div');
  note.className = 'panel-explainer';
  const first = metrics[0];
  const last = metrics[metrics.length - 1];
  note.innerHTML = `
    <p>倍數差距從 ${first.年} 年的 <strong>${first.倍數差距} 倍</strong>
    單調收斂到 ${last.年} 年的 <strong>${last.倍數差距} 倍</strong>。</p>
    <p><strong>制度成因：</strong>《中華民國憲法增修條文》第 4 條第 1 項第 2 款明定
    「自由地區平地原住民及山地原住民<strong>各三人</strong>」——原住民席次是
    <strong>固定數額</strong>。同條第 2 項的「依各直轄市、縣市人口比例分配」
    <strong>只適用區域立委</strong>。因此原住民人口成長不會反映為席次增加，
    每席所代表的選民數就逐屆上升，與區域立委的差距隨之縮小。</p>
    <p>換句話說，這條線下降<strong>不是</strong>代表性改善，而是原住民保障席次的
    超額代表程度正在被人口成長稀釋。原住民選舉人數 16 年間成長
    ${(((last.原民選舉人數 / first.原民選舉人數) - 1) * 100).toFixed(1)}%，
    區域選舉人數同期成長 ${(((last.區域選舉人數 / first.區域選舉人數) - 1) * 100).toFixed(1)}%。</p>
  `;
  container.append(note);

  /* 關鍵數字可查來源。倍數差距是本站計算值，不是任何官方文件裡的數字——
     讓讀者點得到這件事，比在文案裡寫一句話有效。 */
  const stat = document.createElement('p');
  stat.className = 'chart-foot';
  stat.append(`${last.年} 年倍數差距 `);
  stat.append(traceable(String(last.倍數差距), {
    sourceId: meta._sourceId,
    field: '倍數差距',
    nature: meta._fieldNature['倍數差距'],
  }));
  stat.append(' 倍');
  container.append(stat);
}

export const turnoutPanel = createPanel({
  el: '[data-role="turnout-chart"]',
  sources: () => ['processed/election-by-category.json'],
  render: (container, [ds]) => renderTurnout(container, ds.data),
});

export const ratioPanel = createPanel({
  el: '[data-role="ratio-chart"]',
  sources: () => ['processed/legislative-representation.json'],
  render: (container, [ds]) => renderRatio(container, ds.data, ds),
});
