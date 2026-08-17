# 刷新流程的 commit 訊息組裝。
#
# 為什麼是獨立腳本而非寫在 workflow 裡：組裝邏輯只有在「真的有變更要提交」且
# 「該期被具名放行」時才會走完整條路徑，而那個組合在整個開發期間從未發生過。
# 留在 YAML 裡就只能用複製一份的方式測，測到的是副本不是本體；抽出來之後
# 流程與測試呼叫的是同一份程式。
#
# 用法：pwsh scripts/compose-commit-message.ps1 -Period 11508 [-Released -DeltaPct 7.8123 -Reason "..."]
# 輸出：組裝好的 commit 訊息（stdout）。本腳本不碰 git，也不讀寫任何資料檔。

param(
  [Parameter(Mandatory)][string]$Period,

  # 是否經具名放行。刻意不從「有沒有百分比」推導——百分比現在每次刷新都有，
  # 拿它當放行的判準會讓每一次例行更新都被寫成放行過。
  [switch]$Released,

  # 觀察到的變動百分比。僅在放行時寫入訊息；非放行時不寫，
  # 否則版本歷史中「幅度曾被計算」會看起來像「曾被放行」。
  [string]$DeltaPct = '',

  [string]$Reason = ''
)

$ErrorActionPreference = 'Stop'

$msg = @"
data: 更新至期別 $Period

由 .github/workflows/refresh-data.yml 自動提交。
加總自我驗證與變動幅度檢查均已通過；來源記錄的 verification 為 unverified，
尚未經人工與原民會月報交叉驗證。
"@

# 放行過的期別必須在 git 歷史裡自帶理由——三個月後沒有人能從數字本身
# 判斷那次跳動是真實變動還是沒人看的意外，寫在這裡是唯一留得住的地方。
if($Released){
  if([string]::IsNullOrWhiteSpace($DeltaPct)){
    throw '標示為已放行但未提供變動百分比：放行必須在訊息中說明放行了多大的變動。'
  }
  if([string]::IsNullOrWhiteSpace($Reason)){
    throw '標示為已放行但未提供理由：放行必須具名。'
  }
  # 理由原樣寫入，含換行。多行理由是合法的——operator 可能分點說明核對方式。
  $msg = $msg.TrimEnd() + @"


⚠️ 本期的變動幅度檢查由人工具名放行：變動 $DeltaPct%，超過 ±1% 門檻。
放行理由：$Reason
"@
}

$msg.TrimEnd()
