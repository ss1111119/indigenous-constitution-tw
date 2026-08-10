# 第三方函式庫

依 design.md 決策七，函式庫以本機檔案形式納入版本庫，**不使用 CDN**。

理由：本站的生命週期須撐過 2028 年 10 月的立法期限。CDN 在多年尺度上有失效、
改版、或被封鎖的風險，而這個網站的價值正好建立在「三年後還能打開、數字還對得上」。
把檔案入庫是划算的交換——增加約 200KB 的庫容量，換掉一個外部相依。

| 檔案 | 版本 | 授權 | 授權全文 | 來源 |
| --- | --- | --- | --- | --- |
| `chart.umd.js` | Chart.js 4.4.7 | MIT | `LICENSE-chartjs.txt` | https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.js |
| `leaflet.js` / `leaflet.css` | Leaflet 1.9.4 | BSD-2-Clause | `LICENSE-leaflet.txt` | https://unpkg.com/leaflet@1.9.4/dist/ |

**為什麼授權全文要隨檔入庫**：MIT 與 BSD-2-Clause 都要求再散布時保留授權聲明。
壓縮後的 `chart.umd.js` 標頭有「Released under the MIT License」一行，但 `leaflet.js`
的 `@preserve` 標頭只有版權行，**沒有 BSD-2-Clause 要求的條款列表與免責聲明**。
只靠壓縮檔的標頭不足以滿足條件，故兩份全文取自各自的版本標籤存於本目錄。

更新方式：直接以新版覆蓋並更新上表，**同時更新對應的授權全文檔**
（授權條款會隨版本變動，不可假設沿用），並確認各面板圖表仍正常渲染。

## Leaflet 不載入底圖磚

本站的地圖是行政區 choropleth，只需要多邊形，**不使用任何 tile layer**。
理由與上面同一條：OpenStreetMap 或其他磚服務是外部相依，會在多年尺度上帶來
失效風險，且各有使用政策與標示義務。不載磚也讓 choropleth 的顏色不必跟底圖搶對比。

Leaflet 在此的角色是向量渲染器與平移縮放，不是地圖服務客戶端。
