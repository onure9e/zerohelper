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
    const hasSpecial = new RegExp('[\,\n: ]').test(data);
    if (hasSpecial) return '"' + data.replace(/"/g, '\\"') + '"';
    return data;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return '[]';
    const first = data[0];
    if (typeof first === 'object' && first !== null && !Array.isArray(first)) {
      const keys = Object.keys(first);
      const isUniform = data.every(item =>
        item && typeof item === 'object' &&
        Object.keys(item).length === keys.length &&
        Object.keys(item).every(k => keys.includes(k))
      );

      if (isUniform && data.length > 1) {
        const header = '[' + data.length + ']{' + keys.join(',') + '}:';
        const rows = data.map(item => {
          const rowValues = keys.map(k => {
            const val = item[k];
            if (val === null) return 'null';
            const valStr = String(val);
            const hasSpecialRow = new RegExp('[\,\n: ]').test(valStr);
            return (typeof val === 'string' && hasSpecialRow) ? '"' + valStr + '"' : valStr;
          }).join(',');
          return space + '  ' + rowValues;
        });
        return header + '\n' + rows.join('\n');
      }
    }
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
  const lines = toonStr.split('\n').filter(l => l.trim() !== '' || l.startsWith(' '));

  function parseValue(val: string): any {
    const trimmed = val.trim();

    // Tırnak içindeki string
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1).replace(/\\"/g, '"');
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

  function processLines(startIndex: number, currentIndent: number): [any, number] {
    const result: any = {};
    let i = startIndex;

    while (i < lines.length) {
      const line = lines[i];
      const indent = getIndent(line);
      const content = line.trim();

      if (content === '') { i++; continue; }
      if (indent < currentIndent) break;

      // ✅ FIX: Standard Key-Value match FIRST
      const kvMatch = content.match(/^(\w+):\s*(.*)$/);
      if (kvMatch) {
        const key = kvMatch[1];
        const valuePart = kvMatch[2].trim();

        // ✅ FIX: Check if valuePart is a tabular array header
        // Format: [count]{field1,field2,...}:
        const tabularMatch = valuePart.match(/^\[(\d+)\]\{(.*)\}:$/);
        if (tabularMatch) {
          const rowCount = parseInt(tabularMatch[1]);
          const fields = tabularMatch[2].split(',').map(f => f.trim());
          const rows: any[] = [];

          for (let j = 0; j < rowCount; j++) {
            i++;
            if (i >= lines.length) break;

            const rowLine = lines[i].trim();
            if (!rowLine) { j--; continue; } // Boş satır atla

            // ✅ FIX: CSV parsing with quote support
            const values = parseCSVRow(rowLine);
            const row: any = {};
            fields.forEach((f, idx) => {
              row[f] = idx < values.length ? parseValue(values[idx]) : null;
            });
            rows.push(row);
          }

          result[key] = rows;
          i++;
          continue;
        }

        // ✅ Inline array: [count]: value1,value2,...
        const inlineArrayMatch = valuePart.match(/^\[(\d+)\]:\s*(.*)$/);
        if (inlineArrayMatch) {
          const values = parseCSVRow(inlineArrayMatch[2]);
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

  // ✅ CSV row parser with quote support
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

    if (current) {
      result.push(current.trim());
    }

    return result;
  }

  const [finalResult] = processLines(0, 0);
  return finalResult;
}
