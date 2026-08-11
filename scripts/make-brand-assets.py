# 產生 site/og-image.png 與 site/icon-180.png
#
# 用法：python scripts/make-brand-assets.py
#
# ⚠️ 這支腳本【不是】組建流程的一部分。
#
# build-site.py 只用標準函式庫、只搬檔案，那條規則不變。本腳本需要 Pillow，
# 是一次性的資產產生器：產出的 PNG 直接入庫為 site/ 的靜態資產，
# 平常組建與部署都不會執行到這裡。
#
# 為什麼仍然入庫而不是手工做圖：分享卡片上的文字必須與 index.html 的文案一致，
# 手工做圖會在改文案時安靜地失去同步。留著腳本，改文案時重跑一次即可。
#
# 為什麼是 PNG 不是 SVG：Facebook / LINE 等平台的 og:image 不支援 SVG。
# favicon 則相反，site/favicon.svg 是手寫的向量檔，不由本腳本產生。

import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit('需要 Pillow：python -m pip install Pillow')

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / 'site'

# 與 site/css/main.css 的 :root 變數一致。淺色版——分享卡片在各家聊天軟體的
# 底色不一，淺底深字兩邊都讀得到，故不做深色版。
BG = '#fbfaf8'
TEXT = '#1c1a17'
MUTED = '#5d574e'
ACCENT = '#7a4a2b'
ACCENT_SOFT = '#f0e6dc'

# 微軟正黑體，與 main.css 字體堆疊中的 "Microsoft JhengHei" 同一支。
FONT_REGULAR = 'C:/Windows/Fonts/msjh.ttc'
FONT_BOLD = 'C:/Windows/Fonts/msjhbd.ttc'


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        sys.exit(f'找不到字體：{path}（本腳本目前僅在 Windows 上驗證過）')


def make_og():
    """1200x630 分享卡片。文案與 index.html 的 <h1> 及 .lede 對應。"""
    W, H = 1200, 630
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)

    # 左側色帶：讓卡片在白底聊天視窗中仍有邊界感
    d.rectangle([0, 0, 16, H], fill=ACCENT)

    x = 88
    d.text((x, 96), '臺灣原住民族', font=font(FONT_BOLD, 76), fill=TEXT)
    d.text((x, 190), '憲政代表性與土地資料', font=font(FONT_BOLD, 76), fill=TEXT)

    # 分隔線
    d.rectangle([x, 310, x + 120, 316], fill=ACCENT)

    d.text((x, 352), '人口・選舉・土地・席次模擬',
           font=font(FONT_REGULAR, 42), fill=ACCENT)

    d.text((x, 428),
           '每一個數字都能追到來源，並標明它是',
           font=font(FONT_REGULAR, 30), fill=MUTED)
    d.text((x, 470),
           '官方統計、學術估計，還是本站計算',
           font=font(FONT_REGULAR, 30), fill=MUTED)

    d.text((x, 542), 'ss1111119.github.io/indigenous-constitution-tw',
           font=font(FONT_REGULAR, 26), fill=MUTED)

    path = OUT / 'og-image.png'
    img.save(path, 'PNG', optimize=True)
    return path


def make_icon():
    """180x180 apple-touch-icon。favicon.svg 在多數瀏覽器夠用，但 iOS 加到
    主畫面時只吃 PNG，缺這張會得到一張網頁截圖當圖示。"""
    S = 180
    img = Image.new('RGB', (S, S), ACCENT)
    d = ImageDraw.Draw(img)

    # 與 favicon.svg 同構：兩道同心半圓，象徵議場席次配置
    cx, cy = S / 2, S * 0.70
    for r, w, color in ((S * 0.33, S * 0.11, BG), (S * 0.17, S * 0.11, ACCENT_SOFT)):
        d.arc([cx - r, cy - r, cx + r, cy + r], start=180, end=360,
              fill=color, width=int(w))

    path = OUT / 'icon-180.png'
    img.save(path, 'PNG', optimize=True)
    return path


if __name__ == '__main__':
    for p in (make_og(), make_icon()):
        print(f'{p.relative_to(REPO)}  {p.stat().st_size / 1024:.1f} KB')
