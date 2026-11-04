import json

with open(r'C:\Users\kuhan\.gemini\antigravity\brain\db236c4d-a6af-4daf-a632-f23b180e0215\.system_generated\logs\transcript.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        obj = json.loads(line)
        if obj.get('source') == 'USER_EXPLICIT':
            step = obj.get('step_index')
            content = obj.get('content', '')
            print(f"Step {step}:\n{content}\n" + "-"*60)
