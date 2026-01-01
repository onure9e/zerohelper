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
    const hasSpecial = new RegExp('[\,\n:]').test(data);
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
            const hasSpecialRow = new RegExp('[\,\n:]').test(valStr);
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

export function parse(toonStr: string): any {
  if (!toonStr || toonStr.trim() === '') return {};
  const lines = toonStr.split('\n').filter(l => l.trim() !== '');
  const result: any = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    const tabularMatch = line.match(/^(\w+)\[(\d+)\]\{(.*)\}:$/);
    if (tabularMatch) {
      const tableName = tabularMatch[1];
      const rowCount = parseInt(tabularMatch[2]);
      const fields = tabularMatch[3].split(',');
      const rows = [];
      for (let j = 0; j < rowCount; j++) {
        i++;
        if (!lines[i]) break;
        const values = lines[i].trim().split(',').map(v => {
            const trimmed = v.trim();
            if (trimmed === 'true') return true;
            if (trimmed === 'false') return false;
            if (trimmed === 'null') return null;
            if (!isNaN(Number(trimmed)) && trimmed !== '') return Number(trimmed);
            return trimmed.replace(/^"|"$/g, '');
        });
        const row: any = {};
        fields.forEach((f, idx) => row[f] = values[idx]);
        rows.push(row);
      }
      result[tableName] = rows;
    } else {
      const kvMatch = line.match(/^(\w+):\s*(.*)$/);
      if (kvMatch) {
        const key = kvMatch[1];
        const value = kvMatch[2];
        let parsedVal: any = value.trim();
        if (parsedVal === 'true') parsedVal = true;
        else if (parsedVal === 'false') parsedVal = false;
        else if (parsedVal === 'null') parsedVal = null;
        else if (!isNaN(Number(parsedVal)) && parsedVal !== '') parsedVal = Number(parsedVal);
        result[key] = parsedVal;
      }
    }
    i++;
  }
  return result;
}