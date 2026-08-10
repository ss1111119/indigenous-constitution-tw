/* 溯源介面
 *
 * CLAUDE.md 第 3 條：任何呈現在網站上的數字，都要能在 data/sources.json 追到來源。
 * 這支模組把那條紀律變成介面行為——點任何一個數字，看得到它的機關、基準日、性質。
 *
 * 資料來源分兩層（design 決策六）：
 *   性質標籤取自各 processed JSON 的 _fieldNature，前端不自行判斷；
 *   機關與日期等詳情才去載 data/sources.json，且只在使用者真的要看時才載。
 */

import { loadData } from './state.js';

const NATURE_LABEL = {
  'official-statistic': '官方統計',
  'academic-estimate': '學術估計',
  'derived-by-this-project': '本站計算',
  'historical-record': '歷史紀錄',
  compilation: '混合來源',
};

const NATURE_NOTE = {
  'official-statistic': '由政府機關發布的統計數字。',
  'academic-estimate': '學術或專家評估，不是官方統計。使用時必須與官方數字分開標示。',
  'derived-by-this-project': '本站以官方數字計算而得。判準是「官方從未發布過這個數字」——'
    + '不是「有沒有經過計算」。',
  'historical-record': '史料紀錄，不可與現代統計並列。',
  compilation: '混合來源的彙整，檔內各項性質不同，須逐項查看。',
};

let sourcesPromise = null;
function sources() {
  /* 只在使用者第一次要看詳情時才載入。sources.json 含大量網站用不到的
     口徑陷阱與驗證說明，不該在首次渲染就付這個成本。 */
  if (!sourcesPromise) sourcesPromise = loadData('sources.json');
  return sourcesPromise;
}

let popover = null;

function closePopover() {
  popover?.remove();
  popover = null;
}

async function openPopover(trigger) {
  closePopover();
  const { sourceId, field, nature } = trigger.dataset;

  popover = document.createElement('div');
  popover.className = 'prov-popover';
  popover.setAttribute('role', 'dialog');
  popover.innerHTML = '<p class="prov-loading">載入來源資訊…</p>';
  document.body.append(popover);
  place(trigger);

  try {
    const doc = await sources();
    const src = doc.sources.find((s) => s.id === sourceId);
    const natureKey = nature ?? 'official-statistic';
    popover.innerHTML = `
      <button type="button" class="prov-close" aria-label="關閉">×</button>
      <p class="prov-field">${field ?? ''}</p>
      <p class="prov-nature"><span class="nature-tag" data-nature="${natureKey}">${NATURE_LABEL[natureKey] ?? natureKey}</span></p>
      <p class="prov-note">${NATURE_NOTE[natureKey] ?? ''}</p>
      <dl class="prov-meta">
        <dt>提供機關</dt><dd>${src ? src.agency : '（此來源未登記，請回報）'}</dd>
        <dt>資料基準日</dt><dd>${src?.dataDate ?? '—'}</dd>
        <dt>資料集</dt><dd>${src?.title ?? sourceId}</dd>
        <dt>授權</dt><dd>${src?.license ?? '—'}</dd>
      </dl>
      ${src?.url ? `<p class="prov-link"><a href="${src.url}" rel="noopener" target="_blank">來源網址</a></p>` : ''}
      <p class="prov-foot">完整記錄（含口徑陷阱與資料缺口）見 <code>data/sources.json</code> 的 <code>${sourceId}</code>。</p>
    `;
    popover.querySelector('.prov-close').addEventListener('click', closePopover);
    place(trigger);
  } catch (err) {
    popover.innerHTML = `<p class="prov-loading">來源資訊載入失敗：${err.message}</p>`;
  }
}

function place(trigger) {
  const r = trigger.getBoundingClientRect();
  popover.style.top = `${r.bottom + window.scrollY + 6}px`;
  /* 靠右時往左推，避免超出視窗造成頁面橫向滾動。 */
  const left = Math.min(r.left + window.scrollX, window.innerWidth - popover.offsetWidth - 16);
  popover.style.left = `${Math.max(8, left)}px`;
}

/* 把一個數字包成可查來源的元素。
   數字本身仍是純文字，螢幕閱讀器讀到的是「數字，按鈕，查看來源」。 */
export function traceable(value, { sourceId, field, nature }) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'prov-trigger';
  el.dataset.sourceId = sourceId;
  el.dataset.field = field;
  el.dataset.nature = nature;
  el.setAttribute('aria-label', `${field} ${value}，查看資料來源`);
  el.textContent = value;
  return el;
}

/* 事件委派：面板重新渲染不需要重新綁定。 */
document.addEventListener('click', (e) => {
  const trigger = e.target.closest('.prov-trigger');
  if (trigger) {
    openPopover(trigger);
    return;
  }
  if (!e.target.closest('.prov-popover')) closePopover();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePopover();
});
