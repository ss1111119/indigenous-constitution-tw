<!-- 每個任務標註其涵蓋的 spec requirement（英文原名）與 design 決策，供追溯與分析器比對。 -->

## 1. 發佈目錄組建

- [x] 1.1 提供組建腳本 scripts/build-site.py，執行後在專案根產生 _site/：site/ 的內容攤在 _site/ 根（index.html、css/、js/、vendor/），資料收在 _site/data/ 之下，只含 sources.json、data/processed/ 全部 JSON、data/geo/ 全部 GeoJSON，不含 data/raw；執行前先清空既有 _site/ 以免殘留檔案混入。腳本只用 Python 標準函式庫。驗證：執行 python scripts/build-site.py，確認 _site/index.html 存在、_site/data/raw 不存在、_site/data/processed 的 .json 檔數與 data/processed 相同、_site/data/geo/townships 的 .geojson 檔數與 data/geo/townships 相同；在 _site/ 手動放入一個來源樹沒有的檔案後重跑，確認該檔消失。涵蓋 Requirement: Publish directory contains only site assets and the data the site reads；實作 design 決策一：以組建腳本產生 `_site/`，而非直接發佈 repo 根目錄。
- [x] 1.2 組建腳本持有必要資料來源清單並於組建前逐一檢查，任一缺失即以非零狀態碼結束、在 stderr 指出缺失的具體路徑，且不留下半成品 _site/；成功時以狀態碼 0 結束並在 stdout 印出複製檔案數與 _site/ 總大小。驗證：暫時移走 data/processed 中任一 JSON 後執行腳本，確認非零退出、stderr 指出該檔、_site/ 不存在；還原後重跑，確認退出碼為 0 且 stdout 印出檔案數與總大小。涵蓋 Requirement: Build fails loudly when a required data source is missing；實作 design 決策四：組建腳本自我驗證，缺檔即失敗。

## 2. 前端資料路徑收斂

- [x] 2.1 資料基底路徑在程式碼中只有一個定義處：site/js/state.js 匯出具名常數 DATA_BASE 且值為 data，loadData 的既有簽章與快取行為不變；site/js/panel-map.js 改為匯入該常數組出 GeoJSON 路徑，不再自寫原生 fetch 的父層相對字面值；site/index.html 的溯源連結改為站台相對路徑。驗證：在 site/js/ 全目錄搜尋字串 ../data 無任何結果，在 site/index.html 搜尋 ../data 無任何結果；以靜態伺服器服務組建出的 _site/ 並下鑽至任一縣市，確認鄉鎮 GeoJSON 載入成功而非 404。涵蓋 Requirement: The data base path has exactly one definition；實作 design 決策三：資料基底路徑收斂為單一定義。
- [x] 2.2 本機預覽改以組建出的 _site/ 為唯一入口，不保留直開 site/ 目錄的替代路徑，也不在程式中依環境偵測資料基底；README 記載組建與本機預覽的完整指令。驗證：以靜態伺服器服務 _site/ 並開啟根網址，逐一確認人口、選舉、土地、地圖四個面板與席次模擬器全部渲染，瀏覽器 console 無資源載入錯誤、Network 面板無 404；依 README 指令從乾淨狀態重跑一次，確認指令可照抄執行。涵蓋 Requirement: Local preview and CI publish share one build path；實作 design 決策二：本機預覽也走 `_site/`，不保留 `site/` 直開的路徑。

## 3. 自動部署

- [ ] 3.1 新增 GitHub Actions workflow，於推送到 master 時及手動觸發（workflow_dispatch）時，在 ubuntu-latest 上 checkout、setup-python、執行組建腳本，並以 actions/upload-pages-artifact 上傳 _site/、actions/deploy-pages 發佈；權限只授予 pages: write 與 id-token: write；組建腳本失敗時 workflow 隨之失敗且不發佈。驗證：以 workflow_dispatch 手動觸發一次，確認流程完成且 Pages 根網址（不帶 /site/ 路徑）呈現儀表板；在分支上暫時使組建腳本失敗並觸發，確認 workflow 失敗且未產生新的部署。涵蓋 Requirement: Deployment is automated from the default branch、Requirement: Local preview and CI publish share one build path；實作 design 決策五：GitHub Actions 於推送 master 時發佈。
- [x] 3.2 組建產物不入庫：.gitignore 加入 _site/；README 補上 GitHub Pages 來源需在 repo 設定中設為 GitHub Actions 的說明，因該項無法由 repo 內的檔案保證。驗證：執行組建腳本後 git status 顯示工作區乾淨（無 _site 相關未追蹤項目）；README 該段落經閱讀確認含設定位置與所選選項。

## 4. 資料授權與首次公開

- [x] 4.1 data/sources.json 記錄 data/raw/moi-year-end-population-by-sex-age.xls 的再散布條款為待確認，不為其填入任何開放授權宣稱；其餘 data/raw 檔案的再散布條款確認皆已有來源記錄。驗證：以 JSON 解析器讀取 data/sources.json 無誤，且可查到該檔的待確認記錄；逐一比對 data/raw 下已入庫檔案，確認每個都能在 sources.json 找到對應來源記錄。涵蓋 Requirement: Redistribution licensing is settled before the repository is made public；實作 design 決策六：授權查證是推送前的阻擋條件。
- [ ] 4.2 查證 data/raw/moi-year-end-population-by-sex-age.xls 的再散布條款並將結論寫回 data/sources.json 取代待確認記錄；結論為允許再散布時，設定 git remote 並推送至使用者建立的 public repo，完成首次部署。若結論為不允許再散布，停止推送並回報，該檔的處置屬於 data/raw 入庫策略、不在本 change 範圍內。驗證：sources.json 中該檔已無待確認標記而有明確條款結論；推送後以瀏覽器實際開啟 Pages 網址，確認站台可達且四個面板與席次模擬器渲染正常——不以 workflow 顯示成功為唯一判準。涵蓋 Requirement: Redistribution licensing is settled before the repository is made public。
