## Why

臺灣原住民族的人口、選舉與憲政代表性資料分散於三個機關，且**沒有任何網站把它們整合起來**。可行性研究（docs/feasibility-study.md）確認：中研院 CAPAS 做人口視覺化但不碰選舉、報導者做過單屆選舉敘事但未更新、政府圖台只有土地圖資，三者互不連通，都不處理代表性計算。

時間窗口罕見地好。西拉雅族於 2026-07-30 獲核定為第 17 族，《平埔原住民族群身分法》第 23 條要求政府於 2028-10-23 前就平埔族群「政治參與」立法。屆時關於席次的公共討論一定會發生，而目前沒有任何地方提供「數字長什麼樣」的參考點。

第二輪核實已把資料基礎打穩：戶政司 ODRP013／ODRP018 提供村里層級、逐月、含全部 10 個平埔族群欄位的官方資料（現值為 0），與原民會月報三方交叉驗證相符。資料齊備，可以開始建站。

## What Changes

- 建立轉檔管線：政府原始檔（data/raw/）→ 聚合後的前端 JSON（data/processed/），涵蓋人口、選舉、土地三類資料
- 建立溯源機制：轉檔時將 `_sourceId` 與欄位層級的 `_fieldNature` 注入每支 processed JSON，前端無需 runtime join 或解析散文
- 建立四面板儀表板：人口、選舉、土地、席次模擬，以純 HTML + CSS + JavaScript 實作，無 build step
- 建立全域地區選擇器：作為唯一的跨面板共享狀態，人口與土地面板隨之變動；選舉與模擬面板固定為全國
- 建立席次模擬器：三個控制項（平埔納入人口滑桿、保障席次滑桿、增額／重分配切換），即時重算代表性指標
- 將 data/sources.json 的 schema 從暫定（provisional）收斂為正式契約，並修正 gaps 陣列中已失效的 affects 欄位

## Capabilities

### New Capabilities

- `data-pipeline`: 政府原始檔轉為前端 JSON 的管線，含跨行政層級聚合與轉檔時的自我驗證
- `data-provenance`: 數字的來源追溯與資料缺口標示，含官方統計／學術估計／本專案計算的三分法，以及「無資料」與「零」的區辨
- `dashboard-shell`: 四面板版面與全域地區選擇器，管理唯一的跨面板共享狀態
- `data-panels`: 人口、選舉、土地三個資料呈現面板
- `seat-simulator`: 席次分配模擬器，將未決的政策參數暴露給使用者而非替其預設

### Modified Capabilities

(none)

## Impact

- Affected specs: 五個新增 capability，皆為新建
- Affected code:
  - New:
    - scripts/build-population.ps1
    - scripts/build-land.ps1
    - scripts/lib/provenance.ps1
    - data/processed/population-by-county.json
    - data/processed/population-by-township.json
    - data/processed/land-ownership.json
    - data/geo/counties.geojson
    - data/geo/townships.geojson
    - site/index.html
    - site/css/main.css
    - site/js/state.js
    - site/js/panel-population.js
    - site/js/panel-election.js
    - site/js/panel-land.js
    - site/js/panel-simulator.js
    - site/js/provenance.js
  - Modified:
    - scripts/extract-cec-elprof.ps1
    - data/processed/legislative-representation.json
    - data/sources.json
    - README.md
  - Removed: (none)
- Dependencies: Chart.js 與 Leaflet 以本機檔案形式納入版本庫（不使用 CDN），避免外部相依在專案生命週期內失效
