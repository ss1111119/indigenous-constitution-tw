<!-- 每個任務標註其涵蓋的 spec requirement（英文原名）與 design 決策，供追溯與分析器比對。 -->

## 1. 資料契約與轉檔管線

- [x] 1.1 data/sources.json 脫離暫定狀態：移除 provisional 標記，將 gaps 陣列中 affects 欄位的值由舊的四區塊名稱改為四個面板名稱（population、election、land、simulator），並確認 nature 值域包含 compilation。驗證：以 JSON 解析器讀取無誤，且每個 gaps 項目的 affects 值皆屬於四個面板名稱之一。涵蓋 Requirement: Record data gaps in the registry。
- [x] 1.2 提供可重複使用的溯源注入函式，接受來源識別碼與欄位性質對照表，輸出帶有 _sourceId、_generatedBy、_generatedAt、_fieldNature 外層的 JSON；來源識別碼不存在於 data/sources.json 時中止並回報。驗證：以不存在的識別碼呼叫，確認中止且未產生檔案；以 moi-odrp018-11506 呼叫，確認外層四欄齊備。涵蓋 Requirement: Inject source identity and field nature at build time、Requirement: Reject unknown source identifiers；實作 design 決策六：轉檔時注入來源識別與欄位性質，以及 design 資料形狀一節。
- [x] 1.3 人口轉檔腳本接受民國年月參數，將 ODRP013 與 ODRP018 聚合為縣市層級 JSON，寫檔前驗證男加女等於合計、原住民加非原住民等於總計、族別加總等於原住民合計。驗證：以參數 11506 執行，全國總人口 23,243,565、原住民合計 637,620、16 族加總 637,620、10 個平埔欄位皆為 0。涵蓋 Requirement: Convert raw government files to aggregated JSON、Requirement: Accept a period parameter。
- [x] 1.4 人口轉檔腳本另產生鄉鎮層級 JSON，以 8 碼 district_code 為鍵，並標示哪些鄉鎮屬於原住民族地區。驗證：鄉鎮數量與來源村里聚合後一致，且鄉鎮層級各欄加總等於縣市層級對應值。涵蓋 Requirement: Convert raw government files to aggregated JSON；實作 design 決策二：地理層級為縣市加鄉鎮下鑽。
- [x] 1.5 人口轉檔腳本在任一自我驗證失敗時中止並回報差異數值，且不產生輸出檔案。驗證：暫時竄改一列來源資料使男加女不等於合計，確認腳本中止、回報差異、輸出檔未被建立或覆寫。涵蓋 Requirement: Self-validate before writing output；實作 design 失敗模式一節。
- [x] 1.6 土地轉檔腳本將保留地所有權別 CSV 轉為逐年 JSON，缺少年度不產生資料點且不做內插；民國 107 年缺所有權部總計列時自行相加並將該欄標為 derived-by-this-project。驗證：輸出含民國 107、110、111、112、113 五個年度且無 108、109；民國 113 年所有權部總計 265,766.858、國有 128,762.884。涵蓋 Requirement: Preserve gaps in time series。
- [x] 1.7 選舉轉檔腳本以自我驗證偵測各年度欄位版面，兩種版面皆無法通過驗證時中止而不套用預設版面；輸出帶溯源外層的 JSON，將既有 meta.derived 的中文散文改為欄位層級 _fieldNature 對照表。驗證：五屆資料全部通過版面偵測並記錄所用版面；每席選舉人數、倍數差距、人口占比、席次占比四欄性質為 derived-by-this-project。涵蓋 Requirement: Detect election data column layout。

## 2. 地理圖資

- [x] 2.1 取得可再利用的臺灣縣市界 GeoJSON 並確認授權允許再利用，屬性含可與人口資料 join 的 5 碼區域代碼。驗證：以縣市層級人口 JSON 的所有鍵與圖資屬性 join，22 個縣市全部對應成功且無孤兒鍵。實作 design 決策二：地理層級為縣市加鄉鎮下鑽。
- [x] 2.2 取得鄉鎮界 GeoJSON 並依縣市切分為可個別載入的檔案，屬性含 8 碼區域代碼。驗證：任選三個縣市，其鄉鎮圖資與鄉鎮層級人口 JSON 完全對應；單一縣市檔案可獨立載入而不需其他縣市檔案。涵蓋 Requirement: Load township geometry only when needed。

## 3. 頁面骨架與共享狀態

- [x] 3.1 建立單頁骨架，四個面板皆可在不重新載入頁面的情況下到達，且停用 JavaScript 時仍顯示說明文字與資料來源清單。驗證：於瀏覽器停用 JavaScript 開啟頁面，確認說明文字與來源清單可讀。涵蓋 Requirement: Present four panels on one page、Requirement: Remain readable without scripting；實作 design 決策七：純 HTML 加 CSS 加 JavaScript，函式庫納入版本庫。
- [x] 3.2 實作全域地區選擇器與其共享狀態：選取縣市時人口與土地面板重新渲染，選舉與模擬面板維持全國並於面板上標示其為全國資料；可下鑽至鄉鎮並可回到縣市與全國層級。驗證：依序操作全國、選定縣市、下鑽鄉鎮、清除選取，確認四個面板每次都顯示正確的地理範圍標示。涵蓋 Requirement: Global region selector is the only shared state、Requirement: Declare geographic scope on every panel、Requirement: Support drill-down from county to township；實作 design 決策一：全域地區選擇器作為唯一跨面板共享狀態。

## 4. 資料面板

- [x] 4.1 人口面板顯示選定範圍的族別人口，含未申報族別，使各組成加總等於原住民合計。驗證：全國範圍下，16 族加 10 個平埔族群加未申報三者加總為 637,620。涵蓋 Requirement: Population panel shows tribe composition and geographic distribution。
- [x] 4.2 人口面板顯示下一層級行政區的原住民人口比例分佈圖，且在鄉鎮層級標示哪些屬於原住民族地區。驗證：全國範圍顯示 22 縣市；選定花蓮縣後顯示其鄉鎮，且原住民族地區鄉鎮與其他鄉鎮在視覺上可區辨。涵蓋 Requirement: Population panel distinguishes indigenous districts。
- [ ] 4.3 選舉面板顯示第 7 至 11 屆的山原、平原、區域三類投票率，以及每席區域選民對每席原住民選民的倍數差距，並說明原住民席次為憲法固定數額、區域席次依人口比例分配。驗證：2008 年倍數顯示 4.29、2024 年顯示 3.57，且面板上可見該制度說明文字。涵蓋 Requirement: Election panel shows turnout and representation gap over time、Requirement: Election panel explains the institutional cause of the converging ratio。
- [ ] 4.4 土地面板顯示保留地總面積、國有與私有面積的逐年變化，缺少年度處斷線；選定無保留地資料的縣市時顯示該縣市無原住民保留地的說明而非空白或零。驗證：全國範圍下民國 108 與 109 年處為斷線；選定新竹市後面板顯示無保留地說明且未繪出暗示零測量值的圖形。涵蓋 Requirement: Land panel shows ownership composition over time、Requirement: Land panel states when a county has no reserved land；實作 design 決策五：土地面板以所有權變遷為主。
- [ ] 4.5 人口面板提供外連至既有的人口分布視覺化、遷徙與部落點位資源，不在站內重製。驗證：人口面板可見至少三個外連，且連結指向可正常存取的網址。涵蓋 Requirement: Link to external work rather than reproducing it。
- [ ] 4.6 頁面首次渲染僅請求縣市圖資，鄉鎮圖資延後至下鑽時載入；任一面板資料載入失敗時該面板顯示錯誤訊息與來源網址，其餘面板正常運作。驗證：以瀏覽器開發者工具確認初次載入未請求鄉鎮圖資；將任一面板的資料檔改名後重載，確認僅該面板顯示錯誤、其餘面板正常。涵蓋 Requirement: Load township geometry only when needed、Requirement: Isolate panel data failures。（原編為 3.3，因兩項驗收都需要有面板實際載入資料與圖資，而那是本組的工作，故移至此處。任務依「何時驗得起來」分組，比依概念層次分組對實作者更有用。）

## 5. 席次模擬器

- [ ] 5.1 模擬器提供三個控制項並以現況為初始狀態，調整任一控制項後代表性指標即時重算。驗證：初次渲染時席次占比顯示 5.31%、人口占比顯示 2.74%；保障席次設為 6 且平埔納入人口設為 0 時輸出與現況數字一致。涵蓋 Requirement: Expose three controls、Requirement: Start from the status quo；實作 design 決策三：席次模擬器暴露三個控制項，以及 design 行為一節。
- [ ] 5.2 兩種配置方式產生不同算式：重分配時保障席次增加則區域席次等量減少且總席次不變，增額時總席次增加而區域席次不變。驗證：保障席次設為 8，重分配模式顯示區域 71 席、總數 113、席次占比 7.08%；增額模式顯示區域 73 席、總數 115、席次占比 6.96%。涵蓋 Requirement: Two allocation methods produce different arithmetic；實作 design 驗收條件一節。
- [ ] 5.3 平埔納入人口滑桿上限為 637,620，刻度標示 0 與 50,000 兩個有出處的參照點並註明其性質，無依據區間以視覺標示，且面板文案明述上限為參照點而非人口規模主張。驗證：滑桿上可見兩個標註參照點，0 標為官方現況、50,000 標為學術估計且註明僅涵蓋西拉雅族首年；文案含上限非主張的說明。涵蓋 Requirement: Population slider bounds are declared as reference points；實作 design 決策四：平埔納入人口滑桿上限為 637,620，並標註參照點。
- [ ] 5.4 模擬器以手寫 SVG 繪製議會席次圖，席次數量隨配置方式與保障席次變動；提供可展開的固定假設說明、政治參與形式尚未由法律決定的陳述，且任何配置皆不標示為建議或預期。驗證：增額模式下席次方塊總數隨總席次改變；展開假設後可見兩項固定假設與法律未決陳述；全頁文案不含建議或預期字樣。涵蓋 Requirement: Fixed assumptions are stated and inspectable、Requirement: Present outputs as arithmetic, not advocacy、Requirement: State that seat allocation for plains groups is undetermined。
- [ ] 5.5 模擬器以人口為分母呈現代表性落差，並提供選舉人為分母的替代檢視，切換時說明當前使用的基數且指出兩者結果不同、此選擇並非中立。驗證：2024 年資料下人口基數顯示 2.51%、選舉人基數顯示 2.25%，切換後介面標示當前基數。涵蓋 Requirement: Report both population and elector bases。
- [ ] 5.6 模擬器上方呈現法制時間軸，列出憲判 111年憲判字第17號言詞辯論與宣示、身分法三讀與公布、第 23 條期限五個節點，各節點含日期與一手來源連結，並標示各里程碑距其法定期限的間隔。驗證：時間軸顯示 2022-10-28 宣示、2025-10-17 三讀標示距期限 11 天、2025-10-23 公布標示距期限 5 天、2028-10-23 為第 23 條期限；五個節點皆可點擊至法規資料庫或憲法法庭原文。涵蓋 Requirement: Present the legal timeline that makes seat allocation an open question。

## 6. 溯源介面

- [ ] 6.1 四個面板中每個顯示的數字皆可被啟動以查看其提供機關、資料基準日與性質標籤，資料取自 processed JSON 的 _fieldNature 與 data/sources.json。驗證：於每個面板各任選一個數字啟動，皆顯示機關、日期、性質三項資訊。涵蓋 Requirement: Every displayed number is traceable。
- [ ] 6.2 介面區辨零值、該範圍無資料、以及該期間欄位不存在三種狀態：平埔欄位為 0 時顯示尚無登記，時間序列涵蓋 2025-10 以前時該區間不繪點亦不繪零。驗證：平埔數列在 2025-10 以前無資料點，2025-11 起顯示為零並帶有尚無登記標示。涵蓋 Requirement: Distinguish absent data from zero；實作 design 失敗模式與範圍界線兩節。
