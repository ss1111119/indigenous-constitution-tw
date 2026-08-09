# 從中選會 votedata.zip 抽取立委選舉全國層級概況（第7-11屆）
#
# 來源：https://data.cec.gov.tw/選舉資料庫/votedata.zip
# 用法：pwsh ./scripts/extract-cec-elprof.ps1
# 輸出：data/processed/legislative-representation.json
#
# 三個跨屆格式陷阱（皆已處理，勿移除相關程式碼）：
#   1. 資料夾名 2008 為「山原/平原/區域」，2012 起改為「山地立委/平地立委/區域立委」
#   2. 2016 檔名帶 _T1/_T2/_T3 後綴，且有一份 old/ 舊版須排除
#   3. 2024 起 idx11-16 欄位順序改變（詳見 Detect-Layout），格式文件未更新
# 另：檔名為 Big5，須以 codepage 950 開啟 zip；部分欄位帶 Excel 文字前綴單引號。

Add-Type -AssemblyName System.IO.Compression.FileSystem
[Console]::OutputEncoding=[System.Text.Encoding]::UTF8
$enc=[System.Text.Encoding]::GetEncoding(950)
$zp='C:\Users\rsjhu\Documents\code\indigenous-constitution-tw\data\raw\cec-votedata.zip'
$z=[System.IO.Compression.ZipFile]::Open($zp,'Read',$enc)

$map = @(
  @{ term=7;  year=2008; folder='2008立委';            sub=@{ '山原'='山原'; '平原'='平原'; '區域'='區域' } }
  @{ term=8;  year=2012; folder='20120114-總統及立委'; sub=@{ '山原'='山地立委'; '平原'='平地立委'; '區域'='區域立委' } }
  @{ term=9;  year=2016; folder='2016總統立委';        sub=@{ '山原'='山地立委'; '平原'='平地立委'; '區域'='區域立委' } }
  @{ term=10; year=2020; folder='2020總統立委';        sub=@{ '山原'='山地立委'; '平原'='平地立委'; '區域'='區域立委' } }
  @{ term=11; year=2024; folder='2024總統立委';        sub=@{ '山原'='山地立委'; '平原'='平地立委'; '區域'='區域立委' } }
)
$t2016 = @{ '山原'='elprof_T3.csv'; '平原'='elprof_T2.csv'; '區域'='elprof_T1.csv' }

$rows=@()
foreach($m in $map){
  foreach($k in @('山原','平原','區域')){
    $fn = if($m.year -eq 2016){ $t2016[$k] } else { 'elprof.csv' }
    $e = $z.Entries | Where-Object { $_.FullName -like "*/voteData/$($m.folder)/$($m.sub[$k])/$fn" -and $_.FullName -notlike '*/old/*' } | Select-Object -First 1
    if(-not $e){ Write-Host "MISSING $($m.year) $k"; continue }
    $sr=New-Object System.IO.StreamReader($e.Open(),$enc); $f=$null
    while(($l=$sr.ReadLine()) -ne $null){
      $c=($l -replace '"','' -replace "'",'') -split ',' | ForEach-Object { $_.Trim() }
      if($c.Count -lt 20){ continue }
      if($c[0] -match '^0+$' -and $c[1] -match '^0+$' -and $c[2] -match '^0+$' -and $c[3] -match '^0+$' -and $c[4] -match '^0+$' -and $c[5] -match '^0+$'){ $f=$c; break }
    }
    $sr.Close()
    if(-not $f){ Write-Host "NO-NATIONAL $($m.year) $k"; continue }

    $n=@{}; 6..16 | ForEach-Object { $n[$_]=[int64]$f[$_] }
    # 版面偵測：2024 起改為 男,女,合計 × 2；2008-2020 為 合計,合計,男,女,男,女
    if( ($n[11]+$n[12]) -eq $n[13] -and ($n[14]+$n[15]) -eq $n[16] ){
      $cand=$n[13]; $seats=$n[16]; $layout='2024'
    } elseif( ($n[13]+$n[14]) -eq $n[11] -and ($n[15]+$n[16]) -eq $n[12] ){
      $cand=$n[11]; $seats=$n[12]; $layout='spec'
    } else { Write-Host "LAYOUT-UNKNOWN $($m.year) $k"; continue }

    $rows += [pscustomobject]@{
      屆別=$m.term; 年=$m.year; 類別=$k; 版面=$layout
      人口數=$n[10]; 選舉人數=$n[9]; 投票數=$n[8]
      投票率=[math]::Round(100.0*$n[8]/$n[9],2)
      候選人數=$cand; 席次=$seats
      每席選舉人數=[math]::Round($n[9]/$seats,0)
    }
  }
}
$z.Dispose()
$rows | Format-Table -AutoSize

"`n=== 代表性核心指標 ==="
$metrics = foreach($y in @(2008,2012,2016,2020,2024)){
  $s=$rows | Where-Object {$_.年 -eq $y -and $_.類別 -eq '山原'}
  $p=$rows | Where-Object {$_.年 -eq $y -and $_.類別 -eq '平原'}
  $r=$rows | Where-Object {$_.年 -eq $y -and $_.類別 -eq '區域'}
  if(-not($s -and $p -and $r)){ continue }
  $ipVoters=$s.選舉人數+$p.選舉人數; $ipSeats=$s.席次+$p.席次
  $ipPop=$s.人口數+$p.人口數
  $perIP=[math]::Round($ipVoters/$ipSeats,0)
  $perReg=[math]::Round($r.選舉人數/$r.席次,0)
  [pscustomobject]@{
    年=$y
    原民選舉人數=$ipVoters; 原民席次=$ipSeats; 每席原民選民=$perIP
    區域選舉人數=$r.選舉人數; 區域席次=$r.席次; 每席區域選民=$perReg
    倍數差距=[math]::Round($perReg/$perIP,2)
    原民人口=$ipPop; 區域人口=$r.人口數
    # 分母必須是 區域人口 + 原民人口。CEC 的「區域立委人口數」不含原住民，
    # 兩者互斥、相加才是全國人口（2012 年與戶政司年底人口完全相等，差異 0）。
    # 直接拿區域人口當分母會把占比高估約 0.05-0.07 個百分點。
    全國人口=$ipPop + $r.人口數
    人口占比_pct=[math]::Round(100.0*$ipPop/($ipPop + $r.人口數),2)
    席次占比_pct=[math]::Round(100.0*$ipSeats/113,2)
  }
}
$metrics | Format-Table -AutoSize

$outDir = Join-Path $PSScriptRoot '..\data\processed'
$out = @{
  meta = @{
    source        = 'https://data.cec.gov.tw/選舉資料庫/votedata.zip'
    agency        = '中央選舉委員會'
    file          = 'elprof.csv（選舉概況檔）全國層級列'
    nature        = 'official-statistic'
    derived       = '每席選舉人數、倍數差距、人口占比、席次占比為本專案計算 (derived-by-this-project)'
    downloadedAt  = '2026-08-09'
    generatedBy   = 'scripts/extract-cec-elprof.ps1'
    caveats       = @(
      'CEC「區域立委人口數」不含原住民，與山原/平原人口互斥；全國人口＝三者相加。已與內政部戶政司年底人口交叉驗證，2012年差異為0，其餘各屆差4千-3萬（選舉在1月、戶政司基準為前一年12/31的時間差）'
      '席次占比分母固定為 113（第7屆起立法院總席次）'
      '2024 年起中選會 elprof 欄位順序改變，本腳本自動偵測，見 Detect-Layout 註解'
    )
  }
  byCategory = $rows
  metrics    = $metrics
}
$out | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $outDir 'legislative-representation.json') -Encoding UTF8
"`n已輸出: data/processed/legislative-representation.json"
