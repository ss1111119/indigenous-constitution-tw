/* 資料目錄頁
 *
 * 受眾是想使用這些資料的人（開發者、研究者），不是讀站台數字的一般讀者。
 * 首頁的 traceable() 把來源掛在每個數字上，但只給機關、基準日、授權名稱與網址；
 * 驗證層級、格式陷阱、自動化障礙、「評估過但不取用」這類資料集層級的說明沒有位置放。
 * 這一頁就是那個位置。
 *
 * 設計上的界線（見 design）：
 *   - 內容【一律由 sources.json 產生】。手寫任何一筆都會重演 index.html 的
 *     「資料缺口」段落那個問題：它是手寫的、不由 gaps[] 產生，於是登記檔新增一筆
 *     不會出現在任何地方，兩邊無聲地不同步。
 *   - 授權拆成兩個獨立事實：license 是【提供者的授權宣告】，reusable 是
 *     【本專案對自身使用的判斷】。兩者不是同一件事——cip-monthly-population 的
 *     license 為「非開放授權」而 reusable 為 true，因為本專案判斷自己
 *     「逐字、未改動、註明出處」的再散布落在該宣告允許的範圍內，而同一筆的 notes
 *     明確排除改作與去除出處。把兩者併成一個綠色標記，等於叫讀者去做被排除的事。
 *   - notes 原文完整呈現、不截斷不摘要——那正是這份盤點的價值所在。
 */

import { DATA_BASE } from './state.js';

const REGISTRY = 'sources.json';

/* reusable 的三種值各自呈現，unknown 不併入任一端。
   文案刻意都以「本專案」起頭：這一欄記的是本專案的判斷，不是給讀者的授權。 */
const REUSE = {
  true: { label: '本專案判斷可再利用', tone: 'yes' },
  false: { label: '本專案判斷不可再利用', tone: 'no' },
  unknown: { label: '本專案尚未判斷', tone: 'unknown' },
};

function reuseOf(value) {
  return REUSE[String(value)] ?? REUSE.unknown;
}

/* 授權宣告與再利用判斷是否互相牴觸。
   判準只用資料本身：宣告文字表明不是開放授權、或根本沒有授權宣告，
   而本專案仍判斷可再利用——這種組合必須把讀者導向該筆自己的說明，
   因為「為什麼仍可再利用」的推導只寫在 notes 裡。 */
function needsReasoning(source) {
  const notOpen = /非開放授權|無授權宣告/.test(source.license ?? '');
  /* 注意：reusable 在登記檔中是【字串】'true'/'false'/'unknown'，不是布林，
     而同檔的 api 卻是真布林。用 === true 比較會永遠不成立，警語就不會出現——
     而那是靜默失效，畫面看起來完全正常。統一以字串比較。 */
  return notOpen && String(source.reusable) === 'true';
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* 未記載與空白不同：欄位缺值時明說「未記載」，不留空也不推測。 */
function fieldValue(value) {
  if (value === undefined || value === null || value === '') return '未記載';
  if (value === true) return '有';
  if (value === false) return '無';
  return String(value);
}

function definitionRow(dl, term, value) {
  dl.append(el('dt', null, term));
  dl.append(el('dd', null, fieldValue(value)));
}

function licenceBlock(source) {
  const box = el('div', 'cat-licence');

  const grant = el('div', 'cat-licence-part');
  grant.append(el('h4', null, '提供者的授權宣告'));
  grant.append(el('p', 'cat-licence-text', fieldValue(source.license)));
  if (source.licenseUrl) {
    const a = el('a', 'cat-licence-link', '授權條款原文');
    a.href = source.licenseUrl;
    a.rel = 'noopener';
    a.target = '_blank';
    grant.append(a);
  }
  box.append(grant);

  const judgement = el('div', 'cat-licence-part');
  judgement.append(el('h4', null, '本專案的再利用判斷'));
  const verdict = reuseOf(source.reusable);
  const tag = el('p', 'cat-reuse', verdict.label);
  tag.dataset.tone = verdict.tone;
  judgement.append(tag);
  /* 這句對每一筆都成立，不只對牴觸的那幾筆：判斷的射程是本專案的用法，
     讀者的用途可能更寬（例如改作），那不在這個判斷的涵蓋範圍內。 */
  judgement.append(el('p', 'cat-reuse-scope',
    '此為本專案對自身使用方式的判斷，不是提供者給讀者的授權。'
    + '你的用途若與本專案不同（例如改作、重新編排、去除出處），須自行依授權條款評估。'));
  if (needsReasoning(source)) {
    judgement.append(el('p', 'cat-reuse-conflict',
      '⚠️ 本筆的授權宣告並非開放授權，而本專案仍判斷可再利用——'
      + '推導過程與其適用範圍記於下方「原始說明」，使用前請讀完該段。'));
  }
  box.append(judgement);

  return box;
}

function sourceEntry(source) {
  const item = el('article', 'cat-entry');

  const head = el('header', 'cat-entry-head');
  head.append(el('h3', null, source.title ?? source.id));
  head.append(el('p', 'cat-id', source.id));
  item.append(head);

  const dl = el('dl', 'cat-fields');
  definitionRow(dl, '提供機關', source.agency);
  definitionRow(dl, '格式', source.format);
  definitionRow(dl, '資料基準日', source.dataDate);
  definitionRow(dl, '更新頻率', source.updateFrequency);
  definitionRow(dl, '程式介面（API）', source.api);
  definitionRow(dl, '驗證層級', source.verification);
  definitionRow(dl, '取得日期', source.downloadedAt);
  definitionRow(dl, '檔案雜湊', source.sha256 ? `${source.sha256Kind ?? 'sha256'}：${source.sha256}` : undefined);
  item.append(dl);

  const links = el('p', 'cat-links');
  const page = el('a', null, '來源頁面');
  page.href = source.url;
  page.rel = 'noopener';
  page.target = '_blank';
  links.append(page);
  if (source.downloadUrl) {
    const dl2 = el('a', null, '直接下載');
    dl2.href = source.downloadUrl;
    dl2.rel = 'noopener';
    dl2.target = '_blank';
    links.append(dl2);
  }
  item.append(links);

  item.append(licenceBlock(source));

  /* 原文預設收合但不截斷。用原生 details，停用 JavaScript 時仍展得開。 */
  const details = el('details', 'cat-notes');
  details.append(el('summary', null, '原始說明（完整原文）'));
  details.append(el('p', 'cat-notes-body', source.notes ?? '未記載'));
  item.append(details);

  return item;
}

function gapEntry(gap) {
  const item = el('article', 'cat-gap');
  item.append(el('h3', null, gap.title ?? gap.id));
  item.append(el('p', 'cat-id', gap.id));

  const dl = el('dl', 'cat-fields');
  definitionRow(dl, '狀態', gap.status);
  definitionRow(dl, '理應由誰產出', gap.expectedAgency);
  definitionRow(dl, '最早可能出現', gap.earliestAvailable);
  item.append(dl);

  item.append(el('p', 'cat-gap-reason', fieldValue(gap.reason)));

  /* 替代數字與「不得如何使用」必須同時出現。只顯示替代值會讓讀者
     把學術估計當成官方數字——那是本專案資料紀律第 1、2 條要防的事。 */
  if (gap.surrogate) {
    const sur = el('p', 'cat-gap-surrogate');
    sur.append(el('strong', null, '替代估計：'));
    sur.append(document.createTextNode(
      `${gap.surrogate}（性質：${fieldValue(gap.surrogateNature)}）`));
    item.append(sur);
  }
  if (gap.mustNotDo) {
    const must = el('p', 'cat-gap-mustnot');
    must.append(el('strong', null, '不得：'));
    must.append(document.createTextNode(gap.mustNotDo));
    item.append(must);
  }

  return item;
}

function summarise(sources) {
  const withApi = sources.filter((s) => s.api === true).length;
  const box = el('div', 'cat-summary');
  box.append(el('p', null,
    `共 ${sources.length} 筆來源，其中 ${withApi} 筆記有程式介面、`
    + `${sources.length - withApi} 筆沒有。`));
  /* 不假裝「為什麼不能自動追蹤」已經結構化——它目前只寫在各筆的原文裡。 */
  box.append(el('p', 'cat-summary-note',
    '無程式介面者的原因（例如下載連結為不可推導的隨機識別碼、連結由指令碼產生、'
    + '或檔案格式跨期變動）記於各筆的「原始說明」，本頁未將其結構化。'));
  return box;
}

/* 機關清單由資料產生，填進導言的佔位元素。寫死清單會在新增來源時漏列，
   而漏列不會有任何錯誤訊號。 */
function fillAgencyList(sources) {
  const slot = document.querySelector('[data-role="agency-list"]');
  if (!slot) return;
  const agencies = [...new Set(sources.map((s) => s.agency).filter(Boolean))];
  slot.textContent = `目前收錄的提供機關：${agencies.join('、')}。`;
}

async function render() {
  const root = document.querySelector('[data-role="catalogue"]');
  if (!root) return;

  let doc;
  try {
    const res = await fetch(`${DATA_BASE}/${REGISTRY}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    doc = await res.json();
  } catch (err) {
    /* 與站台其他面板一致：明說失敗並指出缺哪一份檔案，不以空表帶過。 */
    root.innerHTML = '';
    root.append(el('p', 'panel-error',
      `資料載入失敗：${err.message} 來源：${DATA_BASE}/${REGISTRY}`));
    return;
  }

  root.innerHTML = '';

  const sources = doc.sources ?? [];
  const gaps = doc.gaps ?? [];

  fillAgencyList(sources);
  root.append(summarise(sources));

  const sourceSection = el('section', 'cat-section');
  sourceSection.append(el('h2', null, `資料來源（${sources.length} 筆）`));
  sources.forEach((s) => sourceSection.append(sourceEntry(s)));
  root.append(sourceSection);

  /* 缺口與可用來源分開成兩個 section：混在一張表裡，
     「不存在的資料」會被當成「可以取用的資料」。 */
  const gapSection = el('section', 'cat-section cat-section-gaps');
  gapSection.append(el('h2', null, `資料缺口（${gaps.length} 筆）`));
  gapSection.append(el('p', 'cat-section-note',
    '以下是本專案查證後確認【目前不存在或無法取得】的資料。它們不是來源，不可取用。'));
  gaps.forEach((g) => gapSection.append(gapEntry(g)));
  root.append(gapSection);
}

render();
