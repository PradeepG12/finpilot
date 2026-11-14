import zipfile
import xml.sax.saxutils

# Read Markdown text
with open(r'c:\Users\DELL\FinPilot_Full_Stack_Coding_Assignment\finpilot\docs\architecture\ARCHITECTURE.md', 'r', encoding='utf-8') as f:
    lines = f.readlines()

body_xml = []
for line in lines:
    line_clean = line.strip()
    if not line_clean:
        continue
    escaped = xml.sax.saxutils.escape(line_clean)
    if line_clean.startswith('# '):
        p = f'<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>{escaped[2:]}</w:t></w:r></w:p>'
    elif line_clean.startswith('## '):
        p = f'<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>{escaped[3:]}</w:t></w:r></w:p>'
    elif line_clean.startswith('### '):
        p = f'<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>{escaped[4:]}</w:t></w:r></w:p>'
    elif line_clean.startswith('- '):
        p = f'<w:p><w:r><w:t>• {escaped[2:]}</w:t></w:r></w:p>'
    else:
        p = f'<w:p><w:r><w:t>{escaped}</w:t></w:r></w:p>'
    body_xml.append(p)

doc_xml = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    '<w:body>' + ''.join(body_xml) + '<w:sectPr/></w:body></w:document>'
)

content_types = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    '</Types>'
)

rels = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    '</Relationships>'
)

out_path = r'c:\Users\DELL\FinPilot_Full_Stack_Coding_Assignment\finpilot\docs\architecture\ARCHITECTURE.docx'
with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml', content_types)
    z.writestr('_rels/.rels', rels)
    z.writestr('word/document.xml', doc_xml)

print('ARCHITECTURE.docx generated successfully!')
