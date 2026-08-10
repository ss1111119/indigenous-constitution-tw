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

# 任何一屆任一類別解析失敗都必須中止，不可跳過後繼續。
# 少一列不會讓輸出看起來壞掉——metrics 會安靜地少一年，而那正是最難發現的錯誤。
$errs=@()
$rows=@()
foreach($m in $map){
  foreach($k in @('山原','平原','區域')){
    $fn = if($m.year -eq 2016){ $t2016[$k] } else { 'elprof.csv' }
    $e = $z.Entries | Where-Object { $_.FullName -like "*/voteData/$($m.folder)/$($m.sub[$k])/$fn" -and $_.FullName -notlike '*/old/*' } | Select-Object -First 1
    if(-not $e){ $errs += "$($m.year) $k：zip 內找不到 $fn（資料夾 $($m.folder)/$($m.sub[$k])）"; continue }
    $sr=New-Object System.IO.StreamReader($e.Open(),$enc); $f=$null
    while(($l=$sr.ReadLine()) -ne $null){
      $c=($l -replace '"','' -replace "'",'') -split ',' | ForEach-Object { $_.Trim() }
      if($c.Count -lt 20){ continue }
      if($c[0] -match '^0+$' -and $c[1] -match '^0+$' -and $c[2] -match '^0+$' -and $c[3] -match '^0+$' -and $c[4] -match '^0+$' -and $c[5] -match '^0+$'){ $f=$c; break }
    }
    $sr.Close()
    if(-not $f){ $errs += "$($m.year) $k：找不到全國彙總列（前 6 欄皆為 0 的那一列）"; continue }

    $n=@{}; 6..16 | ForEach-Object { $n[$_]=[int64]$f[$_] }
    # 版面偵測：2024 起改為 男,女,合計 × 2；2008-2020 為 合計,合計,男,女,男,女
    if( ($n[11]+$n[12]) -eq $n[13] -and ($n[14]+$n[15]) -eq $n[16] ){
      $cand=$n[13]; $seats=$n[16]; $layout='2024'
    } elseif( ($n[13]+$n[14]) -eq $n[11] -and ($n[15]+$n[16]) -eq $n[12] ){
      $cand=$n[11]; $seats=$n[12]; $layout='spec'
    } else {
      # 兩種版面皆無法通過「男+女=合計」的自我驗證，代表來源又改了欄位順序。
      # 【絕不套用預設版面】——依格式文件解讀 2024 資料會得到「山原 5 席、平原 2 席」
      # 這種看起來像數字但完全錯誤的結果，且不會報錯。中止是唯一安全的選擇。
      $errs += "$($m.year) $k：兩種欄位版面皆未通過自我驗證（idx11-16 = $($n[11]),$($n[12]),$($n[13]),$($n[14]),$($n[15]),$($n[16])）。來源欄位順序可能再次變更，須人工確認後更新偵測邏輯。"
      continue
    }

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

# 15 = 5 屆 × 3 類別。少任何一列都代表解析出了問題。
if($rows.Count -ne 15){
  $errs += "解析出 $($rows.Count) 列，預期 15（5 屆 × 3 類別）"
}
if($errs.Count -gt 0){
  Write-Host ''
  Write-Host "自我驗證失敗（$($errs.Count) 項），未產生任何輸出檔：" -ForegroundColor Red
  $errs | ForEach-Object { Write-Host "  $_" }
  throw '自我驗證失敗，中止。'
}
Write-Host "版面偵測：$(($rows | Group-Object 版面 | ForEach-Object { "$($_.Name) $($_.Count) 列" }) -join '、')"
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

. "$PSScriptRoot/lib/provenance.ps1"

# 拆成兩個檔：兩種資料列的欄位性質不同（byCategory 幾乎全為官方，metrics 多為本專案計算），
# _fieldNature 是單一對照表，混在一檔會無法逐欄標示。兩者同一來源，sourceId 相同。
Write-ProvenancedJson -SourceId 'cec-votedata' -OutPath 'data/processed/election-by-category.json' `
  -GeneratedBy 'scripts/extract-cec-elprof.ps1' -Data $rows `
  -FieldNature @{
    '屆別'='official-statistic'; '年'='official-statistic'; '類別'='official-statistic'
    # 版面是本腳本偵測的結果，不是來源欄位。保留到前端是可稽核性的一部分——
    # 讀者能看出 2024 年走的是不同解析路徑。
    '版面'='derived-by-this-project'
    '人口數'='official-statistic'; '選舉人數'='official-statistic'; '投票數'='official-statistic'
    '候選人數'='official-statistic'; '席次'='official-statistic'
    # 投票率：CEC 檔內確有此欄，但本腳本自行由 投票數/選舉人數 重算以求一致。
    '投票率'='derived-by-this-project'
    '每席選舉人數'='derived-by-this-project'
  }

Write-ProvenancedJson -SourceId 'cec-votedata' -OutPath 'data/processed/legislative-representation.json' `
  -GeneratedBy 'scripts/extract-cec-elprof.ps1' -Data $metrics `
  -FieldNature @{
    '年'='official-statistic'
    '原民選舉人數'='official-statistic'; '區域選舉人數'='official-statistic'
    '原民人口'='official-statistic'; '區域人口'='official-statistic'
    # 席次為憲法增修條文第4條明定的固定數額，見 sources.json 的 constitution-amendment-art4。
    '原民席次'='official-statistic'; '區域席次'='official-statistic'
    # 以下五項在任何官方文件中都不存在，是本站存在的理由。
    '每席原民選民'='derived-by-this-project'
    '每席區域選民'='derived-by-this-project'
    '倍數差距'='derived-by-this-project'
    '全國人口'='derived-by-this-project'
    '人口占比_pct'='derived-by-this-project'
    '席次占比_pct'='derived-by-this-project'
  }
