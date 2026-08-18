# site/ + 網站實際讀取的資料 → _site/（可直接發佈的靜態站）
#
# 用法：python scripts/build-site.py
# 輸出：_site/index.html（資料目錄）、_site/dashboard.html（四個面板）、
#       _site/404.html、_site/css|js|vendor/、_site/data/
#
# 為什麼需要這一步，而不是直接發佈 repo 根目錄：
#   1. 首頁會落在 /site/ 這種網址，而非站台根。
#   2. data/raw 有 169MB（單檔最大 40MB），網站一個 byte 都不讀，卻會成為
#      站台資產，每次部署都要上傳、公開頻寬白白消耗在沒人要的原始檔上。
# 見 openspec/changes/deploy-github-pages/design.md 決策一。
#
# 本機預覽也走 _site/，不保留直開 site/ 的路徑（決策二）：若兩種佈局都能運作，
# 就有兩套路徑解析邏輯，而分歧只會在部署後才被發現。
#
# 相依：僅 Python 標準函式庫。前端維持無 build step、無 npm 相依，
# 這支腳本只搬檔案，除了下述唯一的一種取代之外不做任何轉換、打包或壓縮。
#
# 唯一被允許的轉換：把 REQUIRED_PERIOD_PAGES 所列頁面的 {{DATA_PERIOD}}
# 換成實際載入資料的期別。
# 理由見 scheduled-data-refresh/design.md 決策三——這句話是「發佈時才知道正確值」
# 的內容，讓它保持靜態就等於保證它會過期；而基準日必須在停用 JavaScript 時仍可見，
# 所以不能交給前端在執行期渲染。
#
# 這個例外【僅此一種】，不是模板機制的開端：取代對象是單一個固定字串，
# 值的來源鏈是固定的 processed JSON → _sourceId → sources.json → dataDate，
# 沒有運算式、沒有迴圈、沒有條件。要再加第二種取代之前，先回去讀那條規格。

import json
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

SITE_SRC = REPO / 'site'
DATA_SRC = REPO / 'data'
OUT = REPO / '_site'

# 必要資料來源清單。刻意寫死而非掃目錄：掃目錄的話，來源檔被刪掉只會讓它
# 不被列舉，組建照樣「成功」，然後產出一個少了幾個面板資料的站台——
# 那要等使用者回報才會發現。寫死才能讓缺檔當場失敗（決策四）。
#
# 路徑相對於 data/。每一項都對應前端某處的 loadData() 或 fetch()；
# 新增面板資料時必須同時加到這裡，否則本地測得到、線上缺檔。
REQUIRED_DATA = [
    'sources.json',
    'processed/election-by-category.json',
    'processed/land-ownership-by-county.json',
    'processed/land-ownership-national.json',
    'processed/legislative-representation.json',
    'processed/population-by-county.json',
    'processed/population-by-township.json',
    'processed/tribes-by-county.json',
    'processed/tribes-by-township.json',
    'geo/counties.geojson',
]

# 鄉鎮圖資逐縣市切分，檔名是 5 碼縣市代碼。這部分不寫死 22 個代碼，而是從
# 縣市人口資料推導——因為下鑽功能的前提正是「每個出現在縣市清單裡的縣市，
# 都要有對應的鄉鎮圖資」。從資料推導等於順便驗證了這個 join。
COUNTY_POPULATION = 'processed/population-by-county.json'

# 期別佔位符。頁面上每一處陳述基準日的地方都用它，取代後必然一致。
PERIOD_PLACEHOLDER = '{{DATA_PERIOD}}'

# 必須含佔位符的頁面。與 REQUIRED_DATA 同一條紀律：明列而非掃描。
# 掃描發佈目錄統計佔位符總數，只能證明「某處有」，不能證明「該有的那頁有」——
# 儀表板若失去佔位符、而別處（例如日後 vendor 帶進來的說明頁）湊巧含有該字串，
# 總數非零，組建就會誤判成功。掃描還會碰到「vendored libraries copied unchanged」的承諾。
#
# 首頁（資料目錄）刻意不在此清單：它呈現的是各來源各自的 dataDate，
# 沒有單一基準日，硬給一個等於宣稱一個它沒有的資料新鮮度。
# 日後新增呈現單一期別的頁面時，必須同時加進這裡。
REQUIRED_PERIOD_PAGES = ['dashboard.html']


def resolve_period():
    """由縣市人口資料的 _sourceId 對應 data/sources.json，取得該來源的 dataDate。

    取縣市人口資料而非其他檔，是因為頁面陳述的基準日講的就是人口數字的期別。
    找不到對應記錄時直接中止：寧可不發佈，也不要發出一個期別空白或寫著
    未解析佔位符的頁面——那會讓讀者以為看到的是最新資料。
    """
    with (DATA_SRC / COUNTY_POPULATION).open(encoding='utf-8') as f:
        source_id = json.load(f)['_sourceId']
    with (DATA_SRC / 'sources.json').open(encoding='utf-8') as f:
        sources = json.load(f)['sources']

    for entry in sources:
        if entry['id'] == source_id:
            period = entry.get('dataDate')
            if not period:
                sys.exit(f'組建中止：來源記錄 {source_id} 沒有 dataDate 欄位')
            return source_id, period

    sys.exit(
        f'組建中止：{COUNTY_POPULATION} 的 _sourceId「{source_id}」'
        f'在 data/sources.json 中沒有對應記錄，無法解析頁面的基準日。'
    )


def substitute_period(period):
    """把清單上每一頁的期別佔位符換成實際期別，其餘位元組原樣不動。

    清單上的頁面必須存在且必須含佔位符，缺哪一項就指名哪一頁——
    「某處有佔位符」不等於「該有的那頁有」。
    """
    total = 0
    for name in REQUIRED_PERIOD_PAGES:
        page = OUT / name
        if not page.is_file():
            shutil.rmtree(OUT)
            sys.exit(
                f'組建中止：清單要求 {name} 必須含 {PERIOD_PLACEHOLDER}，但該頁不存在。'
                '頁面更名或刪除時，REQUIRED_PERIOD_PAGES 要一起改。'
            )
        text = page.read_text(encoding='utf-8')
        count = text.count(PERIOD_PLACEHOLDER)
        if count == 0:
            shutil.rmtree(OUT)
            sys.exit(
                f'組建中止：{name} 找不到 {PERIOD_PLACEHOLDER}。'
                '該頁必須有一處由資料決定的基準日，否則基準日又會回到寫死的狀態。'
            )
        page.write_text(text.replace(PERIOD_PLACEHOLDER, period), encoding='utf-8')
        total += count
    return total


def required_township_geo():
    """由縣市人口資料的 district_code 推出必須存在的鄉鎮圖資清單。"""
    path = DATA_SRC / COUNTY_POPULATION
    with path.open(encoding='utf-8') as f:
        rows = json.load(f)['data']
    return [f"geo/townships/{row['district_code']}.geojson" for row in rows]


def main():
    if not SITE_SRC.is_dir():
        sys.exit(f'缺少網站來源目錄：{SITE_SRC.relative_to(REPO)}')

    # 先清空再驗證再組建。清空放在最前面，是為了讓「驗證失敗」的結果是
    # 「沒有 _site/」而不是「留著上一次的 _site/ 讓人誤以為是這次的產物」。
    if OUT.exists():
        shutil.rmtree(OUT)

    required = list(REQUIRED_DATA)
    try:
        required += required_township_geo()
    except FileNotFoundError:
        # 縣市人口資料本身就缺，下面的逐項檢查會報出來，這裡不重複報。
        pass

    missing = [rel for rel in required if not (DATA_SRC / rel).is_file()]
    if missing:
        print('組建中止：以下必要資料來源不存在', file=sys.stderr)
        for rel in missing:
            print(f'  data/{rel}', file=sys.stderr)
        print(
            '\n請先執行對應的轉檔腳本（見 README 的資料管線一節）後重試。',
            file=sys.stderr,
        )
        sys.exit(1)

    # 期別在複製之前先解析。解析失敗時 _site/ 尚未建立，符合「驗證失敗就沒有 _site/」。
    source_id, period = resolve_period()

    # site/ 的內容攤在 _site/ 根，這樣首頁就是站台根，網址不帶 /site/。
    shutil.copytree(SITE_SRC, OUT)

    substituted = substitute_period(period)

    # 資料收在 _site/data/ 之下，與前端的 DATA_BASE 常數（site/js/state.js）
    # 一致。只複製清單上的檔案，data/raw 因此不會進到發佈目錄。
    for rel in required:
        dest = OUT / 'data' / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(DATA_SRC / rel, dest)

    files = [p for p in OUT.rglob('*') if p.is_file()]
    total = sum(p.stat().st_size for p in files)
    print(f'_site/ 組建完成：{len(files)} 個檔案，{total / 1024 / 1024:.2f} MB')
    print(f'  其中資料 {len(required)} 個檔案（不含 data/raw）')
    print(f'  基準日 {period}（{source_id}），取代 {substituted} 處')


if __name__ == '__main__':
    main()
