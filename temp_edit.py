import json
import os

file_path = r"c:\projects\next-shadcn-dashboard-starter\Система лояльности с подпиской (шаблон) (3).json"
with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

print([n['type'] for n in data['nodes']])
print([n['id'] for n in data['nodes'] if 'database' in n['type']])
