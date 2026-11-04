import base64
import os

with open('quiz_card_cleaned.png', 'rb') as f:
    b64_png = base64.b64encode(f.read()).decode('utf-8')

with open('quiz_card_cleaned.jpg', 'rb') as f:
    b64_jpg = base64.b64encode(f.read()).decode('utf-8')

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Download Quiz Card Asset</title>
<style>
  body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #0f172a;
    color: #f8fafc;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    margin: 0;
    padding: 24px;
    box-sizing: border-box;
  }}
  .card {{
    background: #1e293b;
    border-radius: 16px;
    padding: 28px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
    max-width: 800px;
    width: 100%;
    text-align: center;
    border: 1px solid #334155;
  }}
  h1 {{
    font-size: 22px;
    font-weight: 700;
    margin-top: 0;
    margin-bottom: 8px;
    color: #f1f5f9;
  }}
  p.subtitle {{
    font-size: 14px;
    color: #94a3b8;
    margin-top: 0;
    margin-bottom: 20px;
  }}
  .img-wrapper {{
    background: #0f172a;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid #334155;
    margin-bottom: 24px;
  }}
  img {{
    width: 100%;
    height: auto;
    display: block;
    border-radius: 8px;
  }}
  .btn-group {{
    display: flex;
    gap: 16px;
    justify-content: center;
    flex-wrap: wrap;
  }}
  .btn {{
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 28px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
    cursor: pointer;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
  }}
  .btn-primary {{
    background: #10b981;
    color: #ffffff;
  }}
  .btn-primary:hover {{
    background: #059669;
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.4);
  }}
  .btn-secondary {{
    background: #3b82f6;
    color: #ffffff;
  }}
  .btn-secondary:hover {{
    background: #2563eb;
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.4);
  }}
  .meta {{
    margin-top: 20px;
    font-size: 13px;
    color: #94a3b8;
    background: #0f172a;
    padding: 10px 16px;
    border-radius: 8px;
    display: inline-block;
  }}
</style>
</head>
<body>
<div class="card">
  <h1>Cleaned Quiz Card Asset</h1>
  <p class="subtitle">Watermarks removed &bull; 15px equalized borders &bull; Body text cleared</p>
  
  <div class="img-wrapper">
    <img src="data:image/png;base64,{b64_png}" alt="Cleaned Quiz Card" />
  </div>

  <div class="btn-group">
    <a href="data:image/png;base64,{b64_png}" download="quiz_card_cleaned.png" class="btn btn-primary">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Download PNG (Lossless)
    </a>
    <a href="data:image/jpeg;base64,{b64_jpg}" download="quiz_card_cleaned.jpg" class="btn btn-secondary">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Download JPG (Standard)
    </a>
  </div>

  <div class="meta">
    📐 Dimensions: <strong>924 &times; 520 px</strong> &nbsp;|&nbsp; 💾 Direct file copied to: <code>Downloads/quiz_card_cleaned.png</code>
  </div>
</div>
</body>
</html>
"""

with open('download_quiz_card.html', 'w', encoding='utf-8') as f:
    f.write(html)

with open(r'C:/Users/kuhan/.gemini/antigravity/brain/51b17122-f69d-4e01-8ba2-1c4784dbd275/download_quiz_card.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('Generated download_quiz_card.html successfully!')
