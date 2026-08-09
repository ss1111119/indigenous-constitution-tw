<!-- SPECTRA:START v1.0.2 -->

# Spectra Instructions

This project uses Spectra for Spec-Driven Development(SDD). Specs live in `openspec/specs/`, change proposals in `openspec/changes/`.

## Use `/spectra-*` skills when:

- A discussion needs structure before coding → `/spectra-discuss`
- User wants to plan, propose, or design a change → `/spectra-propose`
- Tasks are ready to implement → `/spectra-apply`
- There's an in-progress change to continue → `/spectra-ingest`
- User asks about specs or how something works → `/spectra-ask`
- Implementation is done → `/spectra-archive`
- Commit only files related to a specific change → `/spectra-commit`

## Workflow

discuss? → propose → apply ⇄ ingest → archive

- `discuss` is optional — skip if requirements are clear
- Requirements change mid-work? Plan mode → `ingest` → resume `apply`

## Parked Changes

Changes can be parked（暫存）— temporarily moved out of `openspec/changes/`. Parked changes won't appear in `spectra list` but can be found with `spectra list --parked`. To restore: `spectra unpark <name>`. The `/spectra-apply` and `/spectra-ingest` skills handle parked changes automatically.

<!-- SPECTRA:END -->

# 本專案：何時走 Spectra

**第一階段（可行性研究）不走 Spectra，直接做。**

產出只有 `docs/feasibility-study.md`，是調查報告，沒有任何系統行為被建立或改變，
`openspec/specs/` 無從寫起。更重要的是，`/spectra-propose` 要求事前寫下預期產出與驗收條件，
而這份研究的重點正是「不預設結論」——包含「值得做／需縮小範圍／不值得做」的最終判斷，
以及平埔族資料很可能根本不存在官方統計這種結論。事前寫驗收條件會讓調查變成替既定答案找證據。

**第二階段（開始建站）起走 Spectra。**

交接點是可行性報告的 E 節（技術方案）與 F 節（MVP 定義）——那兩節本身就是設計決策。
報告不是被 Spectra 管理的產物，而是餵給 `/spectra-propose` 的輸入。

```
第一階段（直接做）             第二階段（走 Spectra）
調查 → feasibility-study.md → /spectra-discuss 收斂 MVP 範圍
                             → /spectra-propose → /spectra-apply → /spectra-archive
```

之後的日常判準沿用既有原則：新資料管線／轉檔腳本／前後端介面／有設計取捨 → 走 Spectra；
純文案、CSS 微調、修錯字、刪死碼 → 直接做。

# 資料紀律

1. **官方統計、學術估計、本專案計算值三者必須分開標示**，靠 `data/sources.json` 的 `nature`
   欄位在資料層強制區分，不是只在文案上寫提醒。
2. 資料不存在就標記 **Data Gap／資料缺口**，不自行推估成官方數字。
3. 任何呈現在網站上的數字，都要能在 `data/sources.json` 追到來源。
4. 調查階段若查不到某資料庫的授權或格式，記為「待確認」，不要憑印象填。
