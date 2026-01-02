import { IDatabase } from './IDatabase';
import fs from 'fs';
const fsp = fs.promises;
import path from 'path';
import zlib from 'zlib';
import { ZPackConfig } from './types';

/**
 * ZPackDatabase: Low-level Binary Storage
 */
export class ZPackDatabase {
  public filePath: string;
  private fd: fs.promises.FileHandle | null = null;
  private fileSize: bigint = 0n;
  private index: Map<number, bigint> = new Map();
  private deleted: Set<number> = new Set();
  private version: number = 1;
  private _nextId: number = 1;
  private _writeQueue: Promise<any> = Promise.resolve();
  private _closed: boolean = false;
  private _autoFlush: boolean;
  private _contentEnd: bigint = 0n;
  private _compression: boolean;

  constructor(filePath: string, options: { autoFlush?: boolean; compression?: boolean } = {}) {
    if (!filePath || typeof filePath !== "string") throw new Error("ZPackDatabase: 'filePath' zorunludur.");
    this.filePath = filePath;
    this._autoFlush = options.autoFlush === true;
    this._compression = options.compression === true;
  }

  async open(): Promise<void> {
    if (this.fd) return;
    try {
      this.fd = await fsp.open(this.filePath, fs.constants.O_RDWR);
    } catch (err: any) {
      if (err && err.code === "ENOENT") {
        this.fd = await fsp.open(this.filePath, fs.constants.O_RDWR | fs.constants.O_CREAT);
      } else throw err;
    }
    const stat = await this.fd.stat();
    this.fileSize = BigInt(stat.size);
    this._contentEnd = this.fileSize;
    if (!(await this._tryLoadIndexFromFooter())) await this._scanAndRebuildIndex();
    if (this.index.size > 0) {
      let maxId = 0;
      for (const docId of this.index.keys()) if (docId > maxId) maxId = docId;
      this._nextId = maxId + 1;
    }
  }

  async close(): Promise<void> {
    if (this._closed || !this.fd) return;
    await this._writeFooter();
    await this.fd.close();
    this.fd = null;
    this._closed = true;
  }

  async vacuum(): Promise<void> {
    this._ensureOpen();
    return this._enqueue(async () => {
      const tempPath = this.filePath + ".tmp";
      const tempDb = new ZPackDatabase(tempPath, { autoFlush: false, compression: this._compression });
      await tempDb.open();
      for (const docId of this.index.keys()) {
        const doc = await this.get(docId);
        if (doc) await tempDb.insert(doc, docId);
      }
      await tempDb.close();
      await this.fd!.close();
      await fsp.rename(tempPath, this.filePath);
      this.fd = null;
      this.index.clear();
      this.deleted.clear();
      await this.open();
    });
  }

  async insert(document: Record<string, any>, docId?: number): Promise<number> {
    this._ensureOpen();
    const payload = this._encodeDocument(document, docId);
    return this._enqueue(async () => {
      const writeOffset = this.fileSize;
      await this.fd!.write(payload, 0, payload.length, Number(writeOffset));
      this.fileSize = writeOffset + BigInt(payload.length);
      this._contentEnd = this.fileSize;
      const parsed = this._peekDocMeta(payload);
      if (parsed.fieldCount === 0) {
        this.index.delete(parsed.docId);
        this.deleted.add(parsed.docId);
      } else {
        this.index.set(parsed.docId, writeOffset);
        this.deleted.delete(parsed.docId);
        if (parsed.docId >= this._nextId) this._nextId = parsed.docId + 1;
      }
      if (this._autoFlush) await this._internalWriteFooter();
      return parsed.docId;
    });
  }

  async insertBatch(documents: Record<string, any>[]): Promise<number[]> {
    this._ensureOpen();
    if (!Array.isArray(documents) || documents.length === 0) return [];
    const payloads: Buffer[] = [];
    const metas: any[] = [];
    for (const doc of documents) {
      const buf = this._encodeDocument(doc);
      payloads.push(buf);
      metas.push(this._peekDocMeta(buf));
    }
    const totalLen = payloads.reduce((s, b) => s + b.length, 0);
    const buffer = Buffer.alloc(totalLen);
    let pos = 0;
    for (const b of payloads) { b.copy(buffer, pos); pos += b.length; }
    return this._enqueue(async () => {
      const writeOffset = this.fileSize;
      await this.fd!.write(buffer, 0, buffer.length, Number(writeOffset));
      let cur = writeOffset;
      const ids: number[] = [];
      for (let i = 0; i < payloads.length; i++) {
        const meta = metas[i];
        if (meta.fieldCount === 0) {
          this.index.delete(meta.docId);
          this.deleted.add(meta.docId);
        } else {
          this.index.set(meta.docId, cur);
          this.deleted.delete(meta.docId);
          if (meta.docId >= this._nextId) this._nextId = meta.docId + 1;
        }
        ids.push(meta.docId);
        cur += BigInt(payloads[i].length);
      }
      this.fileSize = writeOffset + BigInt(buffer.length);
      this._contentEnd = this.fileSize;
      if (this._autoFlush) await this._internalWriteFooter();
      return ids;
    });
  }

  async delete(docId: number): Promise<void> {
    const tomb = this._encodeTombstone(docId);
    await this._enqueue(async () => {
      const writeOffset = this.fileSize;
      await this.fd!.write(tomb, 0, tomb.length, Number(writeOffset));
      this.fileSize = writeOffset + BigInt(tomb.length);
      this._contentEnd = this.fileSize;
      this.index.delete(docId);
      this.deleted.add(docId);
      if (this._autoFlush) await this._internalWriteFooter();
    });
  }

  async get(docId: number): Promise<Record<string, any> | null> {
    this._ensureOpen();
    const offset = this.index.get(docId);
    if (offset === undefined) return null;
    const header = Buffer.alloc(6);
    const { bytesRead: hread } = await this.fd!.read(header, 0, header.length, Number(offset));
    if (hread !== header.length) return null;
    const docLength = header.readUInt16LE(0);
    const totalSize = 2 + docLength;
    const buf = Buffer.alloc(totalSize);
    const { bytesRead } = await this.fd!.read(buf, 0, totalSize, Number(offset));
    if (bytesRead !== totalSize) return null;
    return this._decodeDocument(buf).document;
  }

  keys(): number[] { return Array.from(this.index.keys()); }

  private _ensureOpen(): void {
    if (!this.fd) throw new Error("ZPackDatabase: önce 'open()' çağrılmalı.");
    if (this._closed) throw new Error("ZPackDatabase: dosya kapalı.");
  }
  private _enqueue<T>(taskFn: () => Promise<T>): Promise<T> {
    this._writeQueue = this._writeQueue.then(taskFn, taskFn);
    return this._writeQueue;
  }

  private async _internalWriteFooter(): Promise<void> {
    const entries = Array.from(this.index.entries());
    const footerSize = 9 + entries.length * 12;
    const footer = Buffer.alloc(footerSize + 4);
    footer.write("ZPCK", 0, "utf8");
    footer.writeUInt8(this.version, 4);
    footer.writeUInt32LE(entries.length, 5);
    let p = 9;
    for (const [id, off] of entries) {
      footer.writeUInt32LE(id, p); p += 4;
      footer.writeUInt32LE(Number(off & 0xffffffffn), p); p += 4;
      footer.writeUInt32LE(Number((off >> 32n) & 0xffffffffn), p); p += 4;
    }
    footer.writeUInt32LE(footerSize, p);
    const writeOffset = this.fileSize;
    await this.fd!.write(footer, 0, footer.length, Number(writeOffset));
    this._contentEnd = writeOffset;
    this.fileSize = writeOffset + BigInt(footer.length);
  }

  private async _writeFooter(): Promise<void> {
    await this._enqueue(() => this._internalWriteFooter());
  }

  private _encodeDocument(document: Record<string, any>, docId?: number): Buffer {
    let id = docId ?? this._nextId++;
    if (this._compression) {
      const dataStr = JSON.stringify(document);
      const compressed = zlib.deflateSync(dataStr);
      const buf = Buffer.alloc(6 + compressed.length);
      buf.writeUInt16LE(4 + compressed.length, 0);
      buf.writeUInt32LE(id, 2);
      compressed.copy(buf, 6);
      return buf;
    }
    const fieldBuffers: Buffer[] = [];
    for (const [key, value] of Object.entries(document)) {
      const keyBuf = Buffer.from(String(key), "utf8");
      const valBuf = Buffer.from(String(value), "utf8");
      const fb = Buffer.alloc(2 + keyBuf.length + valBuf.length);
      fb.writeUInt8(keyBuf.length, 0); keyBuf.copy(fb, 1);
      fb.writeUInt8(valBuf.length, 1 + keyBuf.length); valBuf.copy(fb, 2 + keyBuf.length);
      fieldBuffers.push(fb);
    }
    const payloadSize = 4 + fieldBuffers.reduce((s, b) => s + b.length, 0);
    const buf = Buffer.alloc(2 + payloadSize);
    buf.writeUInt16LE(payloadSize, 0); buf.writeUInt32LE(id, 2);
    let offset = 6;
    for (const b of fieldBuffers) { b.copy(buf, offset); offset += b.length; }
    return buf;
  }

  private _decodeDocument(buf: Buffer): { docId: number; fieldCount: number; document: Record<string, any> } {
    const payloadSize = buf.readUInt16LE(0);
    const docId = buf.readUInt32LE(2);
    if (this._compression && payloadSize > 4) {
      try {
        const decompressed = zlib.inflateSync(buf.subarray(6));
        return { docId, fieldCount: 1, document: JSON.parse(decompressed.toString()) };
      } catch (e) { }
    }
    let p = 6; const end = 2 + payloadSize; const obj: Record<string, any> = {}; let fields = 0;
    while (p < end) {
      if (p + 1 > end) break;
      const klen = buf.readUInt8(p); p += 1;
      if (p + klen > end) break;
      const key = buf.toString("utf8", p, p + klen); p += klen;
      if (p + 1 > end) break;
      const vlen = buf.readUInt8(p); p += 1;
      if (p + vlen > end) break;
      const val = buf.toString("utf8", p, p + vlen); p += vlen;
      obj[key] = val; fields += 1;
    }
    return { docId, fieldCount: fields, document: obj };
  }

  private _encodeTombstone(docId: number): Buffer {
    const buf = Buffer.alloc(6);
    buf.writeUInt16LE(4, 0); buf.writeUInt32LE(docId, 2);
    return buf;
  }

  private _peekDocMeta(encodedBuf: Buffer): { docId: number; fieldCount: number } {
    const payloadSize = encodedBuf.readUInt16LE(0);
    const docId = encodedBuf.readUInt32LE(2);
    return { docId, fieldCount: payloadSize > 4 ? 1 : 0 };
  }

  private async _tryLoadIndexFromFooter(): Promise<boolean> {
    if (this.fileSize < 13n) return false;
    const sizeBuf = Buffer.alloc(4);
    await this.fd!.read(sizeBuf, 0, 4, Number(this.fileSize - 4n));
    const footerSize = sizeBuf.readUInt32LE(0);
    if (footerSize < 9 || BigInt(footerSize) + 4n > this.fileSize) return false;
    const footerStart = this.fileSize - 4n - BigInt(footerSize);
    const footer = Buffer.alloc(footerSize);
    await this.fd!.read(footer, 0, footerSize, Number(footerStart));
    if (footer.toString("utf8", 0, 4) !== "ZPCK" || footer.readUInt8(4) !== this.version) return false;
    const count = footer.readUInt32LE(5);
    let p = 9;
    this.index.clear();
    for (let i = 0; i < count; i++) {
      const id = footer.readUInt32LE(p); p += 4;
      const lo = footer.readUInt32LE(p); p += 4;
      const hi = footer.readUInt32LE(p); p += 4;
      this.index.set(id, (BigInt(hi) << 32n) + BigInt(lo));
    }
    this._contentEnd = footerStart;
    return true;
  }

  private async _scanAndRebuildIndex(): Promise<void> {
    this.index.clear(); this.deleted.clear();
    let offset = 0n; const headerBuf = Buffer.alloc(2);
    while (offset + 2n <= this.fileSize) {
      const { bytesRead } = await this.fd!.read(headerBuf, 0, 2, Number(offset));
      if (bytesRead < 2) break;
      const payloadSize = headerBuf.readUInt16LE(0);
      const idBuf = Buffer.alloc(4);
      await this.fd!.read(idBuf, 0, 4, Number(offset + 2n));
      const docId = idBuf.readUInt32LE(0);
      if (payloadSize === 4) this.index.delete(docId);
      else this.index.set(docId, offset);
      offset += BigInt(2 + payloadSize);
    }
  }
}

/**
 * ZPackAdapter: IDatabase Implementation
 */
export class ZPackAdapter extends IDatabase {
  private db: ZPackDatabase;
  private initPromise: Promise<void>;
  private tableMaxId: Map<string, number> = new Map();
  private keyIndex: Map<string, Map<number, bigint>> = new Map();
  private rowCache: Map<string, Map<number, any>> = new Map();
  private secondary: Map<string, Map<string, Map<string, Set<number>>>> = new Map();
  private indexedFields: Map<string, Set<string>> = new Map();
  private _isClosing: boolean = false;
  private _executing: Promise<any> = Promise.resolve();

  constructor(config: ZPackConfig) {
    super();
    this.db = new ZPackDatabase(config.path, { autoFlush: !!config.autoFlush, compression: !!config.cache });
    if (config.indexFields) {
      for (const [table, fields] of Object.entries(config.indexFields)) {
        this.indexedFields.set(table, new Set(fields));
      }
    }
    this.initPromise = this._init();
  }

  private async _init(): Promise<void> {
    await this.db.open();
    for (const physicalDocId of this.db.keys()) {
      const doc = await this.db.get(physicalDocId);
      if (!doc || !doc.t || isNaN(Number(doc._id))) continue;
      const table = String(doc.t), idNum = Number(doc._id);
      await this.ensureTable(table);
      this.keyIndex.get(table)!.set(idNum, BigInt(physicalDocId));
      if (idNum > (this.tableMaxId.get(table) || 0)) this.tableMaxId.set(table, idNum);
      this._updateSecondaryIndex(table, idNum, doc);
    }
  }

  private async _execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this._isClosing) throw new Error("ZPack: Adaptör kapanıyor.");
    
    const next = this._executing.then(async () => {
        if (this._isClosing) return;
        await this.initPromise;
        return fn();
    });
    this._executing = next.catch(() => {});
    return next as Promise<T>;
  }

  // --- INTERNAL RAW METHODS (No Queue) to prevent deadlocks ---

  private async _rawSelect<T = any>(table: string, where: Record<string, any> | null = null): Promise<T[]> {
    await this.ensureTable(table);
    if (where && Object.keys(where).length === 1) {
      const [field, value] = Object.entries(where)[0];
      const index = this.secondary.get(table)?.get(field);
      if (index) {
        const matches = index.get(String(value));
        if (matches) {
          const results: T[] = [];
          for (const logicalId of matches) {
            const physicalId = this.keyIndex.get(table)!.get(logicalId);
            if (physicalId !== undefined) {
              const doc = await this.db.get(Number(physicalId));
              if (doc) results.push(doc as unknown as T);
            }
          }
          return results;
        }
        return [];
      }
    }
    const results: T[] = [];
    for (const [logicalId, physicalId] of this.keyIndex.get(table)!.entries()) {
      let row = this.rowCache.get(table)!.get(logicalId);
      if (!row) {
        const doc = await this.db.get(Number(physicalId));
        if (!doc) continue;
        row = doc;
        this.rowCache.get(table)!.set(logicalId, row);
      }
      if (this._matches(row, where)) results.push({ ...row } as unknown as T);
    }
    return results;
  }

  async ensureTable(table: string): Promise<void> {
    if (!this.tableMaxId.has(table)) {
      this.tableMaxId.set(table, 0);
      this.keyIndex.set(table, new Map<number, bigint>());
      this.rowCache.set(table, new Map());
      this.secondary.set(table, new Map());
    }
  }

  private _updateSecondaryIndex(table: string, logicalId: number, data: any, oldData: any = null): void {
    const fields = this.indexedFields.get(table);
    if (!fields) return;
    const tableIndex = this.secondary.get(table)!;
    for (const field of fields) {
      if (!tableIndex.has(field)) tableIndex.set(field, new Map());
      const fieldMap = tableIndex.get(field)!;
      if (oldData && oldData[field] !== undefined) fieldMap.get(String(oldData[field]))?.delete(logicalId);
      if (data[field] !== undefined) {
        const newVal = String(data[field]);
        if (!fieldMap.has(newVal)) fieldMap.set(newVal, new Set());
        fieldMap.get(newVal)!.add(logicalId);
      }
    }
  }

  private _coerce(table: string, data: any, id: number): Record<string, string> {
    const out: Record<string, string> = { t: table, _id: String(id) };
    for (const [k, v] of Object.entries(data || {})) {
      if (k !== 't' && k !== '_id') out[k] = typeof v === 'string' ? v : JSON.stringify(v);
    }
    return out;
  }

  private _matches(row: any, where: Record<string, any> | null): boolean {
    if (!where || Object.keys(where).length === 0) return true;
    return Object.entries(where).every(([k, v]) => String(row[k]) === String(v));
  }

  // --- PUBLIC METHODS (With Queue) ---

  async select<T = any>(table: string, where: Record<string, any> | null = null): Promise<T[]> {
    return this._execute(() => this._rawSelect<T>(table, where));
  }

  async selectOne<T = any>(table: string, where: Record<string, any> | null = null): Promise<T | null> {
    const res = await this.select<T>(table, where);
    return res[0] || null;
  }

  async insert(table: string, data: Record<string, any>): Promise<number> {
    return this._execute(async () => {
      await this.ensureTable(table);
      await this.runHooks('beforeInsert', table, data);
      const nextId = (this.tableMaxId.get(table) || 0) + 1;
      const record = this._coerce(table, data, nextId);
      const physicalId = await this.db.insert(record);
      this.tableMaxId.set(table, nextId);
      this.keyIndex.get(table)!.set(nextId, BigInt(physicalId));
      const fullRow = { _id: nextId, ...data };
      this.rowCache.get(table)!.set(nextId, fullRow);
      this._updateSecondaryIndex(table, nextId, fullRow);
      await this.runHooks('afterInsert', table, fullRow);
      return nextId;
    });
  }

  async update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<number> {
    return this._execute(async () => {
      const rows = await this._rawSelect(table, where);
      for (const row of rows) {
        const logicalId = Number((row as any)._id);
        await this.runHooks('beforeUpdate', table, { old: row, new: data });
        const merged = { ...row, ...data };
        const record = this._coerce(table, merged, logicalId);
        const physicalId = await this.db.insert(record);
        this.keyIndex.get(table)!.set(logicalId, BigInt(physicalId));
        this.rowCache.get(table)!.set(logicalId, merged);
        this._updateSecondaryIndex(table, logicalId, merged, row);
        await this.runHooks('afterUpdate', table, merged);
      }
      return rows.length;
    });
  }

  async delete(table: string, where: Record<string, any>): Promise<number> {
    return this._execute(async () => {
      const rows = await this._rawSelect(table, where);
      for (const row of rows) {
        const logicalId = Number((row as any)._id);
        await this.runHooks('beforeDelete', table, row);
        const physicalId = this.keyIndex.get(table)!.get(logicalId);
        if (physicalId !== undefined) {
          await this.db.delete(Number(physicalId));
          this.keyIndex.get(table)!.delete(logicalId);
          this.rowCache.get(table)!.delete(logicalId);
          this._updateSecondaryIndex(table, logicalId, {}, row);
        }
        await this.runHooks('afterDelete', table, row);
      }
      return rows.length;
    });
  }

  async set(table: string, data: Record<string, any>, where: Record<string, any>): Promise<any> {
    return this._execute(async () => {
        const existing = await this._rawSelect(table, where);
        if (existing.length > 0) {
            // Update logic here directly using _raw logic
            const row = existing[0];
            const logicalId = Number((row as any)._id);
            const merged = { ...row, ...data };
            const record = this._coerce(table, merged, logicalId);
            const physicalId = await this.db.insert(record);
            this.keyIndex.get(table)!.set(logicalId, BigInt(physicalId));
            this.rowCache.get(table)!.set(logicalId, merged);
            this._updateSecondaryIndex(table, logicalId, merged, row);
            return logicalId;
        } else {
            // Insert logic here directly
            const nextId = (this.tableMaxId.get(table) || 0) + 1;
            const record = this._coerce(table, { ...where, ...data }, nextId);
            const physicalId = await this.db.insert(record);
            this.tableMaxId.set(table, nextId);
            this.keyIndex.get(table)!.set(nextId, BigInt(physicalId));
            const fullRow = { _id: nextId, ...where, ...data };
            this.rowCache.get(table)!.set(nextId, fullRow);
            this._updateSecondaryIndex(table, nextId, fullRow);
            return nextId;
        }
    });
  }

  async bulkInsert(table: string, dataArray: Record<string, any>[]): Promise<number> {
    return this._execute(async () => {
        for (const d of dataArray) {
            const nextId = (this.tableMaxId.get(table) || 0) + 1;
            const record = this._coerce(table, d, nextId);
            const physicalId = await this.db.insert(record);
            this.tableMaxId.set(table, nextId);
            this.keyIndex.get(table)!.set(nextId, BigInt(physicalId));
            const fullRow = { _id: nextId, ...d };
            this.rowCache.get(table)!.set(nextId, fullRow);
            this._updateSecondaryIndex(table, nextId, fullRow);
        }
        return dataArray.length;
    });
  }

  async increment(table: string, incs: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    return this._execute(async () => {
      const rows = await this._rawSelect(table, where);
      for (const row of rows) {
        const logicalId = Number((row as any)._id);
        const merged = { ...row };
        for (const [f, v] of Object.entries(incs)) merged[f] = (Number(merged[f]) || 0) + v;
        const record = this._coerce(table, merged, logicalId);
        const physicalId = await this.db.insert(record);
        this.keyIndex.get(table)!.set(logicalId, BigInt(physicalId));
        this.rowCache.get(table)!.set(logicalId, merged);
        this._updateSecondaryIndex(table, logicalId, merged, row);
      }
      return rows.length;
    });
  }

  async decrement(table: string, decs: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    const incs: any = {};
    for (const k in decs) incs[k] = -decs[k];
    return this.increment(table, incs, where);
  }

  async vacuum(): Promise<void> { 
    return this._execute(async () => {
        await this.db.vacuum(); 
    });
  }

  async close(): Promise<void> {
    this._isClosing = true;
    try {
        await this._executing;
        await this.db.close();
    } catch (e) {}
  }
}

export default ZPackAdapter;
