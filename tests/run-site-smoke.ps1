# 建站 smoke 檢查
#
# 為什麼要獨立一支：tests/run-regression.ps1 是【資料轉檔】的回歸測試——它建沙箱、
# 跑 build-population.ps1、斷言產出檔與自我驗證。它不建站、不開瀏覽器、不碰任何頁面。
# 把「四個面板與變更前相同」掛在它下面等於沒有驗證。
#
# 本檔驗的是站台結構：組建產出、頁面存在、位址語意、連結與後設資料、退場位址的狀態碼。
# 需要瀏覽器才驗得到的（面板實際渲染、圖資請求、主控台錯誤）不在這裡，
# 由人以瀏覽器檢視，見 openspec 的 tasks 5.1。
#
# 用法：pwsh tests/run-site-smoke.ps1
# 成功時狀態碼 0；失敗時非零並指出失敗的斷言。

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$repo = Split-Path $PSScriptRoot -Parent
$site = Join-Path $repo '_site'
$failed = 0

function Assert-That {
  param([Parameter(Mandatory)][string]$Name, [Parameter(Mandatory)][bool]$Condition, [string]$Detail = '')
  if($Condition){
    Write-Host "  ✓ $Name"
  } else {
    Write-Host "  ✗ $Name" -ForegroundColor Red
    if($Detail){ Write-Host "      $Detail" -ForegroundColor Red }
    $script:failed++
  }
}

Write-Host ''
Write-Host '組建'
Push-Location $repo
try {
  $buildOut = & python scripts/build-site.py 2>&1
  $buildCode = $LASTEXITCODE
} finally { Pop-Location }
Assert-That -Name '組建以狀態碼 0 完成' -Condition ($buildCode -eq 0) -Detail ($buildOut -join ' ')

Write-Host ''
Write-Host '頁面存在'
foreach($page in @('index.html', 'dashboard.html', '404.html')){
  Assert-That -Name "$page 進入發佈目錄" -Condition (Test-Path (Join-Path $site $page))
}
Assert-That -Name 'data.html 不再存在（已更名為 index.html）' `
  -Condition (-not (Test-Path (Join-Path $site 'data.html')))

Write-Host ''
Write-Host '位址語意'
$index = Get-Content (Join-Path $site 'index.html') -Raw -Encoding UTF8
$dash  = Get-Content (Join-Path $site 'dashboard.html') -Raw -Encoding UTF8

# 首頁是資料目錄：內容由登記檔產生，故標記中只會有掛載點而非條目。
Assert-That -Name '首頁是資料目錄（含目錄掛載點）' -Condition ($index -match 'data-role="catalogue"')
Assert-That -Name '儀表板頁含四個面板的分頁' -Condition ($dash -match 'tab-population' -and $dash -match 'tab-simulator')

# 期別佔位符只該在儀表板被取代；首頁沒有單一基準日，不該有佔位符。
Assert-That -Name '首頁不含期別佔位符' -Condition ($index -notmatch '\{\{DATA_PERIOD\}\}')
Assert-That -Name '儀表板的期別佔位符已被取代' -Condition ($dash -notmatch '\{\{DATA_PERIOD\}\}')

Write-Host ''
Write-Host '互連與後設資料'
Assert-That -Name '首頁有前往儀表板的連結' -Condition ($index -match 'href="dashboard\.html"')
Assert-That -Name '儀表板有回站台首頁的連結' -Condition ($dash -match 'href="\./"')
Assert-That -Name '首頁 canonical 指向根位址' `
  -Condition ($index -match 'rel="canonical" href="https://ss1111119\.github\.io/indigenous-constitution-tw/"')
Assert-That -Name '儀表板 canonical 指向自己' `
  -Condition ($dash -match 'rel="canonical" href="https://ss1111119\.github\.io/indigenous-constitution-tw/dashboard\.html"')
Assert-That -Name '首頁具備分享圖標籤' -Condition ($index -match 'og:image')
Assert-That -Name '兩頁皆無殘留的 data.html 連結' `
  -Condition (($index -notmatch 'href="data\.html"') -and ($dash -notmatch 'href="data\.html"'))

Write-Host ''
Write-Host '404 頁的連結必須在任何深度都正確'
$nf = Get-Content (Join-Path $site '404.html') -Raw -Encoding UTF8
# 頁面相對連結會相對於不存在的目錄解析；以伺服器根開頭會離開專案。
# 只有含專案前綴的根相對路徑在巢狀位址下仍正確。
# 先剝除註解再抽連結：本檔的註解正好在說明「不能寫成 href="index.html" 或 href="/"」，
# 直接掃全文會被那段說明自己絆倒。
$nfMarkup = [regex]::Replace($nf, '(?s)<!--.*?-->', '')
$hrefs = [regex]::Matches($nfMarkup, 'href="([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
$bad = @($hrefs | Where-Object { $_ -notmatch '^/indigenous-constitution-tw/' })
Assert-That -Name '404 頁的所有連結都含專案前綴' -Condition ($bad.Count -eq 0) `
  -Detail "不合格的連結：$($bad -join '、')"
Assert-That -Name '404 頁連向資料目錄與儀表板' `
  -Condition (($nf -match 'href="/indigenous-constitution-tw/"') -and ($nf -match 'href="/indigenous-constitution-tw/dashboard\.html"'))

Write-Host ''
Write-Host '單一資料路徑定義'
$pages = Get-ChildItem $site -Filter *.html | ForEach-Object { Get-Content $_.FullName -Raw -Encoding UTF8 }
Assert-That -Name '沒有任何頁面含父層相對資料路徑' `
  -Condition (-not ($pages -match '\.\./data'))

Write-Host ''
if($failed -gt 0){
  Write-Host "建站 smoke 檢查失敗：$failed 項" -ForegroundColor Red
  exit 1
}
Write-Host '建站 smoke 檢查通過'
