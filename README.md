# 臺灣原住民族憲政代表性與土地資料視覺化

用公開資料理解臺灣原住民族的人口、土地、選舉與政治代表性，並提供憲政制度的席次模擬。

**🌐 <https://ss1111119.github.io/indigenous-constitution-tw/>**

## 目前階段

**第二階段：儀表板已上線**

第一階段的可行性研究產出 [`docs/feasibility-study.md`](docs/feasibility-study.md)，
內容包含資料可行性、既有網站調查、資料缺口盤點與技術方案評估。
⚠️ 該報告是當時的快照、不隨後續工作更新；**資料來源的現行狀態一律以
[`data/sources.json`](data/sources.json) 為準**。

其結論導出的互動式儀表板已上線：人口、選舉、土地三個資料面板與席次模擬器，
全部資料可溯源至 `data/sources.json`。推送到 `master` 即自動部署。

## 本機預覽

網站沒有 build step、沒有 npm 相依，但**有一個組建步驟**：發佈目錄由腳本組出。

```sh
python scripts/build-site.py          # 組出 _site/
python -m http.server 8765 -d _site   # 開 http://127.0.0.1:8765/
```

改完前端要重跑第一行。**不要直接用靜態伺服器開 `site/` 目錄**——那樣載不到資料。

這是刻意的：若 `site/` 直開與 `_site/` 都能運作，就存在兩套資料路徑解析邏輯，
而兩者的分歧只會在部署之後才被發現。本機預覽走與 CI 相同的單一路徑，
「本機能跑」才是「線上能跑」的有效證據。詳見
[`openspec/specs/site-deployment/spec.md`](openspec/specs/site-deployment/spec.md)。

資料路徑在程式碼中只有一個定義處：`site/js/state.js` 的 `DATA_BASE`。
新增面板資料時，除了在前端載入，也必須加進 `scripts/build-site.py` 的
`REQUIRED_DATA` 清單，否則本機測得到、線上缺檔。

## 部署

推送到 `master` 時由 GitHub Actions 自動組建並發佈到 GitHub Pages。

首次設定需要在 GitHub repo 的 **Settings → Pages → Build and deployment → Source**
選擇 **GitHub Actions**（不是 "Deploy from a branch"）。這一步在 repo 設定裡，
無法由版本庫中的檔案保證，是唯一必須手動確認的環節。

`_site/` 是組建產物，不入庫。

## 資料夾結構

| 路徑 | 用途 |
| --- | --- |
| `docs/` | 研究報告與設計文件 |
| `site/` | 前端原始檔（HTML、CSS、JS、vendored 函式庫） |
| `_site/` | 組建產物，可直接發佈的靜態站。不入庫 |
| `data/raw/` | 政府下載檔。網站不讀取，不進發佈目錄。可重新取得者不入庫，見下方「原始檔的入庫與取回」 |
| `data/processed/` | 轉檔後供前端使用的 JSON |
| `data/geo/` | 簡化後的行政區界 GeoJSON |
| `data/sources.json` | 資料來源追蹤（provenance），每筆資料的來源、網址、機關、日期、授權 |
| `scripts/` | 原始檔 → JSON 的轉檔程式，以及 `build-site.py` 發佈組建 |
| `openspec/` | 規格與變更提案（Spectra SDD） |

## 資料原則

1. **官方統計、學術估計、本專案計算值三者必須分開標示**，不得混用。
   平埔原住民族人口尤其如此——目前沒有完整官方戶籍統計，任何數字都要標明性質。
2. 資料不足處明確標記為 **Data Gap / 資料缺口**，不自行推估成官方數字。
3. 每個呈現在網站上的數字，都要能在 `data/sources.json` 追到來源。

## 原始檔的入庫與取回

`data/raw/` 裡有兩類東西，性質不同：

- **未加工的下載檔**——五個保留地 CSV、各 XLS、圖資 ZIP。就是機關送出的那一份，未經改動。
- **正規化過的下載**——兩個 ODRP JSON。戶政司的 API 分頁，村里層級 7,771 列分四頁回傳，
  這兩個檔案是四頁合併後由本專案序列化的結果，另帶 `_source`、`_downloadedAt` 等後設欄位。
  合併是取得資料的必要步驟，但它確實不是「原封不動的下載檔」。

**判準是「能不能重新取得」，不是檔案大小。** 可重新取得者不入庫；不可重新取得者入庫，
並在 `.gitignore` 以例外標明理由（目前有兩條：戶政司那份的下載連結由 JS 產生無法程式取得；
原民會月報是第 17 族出現前的最後一期 16 族快照，無法回溯重建）。

不入庫的代價是可稽核性，由 `data/sources.json` 的 `sha256` 欄位補上：

```sh
python scripts/fetch-raw.py                     # 列出可自動取回的來源
python scripts/fetch-raw.py moi-odrp018-11506   # 取回並自動比對雜湊
```

腳本會逐頁取回、合併、計算雜湊並與記錄比對。**雜湊不符時它不會覆蓋你既有的檔案**——
那通常代表來源端更新了資料，該由人判斷要不要接受。

`sha256Kind` 欄位標明雜湊涵蓋的是什麼：未加工的下載檔雜湊**檔案位元組**；正規化過的下載
雜湊**資料內容的正規化形式**（檔中的 `_downloadedAt` 每次取得都不同，位元組雜湊必然不符）。
正規化的確切方式寫在 `sources.json` 的 schema 說明裡，不使用本專案腳本也能重現。

## 授權

這個庫裡有四類權利狀態不同的東西，**不能用一句話一起宣告**。

### 1. 本專案自行撰寫的程式碼與文件 — MIT

`scripts/`、`site/css/`、`site/js/`、`site/index.html`，以及 `docs/` 與 `openspec/` 下的文件。
全文見 [`LICENSE`](LICENSE)。

### 2. `data/raw/` — 不是本專案的，無法由本專案授權

政府原始下載檔，未做任何修改。本專案對其**不持有權利、不能代為授權**。
每個檔案的再散布條款逐一記錄在 [`data/sources.json`](data/sources.json) 的 `license`
與 `reusable` 欄位。

目前的狀態：

| 來源 | 再散布 |
| --- | --- |
| 內政部戶政司、data.gov.tw 各資料集 | 政府資料開放授權條款第 1 版，允許 |
| 原民會開放資料平臺（`data.cip.gov.tw`） | 原住民族委員會開放資料使用規範 1.0 版，允許 |
| **原民會月報 6 檔**（`cip-11506-*.xls`，取自主站 `www.cip.gov.tw`） | 非開放授權，但依其著作權聲明的合理使用條款允許——**以逐字未改動並註明出處為前提**，見下 |

那 6 檔的來源站台（原民會**主站**，非開放資料平臺）沒有採用開放授權，只有著作權聲明。
但該聲明明文把「以本會名義公開發表之著作，在合理範圍內，得重製、公開播送或公開傳輸；
利用時，並請註明出處」列為合理使用情形——**本專案的使用（逐字、未改動、出處完整記於
`sources.json`）落在這一款之內**。

另有一項獨立依據：著作權法第 7 條的編輯著作要件為「就資料之選擇及編排具有創作性」，
而行政統計表的編排由行政區與族別分類決定、底層數字為事實；若不構成著作，
依該聲明「不得為著作權之標的者，任何人均得自由利用」。

⚠️ **上述兩項依據都以「逐字、未改動、註明出處」為前提。** 若你要改作、重新編排或
去除出處，不在射程內，須自行評估。

### 3. `data/processed/` 與 `data/geo/` — 依原始來源條款

由上述來源轉檔、聚合、簡化而來。數字本身是事實，不是本專案得以主張的財產；
本專案對這些檔案不加額外限制，但**你的再利用仍受原始來源條款約束**，
且請依 `sources.json` 標示來源。

其中標記為 `derived-by-this-project` 的欄位是本專案的計算值而非官方發布的數字，
引用時請照 `_fieldNature` 標明性質——這是資料原則第 1 條的要求。

### 4. `site/vendor/` — 第三方函式庫，各依其授權

| 檔案 | 授權 | 全文 |
| --- | --- | --- |
| `chart.umd.js` | MIT | [`site/vendor/LICENSE-chartjs.txt`](site/vendor/LICENSE-chartjs.txt) |
| `leaflet.js`、`leaflet.css` | BSD-2-Clause | [`site/vendor/LICENSE-leaflet.txt`](site/vendor/LICENSE-leaflet.txt) |

兩者的授權都要求再散布時保留授權聲明，故全文隨檔入庫。

## 立場聲明

本專案為資料呈現與制度模擬，不代表任何政黨、政府機關或作者的政治立場。
席次模擬結果是依使用者輸入參數計算的數學結果，不構成制度主張。

## 相關專案

- [moe-indigenous-stats](https://github.com/ss1111119/moe-indigenous-stats)：大專原住民學生科系統計。
  該專案受限於教育部資料，無法取得各族人口數當分母；本專案的人口資料（原民會）正好補上這一塊。
