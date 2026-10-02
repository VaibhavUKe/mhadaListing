#!/usr/bin/env python3
"""
Merge the extracted table with the hand-edited extras (English names, YouTube, links)
into the single JSON file the website loads.

Usage:
  python scripts/build_data.py pune-2026-09

Reads   data/raw-<id>.json, data/extras-<id>.csv, data/lottery-<id>.json
Writes  data/<id>.json
"""
import csv
import json
import re
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / 'data'
SUFFIX = {'अ': 'a', 'ब': 'b', 'ए': 'a', 'बी': 'b', 'सी': 'c', 'डी': 'd'}
SQFT_PER_SQM = 10.7639


def slug(code):
    """'964-अ' -> '964-a', '1000-डी' -> '1000-d' (ASCII ids for URLs)."""
    base, _, suf = code.partition('-')
    return f'{base}-{SUFFIX[suf]}' if suf else base


def unit_types(name_mr):
    """'... 1/1.5 बीएचके' -> ['1 BHK', '1.5 BHK'];  '... 1 आरके' -> ['1 RK']."""
    m = re.search(r'([\d./]+)\s*(बीएचके|आरके)', name_mr)
    kind = 'BHK' if m.group(2) == 'बीएचके' else 'RK'
    return [f'{n} {kind}' for n in m.group(1).split('/')]


def split_links(cell):
    """'Label|https://..., https://...' -> [{'label':..., 'url':...}, ...]"""
    out = []
    for part in filter(None, (p.strip() for p in cell.split(','))):
        label, _, url = part.rpartition('|')
        out.append({'label': label or url, 'url': url})
    return out


def rera_fields(value):
    if value and re.fullmatch(r'P[A-Z0-9]{9,}', value):
        return value, None
    notes = {'PartOcRecevied': 'Part OC received', 'OCReceived': 'OC received', '-': 'Not listed in the ad'}
    return None, notes.get(value, value)


def main(lottery_id):
    raw = json.loads((DATA / f'raw-{lottery_id}.json').read_text())
    extras = {r['code']: r for r in csv.DictReader((DATA / f'extras-{lottery_id}.csv').open())}
    lottery = json.loads((DATA / f'lottery-{lottery_id}.json').read_text())

    schemes = []
    for r in raw:
        x = extras[r['code']]
        if x['name_mr'] != r['name_mr']:
            raise SystemExit(f"{r['code']}: name in extras CSV doesn't match the PDF row")
        rera, rera_note = rera_fields(r['rera'])
        schemes.append({
            'id': slug(r['code']),
            'sr': r['sr'],
            'code': r['code'],
            'round': r['round'],
            'section': r['section'],
            'project': x['project_en'],
            'locality': x['locality_en'],
            'locality_mr': x['locality_mr'],
            'name_mr': r['name_mr'],
            'types': unit_types(r['name_mr']),
            'ews_in_name': 'ईडब्ल्यूएस' in r['name_mr'] or 'ईडब्ल्युएस' in r['name_mr'],
            'price': [r['price_min'], r['price_max']],
            'carpet_sqm': r['carpet_sqm'],
            'carpet_sqft': [round(v * SQFT_PER_SQM) for v in r['carpet_sqm']],
            'builtup_sqm': r['builtup_sqm'],
            'units': r['total_units'],
            'reserved': r['reserved'],
            'rera': rera,
            'rera_note': rera_note,
            'youtube': [u.strip() for u in x['youtube'].split(',') if u.strip()],
            'links': split_links(x['links']),
            'pdf_page': r['pdf_page'],
            'flags': r['flags'],
        })

    ids = [s['id'] for s in schemes]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        raise SystemExit(f'duplicate ids: {dupes}')

    out = {**lottery, 'schemes': schemes}
    path = DATA / f'{lottery_id}.json'
    path.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    units = sum(s['units'] for s in schemes)
    print(f'{len(schemes)} schemes, {units} units -> {path.relative_to(DATA.parent)}')
    if units != lottery['total_units']:
        raise SystemExit(f"unit total {units} != advertised {lottery['total_units']}")


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'pune-2026-09')
