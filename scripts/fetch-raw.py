# 重新取得 data/raw 下未入庫的原始檔，並與 data/sources.json 的雜湊比對
#
# 用法：python scripts/fetch-raw.py            列出可取得的識別碼
#       python scripts/fetch-raw.py <id>       取得該筆並驗證
#       python scripts/fetch-raw.py <id> <期別>  取得指定期別（預設為記錄中的期別）
#
# 為什麼需要這支腳本：ODRP 的 API 是【分頁】的，一次只回 2000 列，而村里層級有 7,771 列。
# 只在文件裡寫下網址的人會拿到四分之一的資料而不自知——那不是「可重新取得」，
# 是把重建成本連同一個陷阱丟給別人。腳本的存在本身就是那個主張的證據。
#
# 相依：僅 Python 標準函式庫。

import json
import sys
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))
from odrp import (  # noqa: E402  （必須在調整 sys.path 之後）
    AGENCY, DATASETS, normalised_data_hash, raw_filename, split_source_id,
)

# Windows 主控台是 cp950，編不出 ⚠️ 這類符號，會在 print 當場擲例外——
# 訊息本身無關緊要，卻會讓一次成功的下載在最後一步中止。改為無法編碼就替換字元：
# 輸出的可讀性不值得用整支腳本的成敗去換。
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, 'reconfigure'):
        _stream.reconfigure(errors='replace')

REPO = Path(__file__).resolve().parent.parent
SOURCES = REPO / 'data' / 'sources.json'
RAW = REPO / 'data' / 'raw'

# 可自動取得的是 ODRP 的兩個 API 資料集，【任何期別】皆可——期別是參數不是身分。
# 其餘來源（xls 需人工點擊、zip 為一次性下載）不在此列，
# 它們的雜湊供人工比對，不是自動化取得的對象。


def fetch_all_pages(endpoint, period):
    """依回應的 totalPage 逐頁取回並合併。

    ⚠️ 不可只取第一頁。API 的 pageDataSize 為 2000，而村里層級有 7,700 餘列，
    只取首頁會得到一份看起來格式正確、實際上少了四分之三的資料。
    """
    url = f'{endpoint}/{period}'
    rows = []
    total_page = None
    page = 1
    while True:
        req = urllib.request.Request(
            f'{url}?page={page}',
            headers={'Accept': 'application/json'},
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read().decode('utf-8'))
        if total_page is None:
            total_page = int(body.get('totalPage', 1))
            declared = int(body.get('totalDataSize', 0))
        rows.extend(body.get('responseData', []))
        if page >= total_page:
            break
        page += 1

    # 頁數或列數對不上就中止，不產生不完整的輸出檔——
    # 靜默的殘缺資料比明顯的失敗難發現得多。
    if page != total_page:
        raise RuntimeError(f'取得 {page} 頁，但 API 宣告 {total_page} 頁')
    if declared and len(rows) != declared:
        raise RuntimeError(f'取得 {len(rows)} 列，但 API 宣告 {declared} 列')
    return rows, total_page


def main(argv):
    sources = json.loads(SOURCES.read_text(encoding='utf-8'))
    by_id = {s['id']: s for s in sources['sources']}

    if len(argv) < 2:
        print('可取得的識別碼（前綴 + 期別）：')
        for sid in sorted(by_id):
            prefix, period = split_source_id(sid)
            if prefix:
                print(f'  {sid:<22} {DATASETS[prefix]["endpoint"]}  '
                      f'期別 {by_id[sid].get("dataDate", "?")}')
        print('\n其餘來源需人工下載，其雜湊記於 data/sources.json 供比對。')
        return 0

    sid = argv[1]
    # 期別取自 id 尾碼（例如 moi-odrp018-11506 → 11506）。不從 dataDate 取，
    # 因為那是人類可讀格式（「2026-06（民國115年6月）」），不是 API 要的民國年月。
    prefix, period = split_source_id(sid)
    if prefix is None:
        print(f'無法自動取得：{sid}', file=sys.stderr)
        print(f'可自動取得的資料集：{", ".join(DATASETS)}（後接期別，如 -11507）',
              file=sys.stderr)
        return 1

    cfg = DATASETS[prefix]
    record = by_id.get(sid)
    if record is None:
        print(f'data/sources.json 中沒有 {sid} 的記錄', file=sys.stderr)
        return 1

    if len(argv) > 2:
        period = argv[2]
    if not period.isdigit():
        print(f'無法從識別碼 {sid} 推出期別，請以第二個參數指定，例如 11506',
              file=sys.stderr)
        return 1

    print(f'取得 {sid} 期別 {period} …')
    try:
        rows, pages = fetch_all_pages(cfg['endpoint'], period)
    except (urllib.error.URLError, TimeoutError) as err:
        print(f'網路取得失敗：{err}', file=sys.stderr)
        return 1
    except RuntimeError as err:
        print(f'取得不完整：{err}', file=sys.stderr)
        return 1
    print(f'  {pages} 頁、{len(rows)} 列')

    digest = normalised_data_hash(rows)
    filename = raw_filename(prefix, period)
    expected = (record.get('sha256') or {}).get(filename)

    if expected is None:
        print(f'  ⚠️ data/sources.json 沒有 {filename} 的雜湊記錄，無從比對')
    elif digest != expected:
        # 雜湊不符最可能的原因是來源端更新了資料，那是需要人判斷的事件。
        # 絕不自動覆蓋既有檔案——那會讓資料在無人察覺的情況下改變。
        print('雜湊不符，未寫入任何檔案：', file=sys.stderr)
        print(f'  期望 {expected}', file=sys.stderr)
        print(f'  實際 {digest}', file=sys.stderr)
        print('  若來源端確實更新了資料，請人工確認後更新 data/sources.json。',
              file=sys.stderr)
        return 1
    else:
        print(f'  雜湊相符 {digest[:16]}…')

    out = RAW / filename

    # 既有檔案的 _note 是人工整理的內容（欄位清單、口徑陷阱、自我驗證的數字），
    # 不可用通用字串覆寫——雜湊只保證 data 相同，救不回被蓋掉的說明文字。
    existing_note = None
    if out.is_file():
        try:
            existing_note = json.loads(out.read_text(encoding='utf-8')).get('_note')
        except (json.JSONDecodeError, OSError):
            existing_note = None

    doc = {
        '_source': f'{cfg["endpoint"]}/{period}',
        '_dataset': cfg['dataset'],
        '_agency': AGENCY,
        '_statistic_yyymm': period,
        '_downloadedAt': date.today().isoformat(),
        '_note': existing_note or (
            f'由 scripts/fetch-raw.py 取得，{pages} 頁合併，{len(rows)} 列。'
            f'口徑陷阱與資料缺口說明見 data/sources.json 的 {sid}。'),
        'data': rows,
    }
    out.write_text(json.dumps(doc, ensure_ascii=False), encoding='utf-8')
    print(f'  已寫入 {out.relative_to(REPO)}'
          + ('（沿用既有 _note）' if existing_note else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
