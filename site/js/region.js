/* 全域地區選擇器
 *
 * 兩個下拉：縣市，以及選定縣市後才出現的鄉鎮。
 * 鄉鎮清單延後載入——population-by-township.json 有 163KB，
 * 首次渲染不該為了一個可能不會被展開的下拉付這個成本。
 */

import { loadData, setRegion, getRegion } from './state.js';

const COUNTY_SRC = 'processed/population-by-county.json';
const TOWNSHIP_SRC = 'processed/population-by-township.json';

export async function initRegionSelector() {
  const countySel = document.querySelector('[data-role="region"]');
  const townshipSel = document.querySelector('[data-role="region-township"]');
  const resetBtn = document.querySelector('[data-role="region-reset"]');
  if (!countySel || !townshipSel || !resetBtn) return;

  const counties = (await loadData(COUNTY_SRC)).data;
  for (const row of counties) {
    countySel.append(new Option(row.name, row.district_code));
  }

  /* 鄉鎮資料只載入一次，之後從這裡分組取用。 */
  let townshipsByCounty = null;

  async function fillTownships(countyCode) {
    if (!townshipsByCounty) {
      const rows = (await loadData(TOWNSHIP_SRC)).data;
      townshipsByCounty = new Map();
      for (const row of rows) {
        const key = row.district_code.slice(0, 5);
        if (!townshipsByCounty.has(key)) townshipsByCounty.set(key, []);
        townshipsByCounty.get(key).push(row);
      }
    }
    townshipSel.textContent = '';
    townshipSel.append(new Option('全縣市', ''));
    for (const row of townshipsByCounty.get(countyCode) ?? []) {
      /* 鄉鎮名在資料中是「花蓮縣秀林鄉」，下拉裡去掉縣市前綴較好讀。 */
      const short = row.name.startsWith(countyName(countyCode))
        ? row.name.slice(countyName(countyCode).length)
        : row.name;
      const label = row.is_indigenous_district ? `${short}（原住民族地區）` : short;
      townshipSel.append(new Option(label, row.district_code));
    }
  }

  function countyName(code) {
    return counties.find((r) => r.district_code === code)?.name ?? '';
  }

  function townshipName(code) {
    const row = townshipsByCounty?.get(code.slice(0, 5))?.find((r) => r.district_code === code);
    return row?.name ?? code;
  }

  countySel.addEventListener('change', async () => {
    const code = countySel.value;
    if (!code) {
      townshipSel.hidden = true;
      resetBtn.hidden = true;
      setRegion({ level: 'national' });
      return;
    }
    await fillTownships(code);
    townshipSel.hidden = false;
    resetBtn.hidden = false;
    setRegion({ level: 'county', code, name: countyName(code) });
  });

  townshipSel.addEventListener('change', () => {
    const code = townshipSel.value;
    if (!code) {
      const countyCode = countySel.value;
      setRegion({ level: 'county', code: countyCode, name: countyName(countyCode) });
      return;
    }
    setRegion({ level: 'township', code, name: townshipName(code) });
  });

  resetBtn.addEventListener('click', () => {
    countySel.value = '';
    townshipSel.textContent = '';
    townshipSel.hidden = true;
    resetBtn.hidden = true;
    setRegion({ level: 'national' });
  });
}

/* 面板的範圍標示。選舉與席次模擬面板【不】呼叫這個——
   它們的範圍是固定的全國，寫死在 HTML 裡，不隨狀態變動。 */
export function bindScopeLabel(selector) {
  const el = document.querySelector(selector);
  if (!el) return () => {};
  return (region) => {
    el.textContent = region.name;
    el.dataset.level = region.level;
  };
}

export { getRegion };
