/**
 * TOON (Token-Oriented Object Notation) Support for ZeroHelper
 * Optimized for LLM token efficiency and now supports Native Storage.
 * API matches standard JSON object (stringify/parse).
 */

export function stringify(data: any, indent: number = 0): string {
  const space = ' '.repeat(indent);
  if (data === null) return 'null';
  if (typeof data === 'boolean' || typeof data === 'number') return String(data);

  if (typeof data === 'string') {
    const hasSpecial = /[,\n: ]/.test(data);
    if (hasSpecial) return '"' + data.replace(/"/g, '\\"') + '"';
    return data;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return '[]';
    const first = data[0];

    // ✅ FIX: Object array'leri için HER ZAMAN tabular format kullan (1+ eleman için)
    if (typeof first === 'object' && first !== null && !Array.isArray(first)) {
      const keys = Object.keys(first);
      const isUniform = data.every(item =>
        item && typeof item === 'object' &&
        Object.keys(item).length === keys.length &&
        Object.keys(item).every(k => keys.includes(k))
      );

      if (isUniform) {
        const header = '[' + data.length + ']{' + keys.join(',') + '}:';
        const rows = data.map(item => {
          const rowValues = keys.map(k => {
            const val = item[k];
            if (val === null) return 'null';
            if (Array.isArray(val)) {
              return '"' + JSON.stringify(val) + '"';
            }
            const valStr = String(val);
            const hasSpecialRow = /[,\n: ]/.test(valStr);
            return (typeof val === 'string' && hasSpecialRow) ? '"' + valStr.replace(/"/g, '\\"') + '"' : valStr;
          }).join(',');
          return space + '  ' + rowValues;
        });
        return header + '\n' + rows.join('\n');
      }
    }

    // Non-object array'ler için inline format
    return '[' + data.length + ']: ' + data.map(v => stringify(v)).join(',');
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data);
    if (entries.length === 0) return '{}';
    return entries.map(([key, value]) => {
      const valStr = stringify(value, indent + 2);
      const isComplex = typeof value === 'object' && value !== null && !Array.isArray(value);
      const separator = isComplex ? '\n' : ' ';
      return space + key + ':' + separator + valStr;
    }).join('\n');
  }
  return '';
}

/**
 * Advanced TOON Parser with Indentation Support for Deep Nesting
 */
export function parse(toonStr: string): any {
  if (!toonStr || toonStr.trim() === '') return {};
  const lines = toonStr.split('\n');

  function parseValue(val: string): any {
    const trimmed = val.trim();

    // Tırnak içindeki string
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      const unquoted = trimmed.slice(1, -1).replace(/\\"/g, '"');
      // JSON array string'i kontrol et
      try {
        if (unquoted.startsWith('[') && unquoted.endsWith(']')) {
          return JSON.parse(unquoted);
        }
      } catch (e) {
        // JSON değilse normal string döndür
      }
      return unquoted;
    }

    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    if (trimmed === '[]') return [];
    if (trimmed === '{}') return {};
    if (!isNaN(Number(trimmed)) && trimmed !== '') return Number(trimmed);
    return trimmed;
  }

  function getIndent(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  // CSV row parser with proper quote handling
  function parseCSVRow(row: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];

      if (char === '"' && (i === 0 || row[i - 1] !== '\\')) {
        inQuotes = !inQuotes;
        current += char;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      result.push(current.trim());
    }

    return result;
  }

  function processLines(startIndex: number, currentIndent: number): [any, number] {
    const result: any = {};
    let i = startIndex;

    while (i < lines.length) {
      const line = lines[i];
      const indent = getIndent(line);
      const content = line.trim();

      // Boş satırları atla
      if (content === '') {
        i++;
        continue;
      }

      if (indent < currentIndent) break;

      // Standard Key-Value match
      const kvMatch = content.match(/^([^:]+):\s*(.*)$/);
      if (kvMatch) {
        const key = kvMatch[1].trim();
        const valuePart = kvMatch[2].trim();

        // ✅ FIX: Tabular array header - Format: [count]{field1,field2,...}:
        const tabularMatch = valuePart.match(/^\[(\d+)\]\{([^}]+)\}:$/);
        if (tabularMatch) {
          const expectedRowCount = parseInt(tabularMatch[1]);
          const fields = tabularMatch[2].split(',').map(f => f.trim());
          const rows: any[] = [];

          let rowsRead = 0;
          i++; // Header'dan sonraki satıra geç

          while (i < lines.length && rowsRead < expectedRowCount) {
            const rowLine = lines[i];
            const rowIndent = getIndent(rowLine);
            const rowContent = rowLine.trim();

            // Boş satırları atla
            if (rowContent === '') {
              i++;
              continue;
            }

            // Indent kontrolü - child satır olmalı
            if (rowIndent <= currentIndent) {
              break;
            }

            // CSV parsing with quote support
            const values = parseCSVRow(rowContent);
            const row: any = {};

            fields.forEach((f, idx) => {
              row[f] = idx < values.length ? parseValue(values[idx]) : null;
            });

            rows.push(row);
            rowsRead++;
            i++;
          }

          result[key] = rows;
          continue;
        }

        // ✅ FIX: Inline array - [count]: value1,value2,...
        const inlineArrayMatch = valuePart.match(/^\[(\d+)\]:\s*(.+)$/);
        if (inlineArrayMatch) {
          const count = parseInt(inlineArrayMatch[1]);
          const valueStr = inlineArrayMatch[2].trim();

          // Normal değer array'i (virgülle ayrılmış basit değerler)
          const values = parseCSVRow(valueStr);
          result[key] = values.map(v => parseValue(v));
          i++;
          continue;
        }

        // Nested object check
        if (valuePart === '' && i + 1 < lines.length && getIndent(lines[i + 1]) > indent) {
          const [nestedObj, nextIndex] = processLines(i + 1, getIndent(lines[i + 1]));
          result[key] = nestedObj;
          i = nextIndex;
          continue;
        }

        // Simple value
        result[key] = parseValue(valuePart);
        i++;
        continue;
      }

      i++;
    }
    return [result, i];
  }

  const [finalResult] = processLines(0, 0);
  return finalResult;
}
