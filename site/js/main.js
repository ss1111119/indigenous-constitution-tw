/* 啟動點
 *
 * 面板逐一註冊到共享狀態。每個面板的初始化都獨立 try/catch——
 * 一個面板壞掉不能讓其餘面板收不到通知或整頁空白。
 */

import { onRegionChange } from './state.js';
import { initRegionSelector, bindScopeLabel } from './region.js';
import { populationPanel } from './panel-population.js';
import { mapPanel } from './panel-map.js';
import { turnoutPanel, ratioPanel } from './panel-election.js';
import { landPanel } from './panel-land.js';
import { simulatorPanel, timelinePanel } from './panel-simulator.js';

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

  /* 選舉面板固定為全國。仍透過 onRegionChange 註冊是為了取得一次初始渲染；
     它會忽略傳入的 region，資料本身就沒有行政區維度。 */
  onRegionChange(turnoutPanel);
  onRegionChange(ratioPanel);

  onRegionChange(landPanel);

  /* 模擬器固定為全國。 */
  onRegionChange(timelinePanel);
  onRegionChange(simulatorPanel);
}

/* 分頁切換後，重算剛顯示出來的面板中的圖表版面。
 *
 * 為什麼需要：分頁以 CSS display 切換，非作用中的面板在建立圖表時寬度為 0。
 * Chart.js 之後會重繪刻度，但資料點的版面不會跟著重算——症狀是刻度橫跨滿版、
 * 資料點卻全擠在最左端，看起來像資料錯了，其實是版面沒更新。
 * Leaflet 同理，隱藏時初始化的地圖需要 invalidateSize。
 */
function refreshVisiblePanel() {
  /* 必須等一幀：change 事件觸發時 CSS 的 display 尚未套用完成，
     此時量到的容器寬度仍是 0。 */
  requestAnimationFrame(() => {
    const panel = [...document.querySelectorAll('.panel')]
      .find((p) => getComputedStyle(p).display !== 'none');
    if (!panel) return;
    for (const canvas of panel.querySelectorAll('canvas')) {
      const chart = window.Chart?.getChart(canvas);
      if (!chart) continue;
      /* resize() 只改畫布尺寸，【不會】重算資料點的版面——
         症狀是刻度已鋪滿而資料點仍擠在原處。必須再 update()。 */
      chart.resize();
      chart.update('none');
    }
    /* Leaflet 的容器在隱藏時尺寸為 0，顯示後須告知它重新量測。 */
    if (panel.querySelector('.leaflet-container')) {
      window.dispatchEvent(new Event('resize'));
    }
  });
}

for (const radio of document.querySelectorAll('.tab-radio')) {
  radio.addEventListener('change', refreshVisiblePanel);
}

main();
