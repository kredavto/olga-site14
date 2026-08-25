#!/usr/bin/env bash
# Скачивает подмножества шрифтов (latin + cyrillic) и кладёт их в dist/assets/fonts,
# генерируя локальный fonts.css. Внешних запросов в рантайме у сайта нет.
set -euo pipefail
cd "$(dirname "$0")/.."
DIR=dist/assets/fonts
mkdir -p "$DIR"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
QUERY="family=Inter+Tight:wght@400;500;600&family=Inter:wght@300;400;500&family=Playfair+Display:wght@400;500&display=swap"

curl -sS -A "$UA" "https://fonts.googleapis.com/css2?${QUERY}" > /tmp/gf.css
python3 tools/localize_fonts.py /tmp/gf.css "$DIR" > "$DIR/../fonts.css"
echo "fonts -> $DIR ($(ls "$DIR" | wc -l) files)"
