## Why

`scheduled-data-refresh` 規格的「驗證通過才提交」需求寫成「與前一期相差超過 1% 即拒絕」，
但實作有一條規格完全沒有記載的路徑：當沒有可比對的基準時，幅度檢查整道略過。
略過條件有兩種——版本庫裡不存在 `data/processed/population-by-county.json`（首次建置），
以及該檔存在但原住民合計小於等於 0。

這是規格漏寫，不是實作有錯。略過首次建置是刻意的設計（否則乾淨的版本庫做不完第一次建置），
理由已寫在 scripts/build-population.ps1 的註解裡。但規格沒寫，就等於有一條「幅度檢查不執行」
的途徑不在任何人的視野內：讀規格的人會以為每次提交都經過幅度比對。

合計小於等於 0 的略過更值得寫下來——那代表前一期檔案本身已經壞了，而目前的處置是放行而非中止。

## What Changes

- 在 `scheduled-data-refresh` 規格的「Refreshed data is committed only after validation passes」需求中，
  補上「無可比基準時幅度檢查略過」的行為敘述與對應 Scenario。
- Scenario 涵蓋兩種略過條件（前一期檔案不存在、前一期原住民合計小於等於 0），
  並明訂略過時必須輸出略過原因，且轉檔自我驗證不受影響、照常執行。
- 不修改任何實作程式碼。本變更是把既有行為補進規格，行為本身不變。
- README 的刷新說明同樣沒寫略過路徑，且有兩處絕對敘述在無基準時不成立
  （「指定期別只跳過探測，不跳過任何驗證」與「排程做得到自我驗證與幅度檢查」），一併補正。

## Non-Goals

- 不改變略過行為本身。是否該在前一期合計小於等於 0 時改為中止，是另一個題目，
  需要先確認那種狀態實際上如何產生；本變更只負責如實記載目前行為。
- 不新增測試 fixture。既有回歸測試涵蓋幅度檢查的通過、拒絕、放行三條路徑，
  略過路徑的驗證方式在 design 中判定。
- 不調整 1% 門檻，也不新增任何調整門檻的途徑——現行規格明訂不提供該途徑，本變更不碰。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `scheduled-data-refresh`：「Refreshed data is committed only after validation passes」需求補上
  無可比基準時的略過行為，需求敘述由無條件的「超過 1% 即拒絕」改為明列前提。

## Impact

- Affected specs: `scheduled-data-refresh`
- Affected code:
  - New: （無）
  - Modified: README.md（補上略過路徑，並修正兩處無基準時不成立的絕對敘述；不動實作程式碼）
  - Removed: （無）
- 參考實作位置：scripts/build-population.ps1 的幅度檢查區塊（比對前一期 processed 檔的段落）
