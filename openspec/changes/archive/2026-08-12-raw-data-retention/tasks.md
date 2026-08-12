<!-- 每個任務標註其涵蓋的 spec requirement（英文原名）與 design 決策，供追溯與分析器比對。 -->

## 1. 雜湊欄位與值

- [x] 1.1 data/sources.json 的 schema 新增兩個欄位：一個記錄雜湊值、一個記錄雜湊涵蓋的對象（檔案位元組或資料內容正規化），並在 schema 說明中寫出正規化的精確方式（對 data 陣列以鍵排序、不轉義非 ASCII、逗號與冒號後無空白序列化為 UTF-8 後取 SHA-256），使不使用本專案腳本的人也能重現。為 data/raw 下每個實體存在的檔案填入雜湊值與種類，含未入庫的 data/raw/cec-votedata.zip：未加工的 CSV、XLS、ZIP 用檔案位元組，兩個 ODRP JSON 用資料內容正規化。驗證：以 JSON 解析器讀取 data/sources.json 無誤；列出 data/raw 下所有實體檔案，逐一確認都能在 sources.json 找到對應記錄且雜湊欄位非空、種類欄位為兩種值之一；獨立依 schema 所述的正規化方式（不呼叫本專案腳本）重算兩個 ODRP JSON 的雜湊，結果與記載相符。涵蓋 Requirement: Raw inputs are verifiable without being stored in the repository；實作 design 決策二：雜湊的對象視檔案性質而異，不是一律雜湊位元組。

## 2. 重新取得腳本

- [x] 2.1 新增 scripts/fetch-raw.py，只用 Python 標準函式庫。接受資料集識別碼（對應 sources.json 的 id）為參數，不帶參數時列出可取得的識別碼並以狀態碼 0 結束。取得 ODRP 資料時依回應的 totalPage 逐頁抓取並合併為單一 data 陣列，產生與現有檔案相同結構的輸出（含 _source、_dataset、_agency、_statistic_yyymm、_downloadedAt、_note），計算正規化雜湊並與 sources.json 比對。失敗模式：雜湊不符時以非零狀態碼結束、印出期望值與實際值、且不覆蓋既有本機檔案；實際取得頁數與 totalPage 不符時以非零狀態碼結束且不產生輸出檔；網路失敗時以非零狀態碼結束且不留半成品。驗證：不帶參數執行，確認列出識別碼且退出碼為 0；以 ODRP018 的 11506 執行，確認取得 7,771 列（不是 2,000 列）、雜湊比對回報相符、退出碼為 0；暫時把 sources.json 中該筆的雜湊改為錯誤值後重跑，確認非零退出、印出兩個值、且既有本機檔案的修改時間未變。涵蓋 Requirement: Re-obtaining a raw input is an executable action；實作 design 決策三：重新取得腳本必須實際跑得動，且自動比對雜湊。

## 3. 停止追蹤與文件更正

- [x] 3.1 .gitignore 新增涵蓋 data/raw 下 json 檔的規則，並把該區塊的註解由列舉副檔名改為明講判準——可重新取得者不入庫，不可重新取得者以例外標明並附理由。現有兩條例外（戶政司 xls 需人工點擊、原民會月報為 16 族結構最後一期快照）原樣保留，不得移除其理由說明。驗證：對兩個 ODRP JSON 執行 git check-ignore，確認皆回報被規則涵蓋；對五個保留地 CSV 執行同一指令，確認皆未被涵蓋（它們仍應入庫）；閱讀該區塊註解，確認判準以文字寫出而非僅靠副檔名清單表達。涵蓋 Requirement: Raw inputs are verifiable without being stored in the repository；實作 design 決策四：`.gitignore` 的註解改為明講依據，不列舉副檔名。
- [x] 3.2 以 git 的 cached 移除停止追蹤兩個 ODRP JSON，兩個檔案仍保留在本機工作目錄供轉檔腳本使用；不重寫 git 歷史，既有 blob 留在歷史中。驗證：git ls-files data/raw 的輸出不含這兩個檔名；以該清單計算的檔案總量小於 5MB；兩個檔案在磁碟上仍存在且可被 JSON 解析器讀取；git status 不顯示它們為未追蹤（已被 ignore 規則涵蓋）；git log 中原有的 commit 數與內容不變（未重寫歷史）。涵蓋 Requirement: Raw inputs are verifiable without being stored in the repository；實作 design 決策一：止血而非手術——停止追蹤，不重寫歷史。
- [x] 3.3 README.md 更正 data/raw 的敘述。現寫「政府原始下載檔，不做任何修改」，該敘述對五個 CSV 與各 XLS 成立、對兩個 ODRP JSON 不成立——後者是分頁 API 四頁合併後由本專案序列化的產物，另帶六個底線開頭的後設欄位。改為描述實情，並說明可重新取得者不入庫、如何以 scripts/fetch-raw.py 取回。驗證：在 README.md 搜尋字串「不做任何修改」無結果；閱讀該段落，確認同時描述了未加工下載檔與正規化下載兩類，且指出重新取得的方式。實作 design 決策五：更正 README 對 `data/raw` 的敘述。
- [x] 3.4 整體迴歸：確認本次改動未影響發佈目錄與網站行為。驗證：執行 python scripts/build-site.py，確認輸出的檔案數與總大小與改動前相同（53 個檔案、約 2.13 MB）；以靜態伺服器服務 _site/ 並逐一切換四個分頁，確認人口、選舉、土地三個面板與席次模擬器渲染正常、瀏覽器 console 無錯誤；執行既有的人口轉檔腳本，確認它仍能讀取留在本機的兩個 ODRP JSON 並產生與現況相同的輸出。涵蓋 Requirement: Re-obtaining a raw input is an executable action。
