## Summary

分頁切換後的地圖版面重算，改為對「剛顯示出來的那一張地圖」直接呼叫 Leaflet 的量測 API，不再以全域 `window resize` 事件廣播；並在容器尺寸為零時跳過量測與視野調整。

## Motivation

`site/js/main.js` 的 `refreshVisiblePanel()` 在偵測到剛顯示的面板含有 Leaflet 容器時，發出全域 `window resize` 事件，藉此讓 Leaflet 重新量測容器尺寸。這樣做能達到目的，但手段與意圖不相稱：

- **廣播打到的對象遠多於需要的對象。** 全域 resize 會被頁面上**每一個** Leaflet 實例接收，包含位於隱藏面板中的；也會被任何其他監聽 `window resize` 的程式接收。呼叫端真正想做的只有一件事——讓剛顯示的那一張地圖重新量測自己。
- **副作用會寫入狀態，不只是空轉。** 已驗證：在容器隱藏（尺寸 0×0）時觸發量測，會把 Leaflet 的尺寸快取寫成 `(0, 0)`（`getSize()` 由 400×300 變為 0×0）。而 `panel-map.js` 的 `ensureMap()` 每次重繪都會呼叫量測，重繪路徑又會把容器重新 append，故「在零尺寸狀態下量測」這個情境確實可達，不是理論上的顧慮。
- **未來多一張地圖就會出錯。** 現在只有人口面板有地圖，廣播的錯誤性質被單一實例掩蓋。第二張地圖出現時，切換到 A 面板會連帶讓隱藏的 B 地圖量測到零尺寸。

**這個 change 修正的是上述設計缺陷，不是一個已驗證的崩潰。** 本專案曾實際捕捉到 Leaflet 拋出
`Invalid LatLng object: (NaN, NaN)`，堆疊為 `_animMoveEnd` → `getCenter` → `layerPointToLatLng` → `unproject`，
發生於連續切換分頁時。該錯誤需要「動畫在飛行中而容器尺寸變為零」的時序競賽，多次嘗試後**無法穩定重現**；
已逐一排除的路徑（皆不拋錯）包括：隱藏地圖加全域 resize、尺寸快取歸零後呼叫 `getCenter`、
零尺寸地圖上呼叫視野調整、在非地圖分頁改地區後切回。

因此本 change 的驗收條件**不寫**「該錯誤不再出現」——沒有重現就無法驗證，寫了也只是自我安慰。
驗收只針對可觀察的行為。此修正是否順帶消除了那個崩潰，屬未知，且刻意不宣稱。

## Proposed Solution

- `site/js/panel-map.js` 對外提供具名入口，讓呼叫端能要求「重新量測並修正版面」，而不需要知道 Leaflet 實例存放在哪裡。地圖實例仍封裝在該模組內，不對外暴露。
- `site/js/main.js` 的 `refreshVisiblePanel()` 改為呼叫該入口，移除 `window.dispatchEvent(new Event('resize'))`。
- 量測與視野調整在容器尺寸為零時直接跳過，不寫入尺寸快取。此判斷放在 `panel-map.js` 內，讓「地圖知道自己看不見時不該做什麼」成為該模組自己的責任，呼叫端不需重複判斷。
- 尚未建立地圖時呼叫該入口為無操作，不拋錯——初始渲染是非同步的，切換分頁可能早於地圖建立。

## Non-Goals

- **不追查那個 `Invalid LatLng` 崩潰的根因。** 需要能穩定重現才有意義，目前做不到。若日後它再次出現且可重現，另開 change。
- **不升級 vendored 的 Leaflet。** 版本升級與本缺陷無關，且會牽動地圖的視覺呈現。
- **不改動地圖的視覺呈現**，包含色階、圖例、外框編碼、視野範圍與縮放行為。
- **不改動 `ensureMap()` 沿用單一 map 實例的既有決策**——該決策是為了保留使用者的平移縮放位置，重建實例會把它重設，切換地區時體感很差。
- **不改動 Chart.js 的重算行為。** `chart.resize()` 之後必須接 `chart.update('none')`，否則刻度鋪滿而資料點仍擠在原處；既有註解已說明原因，此行為原樣保留。
- 不新增自動化測試框架。專案目前沒有前端測試設施，為這一項引入不成比例。

## Alternatives Considered

- **把 map 實例直接 export 給 `main.js` 使用。** 否決：呼叫端就得知道 Leaflet 的 API 與零尺寸的陷阱，等於把 `panel-map.js` 的內部責任外洩到啟動點。具名入口讓呼叫端只表達意圖。
- **在 `panel-map.js` 內自行監聽分頁的 radio 變動，`main.js` 完全不參與。** 否決：分頁機制屬於 shell 的職責，讓每個面板各自去綁 shell 的 DOM 會讓「誰擁有分頁」變得沒有答案，且四個面板會各綁一次。
- **改用 `ResizeObserver` 觀察容器，完全不需要分頁切換的通知。** 否決：可行且更自動，但那是把版面重算的觸發機制整體換掉，會連帶影響 Chart.js 的重算路徑，範圍遠大於本缺陷；本 change 只把廣播換成指定對象。此方案值得日後單獨評估。
- **保留廣播但加上「只在面板可見時才處理」的守衛。** 否決：守衛擋不住其他 Leaflet 實例與其他 resize 監聽器，問題的本質是廣播本身。

## Impact

- Affected specs: 修改 `dashboard-shell`（新增一條關於分頁啟用時版面重算的 requirement；該 spec 目前只規定四個面板可達，未涉及重算機制）
- Affected code:
  - Modified:
    - `site/js/main.js`
    - `site/js/panel-map.js`
  - New: (none)
  - Removed: (none)
- 依賴與系統：不新增任何相依；vendored 的 Leaflet 與 Chart.js 版本不變；發佈流程不受影響（`scripts/build-site.py` 只複製檔案，不做轉換）。
