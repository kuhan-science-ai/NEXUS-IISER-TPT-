import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:\NEXUS-a new breakthrough\figma frontend and ui\pdf_analysis.json', 'r', encoding='utf-8') as f:
    pages = json.load(f)

sidebar_words = {
    'N', 'NEXUS', 'IISER Tirupati · Students only', 'WORKSPACE', 'Dashboard', 
    'Academic Repository', 'My Courses', 'Campus Hub', 'Discussions', 
    'Direct Messages', 'LaTeX Studio', 'AI Research Loop', 'Settings', 
    'Profile', 'COMMUNITY', 'TOOLS', 'STUDENT', 'Log out', 'Search campus', 
    'Search resources, people, conversations… ⌘ K', 'AR', 'Ananya Rao',
    'BS-MS 2023 · Physics Major', 'BS–MS 2023 · Physics Major'
}

for p in pages:
    lines = [l.strip() for l in p['full_text'].split('\n') if l.strip()]
    distinct = [l for l in lines if l not in sidebar_words and not l.startswith('Search resources')]
    title = distinct[0] if distinct else "NO CONTENT"
    subtitle = distinct[1] if len(distinct) > 1 else ""
    third = distinct[2] if len(distinct) > 2 else ""
    print(f"Page {p['page']:02d}: [{title}] | [{subtitle}] | [{third}]")
