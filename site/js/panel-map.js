/* 人口面板：原住民人口比例分布圖
 *
 * 形式（依 dataviz 規範）：choropleth 的工作是比較量值，故用【單一色相由淺到深】的
 * sequential 編碼，不是類別色。
 *
 * 「原住民族地區」是另一個維度（法定身分，非量值），不能用同一個顏色通道表達，
 * 否則兩件事會互相干擾。改以外框粗細與顏色作為第二編碼，並在圖例中說明。
 *
 * 不載入任何底圖磚——見 vendor/README.md。
 */

import { createPanel, fmt } from './panel.js';
import { DATA_BASE } from './state.js';

/* sequential 藍色階（palette.md）。固定級距而非分位數：
   分位數會讓同一個顏色在不同層級代表不同數值，跨層級比較就失效了。
   級距刻意不等寬——原住民人口比例的分布極度右偏（多數行政區低於 2%，
   原鄉可達 98%），等寬級距會讓 90% 的行政區擠在同一色。 */
const BREAKS = [
  { max: 1, color: '#cde2fb', label: '低於 1%' },
  { max: 2.5, color: '#9ec5f4', label: '1–2.5%' },
  { max: 5, color: '#6da7ec', label: '2.5–5%' },
  { max: 10, color: '#3987e5', label: '5–10%' },
  { max: 25, color: '#256abf', label: '10–25%' },
  { max: 50, color: '#184f95', label: '25–50%' },
  { max: Infinity, color: '#0d366b', label: '50% 以上' },
];

const NO_DATA_COLOR = '#e6e2da';

function colorFor(pct) {
  if (pct == null) return NO_DATA_COLOR;
  return BREAKS.find((b) => pct < b.max).color;
}

/* ⚠️ 直接對全部多邊形做 fitBounds 會得到一張無法讀的圖，原因有二：
     1. 高雄市的行政範圍包含【東沙群島與南沙太平島】——太平島在北緯 10.4 度、
        東經 114.4 度的南海。實測整體範圍因此橫跨緯度 10.4~25.9 度，
        臺灣本島被壓縮成一小條。
     2. 金門縣（東經 118.2 度）與連江縣（北緯 26.4 度）也遠離本島。
   故預設視野改用一個明確的框，再與實際資料範圍取交集。
   資料本身沒有被排除——使用者縮小地圖就看得到這些離島，只是預設不入鏡。 */
const TAIWAN_VIEW = { west: 119.3, east: 122.1, south: 21.85, north: 25.4 };

let map = null;
let layer = null;

/* 視野尚未套用。地圖在容器尺寸為零時（面板隱藏，或重繪過程中容器暫時脫離 DOM）
   不能量測也不能調整視野——量測會把 Leaflet 的尺寸快取寫成 (0, 0)，
   而以零尺寸算出的縮放級距是錯的。

   但「跳過」不能等於「不做」：使用者可能在別的分頁改變地區，此時圖層已換成新地區、
   視野卻還框著舊地區。故跳過時記下這件事，等容器真的有尺寸了再補上。 */
let pendingFit = false;

/* 容器有實際尺寸才能量測。判斷放在本模組而非呼叫端：呼叫端能判斷的是「面板可見」，
   但容器在重繪過程中會短暫脫離 DOM——那時面板是可見的，容器卻沒有尺寸。 */
function isMeasurable(m) {
  const r = m.getContainer().getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function fitToView(m, lyr) {
  if (!isMeasurable(m)) {
    pendingFit = true;
    return;
  }
  const L = window.L;
  const data = lyr.getBounds();
  /* 與預設框取交集：本島與澎湖落在框內，南海諸島與金馬被裁掉。
     若某個縣市完全在框外（不會發生，但防呆），退回它自己的範圍。 */
  const south = Math.max(data.getSouth(), TAIWAN_VIEW.south);
  const north = Math.min(data.getNorth(), TAIWAN_VIEW.north);
  const west = Math.max(data.getWest(), TAIWAN_VIEW.west);
  const east = Math.min(data.getEast(), TAIWAN_VIEW.east);
  const ok = south < north && west < east;
  m.fitBounds(ok ? L.latLngBounds([south, west], [north, east]) : data, { padding: [8, 8] });
  pendingFit = false;
}

function ensureMap(container) {
  if (map) {
    /* 重新渲染時沿用同一個 map 實例，只換圖層——重建 map 會讓使用者的
       平移縮放位置被重設，切換地區時體感很差。 */
    container.append(map.getContainer());
    if (isMeasurable(map)) map.invalidateSize();
    return map;
  }
  const el = document.createElement('div');
  el.className = 'map-canvas';
  container.append(el);
  map = window.L.map(el, {
    /* 不載磚，故關掉會露出灰色磚格的預設行為 */
    attributionControl: false,
    zoomSnap: 0.25,
    /* 捲動頁面時不要意外縮放地圖 */
    scrollWheelZoom: false,
  });
  /* 點一下地圖才啟用滾輪縮放，避免捲頁時被吃掉 */
  map.on('focus', () => map.scrollWheelZoom.enable());
  map.on('blur', () => map.scrollWheelZoom.disable());
  return map;
}

function legend(container, showDistrictMark) {
  const box = document.createElement('div');
  box.className = 'map-legend';

  const title = document.createElement('span');
  title.className = 'map-legend-title';
  title.textContent = '原住民人口比例';
  box.append(title);

  for (const b of BREAKS) {
    const item = document.createElement('span');
    item.className = 'map-legend-item';
    const sw = document.createElement('i');
    sw.style.background = b.color;
    item.append(sw, document.createTextNode(b.label));
    box.append(item);
  }

  if (showDistrictMark) {
    const item = document.createElement('span');
    item.className = 'map-legend-item map-legend-district';
    const sw = document.createElement('i');
    item.append(sw, document.createTextNode('原住民族地區（法定指定）'));
    box.append(item);
  }
  container.append(box);
}

async function render(container, [popData], region) {
  const L = window.L;

  /* 全國看 22 縣市；選定縣市看其鄉鎮；已在鄉鎮層級則維持顯示所屬縣市的鄉鎮，
     讓使用者看得到被選中的那一個在哪裡。 */
  const countyCode = region.level === 'national' ? null : region.code.slice(0, 5);
  const geoPath = countyCode ? `geo/townships/${countyCode}.geojson` : 'geo/counties.geojson';

  const heading = document.createElement('h3');
  heading.className = 'chart-title';
  heading.textContent = countyCode ? `${region.name.slice(0, 3)}各鄉鎮原住民人口比例` : '各縣市原住民人口比例';
  container.append(heading);

  /* 這裡不走 loadData()：圖資只在下鑽時用一次，放進 state.js 的資料快取
     會把最大的幾個檔案一直留在記憶體。但路徑基底仍用共享的 DATA_BASE，
     不自寫字面值。 */
  const geo = await fetch(`${DATA_BASE}/${geoPath}`).then((r) => {
    if (!r.ok) throw new Error(`${geoPath} 載入失敗（HTTP ${r.status}）`);
    return r.json();
  });

  /* 以 district_code 建索引，避免每個多邊形都線性搜尋一次。 */
  const byCode = new Map(popData.data.map((r) => [r.district_code, r]));

  const m = ensureMap(container);
  if (layer) layer.remove();

  layer = L.geoJSON(geo, {
    style: (feature) => {
      const row = byCode.get(feature.properties.code);
      const isDistrict = row?.is_indigenous_district === true;
      return {
        fillColor: colorFor(row ? row.indigenous_ratio_pct : null),
        fillOpacity: 1,
        /* 外框即相鄰多邊形之間的間隔，用底色而非黑框——
           黑框會在小面積行政區上蓋掉填色本身。 */
        color: isDistrict ? '#7a4a2b' : '#ffffff',
        weight: isDistrict ? 2 : 1,
        /* 被選中的那一個加上虛線強調 */
        dashArray: feature.properties.code === region.code ? '4 3' : null,
      };
    },
    onEachFeature: (feature, lyr) => {
      const row = byCode.get(feature.properties.code);
      const name = feature.properties.name;
      if (!row) {
        lyr.bindTooltip(`${name}<br>無對應人口資料`, { sticky: true });
        return;
      }
      const mark = row.is_indigenous_district ? '<br>原住民族地區' : '';
      lyr.bindTooltip(
        `<strong>${name}</strong><br>原住民 ${fmt(row.indigenous_total)} 人`
        + `<br>占該區人口 ${row.indigenous_ratio_pct.toFixed(2)}%${mark}`,
        { sticky: true },
      );
    },
  }).addTo(m);

  fitToView(m, layer);

  legend(container, Boolean(countyCode));

  const foot = document.createElement('p');
  foot.className = 'chart-foot';
  foot.textContent = countyCode
    ? '外框較粗者為原住民族地區——依《原住民族基本法》第 2 條由行政院公告指定，全國共 55 個鄉鎮（山地鄉 30、平地鄉 25）。'
    : '「原住民族地區」是鄉鎮層級的法定指定，沒有縣市層級的對應概念，故選定縣市後才會標示。';
  container.append(foot);
}

/* 重新量測地圖並修正版面。呼叫端只需表達「這張地圖所在的面板剛顯示出來了」，
   要不要做、怎麼做由本模組決定——map 實例刻意不對外匯出，否則呼叫端就得知道
   Leaflet 的 API、知道零尺寸不能量測、知道實例可能還不存在。

   兩種無操作的情況都是正常競速結果，不是異常，故刻意靜默不記錄警告：
     1. 地圖尚未建立——初始渲染要先取得 GeoJSON，切換分頁可能早於它完成。
     2. 容器尺寸為零——面板仍隱藏，或重繪過程中容器暫時脫離 DOM。 */
export function refreshMapLayout() {
  if (!map || !isMeasurable(map)) return;
  map.invalidateSize();
  /* 補上先前因容器沒有尺寸而跳過的視野調整，否則框住的會是上一個地區。 */
  if (pendingFit && layer) fitToView(map, layer);
}

export const mapPanel = createPanel({
  el: '[data-role="population-map"]',
  sources: (region) => [region.level === 'national'
    ? 'processed/population-by-county.json'
    : 'processed/population-by-township.json'],
  render,
});
