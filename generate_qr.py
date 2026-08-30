#!/usr/bin/env python3
"""
GitHub Pages公開後、各ブースに置くQRコードを一括生成します。

例:
  pip install -r requirements-qr.txt
  python generate_qr.py https://YOURNAME.github.io/mission-escape-pwa/
"""
from pathlib import Path
import json, sys, csv
from urllib.parse import quote

try:
    import qrcode
except ImportError:
    raise SystemExit("qrcode がありません。先に: pip install -r requirements-qr.txt")

if len(sys.argv) != 2:
    raise SystemExit("使い方: python generate_qr.py https://YOURNAME.github.io/REPOSITORY/")

base = sys.argv[1].strip()
if not base.endswith("/"):
    base += "/"

root = Path(__file__).resolve().parent
data = json.loads((root / "game-data.json").read_text(encoding="utf-8"))
out = root / "qr_output"
out.mkdir(exist_ok=True)

rows = []
for route_key, route in data["routes"].items():
    rdir = out / f"route_{route_key}"
    rdir.mkdir(exist_ok=True)
    for stage in route["stages"]:
        token = stage.get("qrToken")
        booth = stage.get("booth")
        if not token or not booth:
            continue
        url = f"{base}?qr={quote(token, safe='')}"
        filename = f"{route_key}_{stage['number']:02d}.png"
        img = qrcode.make(url)
        img.save(rdir / filename)
        rows.append({
            "route": route_key,
            "stage": stage["number"],
            "booth": booth,
            "token": token,
            "url": url,
            "file": str(Path(f"route_{route_key}") / filename),
        })

with (out / "qr_list.csv").open("w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(f, fieldnames=["route","stage","booth","token","url","file"])
    writer.writeheader()
    writer.writerows(rows)

print(f"{len(rows)} 個のQRコードを生成しました: {out}")
print("一覧:", out / "qr_list.csv")
