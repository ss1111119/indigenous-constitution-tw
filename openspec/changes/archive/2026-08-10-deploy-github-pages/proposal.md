## Why

儀表板 MVP 已完成並歸檔，但只能在本機開啟——沒有任何人看得到。這個專案的價值在於讓一般人理解原住民族的人口、選舉與土地處境，留在本機等於沒有完成。

同時，網站現在假設 repo 根目錄就是 web root（`site/js/state.js` 以 `../data` 讀取資料），直接把 repo 丟上靜態主機會讓首頁落在 `/site/` 這種網址，且會連帶把網站根本不讀的 169MB `data/raw` 一起當成網站資產。部署這件事必須先解決發佈目錄的組成方式。

## What Changes

- 新增發佈組建腳本，把 `site/` 與網站實際讀取的資料組成一個 `_site/` 發佈目錄：`index.html`、`css/`、`js/`、`vendor/` 放在 `_site/` 根，資料放在 `_site/data/`。
- `_site/data/` 只含 `sources.json`、`data/processed/` 全部 JSON、`data/geo/` 全部 GeoJSON（合計約 1.7MB），**不含** `data/raw/`。
- **BREAKING**（僅影響開發流程）：`site/js/state.js` 的 `DATA_BASE` 由 `../data` 改為 `data`，`site/js/panel-map.js` 的 GeoJSON 取用路徑同步調整。改動後直接以靜態伺服器開啟 `site/` 目錄將無法載入資料，本機預覽一律改用組建出的 `_site/`——這正是本次刻意採取的設計：本機與 CI 共用同一支腳本、同一種目錄佈局，避免兩套路徑邏輯分歧導致「本機正常、線上 404」。
- 新增 GitHub Actions workflow，於推送到 `master` 時執行組建腳本並以 GitHub Pages 發佈。
- repo 目前沒有 git remote，需納入設定步驟（使用者自行在 GitHub 建立 public repo）。
- 推送前完成 `data/raw` 全部已入庫檔案的再散布條款盤點，結果記入 `data/sources.json`。public repo 會使 `data/raw/` 一併公開，且 git 歷史中的檔案一推即公開，事後 `git rm` 不足以排除，故此事必須在推送之前完成。

  **【2026-08-10 更新】盤點結果與本提案原先的假設相反。** 原本只列出
  `data/raw/moi-year-end-population-by-sex-age.xls`（戶政司該份需人工點擊下載）一項待確認，
  實際查證後該檔受戶政司站台層級的資料開放宣告涵蓋（政府資料開放授權條款第 1 版），是最明確的一份。
  真正未決的是 `cip-11506-*.xls` 6 檔——它們來自原民會**主站** `www.cip.gov.tw`（僅著作權聲明，
  允許「在合理範圍內」重製並註明出處），而非該會的開放資料平臺 `data.cip.gov.tw`（有明確開放授權）。
  另有三個 `cip-reserved-land-*.csv` 原本完全沒有來源記錄。詳見 design 決策六。

## Non-Goals

- **不處理 `data/raw` 的入庫策略**，包含 40MB 的 `moi-odrp018-population-by-tribe-11506.json` 是否該留在 git 歷史中、是否改用 Git LFS 或外部儲存。網站一個 byte 都不讀 `data/raw`，與部署完全解耦，另開 change 處理。
- **不引入前端建置工具鏈**（bundler、minifier、npm）。現有 `site/vendor/` 已是 vendored 的 Chart.js 與 Leaflet，專案至今無 `package.json`，維持零相依。
- **不做自訂網域與 CNAME 設定**，先用 GitHub Pages 預設網址。
- **不做預覽環境或 PR preview deployment**。
- 不改動任何面板的顯示行為、資料內容或轉檔腳本輸出。

## Capabilities

### New Capabilities

- `site-deployment`: 發佈目錄的組成規則（哪些檔案進、哪些不進）、本機與 CI 共用單一組建路徑的要求、組建自我驗證，以及推送前的資料授權把關——含條款須讀實際供應站台、三種查證結果的區辨，以及專案自身的再散布決定須與提供者的授權分開陳述。

### Modified Capabilities

(none)

## Impact

- Affected specs: 新增 `site-deployment`
- Affected code:
  - New:
    - `scripts/build-site.py`
    - `.github/workflows/deploy.yml`
  - Modified:
    - `site/js/state.js`
    - `site/js/panel-map.js`
    - `site/index.html`
    - `.gitignore`
    - `README.md`
    - `data/sources.json`
  - Removed: (none)
- 依賴與系統：需在 GitHub repo 設定中將 Pages 來源設為 GitHub Actions；workflow 使用 `actions/checkout`、`actions/configure-pages`、`actions/upload-pages-artifact`、`actions/deploy-pages`；組建腳本僅用 Python 標準函式庫，與既有 `scripts/build-geo.py` 一致。

  **【2026-08-10 補記】Pages 設定的實際狀況**：repo 建立時 Pages 已被啟用為
  `build_type: legacy`、來源分支指向不存在的 `main`，因此第一次推送觸發的 workflow
  在 deploy 階段失敗（`Branch "master" is not allowed to deploy to github-pages
  due to environment protection rules`），build 階段是成功的。改為
  `build_type: workflow` 後 `master` 才被加入 `github-pages` 環境的允許分支清單。
  此設定可用 `gh api -X PUT repos/{owner}/{repo}/pages -f build_type=workflow` 完成，
  不必手動點選；`github-pages` 環境仍留有一筆指向 `main` 的舊分支政策，無害但可清除。
