## Summary

停止追蹤可重新取得的大型原始檔，改以雜湊維持可稽核性，並提供一支能真正重新取得它們的腳本。

## Motivation

`data/raw` 目前已入庫 48MB，其中 `data/raw/moi-odrp018-population-by-tribe-11506.json` 單檔 41,471,418 bytes。

**這個檔案是漏網進來的，不是有人決定要入庫。** `.gitignore` 開頭明寫原則是「原始檔可重新下載，就不入庫」，但規則按副檔名列舉——涵蓋 xlsx、xls、zip、shp、dbf、shx、prj、gpkg，**沒有 json**。而 ODRP018 有穩定的 API 端點，期別直接代換在網址中。它完全符合該原則的定義。

**真正的問題是軌跡，不是現況。** ODRP018 是月報。已實測 `11507` 已經上架（`totalDataSize` 由 7,771 增為 7,781），代表若維持現狀，下一次更新就會讓 git 歷史再增 40MB，一年約 480MB。現在正是決定這件事的時機——在第二期進來之前。

**不入庫的代價是可稽核性受損**，而這正是本專案的核心主張。目前 `data/sources.json` 沒有任何雜湊欄位，因此即使是已被忽略的 `data/raw/cec-votedata.zip`（110MB），今天也沒有人能驗證本專案用的是哪一版中選會資料。雜湊補上這個洞：任何人重新取得、比對雜湊、確認與本專案使用的是同一份資料，再重跑轉檔腳本得到相同輸出。

對一個立論是「每個數字都能追到來源」的專案，一行 64 字元的雜湊比把 48MB 塞進 git 更符合它自己的主張。

## Proposed Solution

- `.gitignore` 補上 `data/raw` 的 json 規則，並把註解從列舉副檔名改為明講依據：可重新取得者不入庫，不可重新取得者以例外標明。現有兩條例外（戶政司 xls 需人工點擊、原民會月報為 16 族最後一期快照）的寫法保留。
- 以 git 的 cached 移除停止追蹤兩個 ODRP JSON。**既有的 blob 仍留在 git 歷史中**——這不縮小已有歷史，但止住成長。
- `data/sources.json` 新增雜湊欄位並為每個原始檔填入，含未入庫的 `data/raw/cec-votedata.zip`。
- 新增重新取得腳本，處理 ODRP API 的分頁（`totalPage` 為 4、`pageDataSize` 為 2000）並在取得後自動比對雜湊。**沒有這支腳本，「可重新取得」對讀者只是一句空話**，等於把重建成本丟給別人。
- `README.md` 更正 `data/raw` 的敘述。現寫「政府原始下載檔，不做任何修改」，對五個 CSV 與各 XLS 成立，但對兩個 ODRP JSON **不成立**——它們是四頁合併後由本專案序列化的產物，另加六個底線開頭的後設欄位。

## Non-Goals

- **不重寫 git 歷史。** 既有的 40MB blob 留在歷史中。40MB 在 GitHub 的所有限制之下（單檔警告 50MB、硬限 100MB），整個 repo 才 48MB。重寫公開版本庫的歷史是破壞性操作，會讓既有的 clone 與 fork 失效，收益極小。
- **不更新資料到 11507。** 那會動到所有面板顯示的數字，是獨立的決定，另開 change。
- **不重新分類 `data/raw`。** 該目錄現在混著未加工的政府下載檔（CSV／XLS）與本專案正規化過的下載（兩個 ODRP JSON）。把後者移到別處會動到轉檔腳本的輸入路徑，而那兩個檔案即將不再入庫，移動一個要被移除追蹤的檔案收益很低。改以更正 README 的敘述處理。
- **不改動 `data/processed/` 與 `data/geo/` 的入庫方式。** 那些是發佈目錄實際使用的檔案，合計約 1.7MB。
- **不引入 Git LFS 或外部物件儲存。** 兩者都新增基礎設施相依，而本方案不需要。
- 不改動任何面板行為、資料內容或發佈流程。

## Alternatives Considered

- **重寫 git 歷史移除那 40MB。** 否決理由見 Non-Goals。若日後歷史體積真的成為問題，那是一個獨立且需要協調的操作（通知既有 clone、重新 fork），不該夾帶在策略變更裡。
- **雜湊檔案位元組（對全部檔案一律如此）。** 對兩個 ODRP JSON **行不通**：檔案含 `_downloadedAt` 欄位，每次重新取得都會變；且四頁合併後的序列化結果受鍵序、空白、跳脫設定影響。位元組雜湊會在每次重新取得時失敗，那是一個永遠紅燈的檢查，比沒有檢查更糟。
- **繼續入庫但改用外部儲存（S3 等）。** 引入帳號、憑證與費用，且讓「重新取得」依賴本專案而非政府端點——與可稽核性的方向相反。
- **只加雜湊、不停止追蹤。** 解決不了軌跡問題，一年後仍是 480MB。

## Impact

- Affected specs: 修改 `data-provenance`
- Affected code:
  - New:
    - `scripts/fetch-raw.py`
  - Modified:
    - `.gitignore`
    - `data/sources.json`
    - `README.md`
  - Removed（停止追蹤，檔案仍留在本機工作目錄）:
    - `data/raw/moi-odrp018-population-by-tribe-11506.json`
    - `data/raw/moi-odrp013-population-by-indigenous-status-11506.json`
- 依賴與系統：重新取得腳本只用 Python 標準函式庫（`urllib`、`hashlib`、`json`），與 `scripts/build-site.py` 一致；不影響 `scripts/build-site.py` 的輸出，發佈目錄與網站行為完全不變。
