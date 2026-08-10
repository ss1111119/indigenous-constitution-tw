# 內政部行政區界 SHP → 簡化後的 GeoJSON
#
# 來源：內政部國土測繪中心，政府資料開放授權條款第 1 版
#   縣市：https://data.gov.tw/dataset/7442
#   鄉鎮：https://data.gov.tw/dataset/7441
# 用法：python scripts/build-geo.py
# 輸出：data/geo/counties.geojson          （22 縣市）
#       data/geo/townships/<縣市代碼>.geojson（依縣市切分，供下鑽時個別載入）
#
# 為何需要簡化：原始 SHP 的海岸線精度極高——22 個縣市多邊形共 332,091 個座標點，
# 檔案 5.3MB。轉成 GeoJSON 更大，對瀏覽器完全不可用。本腳本以 Douglas-Peucker
# 簡化，容差以「度」為單位（來源為 TWD97 經緯度）。
#
# 為何是 Python 而非 PowerShell：本專案其餘轉檔腳本為 PowerShell，但 PowerShell
# 沒有可用的 SHP 讀取器。此腳本僅在圖資更新時執行（不定期），產出已入庫，
# 一般開發與部署都不需要跑它，故額外的 pyshp 相依不影響前端「無 build step」的原則。
#
# 相依：pip install pyshp

import json
import math
import os
import sys
import zipfile

import shapefile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 簡化容差（單位：度）。約當 1e-4 度 ≈ 11 公尺。
# 縣市層級用較粗的容差，鄉鎮層級因為要看清單一縣市內的界線而用較細的。
# 調整時請重跑本腳本並確認輸出檔大小與視覺上的鋸齒程度。
COUNTY_TOLERANCE = 0.002
TOWNSHIP_TOLERANCE = 0.0005

# 面積過小的環（外島礁岩、飛地碎塊）在儀表板尺度下不可見，但會顯著增加檔案大小。
# 以最小外接矩形的對角線長度（度）為門檻，保留所有肉眼可辨的島嶼。
MIN_RING_EXTENT = 0.004


def perpendicular_distance(pt, start, end):
    """點到線段的垂直距離（平面近似，容差尺度下足夠）。"""
    (x, y), (x1, y1), (x2, y2) = pt, start, end
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(x - x1, y - y1)
    return abs(dy * x - dx * y + x2 * y1 - y2 * x1) / math.hypot(dx, dy)


def douglas_peucker(points, tolerance):
    """遞迴會在長環上爆掉 recursion limit，故用顯式堆疊。"""
    if len(points) < 3:
        return list(points)
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        if last <= first + 1:
            continue
        max_d, idx = -1.0, first
        for i in range(first + 1, last):
            d = perpendicular_distance(points[i], points[first], points[last])
            if d > max_d:
                max_d, idx = d, i
        if max_d > tolerance:
            keep[idx] = True
            stack.append((first, idx))
            stack.append((idx, last))
    return [p for p, k in zip(points, keep) if k]


def ring_extent(ring):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return math.hypot(max(xs) - min(xs), max(ys) - min(ys))


def signed_area(ring):
    """正值為逆時針。SHP 慣例：外環順時針（負），內環（孔洞）逆時針（正）。"""
    s = 0.0
    for i in range(len(ring) - 1):
        (x1, y1), (x2, y2) = ring[i], ring[i + 1]
        s += x1 * y2 - x2 * y1
    return s / 2.0


def close_ring(ring):
    return ring if ring[0] == ring[-1] else ring + [ring[0]]


def simplify_shape(shape, tolerance):
    """SHP 的 polygon 以 parts 切分多個環，回傳 [[外環, 孔洞...], ...]。

    ⚠️ 孔洞必須歸給它所屬的外環，不能當成獨立多邊形——否則該孔洞會被填色。
    實測來源確有孔洞：縣市層級新北市包住臺北市、嘉義縣包住嘉義市；鄉鎮層級亦有 2 處。
    把臺北市當獨立多邊形會讓新北市的填色蓋住臺北市，是看得見的錯誤。
    """
    pts = shape.points
    starts = list(shape.parts) + [len(pts)]
    polygons = []
    for i in range(len(starts) - 1):
        raw = [(round(x, 5), round(y, 5)) for x, y in pts[starts[i]:starts[i + 1]]]
        if len(raw) < 4:
            continue
        is_hole = signed_area(raw) > 0
        # 太小的環在儀表板尺度下不可見。外環直接丟棄；孔洞亦然（微小孔洞看不出來）。
        if ring_extent(raw) < MIN_RING_EXTENT:
            continue
        simple = close_ring(douglas_peucker(raw, tolerance))
        # 簡化後仍須是閉合且至少三個相異點的環，否則 GeoJSON 無效。
        if len(simple) < 4:
            continue
        ring = [list(p) for p in simple]
        if is_hole and polygons:
            polygons[-1].append(ring)
        else:
            # 孔洞出現在任何外環之前是不合法的 SHP，但真遇到就當外環處理而非丟棄。
            polygons.append([ring])
    return polygons


def read_shp(zip_path, member_prefix):
    """直接從 zip 讀，不落地解壓——原始 zip 已在 data/raw/ 入庫。"""
    with zipfile.ZipFile(zip_path) as z:
        names = {os.path.splitext(n)[1].lower(): n for n in z.namelist()
                 if os.path.basename(n).startswith(member_prefix)}
        for ext in ('.shp', '.dbf', '.shx'):
            if ext not in names:
                raise SystemExit(f'{zip_path} 內找不到 {member_prefix}{ext}')
        return shapefile.Reader(
            shp=z.open(names['.shp']), dbf=z.open(names['.dbf']), shx=z.open(names['.shx']),
            encoding='utf-8',
        )


def feature(code, name, polygons):
    """polygons 為 [[外環, 孔洞...], ...]。單一多邊形用 Polygon，多個用 MultiPolygon。"""
    geom = ({'type': 'Polygon', 'coordinates': polygons[0]} if len(polygons) == 1
            else {'type': 'MultiPolygon', 'coordinates': polygons})
    return {'type': 'Feature', 'properties': {'code': code, 'name': name}, 'geometry': geom}


def write_geojson(path, features, source_note):
    full = os.path.join(REPO, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    doc = {
        'type': 'FeatureCollection',
        'source': source_note,
        'agency': '內政部國土測繪中心',
        'license': '政府資料開放授權條款第1版',
        'generatedBy': 'scripts/build-geo.py',
        'features': features,
    }
    with open(full, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
    size = os.path.getsize(full)
    polys = [[ft['geometry']['coordinates']] if ft['geometry']['type'] == 'Polygon'
             else ft['geometry']['coordinates'] for ft in features]
    pts = sum(len(ring) for ft in polys for poly in ft for ring in poly)
    holes = sum(len(poly) - 1 for ft in polys for poly in ft)
    hole_note = f'、{holes} 個孔洞' if holes else ''
    print(f'  寫出 {path}（{len(features)} 個區、{pts:,} 點{hole_note}、{size / 1024:.0f} KB）')
    return pts


def main():
    county_zip = os.path.join(REPO, 'data/raw/moi-county-boundary-1140318.zip')
    town_zip = os.path.join(REPO, 'data/raw/moi-township-boundary-1140318.zip')
    for p in (county_zip, town_zip):
        if not os.path.exists(p):
            raise SystemExit(f'找不到 {p}。請先下載原始圖資至 data/raw/。')

    print('建置行政區界 GeoJSON')

    # --- 縣市 ---
    r = read_shp(county_zip, 'COUNTY_MOI')
    feats = []
    raw_pts = 0
    for rec, shp in zip(r.records(), r.shapes()):
        raw_pts += len(shp.points)
        rings = simplify_shape(shp, COUNTY_TOLERANCE)
        if not rings:
            raise SystemExit(f'{rec["COUNTYNAME"]} 簡化後無有效環，容差 {COUNTY_TOLERANCE} 過大')
        feats.append(feature(rec['COUNTYCODE'], rec['COUNTYNAME'], rings))
    print(f'  縣市原始 {raw_pts:,} 點')
    kept = write_geojson('data/geo/counties.geojson', feats,
                         'https://data.gov.tw/dataset/7442 直轄市、縣市界線(TWD97經緯度)')
    print(f'  簡化率 {100 * (1 - kept / raw_pts):.1f}%（容差 {COUNTY_TOLERANCE} 度）')

    # --- 鄉鎮，依縣市切分 ---
    # zip 內另有 Town_Majia_Sanhe（瑪家鄉三和村特例圖層），故前綴須精確到 TOWN_MOI。
    r = read_shp(town_zip, 'TOWN_MOI')
    by_county = {}
    raw_pts = 0
    for rec, shp in zip(r.records(), r.shapes()):
        raw_pts += len(shp.points)
        rings = simplify_shape(shp, TOWNSHIP_TOLERANCE)
        if not rings:
            continue
        by_county.setdefault(rec['COUNTYCODE'], []).append(
            feature(rec['TOWNCODE'], rec['COUNTYNAME'] + rec['TOWNNAME'], rings))
    print(f'  鄉鎮原始 {raw_pts:,} 點，{len(by_county)} 個縣市')
    total = 0
    for code in sorted(by_county):
        total += write_geojson(f'data/geo/townships/{code}.geojson', by_county[code],
                               'https://data.gov.tw/dataset/7441 鄉鎮市區界線(TWD97經緯度)')
    print(f'  鄉鎮簡化率 {100 * (1 - total / raw_pts):.1f}%（容差 {TOWNSHIP_TOLERANCE} 度）')


if __name__ == '__main__':
    main()
