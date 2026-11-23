# Merge translated lines into locales/ar.mobile.json.
# usage: python add-arabic.py <missing.json> <batch.txt>
#   missing.json: JSON array of English strings (from collect.js + a dictionary diff)
#   batch.txt:    lines "index|Arabic text" (index into missing.json)
# Lines whose {{placeholders}} differ from the English are rejected and listed.
import json, re, sys, os

DICT = os.path.join(os.path.dirname(__file__), '..', '..', 'locales', 'ar.mobile.json')
missing = json.load(open(sys.argv[1], encoding='utf-8'))
d = json.load(open(DICT, encoding='utf-8'))
added, bad = 0, []
for line in open(sys.argv[2], encoding='utf-8'):
    line = line.rstrip('\n')
    if '|' not in line:
        continue
    i, ar = line.split('|', 1)
    en = missing[int(i)]
    if set(re.findall(r'\{\{\w+\}\}', en)) != set(re.findall(r'\{\{\w+\}\}', ar)):
        bad.append(i)
        continue
    d[en] = ar
    added += 1
json.dump(d, open(DICT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('added', added, '| dictionary size', len(d), '| placeholder mismatch:', bad)
