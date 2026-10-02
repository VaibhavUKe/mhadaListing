"""
Shree-Lipi (SHREE-DEV7-0713/0714/0715/1003/1076) -> Unicode Devanagari converter.

These legacy Marathi fonts put Devanagari glyphs on ASCII / Latin-1 code points,
so a PDF's text layer looks like "gm‘m{OH$ J¥h{Z‘m©U" instead of
"सामाजिक गृहनिर्माण". Visual order also differs from Unicode logical order:
  * the short-i matra (ि) is typed BEFORE its consonant cluster  -> move after
  * the reph (र्) is typed AFTER its syllable                     -> move before
"""
import re

# ---- token tables --------------------------------------------------------
FULL = {  # full consonants and ready-made conjuncts
    'H': 'क', 'I': 'ख', 'J': 'ग', 'K': 'घ', 'M': 'च', 'N': 'छ', 'O': 'ज',
    'P': 'झ', 'Q': 'ट', 'R': 'ठ', 'S': 'ड', 'T': 'ढ', 'U': 'ण', 'V': 'त',
    'W': 'थ', 'X': 'द', 'Y': 'ध', 'Z': 'न', 'n': 'प', '\\': 'फ', '’': 'फ',
    '~': 'ब', '^': 'भ', '_': 'म', '‘': 'म', '`': 'य', '¶': 'य', 'a': 'र',
    'b': 'ल', 'd': 'व', 'e': 'श', 'f': 'ष', 'g': 'स', 'h': 'ह', 'i': 'ळ',
    'j': 'क्ष', 'k': 'ज्ञ', 'l': 'श्र', 'à': 'प्र', 'Ð': 'द्र', 'Ì': 'त्र',
    'Î': 'त्त', 'Õ': 'द्ध', 'Ô': 'द्द', 'Ú': 'द्य', 'Û': 'द्व', 'º': 'क्त',
    '¸': 'क्क', '¹': 'क्व', '¾': 'ग्न', 'á': 'प्त', 'ø': 'ह्य', 'Þ': 'न्न',
    'ï': 'ष्ट', 'ü': 'श्च',
}
HALF = {  # half forms (consonant + virama)
    'Ë': 'त्', 'Ê': 'ण्', 'À': 'च्', 'Á': 'ज्', 'Ý': 'न्', 'ß': 'प्',
    'ã': 'ब्', 'å': 'म्', 'è': 'ऱ्', 'ë': 'ल्', 'ì': 'व्', 'í': 'श्',
    'î': 'ष्', 'ñ': 'स्', 'ù': 'ळ्', 'Š': 'क्', '³': 'क्', '»': 'ख्',
    'Ü': 'ध्', 'Í': 'त्र्', 'Â': 'झ्',
}
ATTACH = {'«': '्र', '´': '्र', 'ç': '्य'}          # sub-joined forms
CONS_WITH_MATRA = {'é': ('र', 'ु'), 'ê': ('र', 'ू'), 'Ñ': ('द', 'ृ')}
VOWEL = {'A': 'अ', 'B': 'इ', 'C': 'उ', 'D': 'ऊ', 'E': 'ए', '\uE000': 'ई'}
MATRA = {
    'm': 'ा', 'r': 'ी', 's': 'ी', 'w': 'ु', 'y': 'ू', 'þ': 'ु', 'ÿ': 'ू',
    'o': 'े', '¡': 'ै', '¥': 'ृ', '§': 'ं', '±': 'ँ', '°': 'ॅ', '|': 'ें',
    't': 'ीं', '²': '्',
}
IPRE = {'{': 'ि', 'p': 'ि', '[': 'ि', 'q': 'िं'}   # typed before consonant
REPH = {'©': '', 'u': 'ी', '}': 'े', 'ª': 'ं'}       # typed after syllable
DROP = {'$', '>'}                                   # glyph-halves, no meaning

# vowel-sign compositions produced by legacy two-glyph spellings
COMPOSE = [
    ('अाॅ', 'ऑ'), ('आॅ', 'ऑ'), ('अॅ', 'ॲ'), ('अा', 'आ'), ('आे', 'ओ'),
    ('आै', 'औ'), ('आें', 'ओं'), ('एे', 'ऐ'), ('ाें', 'ों'), ('ाे', 'ो'),
    ('ाै', 'ौ'), ('ाॅ', 'ॉ'), ('ेे', 'े'),
]


def convert(s: str) -> str:
    if not s:
        return s
    s = ''.join(ch for ch in s if ch not in DROP)
    s = s.replace('B©', '\uE000')                  # इ + reph-glyph = ई

    # tokenise ------------------------------------------------------------
    toks = []  # (kind, text)
    for ch in s:
        if ch in FULL:
            toks.append(('C', FULL[ch]))
        elif ch in HALF:
            toks.append(('H', HALF[ch]))
        elif ch in ATTACH:
            toks.append(('A', ATTACH[ch]))
        elif ch in CONS_WITH_MATRA:
            c, m = CONS_WITH_MATRA[ch]
            toks.append(('C', c)); toks.append(('M', m))
        elif ch in VOWEL:
            toks.append(('V', VOWEL[ch]))
        elif ch in MATRA:
            toks.append(('M', MATRA[ch]))
        elif ch in IPRE:
            toks.append(('I', IPRE[ch]))
        elif ch in REPH:
            toks.append(('R', REPH[ch]))
        else:
            toks.append(('O', ch))

    # pass 1: move pre-base i-matra after its consonant cluster -----------
    out = []  # list of [kind, text]
    i = 0
    while i < len(toks):
        k, t = toks[i]
        if k == 'I':
            j = i + 1
            cluster = []
            while j < len(toks) and toks[j][0] == 'H':
                cluster.append(toks[j]); j += 1
            if j < len(toks) and toks[j][0] == 'C':
                cluster.append(toks[j]); j += 1
                while j < len(toks) and toks[j][0] == 'A':
                    cluster.append(toks[j]); j += 1
                out.extend([list(x) for x in cluster])
                out.append(['M', t])
                i = j
                continue
            out.append(['M', t]); i += 1
            continue
        out.append([k, t]); i += 1

    # pass 2: move reph before its syllable --------------------------------
    res = []
    for k, t in out:
        if k != 'R':
            res.append([k, t]); continue
        # walk back over matras, then the cluster (C + attachments + halves)
        p = len(res) - 1
        while p >= 0 and res[p][0] == 'M':
            p -= 1
        if p >= 0 and res[p][0] in ('C', 'A'):
            while p >= 0 and res[p][0] == 'A':
                p -= 1
            # p now at the C
            while p - 1 >= 0 and res[p - 1][0] == 'H':
                p -= 1
            res.insert(p, ['H', 'र्'])
        else:  # nothing to attach to: keep a bare reph
            res.append(['H', 'र्'])
        if t:
            res.append(['M', t])

    text = ''.join(t for _, t in res)
    for a, b in COMPOSE:
        text = text.replace(a, b)
    return text


if __name__ == '__main__':
    tests = {
        'gm‘m{OH$ J¥h{Z‘m©U ¶moOZm': 'सामाजिक गृहनिर्माण योजना',
        'nwUo ‘hmZJanm{bH$m hÔrVrb': 'पुणे महानगरपालिका हद्दीतील',
        '_hmamï´> emgZ': 'महाराष्ट्र शासन',
        'Am°ZbmB©Z gmoS>V': 'ऑनलाईन सोडत',
        'pñdH¥$VrMo': 'स्विकृतीचे',
        '{~pëS>§J': 'बिल्डिंग',
        'dm{f©H$': 'वार्षिक',
        'n¶ªV': 'पर्यंत',
        'df}nyU©': 'वर्षेपूर्ण',
        '`mnydu': 'यापूर्वी',
        '_m_wS>u': 'मामुर्डी',
        'qnnio gm¡XmJa': 'पिंपळे सौदागर',
        '{dH«$sgmR>r': 'विक्रीसाठी',
        'Zm|XUr': 'नोंदणी',
        '~moèhmSo>dmS>r': 'बोऱ्हाडेवाडी',
        'ApëQ>Qçy>S>': 'अल्टिट्यूड',
        'gßQ>|~a': 'सप्टेंबर',
        'A~m}': 'अर्बो',
        'Hw$Qw>§~r`': 'कुटुंबीय',
        '{H«$ñQ>b': 'क्रिस्टल',
    }
    bad = 0
    for k, v in tests.items():
        got = convert(k)
        flag = 'OK ' if got == v else 'XX '
        if got != v:
            bad += 1
        print(flag, k, '->', got, '' if got == v else f'(expected {v})')
    print('failures:', bad)
