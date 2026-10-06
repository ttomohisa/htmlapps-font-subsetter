"""Deterministic regression fixtures. Original rectangle glyphs; no user or third-party fonts."""
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._c_m_a_p import CmapSubtable
from pathlib import Path
import hashlib, json, struct

root = Path(__file__).resolve().parent
def glyph():
    p = TTGlyphPen(None)
    p.moveTo((50, 0)); p.lineTo((550, 0)); p.lineTo((550, 700)); p.lineTo((50, 700)); p.closePath()
    return p.glyph()

records = []
for suffix, zero_glyph in [('zero', '.notdef'), ('nonzero', 'box')]:
    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder(['.notdef', 'box', 'box2'])
    fb.setupCharacterMap({0x41: 'box'})
    fb.setupGlyf({name: glyph() for name in ['.notdef', 'box', 'box2']})
    fb.setupHorizontalMetrics({name: (600, 50) for name in ['.notdef', 'box', 'box2']})
    fb.setupHorizontalHeader(ascent=800, descent=-200)
    fb.setupNameTable({'familyName': 'Synthetic Coverage Probe', 'styleName': 'Regular', 'uniqueFontIdentifier': 'CoverageProbe-'+suffix, 'fullName': 'Synthetic Coverage Probe '+suffix, 'psName': 'CoverageProbe-'+suffix})
    fb.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200, fsType=0)
    fb.setupPost(); fb.setupMaxp()
    cmap = CmapSubtable.newSubtable(12)
    cmap.platformID=3; cmap.platEncID=10; cmap.language=0
    cmap.cmap={0x41:'box', 0x1F600:zero_glyph, 0x1F601:'box', 0x1F602:'box2'}
    fb.font['cmap'].tables=[cmap]
    fb.font['head'].created=fb.font['head'].modified=2082844800
    fb.font.recalcTimestamp=False
    path = root / ('synthetic-cmap12-'+suffix+'.ttf')
    fb.save(path)
    loaded=TTFont(path, recalcTimestamp=False)
    data=path.read_bytes(); entry=loaded.reader.tables['cmap']; table=data[entry.offset:entry.offset+entry.length]
    offset=struct.unpack_from('>I',table,8)[0]
    count=struct.unpack_from('>I',table,offset+12)[0]
    groups=[struct.unpack_from('>III',table,offset+16+12*i) for i in range(count)]
    records.append({'path':path.name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'glyphOrder':loaded.getGlyphOrder(),'cmapFormat':12,'groups':groups,'fontToolsBestCmap':{str(k):v for k,v in loaded.getBestCmap().items()}})
print(json.dumps(records,ensure_ascii=False,indent=2))
