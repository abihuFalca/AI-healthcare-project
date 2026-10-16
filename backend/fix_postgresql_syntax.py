#!/usr/bin/env python3
"""
Automated PostgreSQL syntax fix script.
Converts SQLite placeholders (?) to PostgreSQL placeholders (%s),
BOOLEAN integers to BOOLEAN literals, and cursor.lastrowid to RETURNING id.
"""

import os
import re

def fix_file(filepath):
    """Fix a single Python file."""
    print(f"Processing {filepath}...")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Fix 1: Replace ? placeholders with %s in SQL queries
    # This regex finds SQL strings and replaces ? with %s
    content = re.sub(r'(\bWHERE\b[^"\']*?)\?', r'\1%s', content)
    content = re.sub(r'(\bVALUES\s*\([^)]*?)\?', lambda m: m.group(1).replace('?', '%s'), content)
    content = re.sub(r'(\bSET\b[^"\']*?)\?', r'\1%s', content)
    content = re.sub(r'(\bAND\b[^"\']*?)\?', r'\1%s', content)
    content = re.sub(r'(\bOR\b[^"\']*?)\?', r'\1%s', content)
    content = re.sub(r'(\bLIMIT\s+)\?', r'\1%s', content)
    content = re.sub(r'(\bIN\s*\([^)]*?)\?', r'\1%s', content)
    content = re.sub(r'(\bLIKE\s+)\?', r'\1%s', content)
    content = re.sub(r'(=\s*)\?', r'\1%s', content)
    content = re.sub(r'(\bON\b[^"\']*?)\?', r'\1%s', content)
    
    # Fix 2: Replace cursor.lastrowid with RETURNING id pattern
    content = re.sub(
        r'(\)\s*"""\s*,\s*\([^)]+\)\s*\)\s*)\n(\s*)([a-z_]+)\s*=\s*cursor\.lastrowid',
        r' RETURNING id\1\n\2\3 = cursor.fetchone()[0]',
        content
    )
    
    # Fix 3: Replace integer BOOLEAN values with TRUE/FALSE in INSERT/UPDATE
    content = re.sub(r"(is_read['\"]?\s*,\s*)'?0'?", r"\1FALSE", content)
    content = re.sub(r"(is_read['\"]?\s*,\s*)'?1'?", r"\1TRUE", content)
    content = re.sub(r"(consent_accepted['\"]?\s*,\s*)'?1'?", r"\1TRUE", content)
    content = re.sub(r"(consent_accepted['\"]?\s*=\s*)'?1'?", r"\1TRUE", content)
    content = re.sub(r"(safety_rule_triggered\s*=\s*)'?1'?", r"\1TRUE", content)
    content = re.sub(r"(safety_rule_triggered\s*=\s*)'?0'?", r"\1FALSE", content)
    
    # Fix 4: Replace fields.append(f"{k} = ?") with %s
    content = content.replace('fields.append(f"{k} = ?")', 'fields.append(f"{k} = %s")')
    
    # Fix 5: Update comment about SQLite
    content = content.replace('# 7. Persistence in SQLite DB', '# 7. Persistence in PostgreSQL DB')
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✓ Fixed {filepath}")
        return True
    else:
        print(f"  - No changes needed for {filepath}")
        return False

def main():
    route_files = [
        'routes/auth_routes.py',
        'routes/assessment_routes.py',
        'routes/patient_routes.py',
        'routes/doctor_routes.py',
        'routes/admin_routes.py',
        'routes/notification_routes.py',
        'routes/ai_routes.py',
    ]
    
    backend_dir = os.path.dirname(__file__)
    fixed_count = 0
    
    for route in route_files:
        filepath = os.path.join(backend_dir, route)
        if os.path.exists(filepath):
            if fix_file(filepath):
                fixed_count += 1
        else:
            print(f"  ✗ File not found: {filepath}")
    
    print(f"\n=== Fixed {fixed_count} files ===")

if __name__ == '__main__':
    main()
