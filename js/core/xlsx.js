const encoder = new TextEncoder();
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function header(signature, fields) {
  const view = new DataView(new ArrayBuffer(4 + fields.reduce((sum, [size]) => sum + size, 0)));
  view.setUint32(0, signature, true);
  let offset = 4;
  for (const [size, value] of fields) {
    if (size === 2) view.setUint16(offset, value, true);
    else view.setUint32(offset, value, true);
    offset += size;
  }
  return new Uint8Array(view.buffer);
}

function zip(files) {
  const parts = [];
  const directory = [];
  let offset = 0;
  for (const [path, content] of files) {
    const name = encoder.encode(path);
    const data = encoder.encode(content);
    const common = [[2, 20], [2, 0x0800], [2, 0], [2, 0], [2, 0x21], [4, crc32(data)], [4, data.length], [4, data.length], [2, name.length], [2, 0]];
    const local = header(0x04034b50, common);
    directory.push(header(0x02014b50, [[2, 20], ...common, [2, 0], [2, 0], [2, 0], [4, 0], [4, offset]]), name);
    parts.push(local, name, data);
    offset += local.length + name.length + data.length;
  }
  const size = directory.reduce((sum, part) => sum + part.length, 0);
  const end = header(0x06054b50, [[2, 0], [2, 0], [2, files.length], [2, files.length], [4, size], [4, offset], [2, 0]]);
  return new Blob([...parts, ...directory, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function escape(text) {
  return String(text)
    .replace(/[^\x09\x0A\x0D\x20-퟿-�]/g, '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function column(index) {
  let name = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  return name;
}

function sheetXml(rows) {
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      if (value == null || value === '') return '';
      const reference = `${column(columnIndex)}${rowIndex + 1}`;
      return typeof value === 'number'
        ? `<c r="${reference}"><v>${value}</v></c>`
        : `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escape(value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

export function buildWorkbook(sheets) {
  const relationships = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const packageRelationships = 'http://schemas.openxmlformats.org/package/2006/relationships';
  return zip([
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${
      sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${packageRelationships}"><Relationship Id="rId1" Type="${relationships}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${relationships}"><sheets>${
      sheets.map((sheet, index) => `<sheet name="${escape(sheet.name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${packageRelationships}">${
      sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="${relationships}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}</Relationships>`],
    ...sheets.map((sheet, index) => [`xl/worksheets/sheet${index + 1}.xml`, sheetXml(sheet.rows)]),
  ]);
}
