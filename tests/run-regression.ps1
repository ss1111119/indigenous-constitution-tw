# 轉檔腳本的回歸測試
#
# 用法：pwsh ./tests/run-regression.ps1 [-KeepSandbox]
# 成功時狀態碼 0；任一斷言失敗為非零，並在輸出指出失敗的斷言名稱。
#
# 為何在沙箱執行：build-population.ps1 的輸出路徑是寫死的 data/processed/*.json，
# 直接在版本庫內跑測試會蓋掉真實資料。故每個案例都複製一份最小的專案結構到暫存目錄
# （腳本 + lib + data/sources.json + 該案例的 raw 樣本），在那裡執行、在那裡斷言。
# 腳本以 $PSScriptRoot/.. 決定專案根目錄，複製後自然指向沙箱。
#
# 為何樣本是人工構造而非錄製完整回應：ODRP018 單期約 40MB，不宜入庫。
# 樣本保留真實欄位名稱與型別（數字為字串，如 ODRP 實際回傳），並涵蓋自我驗證
# 要求的 55 個原住民族地區，否則「原住民族地區代碼全數存在」那道檢查會誤報。
#
# 這層測試守的是【我方解析邏輯不退化】，不是【上游沒變】。上游變動由腳本內建的
# 自我驗證在執行期擋下，見 design 決策五。

param(
  [switch]$KeepSandbox
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$repo = (Resolve-Path "$PSScriptRoot/..").Path
$fixtures = Join-Path $PSScriptRoot 'fixtures'
$Period = '11506'   # 對應 data/sources.json 既有的 moi-odrp013-11506 / moi-odrp018-11506

$script:Failures = @()
$script:Passed = 0

function Assert-That {
  param(
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][bool]$Condition,
    [string]$Detail = ''
  )
  if($Condition){
    $script:Passed++
    Write-Host "  ✓ $Name" -ForegroundColor Green
  } else {
    $script:Failures += $Name
    Write-Host "  ✗ $Name" -ForegroundColor Red
    if($Detail){ Write-Host "      $Detail" }
  }
}

# 建沙箱、跑轉檔、回報結果。呼叫端負責斷言。
function Invoke-ConversionInSandbox {
  param([Parameter(Mandatory)][string]$Case)

  $caseDir = Join-Path $fixtures $Case
  if(-not (Test-Path $caseDir)){ throw "找不到樣本目錄 $caseDir" }

  $sandbox = Join-Path ([System.IO.Path]::GetTempPath()) "regression-$Case-$([guid]::NewGuid().ToString('N').Substring(0,8))"
  New-Item -ItemType Directory -Force -Path (Join-Path $sandbox 'scripts/lib') | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $sandbox 'data/raw')   | Out-Null

  Copy-Item (Join-Path $repo 'scripts/build-population.ps1') (Join-Path $sandbox 'scripts')
  Copy-Item (Join-Path $repo 'scripts/lib/provenance.ps1')   (Join-Path $sandbox 'scripts/lib')
  Copy-Item (Join-Path $repo 'data/sources.json')            (Join-Path $sandbox 'data')
  Copy-Item (Join-Path $caseDir '*.json')                    (Join-Path $sandbox 'data/raw')

  $outLog = Join-Path $sandbox 'stdout.log'
  $errLog = Join-Path $sandbox 'stderr.log'
  $proc = Start-Process -FilePath 'pwsh' -NoNewWindow -Wait -PassThru `
    -ArgumentList '-NoProfile', '-File', (Join-Path $sandbox 'scripts/build-population.ps1'), '-Period', $Period `
    -RedirectStandardOutput $outLog -RedirectStandardError $errLog

  $processed = Join-Path $sandbox 'data/processed'
  return @{
    Case     = $Case
    Sandbox  = $sandbox
    ExitCode = $proc.ExitCode
    Stdout   = (Test-Path $outLog) ? (Get-Content $outLog -Raw -Encoding UTF8) : ''
    Stderr   = (Test-Path $errLog) ? (Get-Content $errLog -Raw -Encoding UTF8) : ''
    Outputs  = (Test-Path $processed) ? @(Get-ChildItem $processed -Filter *.json | ForEach-Object { $_.Name }) : @()
  }
}

function Remove-Sandbox {
  param($Result)
  if($KeepSandbox){
    Write-Host "    （保留沙箱：$($Result.Sandbox)）"
  } else {
    Remove-Item $Result.Sandbox -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# --- 樣本本身的約束 ---
Write-Host ''
Write-Host '樣本檔案'
$oversized = @(Get-ChildItem $fixtures -Recurse -Filter *.json | Where-Object { $_.Length -gt 1MB })
Assert-That -Name '樣本無單檔超過 1MB（完整回應不入庫）' -Condition ($oversized.Count -eq 0) `
  -Detail (($oversized | ForEach-Object { "$($_.Name) $([math]::Round($_.Length/1MB,2))MB" }) -join '、')

# --- 成功路徑 ---
Write-Host ''
Write-Host 'success 樣本（內部自洽，自我驗證應全數通過）'
$r = Invoke-ConversionInSandbox -Case 'success'

Assert-That -Name 'success：轉檔以狀態碼 0 結束' -Condition ($r.ExitCode -eq 0) `
  -Detail "實際狀態碼 $($r.ExitCode)。stderr: $($r.Stderr)"

$expected = @('population-by-county.json', 'population-by-township.json',
              'tribes-by-county.json', 'tribes-by-township.json')
$missing = @($expected | Where-Object { $r.Outputs -notcontains $_ })
Assert-That -Name 'success：四份 processed JSON 全數產出' -Condition ($missing.Count -eq 0) `
  -Detail "缺少：$($missing -join '、')"

if($r.ExitCode -eq 0 -and $missing.Count -eq 0){
  $county = Get-Content (Join-Path $r.Sandbox 'data/processed/population-by-county.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  $tribes = Get-Content (Join-Path $r.Sandbox 'data/processed/tribes-by-county.json')     -Raw -Encoding UTF8 | ConvertFrom-Json

  # 樣本的構造值：55 個鄉鎮，第 i 個（0 起算）原住民 315+4i，加總 23,265。
  $natInd = 0; foreach($c in $county.data){ $natInd += $c.indigenous_total }
  Assert-That -Name 'success：全國原住民合計等於樣本構造值 23,265' -Condition ($natInd -eq 23265) `
    -Detail "實際 $natInd"

  $natPop = 0; foreach($c in $county.data){ $natPop += $c.population_total }
  Assert-That -Name 'success：全國總人口等於樣本構造值 168,465' -Condition ($natPop -eq 168465) `
    -Detail "實際 $natPop"

  Assert-That -Name 'success：縣市檔帶 _sourceId moi-odrp013-11506' `
    -Condition ($county._sourceId -eq "moi-odrp013-$Period") -Detail "實際 $($county._sourceId)"
  Assert-That -Name 'success：族別檔帶 _sourceId moi-odrp018-11506' `
    -Condition ($tribes._sourceId -eq "moi-odrp018-$Period") -Detail "實際 $($tribes._sourceId)"

  # 占比是本專案計算值，不得被標成官方統計——data-provenance 的核心區分。
  Assert-That -Name 'success：indigenous_ratio_pct 標為 derived-by-this-project' `
    -Condition ($county._fieldNature.indigenous_ratio_pct -eq 'derived-by-this-project') `
    -Detail "實際 $($county._fieldNature.indigenous_ratio_pct)"

  # 平埔欄位存在且為零，是「已存在但尚無登記」的狀態，不是欄位不存在。
  $pingpuPresent = $county.data[0].PSObject.Properties.Name -contains 'indigenous_pingpu'
  Assert-That -Name 'success：indigenous_pingpu 欄位存在' -Condition $pingpuPresent

  # 族別加總必須等於原住民合計（腳本內建檢查的正向確認）。
  $stems = $tribes._fieldNature.PSObject.Properties.Name | Where-Object {
    $_ -notin @('district_code', 'name', 'indigenous_total')
  }
  $row = $tribes.data[0]
  $stemSum = 0; foreach($s in $stems){ $stemSum += $row.$s }
  Assert-That -Name 'success：首列族別加總等於 indigenous_total' `
    -Condition ($stemSum -eq $row.indigenous_total) -Detail "加總 $stemSum vs 合計 $($row.indigenous_total)"

  # 55 個原住民族地區必須在鄉鎮層級被標記。
  $town = Get-Content (Join-Path $r.Sandbox 'data/processed/population-by-township.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  $marked = @($town.data | Where-Object { $_.is_indigenous_district }).Count
  Assert-That -Name 'success：55 個原住民族地區全數標記' -Condition ($marked -eq 55) -Detail "實際 $marked"
}
Remove-Sandbox $r

# --- 失敗路徑 ---
# 只測成功路徑等於沒測到安全網本身：自我驗證的價值全在它擋下了什麼。
# 兩個樣本都刻意違反腳本內建的檢查，斷言【中止】與【不留下任何產出檔案】兩者皆成立。
$failureCases = @(
  @{ Case = 'tribe-sum-mismatch';  Desc = '族別加總不等於 indigenous_total' }
  @{ Case = 'pingpu-double-count'; Desc = '平埔兩組平行結構混加後超過總數' }
)

foreach($fc in $failureCases){
  Write-Host ''
  Write-Host "$($fc.Case) 樣本（$($fc.Desc)）"
  $f = Invoke-ConversionInSandbox -Case $fc.Case

  Assert-That -Name "$($fc.Case)：轉檔以非零狀態碼中止" -Condition ($f.ExitCode -ne 0) `
    -Detail "實際狀態碼 $($f.ExitCode)——自我驗證未擋下此樣本"

  Assert-That -Name "$($fc.Case)：未留下任何產出檔案" -Condition ($f.Outputs.Count -eq 0) `
    -Detail "實際產出：$($f.Outputs -join '、')"

  # 半寫入的 processed JSON 比沒有檔案更危險，因為它看起來是有效的。
  # 故訊息須指出是自我驗證擋下的，而不是任何一種非零結束都算通過。
  $combined = "$($f.Stdout)`n$($f.Stderr)"
  Assert-That -Name "$($fc.Case)：訊息指出自我驗證失敗" `
    -Condition ($combined -match '自我驗證失敗') `
    -Detail "實際輸出：$($combined.Trim())"

  Remove-Sandbox $f
}

# --- 總結 ---
Write-Host ''
if($script:Failures.Count -gt 0){
  Write-Host "回歸測試失敗：$($script:Failures.Count) 項斷言未通過" -ForegroundColor Red
  $script:Failures | ForEach-Object { Write-Host "  - $_" }
  exit 1
}
Write-Host "回歸測試通過：$($script:Passed) 項斷言" -ForegroundColor Green
exit 0
