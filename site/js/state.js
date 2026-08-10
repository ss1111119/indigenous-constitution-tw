/* 全域共享狀態
 *
 * 依 design.md 決策一：地區選擇器是【唯一】的跨面板共享狀態。
 * 面板之間不得以任何其他方式互相篩選——沒有事件總線、沒有面板互相持有參照。
 * 若日後需要第二個共享狀態，那是一個設計決定，須先更新 design 再實作。
 *
 * 為什麼選舉與席次模擬面板不吃這個狀態：原住民立委選舉區是山地、平地兩個
 * 全國性選區，在資料層就不是行政區，無法依縣市切分。讓它們跟著變會做出
 * 「點了沒反應」的介面，比不連動更糟。
 */

const DATA_BASE = '../data';

/* 已載入的資料集快取。鄉鎮層級的檔案較大（population 163KB、tribes 245KB），
   故一律延後到首次下鑽時才載入，不在首次渲染時付這個成本。 */
const cache = new Map();

export async function loadData(name) {
  if (!cache.has(name)) {
    cache.set(name, fetch(`${DATA_BASE}/${name}`).then((res) => {
      if (!res.ok) throw new Error(`${name} 載入失敗（HTTP ${res.status}）`);
      return res.json();
    }));
  }
  return cache.get(name);
}

/* 地區狀態。level 決定 code 的意義：
     national  → code 為 null
     county    → code 為 5 碼縣市代碼
     township  → code 為 8 碼鄉鎮代碼 */
const region = { level: 'national', code: null, name: '全國' };

const listeners = new Set();

export function getRegion() {
  /* 回傳複本，避免呼叫端直接改到內部狀態而繞過通知機制。 */
  return { ...region };
}

export function setRegion(next) {
  const level = next.level ?? 'national';
  const code = level === 'national' ? null : next.code;
  if (level === region.level && code === region.code) return;
  region.level = level;
  region.code = code;
  region.name = next.name ?? '全國';
  notify();
}

export function onRegionChange(fn) {
  listeners.add(fn);
  /* 立刻以現值呼叫一次，讓訂閱者不必自己處理初始渲染。 */
  fn(getRegion());
  return () => listeners.delete(fn);
}

function notify() {
  const snapshot = getRegion();
  for (const fn of listeners) {
    /* 一個面板拋錯不能讓其餘面板收不到通知。
       對應 dashboard-shell 的「Isolate panel data failures」要求。 */
    try {
      fn(snapshot);
    } catch (err) {
      console.error('面板更新失敗：', err);
    }
  }
}

/* 面板共用的錯誤呈現。錯誤訊息必須帶出來源路徑，
   否則使用者只看到「載入失敗」而不知道是哪一份資料。 */
export function renderPanelError(container, err, sourcePath) {
  container.innerHTML = '';
  const box = document.createElement('p');
  box.className = 'panel-error';
  box.textContent = `資料載入失敗：${err.message}`;
  const hint = document.createElement('span');
  hint.textContent = ` 來源：${DATA_BASE}/${sourcePath}`;
  box.appendChild(hint);
  container.appendChild(box);
}
