<!-- 每個任務標註其涵蓋的 spec requirement（英文原名）與 design 決策，供追溯與分析器比對。 -->

## 1. 共用的表格建構

- [x] 1.1 site/js/panel.js 新增一個匯出的具名建構函式與一個無資料標記字串常數。函式接受即將傳給 Chart.js 的 data 物件（labels 與 datasets）、標題、第一欄欄名、以及數值格式化函式，回傳含 details、summary 與 table 的 DOM 元素：labels 成為列標題，每個 dataset 成為一個資料欄；data 中的 null 與 undefined 一律輸出無資料標記，數值 0 一律輸出 0，此映射寫在本函式內而非交由呼叫端。退化行為：datasets 為空陣列時產生只有列標題欄的表格；某 dataset 的 data 短於 labels 時缺少的位置視為無資料且不錯位；未提供格式化函式時以字串轉換輸出原值；三者皆不拋錯。驗證：以 labels 三項、一個含 null 與一個含 0 的 dataset 呼叫，確認 null 的儲存格文字等於無資料標記、0 的儲存格文字為 0、兩者不相同；以空 datasets 呼叫確認不拋錯且表格仍有列標題欄；以 data 長度短於 labels 的 dataset 呼叫確認末列為無資料標記而非位移。涵蓋 Requirement: Charts drawn on canvas carry a text alternative；實作 design 決策一：表格由傳給 Chart.js 的同一個 data 物件推導、決策二：`null` 一律渲染為無資料標記，`0` 一律渲染為 0、決策四：單位與數值格式由呼叫端提供、決策五：共用建構函式放在 `site/js/panel.js`。

## 2. 三個面板接上表格與可及名稱

- [x] 2.1 site/js/panel-population.js 的族別長條圖 canvas 取得 role="img" 與摘要該圖內容與範圍的 aria-label，並在圖下插入族別表格，數值以既有的 fmt 格式化為人數。驗證：於瀏覽器確認該 canvas 的 role 為 img 且 aria-label 長度大於 0 並逐字閱讀確認其描述與圖相符；展開表格，確認資料列數等於圖上族別數，且所有數值欄加總等於面板標題所示的原住民族人口總數（全國範圍為 637,620）。涵蓋 Requirement: Charts drawn on canvas carry a text alternative；實作 design 決策三：`details` 收合表格，同時為 canvas 加上 `role` 與 `aria-label`——兩者並用。
- [x] 2.2 site/js/panel-election.js 的投票率圖與每席選民倍數差距圖，兩個 canvas 各自取得 role="img" 與摘要該圖內容與涵蓋屆次的 aria-label，並各自在圖下插入表格：投票率表以百分比格式化並含山地原住民、平地原住民、區域立委三欄，倍數差距表以倍數格式化。驗證：確認兩個 canvas 各有 role="img" 與非空 aria-label 並逐字閱讀；投票率表資料列數等於屆次數、資料欄數為 3；倍數差距表中 2008 年顯示 4.29、2024 年顯示 3.57，與圖上數值一致。涵蓋 Requirement: Charts drawn on canvas carry a text alternative；實作 design 決策三：`details` 收合表格，同時為 canvas 加上 `role` 與 `aria-label`——兩者並用。
- [x] 2.3 site/js/panel-land.js 的保留地所有權圖 canvas 取得 role="img" 與摘要該圖內容與涵蓋年度的 aria-label，並在圖下插入逐年表格，數值以公頃格式化。驗證：確認 canvas 有 role="img" 與非空 aria-label 並逐字閱讀；表格中民國 108 年與 109 年兩列的所有數值欄皆顯示無資料標記，且該標記不等於字串 0 也不為空白；民國 113 年所有權部總計顯示 265,766.858、國有顯示 128,762.884，與圖上一致。涵蓋 Requirement: Charts drawn on canvas carry a text alternative；實作 design 決策二：`null` 一律渲染為無資料標記，`0` 一律渲染為 0。

## 3. 樣式與整體驗證

- [x] 3.1 site/css/main.css 新增表格與其摺疊容器的樣式，沿用既有 details 摺疊區的視覺語言並只使用既有的 CSS 變數，使暗色模式自動適配；表格過寬時於自身容器內橫向滾動，頁面本體不得橫向滾動。驗證：新增規則中出現的顏色一律為 var(--...) 形式、無寫死色碼；於視窗寬度 375px 下開啟四個表格，確認 document.documentElement.scrollWidth 不大於 clientWidth（頁面無橫向滾動）。
- [x] 3.2 以組建出的 _site/ 執行整體迴歸，確認四張圖表的視覺呈現與改動前一致且無障礙屬性齊備。驗證：執行 python scripts/build-site.py 後以靜態伺服器服務 _site/，查詢頁面全部 canvas 元素確認四者皆有 role="img" 與非空 aria-label；逐一比對人口、選舉、土地三面板的軸、色階、圖例、資料點位置與土地圖民國 108–109 年的斷線，確認與改動前相同；展開再收合四個表格，確認圖表仍正常且 console 無錯誤。涵蓋 Requirement: Charts drawn on canvas carry a text alternative。
