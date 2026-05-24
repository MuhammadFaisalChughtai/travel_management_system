import re

with open('src/index.ts', 'r') as f:
    content = f.read()

pattern = re.compile(r"(    if \(!req\.isPlatformAdmin && booking\.tenantId !== tenantIdNumeric\) \{\s*return res\.status\(403\)\.json\(\{.*?\}\);\s*\})")

replacement = r"\1\n\n    if (booking.isLocked && req.userRole === Role.AGENT) {\n      return res.status(403).json({ error: 'Forbidden', message: 'This booking is locked.' });\n    }"

new_content = pattern.sub(replacement, content)

with open('src/index.ts', 'w') as f:
    f.write(new_content)

print("Patched index.ts successfully.")
