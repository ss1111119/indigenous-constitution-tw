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
  param(
    [Parameter(Mandatory)][string]$Case,
    # 附加給 build-population.ps1 的參數（放行路徑用）。預設為空，既有案例行為不變。
    [string[]]$ExtraArgs = @()
  )

  $caseDir = Join-Path $fixtures $Case
  if(-not (Test-Path $caseDir)){ throw "找不到樣本目錄 $caseDir" }

  $sandbox = Join-Path ([System.IO.Path]::GetTempPath()) "regression-$Case-$([guid]::NewGuid().ToString('N').Substring(0,8))"
  New-Item -ItemType Directory -Force -Path (Join-Path $sandbox 'scripts/lib') | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $sandbox 'data/raw')   | Out-Null

  Copy-Item (Join-Path $repo 'scripts/build-population.ps1') (Join-Path $sandbox 'scripts')
  Copy-Item (Join-Path $repo 'scripts/lib/provenance.ps1')   (Join-Path $sandbox 'scripts/lib')
  Copy-Item (Join-Path $repo 'data/sources.json')            (Join-Path $sandbox 'data')
  Copy-Item (Join-Path $caseDir '*.json')                    (Join-Path $sandbox 'data/raw')

  # 幅度檢查以版本庫既有的 processed 檔為前一期基準。案例若附 previous/，
  # 就先鋪進沙箱，讓檢查有比較對象；沒附的案例會走「首次建置，略過檢查」那條路。
  $prevDir = Join-Path $caseDir 'previous'
  if(Test-Path $prevDir){
    New-Item -ItemType Directory -Force -Path (Join-Path $sandbox 'data/processed') | Out-Null
    Copy-Item (Join-Path $prevDir '*.json') (Join-Path $sandbox 'data/processed')
  }

  $outLog = Join-Path $sandbox 'stdout.log'
  $errLog = Join-Path $sandbox 'stderr.log'
  $argList = @('-NoProfile', '-File', (Join-Path $sandbox 'scripts/build-population.ps1'), '-Period', $Period) + $ExtraArgs
  $proc = Start-Process -FilePath 'pwsh' -NoNewWindow -Wait -PassThru `
    -ArgumentList $argList `
    -RedirectStandardOutput $outLog -RedirectStandardError $errLog

  $processed = Join-Path $sandbox 'data/processed'
  return @{
    Case     = $Case
    Sandbox  = $sandbox
    Seeded   = (Test-Path $prevDir) ? @(Get-ChildItem $prevDir -Filter *.json | ForEach-Object { $_.Name }) : @()
    ExitCode = $proc.ExitCode
    # 空檔時 Get-Content -Raw 回 $null，會讓呼叫端的 .Trim() 炸掉——一律正規化為空字串。
    Stdout   = (Test-Path $outLog) ? ((Get-Content $outLog -Raw -Encoding UTF8) ?? '') : ''
    Stderr   = (Test-Path $errLog) ? ((Get-Content $errLog -Raw -Encoding UTF8) ?? '') : ''
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

# success 案例附了前一期基準（23,200 → 23,265，+0.28%），所以幅度檢查必須是
# 【跑過並通過】。若沒有這項斷言，檢查被整段略過也會是綠燈。
Assert-That -Name 'success：幅度檢查實際執行且通過' -Condition ($r.Stdout -match '幅度檢查通過') `
  -Detail "stdout: $($r.Stdout.Trim())"

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

# --- 成功路徑：平埔族群已有登記 ---
# 全零的 success 樣本證明不了平埔處理是對的：平埔全為 0 時，無論轉檔讀的是主清單
# 還是平行的交叉表，所有恆等式都會成立。本樣本把 846 人從平地移到平埔（013）並
# 同額從阿美族移到西拉雅族（018），兩來源各自維持自洽、原住民合計不變；
# 交叉表則刻意填成合計 1,176，誤讀者會得到 1,176 而不是 846。
Write-Host ''
Write-Host 'pingpu-registered 樣本（平埔非零，兩來源自洽，應成功轉換）'
$p = Invoke-ConversionInSandbox -Case 'pingpu-registered'

Assert-That -Name 'pingpu-registered：轉檔以狀態碼 0 結束' -Condition ($p.ExitCode -eq 0) `
  -Detail "實際狀態碼 $($p.ExitCode)。stderr: $($p.Stderr)"

$pMissing = @($expected | Where-Object { $p.Outputs -notcontains $_ })
Assert-That -Name 'pingpu-registered：四份 processed JSON 全數產出' -Condition ($pMissing.Count -eq 0) `
  -Detail "缺少：$($pMissing -join '、')"

if($p.ExitCode -eq 0 -and $pMissing.Count -eq 0){
  $pCounty = Get-Content (Join-Path $p.Sandbox 'data/processed/population-by-county.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  $pTribes = Get-Content (Join-Path $p.Sandbox 'data/processed/tribes-by-county.json')     -Raw -Encoding UTF8 | ConvertFrom-Json

  # ODRP013 側：身分別的平埔合計。
  $pinPop = 0; foreach($c in $pCounty.data){ $pinPop += $c.indigenous_pingpu }
  Assert-That -Name 'pingpu-registered：人口檔平埔合計等於樣本構造值 846' -Condition ($pinPop -eq 846) `
    -Detail "實際 $pinPop（若為 1176 表示讀到了平埔交叉表欄位）"

  # ODRP018 側：主清單十個平埔族欄位。兩側取自不同 endpoint，須各自對得上。
  $pingpuKeys = @('siraya','ketagalan','taokas','pazeh','papora','babuza','hoanya','kaxabu','taivoan','makatau')
  $pinTribe = 0
  foreach($t in $pTribes.data){ foreach($k in $pingpuKeys){ $pinTribe += $t.$k } }
  Assert-That -Name 'pingpu-registered：族別檔十個平埔欄位合計等於 846' -Condition ($pinTribe -eq 846) `
    -Detail "實際 $pinTribe（若為 1176 表示讀到了平埔交叉表欄位）"

  Assert-That -Name 'pingpu-registered：兩來源的平埔合計一致' -Condition ($pinPop -eq $pinTribe) `
    -Detail "人口檔 $pinPop、族別檔 $pinTribe"

  # 平埔非零時，族別加總等於原住民合計這條恆等式才真正被考驗到。
  $pNatInd = 0; foreach($c in $pCounty.data){ $pNatInd += $c.indigenous_total }
  Assert-That -Name 'pingpu-registered：原住民合計仍為 23,265' -Condition ($pNatInd -eq 23265) `
    -Detail "實際 $pNatInd"

  $firstRow = $pTribes.data[0]
  $rowSum = 0
  foreach($k in $pingpuKeys){ $rowSum += $firstRow.$k }
  foreach($k in @('amis','atayal','paiwan','bunun','rukai','pinuyumayan','cou','saisiyat','yami',
                  'thao','kavalan','truku','sakizaya','sediq','hlaalua','kanakanavu','undeclared')){
    $rowSum += $firstRow.$k
  }
  Assert-That -Name 'pingpu-registered：首列族別加總等於 indigenous_total' `
    -Condition ($rowSum -eq $firstRow.indigenous_total) `
    -Detail "加總 $rowSum、indigenous_total $($firstRow.indigenous_total)"

  # 山地＋平地＋平埔＝原住民合計。平埔為 0 時這條同樣不具鑑別力。
  $tri = 0
  foreach($c in $pCounty.data){ $tri += $c.indigenous_mountain + $c.indigenous_plain + $c.indigenous_pingpu }
  Assert-That -Name 'pingpu-registered：山地＋平地＋平埔等於原住民合計' -Condition ($tri -eq $pNatInd) `
    -Detail "三者相加 $tri、原住民合計 $pNatInd"
}
Remove-Sandbox $p

# --- 失敗路徑 ---
# 只測成功路徑等於沒測到安全網本身：自我驗證的價值全在它擋下了什麼。
# 兩個樣本都刻意違反腳本內建的檢查，斷言【中止】與【不留下任何產出檔案】兩者皆成立。
$failureCases = @(
  @{ Case = 'tribe-sum-mismatch';  Desc = '族別加總不等於 indigenous_total'; Pattern = '自我驗證失敗' }
  @{ Case = 'pingpu-double-count'; Desc = '平埔兩組平行結構混加後超過總數'; Pattern = '自我驗證失敗' }
  # 內部完全自洽、所有恆等式都通過，只有相對前一期的總量跳了 +1.16%。
  # 這是加總驗證抓不到而幅度檢查該擋下的那一類。
  @{ Case = 'amplitude-jump';      Desc = '總量相對前一期跳增 +1.16%';      Pattern = '幅度檢查失敗' }
)

foreach($fc in $failureCases){
  Write-Host ''
  Write-Host "$($fc.Case) 樣本（$($fc.Desc)）"
  $f = Invoke-ConversionInSandbox -Case $fc.Case

  Assert-That -Name "$($fc.Case)：轉檔以非零狀態碼中止" -Condition ($f.ExitCode -ne 0) `
    -Detail "實際狀態碼 $($f.ExitCode)——自我驗證未擋下此樣本"

  # 「沒有產出」指的是沒有【新】檔案。鋪進沙箱的前一期基準本來就在那裡，
  # 不能算成產出；下面另有一項斷言確認它連內容都沒被動過。
  $produced = @($f.Outputs | Where-Object { $f.Seeded -notcontains $_ })
  Assert-That -Name "$($fc.Case)：未留下任何產出檔案" -Condition ($produced.Count -eq 0) `
    -Detail "實際產出：$($produced -join '、')"

  # 半寫入的 processed JSON 比沒有檔案更危險，因為它看起來是有效的。
  # 故訊息須指出是自我驗證擋下的，而不是任何一種非零結束都算通過。
  $combined = "$($f.Stdout)`n$($f.Stderr)"
  Assert-That -Name "$($fc.Case)：訊息指出「$($fc.Pattern)」" `
    -Condition ($combined -match $fc.Pattern) `
    -Detail "實際輸出：$($combined.Trim())"

  if($fc.Case -eq 'amplitude-jump'){
    # 被擋下時要能一眼看出擋在哪裡：前後兩期的數值與變動百分比都須出現在 stderr，
    # 否則值班的人只知道紅燈、不知道是不是真的異常。
    Assert-That -Name 'amplitude-jump：stderr 指出前一期數值 23265' `
      -Condition ($f.Stderr -match '23265') -Detail "stderr: $($f.Stderr.Trim())"
    Assert-That -Name 'amplitude-jump：stderr 指出新期別數值 23535' `
      -Condition ($f.Stderr -match '23535') -Detail "stderr: $($f.Stderr.Trim())"
    Assert-That -Name 'amplitude-jump：stderr 指出變動百分比 1.16%' `
      -Condition ($f.Stderr -match '1\.16') -Detail "stderr: $($f.Stderr.Trim())"

    # 中止時不得改動既有的 processed 檔——半更新的版本庫比沒更新更難收拾。
    $seedPath = Join-Path $f.Sandbox 'data/processed/population-by-county.json'
    $origPath = Join-Path $fixtures 'amplitude-jump/previous/population-by-county.json'
    $same = (Get-FileHash $seedPath).Hash -eq (Get-FileHash $origPath).Hash
    Assert-That -Name 'amplitude-jump：既有的前一期檔案未被改動' -Condition $same
  }

  Remove-Sandbox $f
}

# --- 幅度檢查的具名放行 ---
# 放行不是「關掉檢查」，是「這一次、由某人、基於某個理由放行」。故兩個參數必須並用：
# 只給其一都必須在轉檔前中止，否則放行就退化成一個容易誤按的開關。
# 全部以 amplitude-jump 樣本（+1.16%，超出 ±1%）為輸入——它在無放行時必定被擋下。
$overrideReason = '西拉雅族首批身分登記，已與原民會月報人工核對'

Write-Host ''
Write-Host 'amplitude-jump 樣本 + 只給 -AcceptLargeChange（缺 reason）'
$o1 = Invoke-ConversionInSandbox -Case 'amplitude-jump' -ExtraArgs @('-AcceptLargeChange')
Assert-That -Name 'override 缺 reason：轉檔以非零狀態碼中止' -Condition ($o1.ExitCode -ne 0) `
  -Detail "實際狀態碼 $($o1.ExitCode)。stderr: $($o1.Stderr.Trim())"
$produced1 = @($o1.Outputs | Where-Object { $o1.Seeded -notcontains $_ })
Assert-That -Name 'override 缺 reason：未留下任何產出檔案' -Condition ($produced1.Count -eq 0) `
  -Detail "實際產出：$($produced1 -join '、')"
Assert-That -Name 'override 缺 reason：訊息指出缺少 OverrideReason' `
  -Condition ("$($o1.Stdout)`n$($o1.Stderr)" -match 'OverrideReason') `
  -Detail "實際輸出：$("$($o1.Stdout)`n$($o1.Stderr)".Trim())"
Remove-Sandbox $o1

Write-Host ''
Write-Host 'amplitude-jump 樣本 + 只給 -OverrideReason（缺旗標）'
$o2 = Invoke-ConversionInSandbox -Case 'amplitude-jump' -ExtraArgs @('-OverrideReason', $overrideReason)
Assert-That -Name 'override 缺旗標：轉檔以非零狀態碼中止' -Condition ($o2.ExitCode -ne 0) `
  -Detail "實際狀態碼 $($o2.ExitCode)。stderr: $($o2.Stderr.Trim())"
$produced2 = @($o2.Outputs | Where-Object { $o2.Seeded -notcontains $_ })
Assert-That -Name 'override 缺旗標：未留下任何產出檔案' -Condition ($produced2.Count -eq 0) `
  -Detail "實際產出：$($produced2 -join '、')"
Assert-That -Name 'override 缺旗標：訊息指出缺少 AcceptLargeChange' `
  -Condition ("$($o2.Stdout)`n$($o2.Stderr)" -match 'AcceptLargeChange') `
  -Detail "實際輸出：$("$($o2.Stdout)`n$($o2.Stderr)".Trim())"
Remove-Sandbox $o2

Write-Host ''
Write-Host 'amplitude-jump 樣本 + 旗標與 reason 並用（應放行）'
$o3 = Invoke-ConversionInSandbox -Case 'amplitude-jump' -ExtraArgs @('-AcceptLargeChange', '-OverrideReason', $overrideReason)
Assert-That -Name 'override 並用：轉檔以狀態碼 0 完成' -Condition ($o3.ExitCode -eq 0) `
  -Detail "實際狀態碼 $($o3.ExitCode)。stderr: $($o3.Stderr.Trim())"
$expectedOverride = @('population-by-county.json', 'population-by-township.json',
                      'tribes-by-county.json', 'tribes-by-township.json')
$missingOverride = @($expectedOverride | Where-Object { $o3.Outputs -notcontains $_ })
Assert-That -Name 'override 並用：四份 processed JSON 全數產出' -Condition ($missingOverride.Count -eq 0) `
  -Detail "缺少：$($missingOverride -join '、')"
# 放行不是靜默通過：變動幅度仍須被算出並回報，否則沒有人知道放行了多大的變動。
Assert-That -Name 'override 並用：輸出仍指出變動百分比 1.16%' `
  -Condition ($o3.Stdout -match '1\.16') -Detail "stdout: $($o3.Stdout.Trim())"
# reason 須出現在輸出中，供 refresh-data.yml 寫進 commit 訊息（任務 6.2）。
Assert-That -Name 'override 並用：輸出含放行理由原文' `
  -Condition ($o3.Stdout -match [regex]::Escape($overrideReason)) `
  -Detail "stdout: $($o3.Stdout.Trim())"
Remove-Sandbox $o3

# 放行只鬆綁幅度檢查這一道門檻，不鬆綁加總自我驗證。少了這項，
# 「放行」與「跳過所有檢查」在測試上無從區分——而後者會讓內部矛盾的資料自動上線。
# 本項在正確實作下一寫即綠；它的價值在退化時轉紅，故驗證方式是負向對照：
# 暫時讓放行也繞過自我驗證，此項必須轉為失敗。
Write-Host ''
Write-Host 'tribe-sum-mismatch 樣本 + 放行參數（自我驗證仍須中止）'
$o4 = Invoke-ConversionInSandbox -Case 'tribe-sum-mismatch' `
  -ExtraArgs @('-AcceptLargeChange', '-OverrideReason', $overrideReason)
Assert-That -Name '放行不鬆綁自我驗證：轉檔仍以非零狀態碼中止' -Condition ($o4.ExitCode -ne 0) `
  -Detail "實際狀態碼 $($o4.ExitCode)。放行不得讓族別加總不符的資料通過。stderr: $($o4.Stderr.Trim())"
$produced4 = @($o4.Outputs | Where-Object { $o4.Seeded -notcontains $_ })
Assert-That -Name '放行不鬆綁自我驗證：未留下任何產出檔案' -Condition ($produced4.Count -eq 0) `
  -Detail "實際產出：$($produced4 -join '、')"
Assert-That -Name '放行不鬆綁自我驗證：中止原因為「自我驗證失敗」而非幅度檢查' `
  -Condition ("$($o4.Stdout)`n$($o4.Stderr)" -match '自我驗證失敗') `
  -Detail "實際輸出：$("$($o4.Stdout)`n$($o4.Stderr)".Trim())"
Remove-Sandbox $o4

# --- 總結 ---
Write-Host ''
if($script:Failures.Count -gt 0){
  Write-Host "回歸測試失敗：$($script:Failures.Count) 項斷言未通過" -ForegroundColor Red
  $script:Failures | ForEach-Object { Write-Host "  - $_" }
  exit 1
}
Write-Host "回歸測試通過：$($script:Passed) 項斷言" -ForegroundColor Green
exit 0
