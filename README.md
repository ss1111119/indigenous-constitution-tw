# 臺灣原住民族憲政代表性與土地資料視覺化

用公開資料理解臺灣原住民族的人口、土地、選舉與政治代表性，並提供憲政制度的席次模擬。

## 目前階段

**第二階段：儀表板已完成，部署中**

第一階段的可行性研究產出 [`docs/feasibility-study.md`](docs/feasibility-study.md)，
內容包含資料可行性、既有網站調查、資料缺口盤點與技術方案評估。

其結論導出的互動式儀表板 MVP 已完成：人口、選舉、土地三個資料面板與席次模擬器，
全部資料可溯源至 `data/sources.json`。

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
| `data/raw/` | 政府原始下載檔，不做任何修改。網站不讀取，不進發佈目錄 |
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

## 立場聲明

本專案為資料呈現與制度模擬，不代表任何政黨、政府機關或作者的政治立場。
席次模擬結果是依使用者輸入參數計算的數學結果，不構成制度主張。

## 相關專案

- [moe-indigenous-stats](https://github.com/ss1111119/moe-indigenous-stats)：大專原住民學生科系統計。
  該專案受限於教育部資料，無法取得各族人口數當分母；本專案的人口資料（原民會）正好補上這一塊。
