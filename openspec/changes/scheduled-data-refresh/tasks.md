<!-- 每個任務標註其涵蓋的 spec requirement（英文原名）與 design 決策，供追溯與分析器比對。 -->

## 1. 回歸測試（先行，後續自動化的安全網）

- [x] 1.1 建立測試入口與成功樣本：`tests/run-regression.ps1` 以單一指令執行轉檔腳本的回歸測試，成功時狀態碼 0；`tests/fixtures/` 下的成功樣本保留 ODRP 真實欄位名稱與型別、內部自洽（族別加總等於 `indigenous_total`），不錄製完整回應（ODRP018 單期約 40MB 不入庫）。驗證：執行 `pwsh tests/run-regression.ps1`，確認狀態碼為 0 且輸出列出通過的斷言名稱；確認 `tests/fixtures/` 下無單檔超過 1MB。涵蓋 Requirement: Conversion scripts have regression tests over recorded inputs；實作 design 決策五：回歸測試以錄製的小樣本為輸入，並涵蓋失敗路徑。

- [x] 1.2 補上失敗路徑樣本與斷言：新增兩個刻意破壞的樣本——族別加總不等於 `indigenous_total`、以及平埔兩組平行結構混加後超過總數——並斷言轉檔中止、狀態碼非零、且執行後沒有留下任何產出檔案。驗證：執行測試入口，確認兩個破壞樣本各自使測試偵測到「腳本已中止」與「無產出檔案」兩個條件皆成立；若移除腳本中的自我驗證，此測試必須轉為失敗。涵蓋 Requirement: Regression tests cover the self-validation failure paths；實作 design 決策五。

## 2. 轉檔腳本的變動幅度檢查

- [x] 2.1 於 `scripts/build-population.ps1` 加入幅度檢查：新期別的全國原住民總人口相對前一期變動超過 ±1% 時，腳本以非零狀態碼中止、不產出檔案，並在 stderr 指出前後兩期的數值與變動百分比；前一期數值取自版本庫既有的 `data/processed/population-by-county.json`。驗證：以成功樣本執行確認通過；以人工調整為 +1.16% 的樣本執行，確認中止且 stderr 含前後數值；將該檢查納入 `tests/run-regression.ps1`。涵蓋 Requirement: Refreshed data is committed only after validation passes；實作 design 決策六：變動幅度檢查，異常即中止。

## 3. 期別與資料狀態改為資料驅動

- [x] 3.1 `scripts/build-site.py` 支援單一種取代：組建時把頁面中的期別佔位符換成由 processed JSON 的 `_sourceId` 對應 `data/sources.json` 取得的 `dataDate`，其餘位元組原樣複製，不引入通用模板機制、不打包、不壓縮，且維持只用標準函式庫。來源記錄不存在時以非零狀態碼結束、指出無法解析的識別碼、且不留下 `_site/`。驗證：組建後比對 `_site/index.html` 與 `site/index.html`，確認差異僅在期別處；暫時把 `_sourceId` 改為不存在的值後重跑，確認非零退出、stderr 指出該識別碼、`_site/` 不存在。涵蓋 Requirement: The publish build performs exactly one kind of substitution；實作 design 決策三：期別文字由組建時取代注入，這是 build-site.py 唯一被允許的轉換。

- [x] 3.2 `site/index.html` 中所有陳述基準日的位置改為佔位符（人口面板的無腳本說明、頁尾資料來源、資料缺口段落），使頁面顯示的基準日恆等於實際載入資料的期別，且停用 JavaScript 時仍看得到基準日。驗證：組建後以靜態伺服器開啟 `_site/`，確認三處顯示同一個期別且與 `population-by-county.json` 的 `_sourceId` 相符；於瀏覽器停用 JavaScript 重新載入，確認基準日仍出現；全檔搜尋「115 年 6 月」應無結果。涵蓋 Requirement: The displayed baseline period is derived from the data；實作 design 決策三。

- [x] 3.3 平埔族群三態改由載入的資料判定：`site/js/panel-population.js` 依「欄位不存在／存在且為零／存在且大於零」三種情形切換呈現，不以當前日期、不以登記開放日、不以任何寫死旗標判定；出現非零值時顯示數字並標註所屬期別。驗證：以現行資料確認顯示「尚無登記」；在本機把 `indigenous_pingpu` 改為非零後重跑組建，確認切換為顯示數字與期別；移除該欄位後確認顯示為「該期官方統計尚無此欄位」且時間序列不補零。涵蓋 Requirement: Data state is determined by the data, not by the calendar；實作 design 決策四：平埔族群三態由資料判定，不由日期判定。

## 4. 排程刷新流程

- [x] 4.1 新增 `.github/workflows/refresh-data.yml` 的期別探測：每日於 UTC 21:00 執行，自 `data/sources.json` 記載的期別次月起逐月查詢至當月，依回應的 `responseMessage` 與資料列數判定是否已發布，取最新一個有資料的期別；全部查無資料時正常結束、不提交、不觸發部署；網路錯誤或無法歸類的回應則使流程失敗。驗證：以 workflow_dispatch 手動觸發一次，確認流程在目前（無新期別）狀態下綠燈結束且未產生 commit；暫時把記載期別改為 11505 後觸發，確認探測結果為 11506。涵蓋 Requirement: A scheduled job discovers newly published source periods；實作 design 決策一：每日探測，以 ODRP 的回應語意判斷是否已發布。

- [x] 4.2 流程的提交規則：探測到新期別後執行轉檔，通過既有自我驗證與 2.1 的幅度檢查才提交重新產生的 `data/processed/` 檔案與更新後的 `data/sources.json` 期別記錄；任一驗證失敗即流程失敗、不提交、版本庫維持原狀。權限限於 `contents: write` 與 `actions: write`。驗證：在分支上以刻意失敗的轉檔觸發，確認流程紅燈且無 commit；成功路徑則確認 commit 只含 `data/` 之下的檔案。涵蓋 Requirement: Refreshed data is committed only after validation passes；實作 design 決策六。

- [x] 4.3 提交後觸發發佈：流程在提交成功後以 workflow_dispatch 明確呼叫既有的 `Deploy to GitHub Pages`，不在本流程內複製組建或發佈邏輯；未提交時不觸發。驗證：成功路徑確認部署流程被啟動，並以瀏覽器開啟 Pages 網址確認頁面上的基準日已變更——不以流程顯示成功為唯一判準；無新期別的執行則確認沒有新的部署紀錄。涵蓋 Requirement: A successful refresh republishes the site；實作 design 決策二：以 workflow_dispatch 觸發既有的部署流程，不複製部署邏輯。

- [x] 4.4 手動指定期別：流程提供 workflow_dispatch 輸入以指定要轉檔的期別，指定時略過探測並直接轉該期，其餘驗證一律照常套用；重跑版本庫現有期別時產出必須與既有檔案逐位元組相同且不產生 commit。驗證：以輸入 11506 觸發，確認 `git status` 在轉檔後為乾淨、流程綠燈且無 commit。涵蓋 Requirement: The refresh job can be run manually for a chosen period。

## 5. 文件與端到端驗收

- [x] 5.1 README 補上資料更新一節：說明排程時間與探測邏輯、手動指定期別的觸發方式、幅度檢查被擋下時的處置步驟、以及回歸測試的執行指令；並說明刷新流程需要 `contents: write` 與 `actions: write`，與 `deploy.yml` 的唯讀權限不同。驗證：依 README 的指令從乾淨狀態逐條照抄執行，確認每一條都可直接執行且結果與文件所述相符。

- [x] 5.2 端到端驗收：確認刷新流程完整走完探測、轉檔、驗證、提交、部署，且線上頁面的基準日、人口數字與平埔族群狀態三者同時更新。**本項以等價且更強的證據完成，未採用原訂方法。** 原訂方法為「把 `data/sources.json` 的期別暫時改為 11505 以製造一個假的落後狀態」，該做法已被排除：竄改來源記錄的期別以觸發流程，違反本專案資料紀律（任何呈現的數字都要能在 `sources.json` 追到來源），且製造出的是模擬事件而非真實事件。實際證據為 2026-08-12 的一次**真實**排程執行：排程自行探測到 ODRP 發布 11507、完成轉檔與自我驗證與幅度檢查、提交 072ef82（僅含 `data/` 之下檔案）、並以 workflow_dispatch 觸發部署。驗證：2026-08-15 以瀏覽器開啟 Pages 網址確認頁面三處基準日均為「2026-07（民國115年7月）」、全國原住民人口 638,466、平埔族群顯示「尚無登記（0 人）」，且與 `data/processed/population-by-county.json` 的 `_sourceId`（`moi-odrp013-11507`）一致；資料另與原民會 11507 月報 RCRPC1F0 逐格比對 440 格全數相符。真實事件涵蓋原訂方法的每一個驗收點，且多了「探測確實在無人操作下自行發生」這一項模擬做不到的證據。涵蓋 Requirement: A scheduled job discovers newly published source periods、Refreshed data is committed only after validation passes、A successful refresh republishes the site。

## 6. 幅度檢查的具名放行

- [x] 6.1 `scripts/build-population.ps1` 新增 `-AcceptLargeChange`（開關）與 `-OverrideReason <string>` 兩個參數：兩者必須同時提供，只給其一即以非零狀態碼在轉檔前中止並在 stderr 指出缺少哪一個，且不產出任何檔案；同時提供時，幅度檢查照常計算並輸出前後數值與變動百分比，但不中止。腳本不得提供調整或關閉 ±1% 門檻的任何參數。驗證：以現有 11507 資料搭配人工調整為 +7.8% 的樣本執行三次——只給旗標、只給理由、兩者皆給——確認前兩次非零退出且 `data/processed/` 無變動，第三次成功且 stdout 含變動百分比。涵蓋 Requirement: A legitimate large change is released by a named human override；實作 design 決策九：幅度檢查的放行是「具名的人工覆寫」，不是關閉檢查。

- [x] 6.2 `.github/workflows/refresh-data.yml` 接上放行輸入：新增 `accept_large_change`（boolean）與 `override_reason`（string）兩個 workflow_dispatch 輸入，僅在手動觸發時傳入轉檔腳本；`schedule` 觸發的執行路徑不得傳入這兩個值，且流程須在傳入放行參數時於 commit 訊息中寫入該理由與實際變動百分比。驗證分為兩層，本任務只涵蓋第一層。**第一層（本任務的完成條件）**：(a) 檢視流程定義確認 `schedule` 觸發路徑不帶入放行參數；(b) 在真實 GitHub Actions 上以 `workflow_dispatch` 手動觸發一次，`period` 填版本庫現有期別（目前為 11507）、`accept_large_change` 勾選、`override_reason` 填寫真實理由，確認 `Resolve override` 步驟輸出 `accept=true` 且理由完整傳遞、`Convert` 步驟兩個參數均正確綁定至轉檔腳本、幅度檢查因變動為 0% 而正常通過、產出與版本庫逐位元組相同因而不產生 commit、不觸發部署。此次執行驗證的是輸入解析、放行參數解析與參數傳遞這條鏈路在真實 runner 上成立，**不涵蓋放行分支本身**（變動落在門檻內，不會進入放行分支）。**第二層屬 deferred，見 design「延後的驗證」一節**，不列為本任務的完成條件。涵蓋 Requirement: A legitimate large change is released by a named human override；實作 design 決策九：幅度檢查的放行是「具名的人工覆寫」，不是關閉檢查。**（2026-08-16 進度：workflow 實作已完成——新增 `accept_large_change`／`override_reason` 兩個 workflow_dispatch 輸入、`Resolve override` 步驟以 `github.event_name` 判定並在非手動觸發時一律不放行、`Convert` 以 `6>&1` 取回變動百分比、`Commit data` 於放行時追加百分比與理由。離線驗證已完成：YAML 可解析且 schedule 無 inputs；`Resolve override` 五種情形本機模擬正確，含「schedule 觸發即使輸入被填上仍不放行」；以真實腳本輸出驗證百分比擷取得 1.1605；commit 訊息組裝在放行與未放行兩種情形下均正確。實作過程修正一處自身缺陷：原以陣列展開傳參，`[switch]` 不會綁定，導致放行實際失效，改為雜湊表展開。**<br>**第一層完成證據（2026-08-17，GitHub Actions run `31988923342`，`workflow_dispatch`，輸入 `period=11507`、`accept_large_change=true`、`override_reason` 為具名理由，執行於 ubuntu-latest，耗時 1m34s，結論 success）：**<br>① `Resolve override` 步驟輸出 `accept=true`，日誌印出「已指定具名放行，理由：⋯」——該訊息只在 accept 為真的分支產生。**<br>② `Convert` 步驟的環境變數區塊經日誌直接記錄為 `OVERRIDE_ACCEPT: true` 與完整未截斷的 `OVERRIDE_REASON`，證明 step output 確實傳遞至該步驟的執行環境；其後 `$buildArgs` 的填入是對該值的確定性字串比較。**<br>③ 轉檔腳本**未**觸發放行參數完整性檢查——該檢查在只給旗標或只給理由時以狀態碼 2 中止並拒絕產出；本次未中止，故兩個參數並非只傳入其一，配合②可判定兩者均已傳入。**<br>④ 11507 的幅度檢查以「原住民總人口 638466 → 638466（0%，門檻 ±1%）」正常通過。**<br>⑤ 四份 processed JSON 重新產出後與版本庫既有檔案逐位元組相同，`data/processed`、`data/sources.json` 均無變更（`Register period` 兩筆皆「已登記，略過」，`Record checksums` 重寫後內容不變）。**<br>⑥ `Commit data` 判定「產出與版本庫現有檔案相同，不提交。」，`committed=false`，未產生任何 commit，`origin/master` 維持 `f7f190e`。**<br>⑦ `Trigger deployment` 步驟依條件跳過，未觸發部署。**<br>⑧ `Regression tests` 步驟在 ubuntu-latest 上跑出 38 項斷言全綠，與本機結果一致。**<br>**本次執行未涵蓋、亦不宣稱涵蓋放行分支本身**：11507 相對前一期變動 +0.133%，外層 `|變動| > 1%` 條件為假，內層放行分支無法進入。放行分支的實際執行、`delta_pct` 擷取、以及 commit 訊息追加百分比與理由，三者仍為 deferred，見 design「延後的驗證」一節。）**

- [x] 6.3 更正 README「幅度檢查被擋下時」的處置步驟：現行第 3 步寫「以手動指定期別重新觸發該期」，但手動指定期別只跳過探測、不跳過驗證，照做只會以相同方式再失敗一次。改為說明具名放行的實際指令與 workflow 輸入、兩個參數必須並用、排程無法自我放行、以及門檻不可調整；並補上西拉雅族登記開放後首個非零期別預期會觸發此路徑的說明。驗證：依修改後的 README 從乾淨狀態照抄執行放行流程，確認每一條指令可直接執行且結果與文件所述相符。涵蓋 Requirement: A legitimate large change is released by a named human override。

- [x] 6.4 回歸測試涵蓋放行路徑：於 `tests/run-regression.ps1` 新增斷言——超出 ±1% 且未放行時中止且無產出、只給旗標或只給理由時中止且無產出、兩者皆給時完成轉檔；並斷言族別加總不符的樣本在放行狀態下【仍然】中止，確認放行只鬆綁幅度檢查而不鬆綁自我驗證。驗證：執行 `pwsh tests/run-regression.ps1` 狀態碼為 0；移除腳本中的放行參數檢查後，此測試必須轉為失敗。涵蓋 Requirement: A legitimate large change is released by a named human override；實作 design 決策九：幅度檢查的放行是「具名的人工覆寫」，不是關閉檢查。
