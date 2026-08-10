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

repo 設為 public 會使 `data/raw/` 一併公開，故推送前須逐檔確認再散布條款。

**【2026-08-10 更新】本節原先的事實前提是錯的，查證結果與之相反，以下為實際盤點結果。**

原本的判斷是「多數檔案來自政府資料開放平臺、適用政府資料開放授權條款第 1 版，只有
`data/raw/moi-year-end-population-by-sex-age.xls` 一份待確認」。逐一查證 15 個已入庫檔案後：

| 檔案 | 來源站台 | 實際適用文件 | reusable |
| --- | --- | --- | --- |
| `moi-year-end-population-by-sex-age.xls` | ris.gov.tw | 戶政司政府網站資料開放宣告：政府資料開放授權條款第 1 版 | `true` |
| `moi-odrp013/018` JSON ×2 | data.gov.tw | 政府資料開放授權條款第 1 版 | `true` |
| `cip-reserved-land-*.csv` ×5 | data.cip.gov.tw | 原住民族委員會開放資料使用規範 1.0 版 | `true` |
| `cip-11506-*.xls` ×6 | www.cip.gov.tw | 原民會全球資訊網著作權聲明（非開放授權） | `unknown` |
| `siraya-baseline-2026-08-09.md` | 本專案彙整 | 專案自有 | `true` |

三個與原判斷相反或未預見的事實：

1. **被當成主要阻擋的那份反而最乾淨。** 下載頁確實未於檔案旁標示授權，但戶政司有
   站台層級的「政府網站資料開放宣告」涵蓋全站資料，明文允許重製、改作、公開傳輸
   與再授權。原記錄的「待確認」在當時是誠實的，錯的是本節推論它因此有問題。

2. **真正有疑問的是原民會月報 6 檔，而原判斷完全沒提到它們。** 關鍵在同一個機關有
   兩個站台、兩套規則：開放資料平臺 `data.cip.gov.tw` 有明確的「原住民族委員會開放
   資料使用規範 1.0 版」（允許商業利用與併入自有產品），但主站 `www.cip.gov.tw`
   只有著作權聲明——本會著作「在合理範圍內」得重製、公開傳輸並註明出處。月報屬後者。
   「合理範圍」未定義，是否涵蓋在公開版本庫中逐字再散布完整檔案，條款本身答不出來。

3. **三個保留地 CSV 根本沒有來源記錄。** `cip-reserved-land-building-agri`、`-total`、
   `-usage` 已入庫但 `sources.json` 無記錄，違反 CLAUDE.md 資料紀律第 3 條。另發現
   `cip-reserved-land-owner` 的 `url` 誤指 dataset 112682（該頁只含 108090），
   以及 `siraya-baseline` 缺 `license` 與 `reusable` 欄位。皆已補正。

**由此修正的規則。** 原本設想的規則是「有任何一份待確認就不推送」。實際採用的規則是：

- 條款要讀**實際供應該檔案的站台**的規範文件。同機關不同平臺的條款不可互相套用——
  這是本次最容易犯的錯，也是原判斷出錯的地方。
- 區分三種結果：查證為允許、查證為不允許、**條款找到但其範圍無法決定此問題**。
- 第三種情況下 `reusable` 維持 `unknown`、記錄中引述條款原文；若專案仍決定再散布，
  該決定須記為**專案自身的判斷**，與提供者的授權分開陳述，不可寫成後者。
- 阻擋推送的條件是「完全沒有來源記錄」或「查證為不允許」，而非「範圍不確定」。

月報 6 檔依此規則處理：`reusable` 維持 `unknown`，條款原文與專案的再散布決定
（依據為該宣告允許合理範圍內重製並註明出處，出處已完整記錄）分開記於 `sources.json`。
若原民會表示不同意，處置方式為自版本庫移除，需重寫 git 歷史——那屬於 `data/raw`
入庫策略的範圍，仍在本 change 範圍外。

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
- `data/raw` 下每個已入庫檔案都能在 `data/sources.json` 找到對應來源記錄，且該記錄載明再散布條款的查證結果；範圍無法決定者維持 `reusable: unknown` 並引述條款原文。
- README 含組建與本機預覽指令，以及 GitHub Pages 來源需設為 GitHub Actions 的設定說明。

**範圍邊界**

- 在範圍內：組建腳本、三處路徑收斂、workflow、`.gitignore` 加入 `_site/`、README 說明、`data/raw` 全部檔案的授權盤點與 `sources.json` 記錄補正。
- 不在範圍內：`data/raw` 入庫策略與瘦身（含 40MB JSON 與月報 6 檔的去留）、git remote 的實際建立（使用者執行）、自訂網域、任何面板行為或資料內容的改動。

## Risks / Trade-offs

- **改動後 `site/` 無法直開，既有的開發習慣被打斷** → README 明載新的預覽指令；組建腳本保持在一秒內完成，讓重跑成本可忽略。此為決策二刻意接受的代價。
- **三處路徑必須同步改，漏一處就是線上 404，而 404 只在特定操作（例如下鑽到鄉鎮）才觸發** → 驗收條件納入「全目錄搜尋 `../data` 無結果」這項機械式檢查，不倚賴人眼；並要求手動驗證時實際執行一次下鑽。
- **授權查證結果可能是不允許再散布，屆時 public repo 這個前提本身要重新考慮** → 查證列為推送前的阻擋條件而非事後補救。【2026-08-10 實際結果】沒有任何一檔查證為不允許；月報 6 檔屬「條款範圍無法決定」，依修正後的規則不構成阻擋，但仍是未決事項。
- **「同機關的授權條款可以互相套用」是這次最容易犯、也實際犯了的錯** → 原判斷把原民會開放資料平臺的授權當成主站檔案的授權。修正後的規則明訂條款須讀實際供應該檔案的站台，並在 spec 中以「一個機關、兩個平臺」的對照表固定下來。
- **repo 從未推送過，git 歷史中的檔案一推即公開，`git rm` 不足以排除** → 推送前完成盤點就是為此。若日後需要移除月報 6 檔，須重寫歷史，成本遠高於推送前處理，這是把授權查證放在推送之前的實際理由。
- **GitHub Pages 的 Pages 來源設定在 repo 設定頁，不在 repo 檔案裡，是唯一無法由程式碼保證的一步** → 列入 README 設定說明，且首次部署後以實際開啟網址確認，不以 workflow 成功為唯一判準。
- **全量複製而非增量** → 1.7MB 的規模下增量組建的複雜度不划算，明確接受。
