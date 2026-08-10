# 溯源注入：把 _sourceId / _generatedBy / _generatedAt / _fieldNature 外層寫進 processed JSON
#
# 用法：. "$PSScriptRoot/lib/provenance.ps1"  然後呼叫 Write-ProvenancedJson
# 契約：openspec/changes/interactive-dashboard-mvp/design.md「資料形狀」節
#
# 存在理由：前端要做到「每個數字可點開看性質」，若性質只寫在中文散文裡（如舊版
# legislative-representation.json 的 meta.derived），前端就得去 parse 句子。改為
# 欄位層級對照表後，前端讀 JSON 即可標示，不需 runtime join 也不需字串解析。
#
# 兩道驗證都在寫檔【之前】完成，任一失敗即擲出例外且不產生檔案——半寫入的
# processed JSON 比沒有檔案更危險，因為它看起來是有效的。

$script:RepoRoot = (Resolve-Path "$PSScriptRoot/../..").Path

# 從 data/sources.json 的 schema.nature 取出允許的性質值。
# 該欄位形如 "official-statistic | academic-estimate | ... | compilation（中文說明）"，
# 故先以 | 切開，再取每段開頭的 ASCII 小寫 token（compilation 無連字號，不能用連字號規則）。
function Get-AllowedNatures {
  param([Parameter(Mandatory)][object]$Sources)
  $Sources.schema.nature -split '\|' | ForEach-Object {
    [regex]::Match($_.Trim(), '^[a-z][a-z-]*').Value
  } | Where-Object { $_ }
}

function Write-ProvenancedJson {
  param(
    [Parameter(Mandatory)][string]$SourceId,      # 須存在於 data/sources.json 的 sources[].id
    [Parameter(Mandatory)][hashtable]$FieldNature, # 欄位名 -> nature
    [Parameter(Mandatory)][object]$Data,           # 資料列陣列
    [Parameter(Mandatory)][string]$OutPath,        # 相對於專案根目錄
    [Parameter(Mandatory)][string]$GeneratedBy     # 產生此檔的腳本路徑，供追溯
  )

  $sourcesPath = Join-Path $script:RepoRoot 'data/sources.json'
  if(-not (Test-Path $sourcesPath)){ throw "找不到 $sourcesPath" }
  $sources = Get-Content $sourcesPath -Raw -Encoding UTF8 | ConvertFrom-Json

  # 驗證一：來源識別碼必須已登記。未登記就寫檔等於產生無法追溯的數字，
  # 違反 CLAUDE.md 第3條（任何呈現的數字都要能在 sources.json 追到來源）。
  $known = @($sources.sources | ForEach-Object { $_.id })
  if($known -notcontains $SourceId){
    throw "未知的 sourceId '$SourceId'。data/sources.json 現有：$($known -join ', ')"
  }

  # 驗證二：nature 值須在 schema 定義的值域內，避免前端拿到無法對應的標籤。
  $allowed = Get-AllowedNatures -Sources $sources
  foreach($f in $FieldNature.Keys){
    if($allowed -notcontains $FieldNature[$f]){
      throw "欄位 '$f' 的 nature '$($FieldNature[$f])' 不在值域內。允許：$($allowed -join ', ')"
    }
  }

  # ConvertTo-Json 會依插入順序輸出，用 ordered 讓外層欄位固定排在 data 之前，
  # 方便人工開檔時先看到溯源資訊。
  $doc = [ordered]@{
    _sourceId    = $SourceId
    _generatedBy = $GeneratedBy
    _generatedAt = (Get-Date -Format 'yyyy-MM-dd')
    _fieldNature = [ordered]@{}
  }
  foreach($f in ($FieldNature.Keys | Sort-Object)){ $doc._fieldNature[$f] = $FieldNature[$f] }
  $doc['data'] = $Data

  $full = Join-Path $script:RepoRoot $OutPath
  $dir = Split-Path $full -Parent
  if(-not (Test-Path $dir)){ New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $doc | ConvertTo-Json -Depth 10 -Compress:$false | Set-Content -Path $full -Encoding UTF8
  Write-Host "  寫出 $OutPath（$($Data.Count) 列，sourceId=$SourceId）"
}
