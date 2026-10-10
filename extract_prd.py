import zipfile
import xml.etree.ElementTree as ET

def extract_docx(filename, output_filename):
    with zipfile.ZipFile(filename) as doc:
        xml_content = doc.read('word/document.xml')
    
    root = ET.fromstring(xml_content)
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    
    lines = []
    # Iterate over elements: paragraphs and table rows
    for elem in root.iter():
        tag = elem.tag.split('}')[-1]
        if tag == 'p':
            texts = [t.text for t in elem.findall('.//w:t', ns) if t.text]
            if texts:
                lines.append(''.join(texts))
        elif tag == 'tr':
            row = []
            for cell in elem.findall('.//w:tc', ns):
                cell_text = ''.join([t.text for t in cell.findall('.//w:t', ns) if t.text])
                row.append(cell_text.strip())
            if any(row):
                lines.append(' | '.join(row))
                
    with open(output_filename, 'w', encoding='utf-8') as f:
        f.write('\n\n'.join(lines))
    print(f"Extracted to {output_filename}")

if __name__ == '__main__':
    extract_docx('PRD_AI_Early_Risk_Detection_Triage_System.docx', 'prd_content.txt')
