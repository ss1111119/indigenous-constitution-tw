"""戶政司 ODRP 資料集的共用定義。

由 scripts/fetch-raw.py（重新取得原始檔）與 scripts/register-period.py（登記新期別）
共用。抽出來的理由只有一個：正規化雜湊的序列化參數必須兩邊完全一致，否則同一份資料
會算出兩個值，而那種分歧要等到有人拿去驗證時才會發現。

相依：僅 Python 標準函式庫。
"""

import hashlib
import json

AGENCY = '內政部戶政司'

# 以資料集前綴為鍵，不含期別——期別是參數不是身分。
# data/sources.json 的識別碼形如 moi-odrp013-11506，前綴 + 期別。
DATASETS = {
    'moi-odrp013': {
        'endpoint': 'https://www.ris.gov.tw/rs-opendata/api/v1/datastore/ODRP013',
        'filename': 'moi-odrp013-population-by-indigenous-status-{period}.json',
        'dataset': '現住人口數按性別及原住民身分分（新增區域代碼）ODRP013',
        'title': '現住人口數按性別及原住民身分分（新增區域代碼）ODRP013',
    },
    'moi-odrp018': {
        'endpoint': 'https://www.ris.gov.tw/rs-opendata/api/v1/datastore/ODRP018',
        'filename': 'moi-odrp018-population-by-tribe-{period}.json',
        'dataset': '現住原住民人口按性別、身分、原住民族別分（新增區域代碼）ODRP018',
        'title': '現住原住民人口按性別、身分、原住民族別分（新增區域代碼）ODRP018',
    },
}


def normalised_data_hash(rows):
    """對 data 陣列取正規化雜湊。

    參數必須與 data/sources.json 的 schema.sha256Kind 所述完全一致，
    否則別人算不出同一個值。不要在此處「順手優化」序列化參數。
    """
    canon = json.dumps(rows, sort_keys=True, ensure_ascii=False,
                       separators=(',', ':'))
    return hashlib.sha256(canon.encode('utf-8')).hexdigest()


def split_source_id(source_id):
    """moi-odrp013-11506 → ('moi-odrp013', '11506')。前綴不認識時回傳 (None, None)。"""
    for prefix in DATASETS:
        if source_id.startswith(prefix + '-'):
            period = source_id[len(prefix) + 1:]
            if period.isdigit():
                return prefix, period
    return None, None


def raw_filename(prefix, period):
    return DATASETS[prefix]['filename'].format(period=period)


def data_date(period):
    """民國年月 11507 → '2026-07（民國115年7月）'，與既有記錄同一種寫法。

    dataDate 是給人看的，格式必須與註冊檔中既有的記錄一致，否則同一個欄位
    會出現兩種寫法，日後想用它做比對的人得先處理格式分歧。
    """
    roc_year = int(period[:3])
    month = int(period[3:])
    return f'{roc_year + 1911}-{month:02d}（民國{roc_year}年{month}月）'
