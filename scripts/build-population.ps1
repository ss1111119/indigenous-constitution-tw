# 戶政司人口資料 → 前端 JSON（縣市層級）
#
# 來源：ODRP013 現住人口數按性別及原住民身分分（新增區域代碼）
#       ODRP018 現住原住民人口按性別、身分、原住民族別分（新增區域代碼）
# 用法：pwsh ./scripts/build-population.ps1 [-Period 11506]
# 輸出：data/processed/population-by-county.json   （總人口與原住民身分別，源自 ODRP013）
#       data/processed/tribes-by-county.json       （族別，源自 ODRP018）
#
# 為何是兩個檔而非一個：兩份資料來自不同 endpoint，_sourceId 是單值欄位。
# 併成一檔就得讓一個 sourceId 涵蓋兩個來源，那正是本專案禁止的來源混用。
#
# 三個必須知道的陷阱：
#   1. API 路徑參數是 {yyymm}（民國年+月，如 11506），不是 {yyy}。用 115 會回「查無資料」，
#      本專案第二輪曾因此誤判資料不存在達數小時。
#   2. ODRP018 有兩組平行的族別結構：主清單（16 現行族 + 10 平埔族群 + 未申報，共 27 個）
#      與 pingpu_* 區塊（pingpu_total 加 11 個 pingpu_<族>）。後者是依平埔身分別的交叉表，
#      【不是額外的人】。兩組相加會重複計算。目前平埔全為 0 所以看不出來，
#      登記自 2026-08 中開始後就會浮現。本腳本只用主清單，並以自我驗證守住。
#   3. district_code 為 11 碼 = 縣市 5 + 鄉鎮 3 + 村里 3。

param(
  [string]$Period = '11506',

  # 幅度檢查的具名放行。兩者必須並用——見 design 決策九。
  # 刻意不提供調整或關閉 ±1% 門檻的參數：門檻調高一次，下一次數量級錯誤就過得去了。
  [switch]$AcceptLargeChange,
  [string]$OverrideReason
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
. "$PSScriptRoot/lib/provenance.ps1"

$repo = (Resolve-Path "$PSScriptRoot/..").Path

# 放行參數的完整性檢查，置於一切工作之前——只給其一是操作失誤，
# 讓它跑完整趟再失敗只會浪費一次下載，且容易被誤讀成「資料有問題」。
$hasReason = -not [string]::IsNullOrWhiteSpace($OverrideReason)
if($AcceptLargeChange -and -not $hasReason){
  [Console]::Error.WriteLine('放行參數不完整：指定了 -AcceptLargeChange 但缺少 -OverrideReason。放行必須具名，請以 -OverrideReason "<理由>" 說明為何此變動為真實。')
  exit 2
}
if($hasReason -and -not $AcceptLargeChange){
  [Console]::Error.WriteLine('放行參數不完整：指定了 -OverrideReason 但缺少 -AcceptLargeChange。理由本身不構成放行，兩者必須並用。')
  exit 2
}

# ODRP018 主清單的族別 stem，順序即輸出順序。
# 前 16 個為現行認定民族，後 10 個為平埔族群（官方 schema 已預留欄位，2026-06 時值皆為 0），
# 最後為未申報族別——畫族別圓餅圖時不可省略，否則各族加總不等於原住民合計。
$RecognisedTribes = @('amis','atayal','paiwan','bunun','rukai','pinuyumayan','cou','saisiyat',
                      'yami','thao','kavalan','truku','sakizaya','sediq','hlaalua','kanakanavu')
$PingpuTribes     = @('siraya','ketagalan','taokas','pazeh','papora','babuza','hoanya','kaxabu',
                      'taivoan','makatau')
$TribeStems       = $RecognisedTribes + $PingpuTribes + @('undeclared')

# 原住民族地區（55 鄉鎮），依《原住民族基本法》第2條由行政院公告指定，分山地鄉 30、平地鄉 25。
# 來源：data/raw/cip-11506-indigenous-area-population.xls（原民會 115年6月月報），
# 八碼代碼由該表鄉鎮名與 ODRP013 的 site_id 對照取得，55 筆全數對應成功。
#
# 為何寫成常數而非讀檔：這是【法律指定的清單】不是統計數字，僅隨行政院公告變更；
# 且來源為 XLS，PowerShell 解析成本高。變更時請重新比對上述來源檔並更新此處。
$IndigenousDistricts = @(
  @{ code='65000290'; name='新北市烏來區'; kind='mountain' }
  @{ code='10002110'; name='宜蘭縣大同鄉'; kind='mountain' }
  @{ code='10002120'; name='宜蘭縣南澳鄉'; kind='mountain' }
  @{ code='68000130'; name='桃園市復興區'; kind='mountain' }
  @{ code='10004040'; name='新竹縣關西鎮'; kind='plain' }
  @{ code='10004120'; name='新竹縣尖石鄉'; kind='mountain' }
  @{ code='10004130'; name='新竹縣五峰鄉'; kind='mountain' }
  @{ code='10005110'; name='苗栗縣南庄鄉'; kind='plain' }
  @{ code='10005170'; name='苗栗縣獅潭鄉'; kind='plain' }
  @{ code='10005180'; name='苗栗縣泰安鄉'; kind='mountain' }
  @{ code='66000290'; name='臺中市和平區'; kind='mountain' }
  @{ code='10008090'; name='南投縣魚池鄉'; kind='plain' }
  @{ code='10008120'; name='南投縣信義鄉'; kind='mountain' }
  @{ code='10008130'; name='南投縣仁愛鄉'; kind='mountain' }
  @{ code='10010180'; name='嘉義縣阿里山鄉'; kind='mountain' }
  @{ code='64000360'; name='高雄市茂林區'; kind='mountain' }
  @{ code='64000370'; name='高雄市桃源區'; kind='mountain' }
  @{ code='64000380'; name='高雄市那瑪夏區'; kind='mountain' }
  @{ code='10013240'; name='屏東縣滿州鄉'; kind='plain' }
  @{ code='10013260'; name='屏東縣三地門鄉'; kind='mountain' }
  @{ code='10013270'; name='屏東縣霧臺鄉'; kind='mountain' }
  @{ code='10013280'; name='屏東縣瑪家鄉'; kind='mountain' }
  @{ code='10013290'; name='屏東縣泰武鄉'; kind='mountain' }
  @{ code='10013300'; name='屏東縣來義鄉'; kind='mountain' }
  @{ code='10013310'; name='屏東縣春日鄉'; kind='mountain' }
  @{ code='10013320'; name='屏東縣獅子鄉'; kind='mountain' }
  @{ code='10013330'; name='屏東縣牡丹鄉'; kind='mountain' }
  @{ code='10014010'; name='臺東縣臺東市'; kind='plain' }
  @{ code='10014020'; name='臺東縣成功鎮'; kind='plain' }
  @{ code='10014030'; name='臺東縣關山鎮'; kind='plain' }
  @{ code='10014040'; name='臺東縣卑南鄉'; kind='plain' }
  @{ code='10014100'; name='臺東縣大武鄉'; kind='plain' }
  @{ code='10014090'; name='臺東縣太麻里鄉'; kind='plain' }
  @{ code='10014070'; name='臺東縣東河鄉'; kind='plain' }
  @{ code='10014080'; name='臺東縣長濱鄉'; kind='plain' }
  @{ code='10014050'; name='臺東縣鹿野鄉'; kind='plain' }
  @{ code='10014060'; name='臺東縣池上鄉'; kind='plain' }
  @{ code='10014130'; name='臺東縣延平鄉'; kind='mountain' }
  @{ code='10014120'; name='臺東縣海端鄉'; kind='mountain' }
  @{ code='10014150'; name='臺東縣達仁鄉'; kind='mountain' }
  @{ code='10014140'; name='臺東縣金峰鄉'; kind='mountain' }
  @{ code='10014160'; name='臺東縣蘭嶼鄉'; kind='mountain' }
  @{ code='10015010'; name='花蓮縣花蓮市'; kind='plain' }
  @{ code='10015020'; name='花蓮縣鳳林鎮'; kind='plain' }
  @{ code='10015030'; name='花蓮縣玉里鎮'; kind='plain' }
  @{ code='10015040'; name='花蓮縣新城鄉'; kind='plain' }
  @{ code='10015050'; name='花蓮縣吉安鄉'; kind='plain' }
  @{ code='10015060'; name='花蓮縣壽豐鄉'; kind='plain' }
  @{ code='10015070'; name='花蓮縣光復鄉'; kind='plain' }
  @{ code='10015080'; name='花蓮縣豐濱鄉'; kind='plain' }
  @{ code='10015090'; name='花蓮縣瑞穗鄉'; kind='plain' }
  @{ code='10015100'; name='花蓮縣富里鄉'; kind='plain' }
  @{ code='10015110'; name='花蓮縣秀林鄉'; kind='mountain' }
  @{ code='10015120'; name='花蓮縣萬榮鄉'; kind='mountain' }
  @{ code='10015130'; name='花蓮縣卓溪鄉'; kind='mountain' }
)
$DistrictKind = @{}
foreach($d in $IndigenousDistricts){ $DistrictKind[$d.code] = $d.kind }

# 取得某個 endpoint 的某一期。優先讀 data/raw/ 的快照；沒有才呼叫 API 並存檔，
# 維持「下載快照入庫」原則（可行性研究 E 節方法 A）——三年後有人質疑某個數字時，
# 可以 git log 追出當時的原始檔。
function Get-OdrpSnapshot {
  param(
    [Parameter(Mandatory)][string]$Endpoint,   # ODRP013 / ODRP018
    [Parameter(Mandatory)][string]$Period,
    [Parameter(Mandatory)][string]$RawName     # data/raw/ 下的檔名（不含期數與副檔名）
  )
  $path = Join-Path $repo "data/raw/$RawName-$Period.json"
  if(Test-Path $path){
    Write-Host "  讀取快照 data/raw/$RawName-$Period.json"
    return (Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json).data
  }

  Write-Host "  快照不存在，改由 API 下載 $Endpoint/$Period"
  $rows = @()
  $page = 1
  while($true){
    $url = "https://www.ris.gov.tw/rs-opendata/api/v1/datastore/$Endpoint/$Period" + "?page=$page"
    $r = Invoke-RestMethod -Uri $url -TimeoutSec 60
    if($r.responseCode -ne 'OD-0101-S'){
      if($page -eq 1){ throw "$Endpoint/$Period 取得失敗：$($r.responseMessage)。注意路徑參數須為民國年+月（如 11506）。" }
      break
    }
    $rows += $r.responseData
    if($page -ge [int]$r.totalPage){ break }
    $page++
  }
  $doc = [ordered]@{
    _source = "https://www.ris.gov.tw/rs-opendata/api/v1/datastore/$Endpoint/$Period"
    _agency = '內政部戶政司'
    _statistic_yyymm = $Period
    _downloadedAt = (Get-Date -Format 'yyyy-MM-dd')
    data = $rows
  }
  $doc | ConvertTo-Json -Depth 10 | Set-Content -Path $path -Encoding UTF8
  Write-Host "  已存入 data/raw/$RawName-$Period.json（$($rows.Count) 列）"
  return $rows
}

function ConvertTo-Int { param($v) if($null -eq $v -or "$v" -eq ''){ 0 } else { [int64]$v } }

Write-Host "建置人口資料（期數 $Period）"

$p013 = Get-OdrpSnapshot -Endpoint 'ODRP013' -Period $Period -RawName 'moi-odrp013-population-by-indigenous-status'
$p018 = Get-OdrpSnapshot -Endpoint 'ODRP018' -Period $Period -RawName 'moi-odrp018-population-by-tribe'

# --- 聚合 ---
# 縣市與鄉鎮共用同一段邏輯，差別只在 district_code 取前幾碼（5 或 8）。
# 鄉鎮層級的 name 直接用 site_id（已是「新北市板橋區」形式），縣市層級則截出前綴。

function Group-Population {
  param([Parameter(Mandatory)]$Rows, [Parameter(Mandatory)][int]$KeyLen)
  $acc = [ordered]@{}
  foreach($r in $Rows){
    $k = $r.district_code.Substring(0,$KeyLen)
    if(-not $acc.Contains($k)){
      $acc[$k] = [ordered]@{
        district_code = $k
        name = if($KeyLen -eq 5){ ($r.site_id -replace '^(..[縣市])(.*)$','$1') } else { $r.site_id }
        population_total = 0; population_m = 0; population_f = 0
        non_indigenous = 0
        indigenous_mountain = 0; indigenous_plain = 0; indigenous_pingpu = 0
      }
    }
    $c = $acc[$k]
    $c.population_total += (ConvertTo-Int $r.people_total)
    $c.population_m     += (ConvertTo-Int $r.people_total_m)
    $c.population_f     += (ConvertTo-Int $r.people_total_f)
    $c.non_indigenous   += (ConvertTo-Int $r.nindigenous_total_m) + (ConvertTo-Int $r.nindigenous_total_f)
    $c.indigenous_mountain += (ConvertTo-Int $r.indigenous_mountain_total_m) + (ConvertTo-Int $r.indigenous_mountain_total_f)
    $c.indigenous_plain    += (ConvertTo-Int $r.indigenous_plain_total_m)    + (ConvertTo-Int $r.indigenous_plain_total_f)
    $c.indigenous_pingpu   += (ConvertTo-Int $r.indigenous_pingpu_total_m)   + (ConvertTo-Int $r.indigenous_pingpu_total_f)
  }
  foreach($c in $acc.Values){
    $c.indigenous_total = $c.indigenous_mountain + $c.indigenous_plain + $c.indigenous_pingpu
    $c.indigenous_ratio_pct = [math]::Round($c.indigenous_total * 100 / $c.population_total, 4)
  }
  # 鄉鎮層級才標原住民族地區。縣市不標——「原住民族地區」是鄉鎮層級的法定指定，
  # 沒有「原住民族縣市」這種東西，在縣市層級加這個欄位會是無中生有的分類。
  if($KeyLen -eq 8){
    foreach($c in $acc.Values){
      $c.is_indigenous_district = $DistrictKind.ContainsKey($c.district_code)
      $c.district_kind = if($DistrictKind.ContainsKey($c.district_code)){ $DistrictKind[$c.district_code] } else { $null }
    }
  }
  return $acc
}

function Group-Tribes {
  param([Parameter(Mandatory)]$Rows, [Parameter(Mandatory)][int]$KeyLen)
  $acc = [ordered]@{}
  foreach($r in $Rows){
    $k = $r.district_code.Substring(0,$KeyLen)
    if(-not $acc.Contains($k)){
      $t = [ordered]@{
        district_code = $k
        name = if($KeyLen -eq 5){ ($r.site_id -replace '^(..[縣市])(.*)$','$1') } else { $r.site_id }
        indigenous_total = 0
      }
      foreach($s in $TribeStems){ $t[$s] = 0 }
      $acc[$k] = $t
    }
    $t = $acc[$k]
    $t.indigenous_total += (ConvertTo-Int $r.indigenous_total)
    foreach($s in $TribeStems){
      $t[$s] += (ConvertTo-Int $r."indigenous_${s}_m") + (ConvertTo-Int $r."indigenous_${s}_f")
    }
  }
  return $acc
}

$byCounty      = Group-Population -Rows $p013 -KeyLen 5
$byTownship    = Group-Population -Rows $p013 -KeyLen 8
$tribeByCounty = Group-Tribes     -Rows $p018 -KeyLen 5
$tribeByTown   = Group-Tribes     -Rows $p018 -KeyLen 8

# --- 自我驗證（全部在寫檔之前）---
# 官方格式文件不可信（中選會的教訓），且來源結構會無預警變更，故每次建置都重驗。

function Test-PopulationIdentities {
  param($Acc, [string]$Level)
  $e = @()
  foreach($c in $Acc.Values){
    if($c.population_m + $c.population_f -ne $c.population_total){
      $e += "[$Level] $($c.name)：男 $($c.population_m) + 女 $($c.population_f) != 合計 $($c.population_total)"
    }
    if($c.indigenous_total + $c.non_indigenous -ne $c.population_total){
      $e += "[$Level] $($c.name)：原住民 $($c.indigenous_total) + 非原住民 $($c.non_indigenous) != 總計 $($c.population_total)"
    }
  }
  return $e
}

function Test-TribeIdentities {
  param($TribeAcc, $PopAcc, [string]$Level)
  $e = @()
  foreach($k in $TribeAcc.Keys){
    $t = $TribeAcc[$k]
    $sum = 0; foreach($s in $TribeStems){ $sum += $t[$s] }
    if($sum -ne $t.indigenous_total){
      $e += "[$Level] $($t.name)：族別加總 $sum != 原住民合計 $($t.indigenous_total)（疑似 pingpu_* 重複計算，見開頭陷阱 2）"
    }
    if($t.indigenous_total -ne $PopAcc[$k].indigenous_total){
      $e += "[$Level] $($t.name)：ODRP018 原住民 $($t.indigenous_total) != ODRP013 原住民 $($PopAcc[$k].indigenous_total)"
    }
  }
  return $e
}

$errs = @()
$errs += Test-PopulationIdentities -Acc $byCounty   -Level '縣市'
$errs += Test-PopulationIdentities -Acc $byTownship -Level '鄉鎮'
$errs += Test-TribeIdentities -TribeAcc $tribeByCounty -PopAcc $byCounty   -Level '縣市'
$errs += Test-TribeIdentities -TribeAcc $tribeByTown   -PopAcc $byTownship -Level '鄉鎮'

# 鄉鎮加總必須等於縣市——若兩個層級對不上，代表 district_code 的切分規則有誤。
$rollup = @{}
foreach($t in $byTownship.Values){
  $ck = $t.district_code.Substring(0,5)
  if(-not $rollup.ContainsKey($ck)){ $rollup[$ck] = @{ pop = 0; ind = 0 } }
  $rollup[$ck].pop += $t.population_total
  $rollup[$ck].ind += $t.indigenous_total
}
foreach($k in $byCounty.Keys){
  if($rollup[$k].pop -ne $byCounty[$k].population_total){
    $errs += "[彙總] $($byCounty[$k].name)：鄉鎮加總 $($rollup[$k].pop) != 縣市 $($byCounty[$k].population_total)"
  }
  if($rollup[$k].ind -ne $byCounty[$k].indigenous_total){
    $errs += "[彙總] $($byCounty[$k].name)：鄉鎮原住民加總 $($rollup[$k].ind) != 縣市 $($byCounty[$k].indigenous_total)"
  }
}

# 55 個原住民族地區必須全部在鄉鎮資料中找到，否則常數清單與來源資料已脫節。
$unmatched = @($IndigenousDistricts | Where-Object { -not $byTownship.Contains($_.code) })
if($unmatched.Count -gt 0){
  $errs += "[原住民族地區] $($unmatched.Count) 個代碼在鄉鎮資料中不存在：$(($unmatched | ForEach-Object { $_.name }) -join '、')"
}

if($errs.Count -gt 0){
  Write-Host ''
  Write-Host "自我驗證失敗（$($errs.Count) 項），未產生任何輸出檔：" -ForegroundColor Red
  $errs | Select-Object -First 20 | ForEach-Object { Write-Host "  $_" }
  throw '自我驗證失敗，中止。'
}

# 注意：.Values 是 OrderedDictionary 的值集合不是 PSObject，Measure-Object 取不到屬性，
# 會安靜地回傳空值。手動加總。
$natTotal = 0; $natInd = 0
foreach($c in $byCounty.Values){ $natTotal += $c.population_total; $natInd += $c.indigenous_total }
$markedCount = @($byTownship.Values | Where-Object { $_.is_indigenous_district }).Count
Write-Host "  驗證通過：全國 $('{0:N0}' -f $natTotal) 人，原住民 $('{0:N0}' -f $natInd) 人"
Write-Host "            $($byCounty.Count) 縣市、$($byTownship.Count) 鄉鎮，其中 $markedCount 個為原住民族地區"

# --- 變動幅度檢查（仍在寫檔之前）---
# 上面的加總驗證只能抓「內部不一致」，抓不到「內部一致但整份資料換了口徑」——
# 例如上游改了統計對象或欄位語意，各項仍自洽但總量整個位移。這種資料會安靜地
# 通過所有恆等式檢查然後被自動提交上線，故另設一道對照前一期的幅度檢查。
#
# 門檻 ±1%：實測近半年增幅 1.30%（約每月 0.22%），單月 ±1% 有足夠餘裕，
# 又能擋下數量級錯誤。合法的大幅變動可由刷新流程的「手動指定期別」在人工確認後放行。
#
# 前一期數值取自版本庫既有的 processed 檔。首次建置時該檔不存在——此時沒有可比對的
# 基準，略過檢查而非中止；把「沒有前一期」當成異常會讓乾淨的版本庫無法完成第一次建置。
$prevPath = Join-Path $repo 'data/processed/population-by-county.json'
if(Test-Path $prevPath){
  $prev = Get-Content $prevPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $prevInd = 0; foreach($c in $prev.data){ $prevInd += $c.indigenous_total }
  if($prevInd -le 0){
    Write-Host "  幅度檢查略過：前一期檔案的原住民合計為 $prevInd，無法作為基準"
    Write-Host 'REFRESH_AMPLITUDE=skipped'
  } else {
    $deltaPct = ($natInd - $prevInd) * 100 / $prevInd
    $shown = [math]::Round($deltaPct, 4)
    if([math]::Abs($deltaPct) -gt 1){
      if($AcceptLargeChange){
        # 放行不是靜默通過：變動幅度照常算出並回報，理由一併輸出供刷新流程
        # 寫進 commit 訊息（見 design 決策九）。放行只鬆綁這一道門檻，
        # 上面的加總自我驗證已經跑過，且不受此影響。
        Write-Host "  幅度檢查【已具名放行】：原住民總人口 $prevInd → $natInd（$shown%，超過門檻 ±1%）"
        Write-Host "  放行理由：$OverrideReason"
      } else {
        [Console]::Error.WriteLine(
          "幅度檢查失敗：全國原住民總人口由 $prevInd（$($prev._sourceId)）變為 $natInd（moi-odrp013-$Period），" +
          "變動 $shown%，超過 ±1%。未產生任何輸出檔。")
        [Console]::Error.WriteLine(
          '若已人工確認此變動為真實，請以 -AcceptLargeChange 搭配 -OverrideReason "<理由>" 重跑；兩者必須並用，門檻本身不可調整。')
        throw "變動幅度檢查失敗（$shown%），中止。"
      }
    } else {
      Write-Host "  幅度檢查通過：原住民總人口 $prevInd → $natInd（$shown%，門檻 ±1%）"
    }

    # 給機器讀的一行。上面那些中文訊息是寫給讀流程紀錄的人看的，措辭隨時可能為了
    # 可讀性而改寫；刷新流程若去比對那些字，措辭一改耦合就斷，而斷掉的那天
    # 正好是第一次真的需要放行的那天。故另出一行與語言無關的固定格式標記。
    #
    # 只在幅度檢查【實際執行】時輸出。無可比基準而略過時不輸出——
    # 此時並不存在「觀察到的變動」，印 0 會與「變動確實為 0%」混淆。
    Write-Host "REFRESH_AMPLITUDE=computed DELTA_PCT=$shown RELEASED=$(if($AcceptLargeChange -and [math]::Abs($deltaPct) -gt 1){'true'}else{'false'})"
  }
} else {
  Write-Host '  幅度檢查略過：找不到 data/processed/population-by-county.json（首次建置）'
  Write-Host 'REFRESH_AMPLITUDE=skipped'
}

# --- 寫出 ---
$popNature = @{
  district_code = 'official-statistic'; name = 'official-statistic'
  population_total = 'official-statistic'; population_m = 'official-statistic'; population_f = 'official-statistic'
  non_indigenous = 'official-statistic'
  indigenous_mountain = 'official-statistic'; indigenous_plain = 'official-statistic'; indigenous_pingpu = 'official-statistic'
  # 雖由三欄相加而得，但原民會月報有直接發布 637,620 且已交叉驗證相符，
  # 故為官方統計而非本專案計算值。判準見 data/sources.json 的 natureRule。
  indigenous_total = 'official-statistic'
  # 占比在任何官方文件中都不存在，是本專案計算值。
  indigenous_ratio_pct = 'derived-by-this-project'
}
$townNature = $popNature.Clone()
# 原住民族地區是行政院公告指定的法定身分，非本專案判斷。
$townNature['is_indigenous_district'] = 'official-statistic'
$townNature['district_kind'] = 'official-statistic'

Write-ProvenancedJson -SourceId "moi-odrp013-$Period" -OutPath 'data/processed/population-by-county.json' `
  -GeneratedBy 'scripts/build-population.ps1' -Data ($byCounty.Values | Sort-Object district_code) -FieldNature $popNature

Write-ProvenancedJson -SourceId "moi-odrp013-$Period" -OutPath 'data/processed/population-by-township.json' `
  -GeneratedBy 'scripts/build-population.ps1' -Data ($byTownship.Values | Sort-Object district_code) -FieldNature $townNature

$tribeNature = @{ district_code = 'official-statistic'; name = 'official-statistic'; indigenous_total = 'official-statistic' }
foreach($s in $TribeStems){ $tribeNature[$s] = 'official-statistic' }

Write-ProvenancedJson -SourceId "moi-odrp018-$Period" -OutPath 'data/processed/tribes-by-county.json' `
  -GeneratedBy 'scripts/build-population.ps1' -Data ($tribeByCounty.Values | Sort-Object district_code) -FieldNature $tribeNature

Write-ProvenancedJson -SourceId "moi-odrp018-$Period" -OutPath 'data/processed/tribes-by-township.json' `
  -GeneratedBy 'scripts/build-population.ps1' -Data ($tribeByTown.Values | Sort-Object district_code) -FieldNature $tribeNature
