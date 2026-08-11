## Why

四個 Chart.js 圖表以 `<canvas>` 繪製，而 canvas 對輔助技術是不透明的——螢幕閱讀器讀到的是一個沒有名稱、沒有內容的元素。實測本專案的四個 canvas 目前**完全沒有** `role`、`aria-label` 或任何文字替代：族別人口長條圖、歷屆投票率圖、每席選民倍數差距圖、保留地所有權逐年圖。使用螢幕閱讀器的人在這四張圖上得到的資訊量是零。

這不只是合規問題，而是與本專案的核心主張直接衝突。首頁寫著「每一個數字都能追到來源」，但對讀不到 canvas 的人，這四張圖裡的數字連讀到都做不到，追溯無從開始。

半圓席次圖是個對照：它是手寫 SVG，帶 `role="img"` 與描述完整的 `aria-label`（席次總數與三類各自的席次），因此已經合規。差別不在難度，而在 canvas 這個媒介本身不帶語意——所以替代必須另外提供。

## What Changes

- 四張 canvas 圖表各自取得 `role="img"` 與非空的 `aria-label`，摘要該圖呈現什麼、涵蓋哪些類別或期間。
- 四張圖表各自附上一個資料表格，內容為繪圖所用的同一組數值，可由使用者展開檢視。表格同時服務兩種需求：讀不到圖的人取得數值，以及想驗算的人看到原始數字。
- 表格沿用本專案既有的漸進揭露樣式（`details` 加 `summary`），與剛完成的模擬器摺疊區視覺一致。
- 表格中的「無資料」與「值為 0」必須可區辨。這不是本 change 新訂的規則——`data-provenance` 既有的 requirement「Distinguish absent data from zero」明文要求「the interface SHALL render three states differently」，表格屬於 interface 的一部分，因此自動受其約束。土地圖的民國 108、109 年是實際存在的資料缺口，表格必須顯示為無資料而非 0 或空白。

## Non-Goals

- **半圓席次圖不在範圍內。** 它已有 `role="img"` 與完整的 `aria-label`，是合規的。為它再加表格是重複。
- **地圖不在範圍內。** Leaflet choropleth 的表格形式是 22 個縣市或最多 368 個鄉鎮的長列表，需要先決定分頁或滾動策略，且「原住民族地區」是與人口比例正交的第二個維度，表格要如何同時承載兩者是獨立的設計問題。另開 change。
- **不引入前端測試框架或無障礙自動檢測工具鏈**（axe、pa11y 等）。專案至今無 `package.json`，為這一項引入 npm 相依不成比例；驗收改以可機械檢查的 DOM 斷言進行。
- **不改動任何圖表的視覺呈現**：色階、軸、圖例、資料點、缺口斷線行為一律不動。
- **不改動資料內容或轉檔腳本輸出。**
- 不做表格的排序、篩選或匯出。那是另一層功能，本 change 只解決「數值讀不到」。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `data-panels`: 新增一條 requirement——每個以 canvas 繪製的圖表都必須提供文字替代（可及的名稱與摘要），並提供繪圖所用同一組數值的表格。既有七條 requirement 規定各面板顯示什麼內容，未涉及這些內容如何被讀不到圖的人取得。

## Impact

- Affected specs: 修改 `data-panels`
- Affected code:
  - Modified:
    - `site/js/panel-population.js`
    - `site/js/panel-election.js`
    - `site/js/panel-land.js`
    - `site/css/main.css`
  - New: (none)
  - Removed: (none)
- 依賴與系統：不新增相依；vendored 的 Chart.js 版本不變；發佈流程不受影響。三個面板模組各自建立圖表，故表格的產生方式需可共用，避免同一段邏輯抄三次。
