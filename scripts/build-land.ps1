# 原住民保留地所有權別 → 前端 JSON
#
# 來源：原民會「原住民保留地按所有權別」A53000000A-113003
#       https://data.cip.gov.tw/API/v1/dump/datastore/A53000000A-113003
# 用法：pwsh ./scripts/build-land.ps1
# 輸出：data/processed/land-ownership-national.json （全國逐年，土地面板主圖）
#       data/processed/land-ownership-by-county.json（縣市逐年，供地區選擇器）
#
# 四個必須知道的事：
#   1. 只有 13 個縣市有保留地資料。其餘 9 個縣市是【無保留地】不是【資料缺漏】，
#      前端須顯示「此縣市無原住民保留地」而非空白或零。
#   2. 年度只有民國 107、110、111、112、113，【缺 108、109】。輸出不產生該兩年的資料點，
#      也不做內插——內插等於捏造測量值。前端須在該區間斷線。
#   3. 民國 107 年缺「所有權部總計」列。本腳本以 公有+私有 自行相加，寫入 total_derived
#      而非 total_official，兩欄分開是因為 _fieldNature 是每欄一個值，無法表達
#      「同一欄在某些列是官方、某些列是計算值」。前端取 total_official ?? total_derived，
#      並可據此把該點畫成不同樣式。
#      ⚠️ 107 年的「其他單位」也是空值，故該年推算值可能少計約 0-100 公頃
#      （其他年度的其他單位介於 37-103 公頃）。
#   4. 組成關係（已驗算）：所有權部總計 = 公有 + 私有 + 其他單位；
#      公有 = 國有 + 縣有 + 鄉有 + 省有（不含其他單位）。
#   5. ⚠️ 來源在【同一列內】混用小數位數，故組成加總不會恰好等於官方小計。
#      例：113年臺中市 國有 5040.02（2位）+ 鄉有 5.289（3位）= 5045.309，
#      但公有欄寫 5045.31（2位）。民國113年有 44 個值只到 2 位、39 個到 3 位。
#      故驗證用容差 0.05 公頃（≈ 4 個 2 位數值累積的四捨五入上限），
#      而非要求完全相等。真正的資料錯誤會差好幾個數量級，仍會被抓到。

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
. "$PSScriptRoot/lib/provenance.ps1"

$repo = (Resolve-Path "$PSScriptRoot/..").Path
$csv = Join-Path $repo 'data/raw/cip-reserved-land-owner-A53000000A-113003.csv'
if(-not (Test-Path $csv)){ throw "找不到 $csv" }

# 統計項目 -> 輸出欄名
$ItemMap = @{
  '所有權部總計' = 'total_official'
  '公有土地'     = 'public'
  '國有土地'     = 'state_owned'
  '縣有土地'     = 'county_owned'
  '鄉有土地'     = 'township_owned'
  '省有土地'     = 'province_owned'
  '其他單位'     = 'other_units'
  '私有保留地'   = 'private'
}
$AreaFields = @('total_official','public','state_owned','county_owned','township_owned','province_owned','other_units','private')

Write-Host '建置保留地所有權資料'

$rows = Import-Csv -Path $csv -Encoding UTF8
Write-Host "  讀入 $($rows.Count) 列"

# 以 (縣市代碼, 年度) 為鍵累積。同一鍵下每個統計項目應只出現一次。
$acc = [ordered]@{}
foreach($r in $rows){
  $code = $r.'縣市別代碼'
  $year = [int]$r.'年度'
  $key = "$code-$year"
  if(-not $acc.Contains($key)){
    $e = [ordered]@{ district_code = $code; name = $r.'縣市'; roc_year = $year }
    foreach($f in $AreaFields){ $e[$f] = $null }
    $e['parcels'] = $null
    $acc[$key] = $e
  }
  $item = $r.'統計項目'
  if(-not $ItemMap.ContainsKey($item)){ throw "未預期的統計項目『$item』——來源結構可能已變更，請先確認再調整 ItemMap。" }
  $field = $ItemMap[$item]
  $area = $r.'面積'
  if($area -and $area.Trim() -ne ''){ $acc[$key][$field] = [double]$area }
  if($item -eq '所有權部總計'){
    $n = $r.'資料筆數'
    if($n -and $n.Trim() -ne ''){ $acc[$key]['parcels'] = [int64]$n }
  }
}

# 民國 107 年缺總計列：以 公有+私有 推算，寫入 total_derived。
# 兩欄分開而非覆寫 total_official，是為了讓性質標示留在資料層。
foreach($e in $acc.Values){
  $e['total_derived'] = $null
  if($null -eq $e['total_official']){
    if($null -ne $e['public'] -and $null -ne $e['private']){
      $e['total_derived'] = [math]::Round($e['public'] + $e['private'], 3)
    }
  }
}

# --- 自我驗證（全部在寫檔之前）---
$errs = @()

# 來源同一列內混用小數位數（見開頭第 5 點），故用容差而非要求完全相等。
# 0.05 公頃 ≈ 4 個 2 位小數值累積的四捨五入上限；真正的資料錯誤會差好幾個數量級。
$Tolerance = 0.05

foreach($e in $acc.Values){
  $label = "$($e.name) 民國$($e.roc_year)年"

  # 公有 = 國有 + 縣有 + 鄉有 + 省有
  if($null -ne $e['public']){
    $parts = 0.0
    foreach($f in @('state_owned','county_owned','township_owned','province_owned')){
      if($null -ne $e[$f]){ $parts += $e[$f] }
    }
    if([math]::Abs($parts - $e['public']) -gt $Tolerance){
      $errs += "$label：國有+縣有+鄉有+省有 $parts != 公有土地 $($e['public'])（差 $([math]::Round($parts - $e['public'],3))）"
    }
  }

  # 所有權部總計 = 公有 + 私有 + 其他單位（僅在官方有給總計時驗）
  if($null -ne $e['total_official']){
    $sum = 0.0
    foreach($f in @('public','private','other_units')){
      if($null -ne $e[$f]){ $sum += $e[$f] }
    }
    if([math]::Abs($sum - $e['total_official']) -gt $Tolerance){
      $errs += "$label：公有+私有+其他 $sum != 所有權部總計 $($e['total_official'])（差 $([math]::Round($sum - $e['total_official'],3))）"
    }
  }

  # 每一列都必須有一個可用的總計，否則前端無圖可畫
  if($null -eq $e['total_official'] -and $null -eq $e['total_derived']){
    $errs += "$label：既無官方總計亦無法推算"
  }
}

# 年度集合必須正好是 107、110-113。若來源新增年度（如補上 108、109），
# 這裡會提醒而非安靜通過——因為前端的斷線邏輯是依此設計的。
$years = @($acc.Values | ForEach-Object { $_.roc_year } | Sort-Object -Unique)
$expected = @(107,110,111,112,113)
if(($years -join ',') -ne ($expected -join ',')){
  $errs += "年度集合為 $($years -join '、')，與預期 $($expected -join '、') 不同。若來源已補上缺漏年度，請確認前端斷線邏輯後再更新此檢查。"
}

$counties = @($acc.Values | ForEach-Object { $_.district_code } | Sort-Object -Unique)
if($counties.Count -ne 13){
  $errs += "縣市數為 $($counties.Count)，預期 13。若來源新增縣市，請確認前端『無保留地』的判斷邏輯。"
}

if($errs.Count -gt 0){
  Write-Host ''
  Write-Host "自我驗證失敗（$($errs.Count) 項），未產生任何輸出檔：" -ForegroundColor Red
  $errs | Select-Object -First 20 | ForEach-Object { Write-Host "  $_" }
  throw '自我驗證失敗，中止。'
}

# --- 全國逐年彙總 ---
# 原民會有對外發布全國保留地面積（可行性研究 A-3b 記載 26 萬餘公頃），
# 故全國總計視為官方統計而非本專案計算值；判準見 data/sources.json 的 natureRule。
# ⚠️ OrderedDictionary 若以【整數】為鍵，索引器會把它當成位置索引而非鍵，
# 導致 index out of range。故年度一律轉字串當鍵。
$national = [ordered]@{}
foreach($e in $acc.Values){
  $yk = [string]$e.roc_year
  if(-not $national.Contains($yk)){
    $n = [ordered]@{ roc_year = $e.roc_year }
    foreach($f in ($AreaFields + @('total_derived'))){ $n[$f] = 0.0 }
    $n['parcels'] = 0
    $n['total_official_missing'] = $false
    $national[$yk] = $n
  }
  $n = $national[$yk]
  foreach($f in ($AreaFields + @('total_derived'))){
    if($null -ne $e[$f]){ $n[$f] += $e[$f] }
  }
  if($null -ne $e['parcels']){ $n['parcels'] += $e['parcels'] }
  if($null -eq $e['total_official']){ $n['total_official_missing'] = $true }
}
foreach($n in $national.Values){
  foreach($f in ($AreaFields + @('total_derived'))){ $n[$f] = [math]::Round($n[$f], 3) }
  # 該年度若任一縣市缺官方總計，全國的官方總計就不完整，改以推算值表示。
  if($n['total_official_missing']){ $n['total_official'] = $null } else { $n['total_derived'] = $null }
  $n.Remove('total_official_missing')
}

foreach($n in $national.Values){
  $shown = if($null -ne $n['total_official']){ $n['total_official'] } else { $n['total_derived'] }
  $tag = if($null -ne $n['total_official']){ '官方' } else { '推算' }
  Write-Host ("  民國{0}年 總計 {1,12:N3} 公頃（{2}）國有 {3,12:N3} 私有 {4,12:N3}" -f $n['roc_year'], $shown, $tag, $n['state_owned'], $n['private'])
}

# --- 寫出 ---
$nature = @{
  district_code = 'official-statistic'; name = 'official-statistic'; roc_year = 'official-statistic'
  total_official = 'official-statistic'
  public = 'official-statistic'; state_owned = 'official-statistic'
  county_owned = 'official-statistic'; township_owned = 'official-statistic'
  province_owned = 'official-statistic'; other_units = 'official-statistic'
  private = 'official-statistic'
  parcels = 'official-statistic'
  # 僅在官方未提供總計的年度（民國107）才有值，由公有+私有相加而得。
  total_derived = 'derived-by-this-project'
}
Write-ProvenancedJson -SourceId 'cip-reserved-land-owner' -OutPath 'data/processed/land-ownership-by-county.json' `
  -GeneratedBy 'scripts/build-land.ps1' `
  -Data ($acc.Values | Sort-Object district_code, roc_year) -FieldNature $nature

$natNature = $nature.Clone()
$natNature.Remove('district_code'); $natNature.Remove('name')
Write-ProvenancedJson -SourceId 'cip-reserved-land-owner' -OutPath 'data/processed/land-ownership-national.json' `
  -GeneratedBy 'scripts/build-land.ps1' `
  -Data ($national.Values | Sort-Object roc_year) -FieldNature $natNature
