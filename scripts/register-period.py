# 在 data/sources.json 登記一個新期別的 ODRP 來源記錄
#
# 用法：python scripts/register-period.py register 11507   新增該期的兩筆記錄（尚無雜湊）
#       python scripts/register-period.py seal 11507       由 data/raw 的原始檔補上雜湊
#
# 為何分兩步：轉檔腳本會拒絕未登記的 sourceId（見 scripts/lib/provenance.ps1），
# 所以記錄必須在轉檔【之前】就存在；而雜湊要等原始檔下載完才算得出來。
# 順序是 register → 取得原始檔 → seal → 轉檔 → 提交。
#
# 為何新增而不覆蓋既有記錄：記錄裡的 notes 寫著該期實際交叉驗證過的數字，sha256 也綁定
# 該期的原始檔。就地覆蓋會讓舊期驗證過的數字掛在新期上，那是憑空產生的假驗證。
# 見 scheduled-data-refresh/design.md 決策七。
#
# 自動新增的記錄一律記為 unverified：排程做得到自我驗證與幅度檢查，做不到跨來源的人工
# 核對（如與原民會月報比對）。記成 primary-source 是溢領。
#
# 相依：僅 Python 標準函式庫。

import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))
from odrp import (  # noqa: E402  （必須在調整 sys.path 之後）
    DATASETS, data_date, normalised_data_hash, raw_filename,
)

REPO = Path(__file__).resolve().parent.parent
SOURCES = REPO / 'data' / 'sources.json'
RAW = REPO / 'data' / 'raw'

AUTO_NOTE = (
    '由排程刷新流程（.github/workflows/refresh-data.yml）自動取得。'
    '轉檔時的加總自我驗證與變動幅度檢查均已通過，但【未經人工與原民會月報交叉驗證】——'
    '故 verification 記為 unverified。人工核對後可改記並補上核對內容。'
)


def load():
    """讀入註冊檔。保留鍵的順序，寫回時才不會產生無謂的巨大 diff。"""
    return json.loads(SOURCES.read_text(encoding='utf-8'))


def save(doc):
    text = json.dumps(doc, ensure_ascii=False, indent=2) + '\n'
    # 註冊檔在版本庫中是 CRLF，寫回時保持一致，否則整檔會被記成一行不剩地改過。
    SOURCES.write_bytes(text.replace('\n', '\r\n').encode('utf-8'))


def latest_entry(sources, prefix):
    """取該資料集目前期別最新的一筆，作為新記錄的樣板。"""
    matching = [(s['id'].rsplit('-', 1)[-1], i, s)
                for i, s in enumerate(sources)
                if s['id'].startswith(prefix + '-') and s['id'].rsplit('-', 1)[-1].isdigit()]
    if not matching:
        sys.exit(f'data/sources.json 中沒有任何 {prefix}-<期別> 記錄，無法作為樣板')
    return max(matching, key=lambda t: int(t[0]))


def register(period):
    doc = load()
    sources = doc['sources']
    added = []

    for prefix, cfg in DATASETS.items():
        new_id = f'{prefix}-{period}'
        if any(s['id'] == new_id for s in sources):
            print(f'  {new_id} 已登記，略過')
            continue

        _, index, template = latest_entry(sources, prefix)
        entry = dict(template)          # 淺拷貝即可：下面覆寫的都是純量與新建的 dict
        entry['id'] = new_id
        entry['title'] = cfg['title']
        entry['downloadUrl'] = f'{cfg["endpoint"]}/{period}'
        entry['dataDate'] = data_date(period)
        entry['downloadedAt'] = date.today().isoformat()
        entry['verification'] = 'unverified'
        entry['notes'] = AUTO_NOTE
        # 雜湊在 seal 階段補上。先留空 dict 而非沿用樣板的值——沿用會讓新期別
        # 掛著舊期別原始檔的雜湊，比沒有雜湊更危險。
        entry['sha256'] = {}

        sources.insert(index + 1, entry)   # 緊接同資料集的前一期，相關記錄不被拆散
        added.append(new_id)

    if added:
        save(doc)
        print(f'已登記：{", ".join(added)}')
    else:
        print('沒有需要登記的記錄')
    return 0


def seal(period):
    doc = load()
    by_id = {s['id']: s for s in doc['sources']}
    sealed = []

    for prefix in DATASETS:
        sid = f'{prefix}-{period}'
        entry = by_id.get(sid)
        if entry is None:
            print(f'{sid} 尚未登記，請先執行 register', file=sys.stderr)
            return 1

        filename = raw_filename(prefix, period)
        path = RAW / filename
        if not path.is_file():
            print(f'找不到原始檔 {path.relative_to(REPO)}，無法計算雜湊', file=sys.stderr)
            return 1

        rows = json.loads(path.read_text(encoding='utf-8'))['data']
        digest = normalised_data_hash(rows)
        existing = (entry.get('sha256') or {}).get(filename)

        # 已有雜湊且不符時中止：那代表同一個期別的來源資料被改過，是需要人判斷的事件，
        # 不是可以靜靜覆蓋過去的細節。
        if existing and existing != digest:
            print(f'{sid} 的雜湊與既有記錄不符，未寫入任何變更：', file=sys.stderr)
            print(f'  記錄 {existing}', file=sys.stderr)
            print(f'  實際 {digest}', file=sys.stderr)
            return 1

        entry['sha256'] = {filename: digest}
        entry['sha256Kind'] = 'normalised-data'
        sealed.append(f'{sid} {digest[:16]}…')

    save(doc)
    print('已補上雜湊：')
    for s in sealed:
        print(f'  {s}')
    return 0


def main(argv):
    if len(argv) < 3 or argv[1] not in ('register', 'seal') or not argv[2].isdigit():
        print(__doc__ or '', file=sys.stderr)
        print('用法：python scripts/register-period.py register|seal <期別>',
              file=sys.stderr)
        return 2
    return register(argv[2]) if argv[1] == 'register' else seal(argv[2])


if __name__ == '__main__':
    sys.exit(main(sys.argv))
