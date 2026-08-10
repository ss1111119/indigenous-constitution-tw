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
