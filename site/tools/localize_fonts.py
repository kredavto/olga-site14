#!/usr/bin/env python3
"""Разбирает CSS Google Fonts, качает только latin и cyrillic, печатает локальный @font-face."""
import re, sys, os, subprocess, hashlib

src, outdir = sys.argv[1], sys.argv[2]
css = open(src, encoding="utf-8").read()
os.makedirs(outdir, exist_ok=True)
KEEP = {"latin", "cyrillic"}
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"

blocks = re.findall(r"/\* (\S+) \*/\s*(@font-face \{.*?\})", css, re.S)
out, seen = [], set()
for subset, block in blocks:
    if subset not in KEEP:
        continue
    fam = re.search(r"font-family: '([^']+)'", block).group(1)
    wgt = re.search(r"font-weight: (\d+)", block).group(1)
    url = re.search(r"url\((https://[^)]+)\)", block).group(1)
    name = f"{fam.lower().replace(' ', '-')}-{wgt}-{subset}.woff2"
    path = os.path.join(outdir, name)
    if name not in seen:
        seen.add(name)
        subprocess.run(["curl", "-sS", "-A", UA, "-o", path, url], check=True)
    rng = re.search(r"unicode-range: ([^;]+);", block).group(1)
    out.append(f"""@font-face {{
  font-family: '{fam}';
  font-style: normal;
  font-weight: {wgt};
  font-display: swap;
  src: url('fonts/{name}') format('woff2');
  unicode-range: {rng};
}}""")

print("/* Локальные шрифты. Пересобрать: tools/fetch_fonts.sh */")
print("\n".join(out))
