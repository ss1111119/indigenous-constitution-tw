/* 啟動點
 *
 * 面板逐一註冊到共享狀態。每個面板的初始化都獨立 try/catch——
 * 一個面板壞掉不能讓其餘面板收不到通知或整頁空白。
 */

import { onRegionChange } from './state.js';
import { initRegionSelector, bindScopeLabel } from './region.js';
import { populationPanel } from './panel-population.js';
import { mapPanel } from './panel-map.js';

async function main() {
  try {
    await initRegionSelector();
  } catch (err) {
    console.error('地區選擇器初始化失敗：', err);
    const bar = document.querySelector('.region-bar');
    if (bar) {
      const msg = document.createElement('p');
      msg.className = 'panel-error';
      msg.textContent = `地區選擇器無法載入：${err.message}。各面板將維持全國資料。`;
      bar.appendChild(msg);
    }
  }

  /* 隨地區變動的面板：人口與土地。
     選舉與席次模擬固定為全國，其範圍標示寫在 HTML 中，不在此註冊。 */
  onRegionChange(bindScopeLabel('[data-role="scope-population"]'));
  onRegionChange(bindScopeLabel('[data-role="scope-land"]'));

  onRegionChange(populationPanel);
  onRegionChange(mapPanel);
}

main();
