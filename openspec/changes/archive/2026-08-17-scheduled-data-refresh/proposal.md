## Why

儀表板的人口數字停在民國 115 年 6 月底，而戶政司 ODRP 每月發布新期別。更關鍵的是：西拉雅族身分登記自 2026 年 8 月中開放，第一筆非零的平埔族群戶籍人口預計出現在 ODRP 期別 11508（約 2026 年 10 月上架）。網站目前把「基準日為民國 115 年 6 月底」與「平埔族群的戶籍登記人口目前為零」寫死在標記裡，屆時這兩句話會變成錯誤敘述——而且錯在這個專案唯一無可取代的那個數字上。

逐月追蹤平埔族群登記人數是本專案的核心價值，目前沒有任何機制會讓它自動發生。

## What Changes

- 新增排程 workflow，定期探測 ODRP 是否已發布新期別；有新期別才重跑轉檔、提交並觸發部署，沒有則不留下任何 commit。
- 期別探測依 ODRP 既有的回應語意判斷：查詢 `{yyymm}` 路徑，`responseMessage` 為「查無資料」即視為尚未發布，不以 HTTP 狀態碼推測。
- **BREAKING**（僅影響前端文案的產生方式）：呈現於頁面的基準日與平埔族群資料狀態改由資料決定，不再寫死於 `site/index.html`。基準日已可由 processed JSON 的 `_sourceId` 對應到 `data/sources.json` 的 `dataDate` 取得，本次把最後一段靜態文案接上這條既有路徑。
- 平埔族群的三種狀態（欄位不存在／欄位存在但為零／出現非零值）由資料切換，取代目前固定顯示「尚無登記」的文案。
- 新增轉檔腳本的回歸測試：以錄製的 ODRP 回應樣本為輸入，斷言輸出的關鍵數字與自我驗證行為。沒有這層，自動更新等於在沒有安全網的情況下改動線上數字。
- 幅度檢查新增具名的人工放行途徑（接受旗標 + 必填理由，僅限手動觸發，理由寫入 commit 訊息）。原先假設「以手動指定期別重跑即可放行」，但手動指定期別只跳過探測、不跳過驗證，被擋下的期別因此無路可走——而西拉雅族登記開放後的第一個非零期別正是預期中的合法大幅變動。門檻本身不提供調高或關閉的方式。

## Capabilities

### New Capabilities

- `scheduled-data-refresh`: 排程探測新期別、無新期別時不動作、轉檔失敗即中止不提交、提交內容與觸發部署的規則。

### Modified Capabilities

- `data-pipeline`: 新增要求——轉檔腳本須有以錄製輸入為基準的回歸測試，且測試須涵蓋既有的自我驗證失敗路徑。
- `data-provenance`: 新增要求——呈現於頁面的基準日與資料狀態須由資料決定，不得寫死於標記。
- `site-deployment`: 新增要求——發佈組建被允許進行單一種取代（期別文字），且該例外的邊界由規格固定，不得擴充為通用模板機制。

## Impact

- Affected specs: 新增 `scheduled-data-refresh`；修改 `data-pipeline`、`data-provenance`
- Affected code:
  - New:
    - `.github/workflows/refresh-data.yml`
    - `tests/run-regression.ps1`
    - `tests/fixtures/`
  - Modified:
    - `scripts/build-population.ps1`
    - `site/index.html`
    - `site/js/panel-population.js`
    - `data/sources.json`
    - `README.md`
  - Removed: (none)
- 依賴與系統：workflow 於 ubuntu-latest 執行既有的 PowerShell 轉檔腳本，該腳本只用 ODRP HTTP API 與 pwsh 內建功能，無 Excel 或 Windows 相依；排程需要對版本庫的寫入權限，與現行 `deploy.yml` 只讀原始碼的權限模型不同。
