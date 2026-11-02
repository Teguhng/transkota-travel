path = r'C:\Users\kikid\.gemini\config\skills\hallmark\scripts\theme.mjs'
with open(path, 'r', encoding='utf-8') as f:
    s = f.read()

s = s.replace('const m = /^---\\n([\\s\\S]*?)\\n---/.exec(src);', 'const m = /^---\\r?\\n([\\s\\S]*?)\\r?\\n---/.exec(src);')
s = s.replace("for (const line of m[1].split('\\n'))", "for (const line of m[1].split(/\\r?\\n/))")
s = s.replace('const m = /```css\\s*\\n:root\\s*\\{([\\s\\S]*?)\\n\\}\\s*\\n```/.exec(src);', 'const m = /```css\\s*\\r?\\n:root\\s*\\{([\\s\\S]*?)\\r?\\n\\}\\s*\\r?\\n```/.exec(src);')

with open(path, 'w', encoding='utf-8') as f:
    f.write(s)
print('Successfully patched theme.mjs for Windows CRLF')

