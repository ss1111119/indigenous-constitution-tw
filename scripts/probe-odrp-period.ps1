# 探測 ODRP 是否已發布比版本庫記載更新的期別。
#
# 用法：pwsh ./scripts/probe-odrp-period.ps1 [-RecordedPeriod 11506]
# 輸出：找到新期別時在 stdout 印出該期別（如 11507）並以狀態碼 0 結束；
#       沒有新期別時印出空字串並以狀態碼 0 結束（這是正常狀況，不是失敗）；
#       網路錯誤或無法歸類的回應則以非零狀態碼結束。
#
# 為何獨立成腳本而不是寫在 workflow 裡：這段邏輯的正確性取決於 ODRP 回應的語意，
# 而那件事只能對著真實 API 驗證。寫成腳本才能在本機跑，不必每次都推上 GitHub 才知道
# 判定對不對。workflow 只負責呼叫它並依輸出決定要不要往下走。
#
# 判定依據是【回應內容】不是 HTTP 狀態碼：ODRP 對尚未發布的期別回傳 HTTP 200，
# 並在 responseMessage 標示查無資料。以狀態碼推測會把「還沒發布」誤判成「發布了」。
#
# 兩個 endpoint 都必須有資料才算已發布。ODRP018 常比 ODRP013 晚：只看 013 就往下走，
# 轉檔會在取 018 時失敗並讓流程紅燈——那是一個每月都可能誤報一次的假警報。

param(
  # 留空時自版本庫的 data/sources.json 取得目前記載的期別。
  [string]$RecordedPeriod = '',
  [string]$SourcesPath = ''
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$repo = (Resolve-Path "$PSScriptRoot/..").Path
if(-not $SourcesPath){ $SourcesPath = Join-Path $repo 'data/sources.json' }

$Endpoints = @('ODRP013', 'ODRP018')

function Get-RecordedPeriod {
  $sources = Get-Content $SourcesPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $periods = @($sources.sources |
    Where-Object { $_.id -match '^moi-odrp013-(\d{5})$' } |
    ForEach-Object { [int]($_.id -replace '^moi-odrp013-', '') })
  if($periods.Count -eq 0){ throw "在 $SourcesPath 找不到任何 moi-odrp013-<期別> 記錄" }
  return ($periods | Sort-Object -Descending)[0].ToString()
}

# 民國年月（yyymm）的推進。不用 DateTime：民國年只是西元年減 1911，
# 而月份進位的規則自己寫比轉來轉去清楚，也不會受時區影響。
function Step-Period {
  param([Parameter(Mandatory)][string]$Period)
  $y = [int]$Period.Substring(0, 3)
  $m = [int]$Period.Substring(3, 2)
  $m++
  if($m -gt 12){ $m = 1; $y++ }
  return '{0:d3}{1:d2}' -f $y, $m
}

# 探測到「當月」為止。ODRP 滯後約兩個月，所以正常情況下當月的期別必然查無資料；
# 把上限訂在當月而非上個月，是為了不必在跨月時多想一次邊界。
function Get-CurrentPeriod {
  $now = Get-Date
  return '{0:d3}{1:d2}' -f ($now.Year - 1911), $now.Month
}

# 回傳 $true（已發布）／$false（尚未發布）。無法歸類時擲出例外讓流程紅燈——
# 靜默失效比誤報危險：排程長期無人看管，紅燈是唯一會被注意到的訊號。
function Test-PeriodPublished {
  param(
    [Parameter(Mandatory)][string]$Endpoint,
    [Parameter(Mandatory)][string]$Period
  )
  $url = "https://www.ris.gov.tw/rs-opendata/api/v1/datastore/$Endpoint/$Period" + '?page=1'
  try {
    $r = Invoke-RestMethod -Uri $url -TimeoutSec 60
  } catch {
    throw "$Endpoint/$Period 查詢失敗（網路或伺服器錯誤）：$($_.Exception.Message)"
  }

  if($r.responseCode -eq 'OD-0101-S'){
    $rows = @($r.responseData).Count
    if($rows -gt 0){ return $true }
    # 成功碼配上零筆資料是無法歸類的回應：既不是明確的查無資料，也沒有東西可轉。
    throw "$Endpoint/$Period 回傳成功碼但沒有任何資料列，無法歸類：$($r.responseMessage)"
  }

  if("$($r.responseMessage)" -match '查無資料'){ return $false }

  throw "$Endpoint/$Period 回應無法歸類：responseCode=$($r.responseCode)，responseMessage=$($r.responseMessage)"
}

if(-not $RecordedPeriod){ $RecordedPeriod = Get-RecordedPeriod }
$current = Get-CurrentPeriod
Write-Host "版本庫記載期別：$RecordedPeriod，探測至 $current" -InformationAction Continue

# 不假設「只會晚一期」——長期無人看管時可能一次落後多期，故逐月往前查到當月，
# 取其中最新一個兩個 endpoint 都有資料的期別。
$latest = ''
$candidate = Step-Period $RecordedPeriod
while([int]$candidate -le [int]$current){
  $published = $true
  foreach($ep in $Endpoints){
    if(-not (Test-PeriodPublished -Endpoint $ep -Period $candidate)){
      Write-Host "  $candidate：$ep 尚未發布" -InformationAction Continue
      $published = $false
      break
    }
  }
  if($published){
    Write-Host "  $candidate：兩個 endpoint 均已發布" -InformationAction Continue
    $latest = $candidate
  }
  $candidate = Step-Period $candidate
}

if($latest){
  Write-Host "探測結果：最新可用期別 $latest" -InformationAction Continue
} else {
  Write-Host '探測結果：沒有比版本庫記載更新的期別' -InformationAction Continue
}

# 最後一行純輸出，供 workflow 取用。
Write-Output $latest
