# Ghar Sodat Pune

An unofficial, searchable list of every home in the MHADA Pune Board lottery
(September 2026, 4,462 homes, 168 schemes). The official ad is a hard-to-read Marathi
PDF; this site lets people filter it by locality, home type, budget and reserved category.

It is a plain static site (HTML + CSS + JS, no build step), so it can be hosted on GitHub Pages for free.

## Run it locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

(Opening `index.html` directly from disk won't work, because the page loads `data/*.json` with `fetch`.)

## Publish on GitHub Pages

1. Create a public repository on your personal GitHub account, e.g. `ghar-sodat`.
2. Push this folder to it:
   ```bash
   git init && git add . && git commit -m "First version"
   git branch -M main
   git remote add origin https://github.com/<your-username>/ghar-sodat.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   branch `main`, folder `/ (root)`. Save.
4. After a minute the site is live at `https://<your-username>.github.io/ghar-sodat/`.

Every later `git push` updates the site automatically.

## Add YouTube videos and links

Edit `data/extras-pune-2026-09.csv` (Excel / Google Sheets work fine, but save it as CSV with UTF-8 encoding):

| column       | what to put                                                                    |
|--------------|--------------------------------------------------------------------------------|
| `project_en` | English project name shown on the site                                         |
| `locality_en`| Locality used for the filter (keep spellings consistent)                       |
| `youtube`    | One or more YouTube URLs, comma-separated. They're embedded on the scheme page |
| `links`      | Extra links as `Label|https://…`, comma-separated                              |

Don't change the `code` or `name_mr` columns. They tie each row to the PDF.
Then rebuild the data file and push:

```bash
python3 scripts/build_data.py pune-2026-09
```

## How the data was made

```
source/pune-2026-09.pdf            official ad (Shree-Lipi Marathi fonts)
  └─ scripts/extract.py            → data/raw-pune-2026-09.json   (table → JSON, checked)
data/extras-pune-2026-09.csv       hand-edited English names, YouTube, links
data/lottery-pune-2026-09.json     dates, income limits, categories, helplines
  └─ scripts/build_data.py         → data/pune-2026-09.json        (what the site loads)
```

- `scripts/shree2uni.py` converts the legacy Shree-Lipi font text to Unicode Marathi.
- `extract.py` reads table columns from the PDF's ruling lines and checks every row: the
  15 category counts must add up to the row total, and all rows must add up to 4,462.
- Nine rows (Sr. 115, 116, 118, 121, 123, 126, 127, 129, 130) don't add up **in the ad
  itself** (checked against the page image). They are kept as printed and flagged on the site.
- The ad doesn't say which schemes are EWS and which are LIG, so the site has no income-group
  filter. If the official information booklet lists it, add an `income_group` column.

To re-run the extraction (needs `pip install -r requirements.txt`):

```bash
python3 scripts/extract.py source/pune-2026-09.pdf data/raw-pune-2026-09.json
python3 scripts/build_data.py pune-2026-09
```

## Next lottery

Drop the new PDF in `source/`, run `extract.py`, create a new `extras-<id>.csv` and
`lottery-<id>.json`, build, and point `DATA_URL` in `assets/common.js` at the new file.
