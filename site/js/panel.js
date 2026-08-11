/* 面板共用基礎
 *
 * 每個面板透過 createPanel 註冊，載入自己的資料並自行渲染。
 * 錯誤在此收斂：一個面板的資料載入失敗只會讓該面板顯示錯誤，
 * 其餘面板照常運作（dashboard-shell 的 Isolate panel data failures）。
 */

import { loadData, renderPanelError } from './state.js';

/* sources 為一個函式而非固定陣列，因為要載入哪些檔案取決於當前層級。
   鄉鎮層級的資料檔較大（tribes-by-township 245KB），只有真的下鑽時才該付這個成本。 */
export function createPanel({ el, sources, render }) {
  const container = typeof el === 'string' ? document.querySelector(el) : el;
  if (!container) return () => {};

  return async (region) => {
    const needed = typeof sources === 'function' ? sources(region) : sources;
    try {
      const loaded = await Promise.all(needed.map(loadData));
      container.innerHTML = '';
      render(container, loaded, region);
    } catch (err) {
      /* 錯誤訊息必須帶出來源路徑，否則使用者只看到「載入失敗」而不知道缺哪一份資料。 */
      renderPanelError(container, err, needed.join('、'));
      console.error(`面板資料載入失敗（${needed.join('、')}）：`, err);
    }
  };
}

/* 數字格式：千分位。全站一致，避免同一頁出現兩種寫法。 */
export const fmt = (n) => n.toLocaleString('zh-TW');

/* 無資料的顯示文字。定義在此、四張表共用，是為了讓「無資料」與「0」的區辨
   不依賴每個實作者記得要分——data-provenance 的三態要求若靠紀律滿足，遲早會漏。 */
export const NO_DATA = '無資料';

/* 圖表的表格檢視。
 *
 * canvas 對輔助技術是不透明的：螢幕閱讀器讀到的是一個沒有名稱、沒有內容的元素。
 * 這個函式產生同一組數值的表格作為文字替代，同時也給想驗算的人看。
 *
 * 【重要】參數 data 就是即將傳給 Chart.js 的那一個物件，不是另外組的陣列。
 * 若各面板依自己的來源陣列另外組表格，就會有兩條獨立路徑算出「圖上的數字」與
 * 「表裡的數字」，兩者可以在不被察覺的情況下分歧——而表格存在的理由正是給人驗算，
 * 說謊的表格比沒有表格糟。同源推導讓分歧在結構上不可能發生。
 *
 * 【注意】收合狀態的 details 內容不在無障礙樹中，所以這個表格【不能】是唯一的
 * 文字替代。呼叫端必須另外為 canvas 設定 role="img" 與摘要性的 aria-label。
 *
 * @param {{labels: Array, datasets: Array<{label?: string, data: Array}>}} data
 *        傳給 Chart.js 的 data 物件
 * @param {string} caption      表格標題，也是 summary 的文字
 * @param {string} rowHeader    第一欄的欄名（例如「族別」「年度」）
 * @param {(v: number) => string} format  數值轉顯示字串；未提供時退化為字串轉換
 */
export function chartTable(data, caption, rowHeader, format) {
  const labels = data?.labels ?? [];
  const datasets = data?.datasets ?? [];
  const toText = typeof format === 'function' ? format : (v) => String(v);

  const details = document.createElement('details');
  details.className = 'chart-table';
  const summary = document.createElement('summary');
  summary.textContent = `以表格檢視：${caption}`;
  details.append(summary);

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const corner = document.createElement('th');
  corner.scope = 'col';
  corner.textContent = rowHeader;
  headRow.append(corner);
  datasets.forEach((ds, i) => {
    const th = document.createElement('th');
    th.scope = 'col';
    /* 單一無名序列（例如族別長條圖）沒有 label，用表格標題當欄名。 */
    th.textContent = ds.label || (datasets.length === 1 ? caption : `序列 ${i + 1}`);
    headRow.append(th);
  });
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement('tbody');
  labels.forEach((label, row) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = label;
    tr.append(th);
    for (const ds of datasets) {
      const td = document.createElement('td');
      /* data 短於 labels 時，缺少的位置視為無資料而非位移。 */
      const v = ds.data?.[row];
      /* null 與 undefined 是缺口，0 是事實——兩者的文字必須不同。 */
      td.textContent = (v === null || v === undefined) ? NO_DATA : toText(v);
      if (v === null || v === undefined) td.dataset.nodata = 'true';
      tr.append(td);
    }
    tbody.append(tr);
  });
  table.append(tbody);

  /* 表格過寬時在自身容器內橫向滾動，頁面本體不得橫向滾動。 */
  const wrap = document.createElement('div');
  wrap.className = 'chart-table-scroll';
  wrap.append(table);
  details.append(wrap);
  return details;
}

/* 把一段文字標成某個性質標籤。性質取自 processed JSON 的 _fieldNature，
   不在前端自行判斷——判斷邏輯只能有一處。 */
export function natureTag(nature) {
  const label = {
    'official-statistic': '官方統計',
    'academic-estimate': '學術估計',
    'derived-by-this-project': '本站計算',
    'historical-record': '歷史紀錄',
    compilation: '混合來源',
  }[nature] ?? nature;
  const el = document.createElement('span');
  el.className = 'nature-tag';
  el.dataset.nature = nature;
  el.textContent = label;
  return el;
}
