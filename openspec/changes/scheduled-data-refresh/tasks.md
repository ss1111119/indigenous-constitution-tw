<!-- 每個任務標註其涵蓋的 spec requirement（英文原名）與 design 決策，供追溯與分析器比對。 -->

## 1. 回歸測試（先行，後續自動化的安全網）

- [ ] 1.1 建立測試入口與成功樣本：`tests/run-regression.ps1` 以單一指令執行轉檔腳本的回歸測試，成功時狀態碼 0；`tests/fixtures/` 下的成功樣本保留 ODRP 真實欄位名稱與型別、內部自洽（族別加總等於 `indigenous_total`），不錄製完整回應（ODRP018 單期約 40MB 不入庫）。驗證：執行 `pwsh tests/run-regression.ps1`，確認狀態碼為 0 且輸出列出通過的斷言名稱；確認 `tests/fixtures/` 下無單檔超過 1MB。涵蓋 Requirement: Conversion scripts have regression tests over recorded inputs；實作 design 決策五：回歸測試以錄製的小樣本為輸入，並涵蓋失敗路徑。

- [ ] 1.2 補上失敗路徑樣本與斷言：新增兩個刻意破壞的樣本——族別加總不等於 `indigenous_total`、以及平埔兩組平行結構混加後超過總數——並斷言轉檔中止、狀態碼非零、且執行後沒有留下任何產出檔案。驗證：執行測試入口，確認兩個破壞樣本各自使測試偵測到「腳本已中止」與「無產出檔案」兩個條件皆成立；若移除腳本中的自我驗證，此測試必須轉為失敗。涵蓋 Requirement: Regression tests cover the self-validation failure paths；實作 design 決策五。

## 2. 轉檔腳本的變動幅度檢查

- [ ] 2.1 於 `scripts/build-population.ps1` 加入幅度檢查：新期別的全國原住民總人口相對前一期變動超過 ±1% 時，腳本以非零狀態碼中止、不產出檔案，並在 stderr 指出前後兩期的數值與變動百分比；前一期數值取自版本庫既有的 `data/processed/population-by-county.json`。驗證：以成功樣本執行確認通過；以人工調整為 +1.16% 的樣本執行，確認中止且 stderr 含前後數值；將該檢查納入 `tests/run-regression.ps1`。涵蓋 Requirement: Refreshed data is committed only after validation passes；實作 design 決策六：變動幅度檢查，異常即中止。

## 3. 期別與資料狀態改為資料驅動

- [ ] 3.1 `scripts/build-site.py` 支援單一種取代：組建時把頁面中的期別佔位符換成由 processed JSON 的 `_sourceId` 對應 `data/sources.json` 取得的 `dataDate`，其餘位元組原樣複製，不引入通用模板機制、不打包、不壓縮，且維持只用標準函式庫。來源記錄不存在時以非零狀態碼結束、指出無法解析的識別碼、且不留下 `_site/`。驗證：組建後比對 `_site/index.html` 與 `site/index.html`，確認差異僅在期別處；暫時把 `_sourceId` 改為不存在的值後重跑，確認非零退出、stderr 指出該識別碼、`_site/` 不存在。涵蓋 Requirement: The publish build performs exactly one kind of substitution；實作 design 決策三：期別文字由組建時取代注入，這是 build-site.py 唯一被允許的轉換。

- [ ] 3.2 `site/index.html` 中所有陳述基準日的位置改為佔位符（人口面板的無腳本說明、頁尾資料來源、資料缺口段落），使頁面顯示的基準日恆等於實際載入資料的期別，且停用 JavaScript 時仍看得到基準日。驗證：組建後以靜態伺服器開啟 `_site/`，確認三處顯示同一個期別且與 `population-by-county.json` 的 `_sourceId` 相符；於瀏覽器停用 JavaScript 重新載入，確認基準日仍出現；全檔搜尋「115 年 6 月」應無結果。涵蓋 Requirement: The displayed baseline period is derived from the data；實作 design 決策三。

- [ ] 3.3 平埔族群三態改由載入的資料判定：`site/js/panel-population.js` 依「欄位不存在／存在且為零／存在且大於零」三種情形切換呈現，不以當前日期、不以登記開放日、不以任何寫死旗標判定；出現非零值時顯示數字並標註所屬期別。驗證：以現行資料確認顯示「尚無登記」；在本機把 `indigenous_pingpu` 改為非零後重跑組建，確認切換為顯示數字與期別；移除該欄位後確認顯示為「該期官方統計尚無此欄位」且時間序列不補零。涵蓋 Requirement: Data state is determined by the data, not by the calendar；實作 design 決策四：平埔族群三態由資料判定，不由日期判定。

## 4. 排程刷新流程

- [ ] 4.1 新增 `.github/workflows/refresh-data.yml` 的期別探測：每日於 UTC 21:00 執行，自 `data/sources.json` 記載的期別次月起逐月查詢至當月，依回應的 `responseMessage` 與資料列數判定是否已發布，取最新一個有資料的期別；全部查無資料時正常結束、不提交、不觸發部署；網路錯誤或無法歸類的回應則使流程失敗。驗證：以 workflow_dispatch 手動觸發一次，確認流程在目前（無新期別）狀態下綠燈結束且未產生 commit；暫時把記載期別改為 11505 後觸發，確認探測結果為 11506。涵蓋 Requirement: A scheduled job discovers newly published source periods；實作 design 決策一：每日探測，以 ODRP 的回應語意判斷是否已發布。

- [ ] 4.2 流程的提交規則：探測到新期別後執行轉檔，通過既有自我驗證與 2.1 的幅度檢查才提交重新產生的 `data/processed/` 檔案與更新後的 `data/sources.json` 期別記錄；任一驗證失敗即流程失敗、不提交、版本庫維持原狀。權限限於 `contents: write` 與 `actions: write`。驗證：在分支上以刻意失敗的轉檔觸發，確認流程紅燈且無 commit；成功路徑則確認 commit 只含 `data/` 之下的檔案。涵蓋 Requirement: Refreshed data is committed only after validation passes；實作 design 決策六。

- [ ] 4.3 提交後觸發發佈：流程在提交成功後以 workflow_dispatch 明確呼叫既有的 `Deploy to GitHub Pages`，不在本流程內複製組建或發佈邏輯；未提交時不觸發。驗證：成功路徑確認部署流程被啟動，並以瀏覽器開啟 Pages 網址確認頁面上的基準日已變更——不以流程顯示成功為唯一判準；無新期別的執行則確認沒有新的部署紀錄。涵蓋 Requirement: A successful refresh republishes the site；實作 design 決策二：以 workflow_dispatch 觸發既有的部署流程，不複製部署邏輯。

- [ ] 4.4 手動指定期別：流程提供 workflow_dispatch 輸入以指定要轉檔的期別，指定時略過探測並直接轉該期，其餘驗證一律照常套用；重跑版本庫現有期別時產出必須與既有檔案逐位元組相同且不產生 commit。驗證：以輸入 11506 觸發，確認 `git status` 在轉檔後為乾淨、流程綠燈且無 commit。涵蓋 Requirement: The refresh job can be run manually for a chosen period。

## 5. 文件與端到端驗收

- [ ] 5.1 README 補上資料更新一節：說明排程時間與探測邏輯、手動指定期別的觸發方式、幅度檢查被擋下時的處置步驟、以及回歸測試的執行指令；並說明刷新流程需要 `contents: write` 與 `actions: write`，與 `deploy.yml` 的唯讀權限不同。驗證：依 README 的指令從乾淨狀態逐條照抄執行，確認每一條都可直接執行且結果與文件所述相符。

- [ ] 5.2 端到端驗收：把 `data/sources.json` 的期別暫時改為 11505 並觸發刷新流程，確認完整走完探測、轉檔、驗證、提交、部署，且線上頁面的基準日、人口數字與平埔族群狀態三者同時更新；驗收後把期別還原。驗證：以瀏覽器開啟 Pages 網址逐項確認上述三者，並確認 `data/processed/` 的 `_sourceId` 與頁面顯示一致。
