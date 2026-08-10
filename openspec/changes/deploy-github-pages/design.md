## Context

儀表板 MVP（`interactive-dashboard-mvp`，已歸檔）產出一個純靜態站：`site/` 下是 `index.html` 加五個面板模組，第三方函式庫已 vendored 在 `site/vendor/`，全案無 `package.json`、無建置工具鏈。資料則放在 repo 的 `data/` 之下。

目前網站以 `../data` 這個相對路徑跨出 `site/` 去讀 repo 的 `data/`，等於假設「repo 根目錄就是 web root」。這個假設在部署時造成三個問題：

1. 首頁會落在 `/site/` 這種網址，而非站台根。
2. 網站根本不讀的 `data/raw/`（169MB，其中單檔 40MB）會成為網站資產的一部分。
3. 資料基底路徑散落三處各寫各的：`site/js/state.js` 的 `DATA_BASE` 常數、`site/js/panel-map.js` 中繞過 `loadData()` 的一句原生 `fetch('../data/...')`、以及 `site/index.html` 指向 `data/sources.json` 的溯源連結。三處必須同步改，漏一處就是線上 404。

網站實際讀取的資料只有 `data/sources.json`、`data/processed/` 八個 JSON、`data/geo/` 的 `counties.geojson` 與 `townships/`，合計約 1.7MB。

限制條件：維持零 npm 相依；組建腳本只用 Python 標準函式庫，與既有的 `scripts/build-geo.py` 一致（其餘轉檔腳本為 PowerShell，但 CI 跑 ubuntu，新腳本選 Python 以免多裝 pwsh）。

## Goals / Non-Goals

**Goals:**

- 讓網站以站台根網址對外可見，且首次載入不需要下載任何網站不使用的資料。
- 本機預覽與 CI 發佈走**同一支腳本、同一種目錄佈局**，使「本機能跑」成為「線上能跑」的有效證據。
- 資料基底路徑在程式碼中只有一個定義處。
- 推送成為公開 repo 之前，資料授權問題有明確結論或明確的阻擋。

**Non-Goals:**

- 不處理 `data/raw` 的入庫策略與 40MB JSON 瘦身（與部署解耦，另開 change）。
- 不引入 bundler、minifier 或任何 npm 相依。
- 不做自訂網域、CNAME、PR preview 環境。
- 不改動面板顯示行為、資料內容或既有轉檔腳本的輸出。
- 不做組建產物的快取或增量組建；資料僅 1.7MB，全量複製即可。

## Decisions

### 決策一：以組建腳本產生 `_site/`，而非直接發佈 repo 根目錄

發佈目錄由 `scripts/build-site.py` 組出，佈局為 `site/` 的內容攤在 `_site/` 根，資料收在 `_site/data/` 之下：

```
_site/
  index.html
  css/  js/  vendor/
  data/
    sources.json
    processed/*.json
    geo/counties.geojson
    geo/townships/*.geojson
```

替代方案一是直接把 repo 根目錄當站台根，不寫腳本。否決原因：首頁網址帶 `/site/`，且 169MB 的 `data/raw` 成為站台資產——GitHub Pages 站台上限 1GB 雖然吃得下，但每次部署都要上傳一份，且公開下載頻寬白白消耗在沒人要的原始檔上。

替代方案二是把 `data/` 搬進 `site/` 之下，讓現況路徑直接成立、完全不需要組建。否決原因：`data/raw` 是轉檔腳本的輸入，不是網站資產，搬進 `site/` 會讓「網站目錄」與「資料工作區」混為一談；且 `data/processed` 是 `scripts/` 的輸出，其位置已被 `data-pipeline` spec 規定為 `data/processed/`，搬動等於改動既有 spec。

### 決策二：本機預覽也走 `_site/`，不保留 `site/` 直開的路徑

改動後直接以靜態伺服器開 `site/` 目錄將無法載入資料。這是刻意的：若同時讓 `site/` 直開和 `_site/` 都能運作，就存在兩套路徑解析邏輯，兩者會分歧，而分歧只會在部署後才被發現。單一路徑讓本機預覽成為線上行為的有效證據。

代價是每次改前端都要重跑組建腳本。緩解方式是腳本必須夠快（全量複製 1.7MB，實測應在一秒內），且 README 明載預覽指令。

替代方案是讓 `DATA_BASE` 在執行期偵測環境（例如檢查 `location.pathname` 是否含 `/site/`）。否決原因：這正是「兩套邏輯」的另一種寫法，只是把分歧藏進條件判斷裡，除錯時更難看出。

### 決策三：資料基底路徑收斂為單一定義

`site/js/state.js` 匯出 `DATA_BASE` 常數，值為 `data`。`site/js/panel-map.js` 改為匯入該常數組出 GeoJSON 路徑，不再自寫 `fetch('../data/...')` 字面值。`site/index.html` 中指向溯源檔的連結改為站台相對路徑。

如此路徑只有一個定義處，未來若佈局再變，改一處即可。

### 決策四：組建腳本自我驗證，缺檔即失敗

腳本不做「盡力複製、缺了就算了」。它持有一份必須存在的資料清單（`sources.json`、`data/processed/` 下所有 `.json`、`data/geo/counties.geojson`、`data/geo/townships/` 下所有 `.geojson`），任一必要來源不存在就以非零狀態碼結束並指出缺哪個檔。

理由與既有 `data-pipeline` spec 的組建期自我驗證原則一致：靜默產出一個少了幾個面板資料的站台，比組建失敗糟得多——前者要等使用者回報，後者當場就知道。

腳本每次執行前先清空既有 `_site/`，避免上一次組建的殘留檔案混入。

### 決策五：GitHub Actions 於推送 master 時發佈

workflow 在 `ubuntu-latest` 上 checkout、setup-python、執行組建腳本、以 `actions/upload-pages-artifact` 上傳 `_site/`，再由 `actions/deploy-pages` 發佈。需在 repo 設定中將 Pages 來源設為 GitHub Actions，並授予 workflow `pages: write` 與 `id-token: write` 權限。

替代方案是本機組建後推到 `gh-pages` 分支。否決原因：會把產物入庫，且產物與原始碼容易不同步。

### 決策六：授權查證是推送前的阻擋條件

repo 設為 public 會使 `data/raw/` 一併公開。多數檔案來自政府資料開放平臺，適用政府資料開放授權條款第 1 版，允許標示來源後再散布，`data/sources.json` 已有來源記錄。

但 `data/raw/moi-year-end-population-by-sex-age.xls` 這份的授權條款尚未實際查證——`.gitignore` 註解記載它「下載連結由 JS 產生，頁面上沒有 `<a href>`，必須人工開瀏覽器點擊」，取得途徑非標準開放資料下載，不能逕自套用開放授權的假設。

依專案資料紀律第 4 條（查不到就記為「待確認」，不憑印象填），此事登記為待確認事項，並在查證前不推送 public repo。查證結果若為不允許再散布，處置方式是把該檔自 `data/raw` 排除——這屬於 `data/raw` 入庫策略的範圍，另開 change 處理，本 change 只負責讓問題浮出並阻擋。

## Implementation Contract

**行為**

- 執行組建指令後，專案根目錄出現 `_site/`，其根有 `index.html`，其 `data/` 子目錄含 `sources.json`、`processed/`、`geo/`，且**不含** `raw/`。
- 以靜態伺服器服務 `_site/` 並開啟根網址時，四個面板與席次模擬器全部正常渲染，瀏覽器 console 無資源載入錯誤，Network 面板無 404。
- 推送到 `master` 後，GitHub Actions 完成部署，Pages 網址的根路徑（不帶 `/site/`）呈現同一個站台。

**介面與資料形狀**

- 組建腳本：`python scripts/build-site.py`，不需參數。成功時以狀態碼 0 結束，並在 stdout 印出複製的檔案數與 `_site/` 總大小。
- 輸出佈局如決策一所列。
- `site/js/state.js` 匯出具名常數 `DATA_BASE`，值為字串 `data`；`loadData(name)` 的既有簽章與快取行為不變。
- `site/js/panel-map.js` 透過匯入的 `DATA_BASE` 組出 GeoJSON 路徑，模組中不再出現 `../data` 字面值。
- workflow 檔觸發條件為推送到 `master`，並可手動觸發（`workflow_dispatch`）。

**失敗模式**

- 任一必要資料來源缺失 → 組建腳本以非零狀態碼結束，stderr 指出缺失的具體路徑，且不留下半成品 `_site/`。
- 組建腳本失敗時 workflow 隨之失敗，不發佈——絕不部署一個資料不全的站台。
- 面板層級的單一資料載入失敗，維持既有 `dashboard-shell` spec 規定的逐面板錯誤隔離行為，本 change 不改動。

**驗收條件**

- `python scripts/build-site.py` 後，`_site/data/raw` 不存在，且 `_site/data/processed` 的 JSON 檔數與 `data/processed` 相同。
- 在 `site/js/` 全目錄搜尋 `../data` 字串，無任何結果。
- 在 `site/index.html` 搜尋 `../data`，無任何結果。
- 暫時移走 `data/processed` 中任一 JSON 後執行組建腳本，腳本以非零狀態碼結束並指出該檔缺失；還原後重跑成功。
- 以靜態伺服器服務 `_site/` 手動開啟，逐一確認人口、選舉、土地、地圖四面板與席次模擬器渲染正常，並執行一次縣市下鑽確認鄉鎮 GeoJSON 載入成功。
- `data/sources.json` 中可查到新增的授權待確認記錄。
- README 含組建與本機預覽指令，以及 GitHub Pages 來源需設為 GitHub Actions 的設定說明。

**範圍邊界**

- 在範圍內：組建腳本、三處路徑收斂、workflow、`.gitignore` 加入 `_site/`、README 說明、授權待確認記錄。
- 不在範圍內：`data/raw` 入庫策略與瘦身、git remote 的實際建立（使用者執行）、自訂網域、任何面板行為或資料內容的改動。

## Risks / Trade-offs

- **改動後 `site/` 無法直開，既有的開發習慣被打斷** → README 明載新的預覽指令；組建腳本保持在一秒內完成，讓重跑成本可忽略。此為決策二刻意接受的代價。
- **三處路徑必須同步改，漏一處就是線上 404，而 404 只在特定操作（例如下鑽到鄉鎮）才觸發** → 驗收條件納入「全目錄搜尋 `../data` 無結果」這項機械式檢查，不倚賴人眼；並要求手動驗證時實際執行一次下鑽。
- **授權查證結果可能是不允許再散布，屆時 public repo 這個前提本身要重新考慮** → 查證列為推送前的阻擋條件而非事後補救；查證未完成就不推送，避免公開後才發現要撤。
- **GitHub Pages 的 Pages 來源設定在 repo 設定頁，不在 repo 檔案裡，是唯一無法由程式碼保證的一步** → 列入 README 設定說明，且首次部署後以實際開啟網址確認，不以 workflow 成功為唯一判準。
- **全量複製而非增量** → 1.7MB 的規模下增量組建的複雜度不划算，明確接受。
