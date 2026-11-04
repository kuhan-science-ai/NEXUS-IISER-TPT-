import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
from pypdf import PdfReader

reader = PdfReader(r'C:\NEXUS-a new breakthrough\figma frontend and ui\ui and ux.pdf')
pages_data = []
for i, page in enumerate(reader.pages):
    txt = page.extract_text() or ''
    lines = [l.strip() for l in txt.splitlines() if l.strip()]
    pages_data.append({
        'page': i + 1,
        'line_count': len(lines),
        'title': lines[0] if lines else '',
        'sample': lines[:8],
        'full_text': '\n'.join(lines)
    })

with open(r'C:\NEXUS-a new breakthrough\figma frontend and ui\pdf_analysis.json', 'w', encoding='utf-8') as f:
    json.dump(pages_data, f, indent=2, ensure_ascii=False)

for p in pages_data:
    print(f"Page {p['page']:02d} ({p['line_count']} lines): {' | '.join(p['sample'][:3])}")
