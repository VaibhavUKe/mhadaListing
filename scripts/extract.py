#!/usr/bin/env python3
"""
Extract the scheme table from a MHADA Pune lottery ad (Shree-Lipi PDF) into JSON.

Usage:
  python scripts/extract.py source/pune-2026-09.pdf data/raw-pune-2026-09.json

Columns are found from the PDF's vertical rule lines, rows from the serial-number
column and the horizontal rule lines. Every row is checked: the 15 category counts
must add up to the row total. Problems are printed, not silently fixed.
"""
import json
import re
import sys
from pathlib import Path

import pdfplumber

sys.path.insert(0, str(Path(__file__).parent))
from shree2uni import convert  # noqa: E402

CATEGORIES = ['SC', 'ST', 'NT', 'DT', 'JR', 'FF', 'PH', 'DF', 'EX', 'MP', 'ME', 'SG', 'CG', 'AR', 'GP']
COLUMNS = ['sr', 'code', 'round', 'name', 'price', 'builtup', 'carpet', 'total', *CATEGORIES, 'rera']
ROUNDS = {'प्रथम': 1, 'द्वितीय': 2, 'तृतीय': 3}
SECTIONS = [  # (text found in the section heading, id)
    ('15% सामाजिक', 'social-15'),
    ('पुणे महानगरपालिका', 'inclusive-20-pmc'),
    ('पिंपरी चिंचवड', 'inclusive-20-pcmc'),
]


def page_words(page):
    out = []
    for w in page.extract_words(extra_attrs=['fontname'], x_tolerance=1.2, y_tolerance=2):
        text = convert(w['text']) if 'SHREE' in w['fontname'].upper() else w['text']
        out.append({**w, 'text': text, 'xc': (w['x0'] + w['x1']) / 2, 'yc': (w['top'] + w['bottom']) / 2})
    return out


def rules(page):
    v, h = set(), set()
    for l in page.lines + page.rects:
        height, width = abs(l['bottom'] - l['top']), abs(l['x1'] - l['x0'])
        if height > 200 and width < 3:
            v.add(round((l['x0'] + l['x1']) / 2))
        elif width > 400 and height < 3:
            h.add(round(l['top'], 1))
    return sorted(v), sorted(h)


def column_of(x, edges):
    for i, e in enumerate(edges):
        if x < e:
            return i
    return len(edges)


def extract_page(page, pageno):
    words = page_words(page)
    vedges, hrules = rules(page)
    if len(vedges) != len(COLUMNS) - 1:
        raise SystemExit(f'page {pageno}: expected {len(COLUMNS) - 1} column rules, found {len(vedges)}')

    sc = next(w for w in words if w['text'] == 'SC')
    end = next((w['top'] for w in words if 'विशेष' in w['text']), page.height)
    body = [w for w in words if sc['bottom'] + 14 < w['yc'] < end]  # skip the 1..24 column-number row

    # full-width banner lines: section headings and the deposit notice under each
    sections, banner_ys = [], []
    for w in body:
        line = ' '.join(x['text'] for x in body if abs(x['yc'] - w['yc']) < 3)
        if 'अनामत' in line or ('%' in line and 'योजना' in line):
            banner_ys.append(w['yc'])
        for key, sid in SECTIONS:
            if key in line and 'योजना' in line:
                sections.append((w['top'], sid))
    sections = sorted(set(sections))
    body = [w for w in body if all(abs(w['yc'] - y) >= 3 for y in banner_ys)]

    anchors = [w for w in body if column_of(w['xc'], vedges) == 0 and w['text'].isdigit()]
    rows = []
    for a in anchors:
        above = max((y for y in hrules if y <= a['yc']), default=a['top'] - 6)
        below = min((y for y in hrules if y > a['yc']), default=a['bottom'] + 6)
        cells = {c: [] for c in COLUMNS}
        for w in body:
            if above < w['yc'] < below:
                cells[COLUMNS[column_of(w['xc'], vedges)]].append(w)
        row = {c: ' '.join(x['text'] for x in sorted(ws, key=lambda x: (round(x['top']), x['x0'])))
               for c, ws in cells.items()}
        row['_page'] = pageno
        row['_section'] = next((sid for y, sid in reversed(sections) if y < a['top']), None)
        rows.append(row)
    return rows


def num_range(s):
    """'1467900-1469200' -> (1467900, 1469200); '61.6' -> (61.6, 61.6)."""
    nums = [float(x) for x in re.findall(r'\d+(?:\.\d+)?', s.replace(' ', ''))]
    if not nums:
        return None, None
    return min(nums), max(nums)


def unit_type(name):
    m = re.search(r'(\d(?:\.\d)?)\s*(बीएचके|आरके)', name)
    if not m:
        return None
    return f"{m.group(1)} {'BHK' if m.group(2) == 'बीएचके' else 'RK'}"


def clean(row, problems):
    sr = int(row['sr'])
    counts = {}
    for c in CATEGORIES:
        v = row[c].replace(' ', '')
        if not v.isdigit():
            problems.append(f'row {sr}: category {c} = {row[c]!r}')
            v = '0'
        counts[c] = int(v)
    total = int(row['total']) if row['total'].isdigit() else None
    flags = []
    if total is not None and sum(counts.values()) != total:
        # seen in the source ad itself (checked on the page image) -- keep as printed, flag it
        flags.append(f'Category counts in the ad add up to {sum(counts.values())}, but the ad prints a total of {total}.')
    elif total is None:
        problems.append(f'row {sr}: total = {row["total"]!r}')
    pmin, pmax = num_range(row['price'])
    bmin, bmax = num_range(row['builtup'])
    cmin, cmax = num_range(row['carpet'])
    name = re.sub(r'\s+', ' ', row['name']).strip()
    out = {
        'sr': sr,
        'code': row['code'].replace(' ', ''),
        'round': ROUNDS.get(row['round']),
        'section': row['_section'],
        'name_mr': name,
        'unit_type': unit_type(name),
        'price_min': int(pmin) if pmin else None,
        'price_max': int(pmax) if pmax else None,
        'builtup_sqm': [bmin, bmax],
        'carpet_sqm': [cmin, cmax],
        'total_units': total,
        'reserved': counts,
        'rera': row['rera'].replace(' ', '').lstrip(',') or None,
        'pdf_page': row['_page'],
        'flags': flags,
        'raw': {k: row[k] for k in ('price', 'builtup', 'carpet', 'rera')},
    }
    for k in ('round', 'section', 'unit_type', 'price_min', 'rera'):
        if out[k] is None:
            problems.append(f'row {sr}: missing {k} (raw: {row.get(k, "")!r})')
    return out


def main(pdf_path, out_path):
    rows = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages[:2], 1):
            rows += extract_page(page, i)
    rows.sort(key=lambda r: int(r['sr']))
    problems = []
    data = [clean(r, problems) for r in rows]
    srs = [d['sr'] for d in data]
    if srs != list(range(1, len(srs) + 1)):
        problems.append(f'serial numbers not continuous: {srs}')
    total = sum(d['total_units'] or 0 for d in data)
    Path(out_path).write_text(json.dumps(data, ensure_ascii=False, indent=1))
    print(f'{len(data)} rows, {total} units -> {out_path}')
    for d in data:
        for f in d['flags']:
            print(f'flag row {d["sr"]} ({d["code"]}): {f}')
    print('\n'.join(problems) if problems else 'no problems')


if __name__ == '__main__':
    main(*sys.argv[1:3])
