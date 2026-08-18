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

/* 已知的「明確開放授權」文件。命名了其中之一，機關就已經對讀者說了他能做什麼。
   這份清單刻意只認得具體的授權文件名稱，不做模糊比對——認不得的一律歸入
   「需要當心」那一側，因為把不清楚的授權誤判成清楚的，代價遠大於反過來。 */
const PLAIN_GRANTS = [
  '政府資料開放授權條款',
  '原住民族委員會開放資料使用規範',
  '政府法規，公眾得自由利用',
];

/* 出現這些字就不是單純的開放授權，無論同一段裡還提到什麼授權名稱。
   例：教育調查統計那筆的 license 同時提到「政府資料開放授權條款第1版」
   與「待確認」——那是兩個平臺說法不一致，不能算清楚。 */
const NOT_PLAIN = /非開放授權|無授權宣告|待確認/;

/* 這一筆的授權是否為明確開放授權。
   判準【只讀 license 欄位本身】，不另設一個人工維護的旗標：
   旗標與授權文字一旦不同步，頁面就會顯示與條款相反的分類，而那不會有任何錯誤訊號。 */
function isPlainGrant(source) {
  const lic = source.license ?? '';
  if (NOT_PLAIN.test(lic)) return false;
  return PLAIN_GRANTS.some((name) => lic.includes(name));
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

  /* 授權清楚時就到此為止：機關已經說了讀者能做什麼，本專案再加一句
     只會讓真正需要當心的那幾筆淹沒在一致的版面裡。 */
  if (isPlainGrant(source)) {
    box.dataset.plain = 'true';
    return box;
  }

  /* 授權不清楚時，說的是【本專案做了什麼】，不是【能不能做】。
     一個叫「可再利用」的欄位，旁邊寫再多警語都會被讀成對讀者的許可；
     一句描述行為的話則要讀者自己拿去對照條款——那一步正是責任轉移的分界。 */
  if (source.ourUse) {
    const use = el('div', 'cat-licence-part');
    use.append(el('h4', null, '本專案做了什麼'));
    use.append(el('p', 'cat-our-use', source.ourUse));
    use.append(el('p', 'cat-our-use-note',
      '這是本專案的實際作法，不是提供者給你的授權。'
      + '你的用途能不能成立，請拿這段與左側的授權條款自行對照；推導過程見下方「原始說明」。'));
    box.append(use);
  }
  /* ourUse 未填時不補任何文字：在授權這件事上，空欄位的正確處置是不說話，
     說「未記載」反而像是宣稱本專案審視過而無可奉告。 */

  return box;
}

function sourceEntry(source) {
  const item = el('article', 'cat-entry');
  /* 需要當心者在版面上要看得出來，讀者不必逐筆展開。 */
  if (!isPlainGrant(source)) item.dataset.needsCare = 'true';

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
  const care = sources.filter((s) => !isPlainGrant(s)).length;
  box.append(el('p', 'cat-summary-care',
    `其中 ${care} 筆的授權不是單純的開放授權——授權被保留、未宣告、`
    + '以非資料用途的條款涵蓋，或兩個平臺說法不一致。'
    + '這幾筆另附本專案的實際作法，供你對照條款自行判斷。'));
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
