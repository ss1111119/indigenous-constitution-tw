<!-- 每個任務標註其涵蓋的 spec requirement（英文原名）與 design 決策，供追溯與分析器比對。 -->

## 1. 量測責任內收到地圖模組

- [x] 1.1 site/js/panel-map.js 匯出一個無參數、無回傳值的具名函式，語意為「重新量測地圖並修正版面」；該函式在地圖尚未建立時直接返回，在地圖容器寬或高為零時跳過量測與視野調整，兩種情況皆不拋錯也不輸出 console 訊息。零尺寸判斷寫在本模組內並涵蓋所有觸發量測的路徑（含 ensureMap 於重繪時的量測），使容器脫離 DOM 期間也受保護。map 實例維持模組私有，不對外匯出。驗證：於頁面剛載入、地圖尚未建立的時點呼叫該函式，確認無錯誤拋出且 console 無新增訊息；在地圖所在面板隱藏的狀態下呼叫，確認 Leaflet 的 getSize() 維持隱藏前的值而非變為 0×0。涵蓋 Requirement: A hidden map does not measure itself；實作 design 決策一：由地圖模組提供具名入口，不對外暴露 map 實例、決策二：可見性判斷放在地圖模組內，不放在呼叫端、決策三：地圖尚未建立時為無操作，不拋錯。
- [x] 1.2 site/js/main.js 的 refreshVisiblePanel() 在可見面板含有 Leaflet 容器時，改為呼叫 panel-map.js 匯出的量測入口，不再派發全域事件；其 Chart.js 分支原樣保留，包含 resize() 後必須接 update('none') 的既有行為。驗證：在 site/js/ 全目錄搜尋 dispatchEvent 與字串 new Event，皆無任何結果；切換至選舉、土地、席次模擬三個面板，確認各自的圖表刻度與資料點對齊、資料點未擠在繪圖區最左端。涵蓋 Requirement: Layout recalculation targets only the panel being shown；實作 design 決策一：由地圖模組提供具名入口，不對外暴露 map 實例。

## 2. 行為驗證

- [x] 2.1 確認分頁切換不再產生全域 resize 事件，且地圖在隱藏後重新顯示時版面正確。驗證：於瀏覽器安裝一個 window 的 resize 監聽器並計數，依序切換全部四個分頁各一次，確認計數維持 0；接著依序切到選舉、土地、席次模擬再切回人口面板，確認地圖寬度等於其容器寬度（誤差 1 像素內）且地圖可正常平移與縮放。涵蓋 Requirement: Layout recalculation targets only the panel being shown。
- [x] 2.2 以組建出的 _site/ 執行整體迴歸，確認本次改動未影響地圖以外的行為，並確認驗收方式符合 design 決策四：不寫「錯誤不再出現」這種驗收條件——因該崩潰無法穩定重現，「沒看到錯誤」在修正前後皆成立，不具鑑別力，故不列為通過條件。驗證：執行 python scripts/build-site.py 後以靜態伺服器服務 _site/，逐一確認人口、選舉、土地三個面板與席次模擬器渲染正常，執行一次縣市下鑽確認鄉鎮 GeoJSON 載入成功；確認 tasks 與 design 中沒有任何以「該錯誤不再出現」為內容的通過條件。涵蓋 Requirement: A hidden map does not measure itself。
