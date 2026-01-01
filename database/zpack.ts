import { IDatabase } from './IDatabase';
import fs from 'fs';
const fsp = fs.promises;
import { ZPackConfig } from './types';

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

  constructor(filePath: string, options: { autoFlush?: boolean } = {}) {
    if (!filePath || typeof filePath !== "string") throw new Error("ZPackDatabase: 'filePath' zorunludur.");
    this.filePath = filePath;
    this._autoFlush = options.autoFlush === true;
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
    this._closed = true;
  }

  async insert(document: Record<string, any>, docId?: number): Promise<number> {
    this._ensureOpen();
    const payload = this._encodeDocument(document, docId);
    return this._enqueue(async () => {
      const writeOffset = this.fileSize;
      await this.fd!.write(payload, 0, payload.length, writeOffset as any);
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
      await this.fd!.write(buffer, 0, buffer.length, writeOffset as any);
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
    if (!Number.isInteger(docId) || docId <= 0) throw new Error("delete: 'docId' pozitif bir tamsayı olmalıdır.");
    const tomb = this._encodeTombstone(docId);
    await this._enqueue(async () => {
      const writeOffset = this.fileSize;
      await this.fd!.write(tomb, 0, tomb.length, writeOffset as any);
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
    if (offset + BigInt(header.length) > this._contentEnd) return null;
    const { bytesRead: hread } = await this.fd!.read(header, 0, header.length, offset);
    if (hread !== header.length) return null;
    const docLength = header.readUInt16LE(0);
    const totalSize = 2 + docLength;
    if (docLength < 4 || offset + BigInt(totalSize) > this._contentEnd) return null;
    const buf = Buffer.alloc(totalSize);
    const { bytesRead } = await this.fd!.read(buf, 0, totalSize, offset);
    if (bytesRead !== totalSize) return null;
    const parsed = this._decodeDocument(buf);
    return parsed.fieldCount === 0 ? null : parsed.document;
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
    await this.fd!.write(footer, 0, footer.length, writeOffset as any);
    this._contentEnd = writeOffset;
    this.fileSize = writeOffset + BigInt(footer.length);
  }

  private async _writeFooter(): Promise<void> {
    await this._enqueue(() => this._internalWriteFooter());
  }

  private _encodeDocument(document: Record<string, any>, docId?: number): Buffer {
    let id = docId ?? this._nextId++;
    const fieldBuffers: Buffer[] = [];
    for (const [key, value] of Object.entries(document)) {
      const keyBuf = Buffer.from(String(key), "utf8");
      const valBuf = Buffer.from(String(value), "utf8");
      const fb = Buffer.alloc(2 + keyBuf.length + valBuf.length);
      fb.writeUInt8(keyBuf.length, 0);
      keyBuf.copy(fb, 1);
      fb.writeUInt8(valBuf.length, 1 + keyBuf.length);
      valBuf.copy(fb, 2 + keyBuf.length);
      fieldBuffers.push(fb);
    }
    const payloadSize = 4 + fieldBuffers.reduce((s, b) => s + b.length, 0);
    const buf = Buffer.alloc(2 + payloadSize);
    buf.writeUInt16LE(payloadSize, 0);
    buf.writeUInt32LE(id, 2);
    let offset = 6;
    for (const b of fieldBuffers) { b.copy(buf, offset); offset += b.length; }
    return buf;
  }
  private _encodeTombstone(docId: number): Buffer {
    const buf = Buffer.alloc(6);
    buf.writeUInt16LE(4, 0);
    buf.writeUInt32LE(docId, 2);
    return buf;
  }
  private _peekDocMeta(encodedBuf: Buffer): { docId: number; fieldCount: number } {
    const payloadSize = encodedBuf.readUInt16LE(0);
    const docId = encodedBuf.readUInt32LE(2);
    const fieldBytes = payloadSize - 4;
    let p = 6, consumed = 0, fields = 0;
    while (consumed < fieldBytes) {
      const klen = encodedBuf.readUInt8(p); p += 1 + klen; consumed += 1 + klen;
      if (consumed >= fieldBytes) break;
      const vlen = encodedBuf.readUInt8(p); p += 1 + vlen; consumed += 1 + vlen; fields += 1;
    }
    return { docId, fieldCount: fields };
  }
  private _decodeDocument(buf: Buffer): { docId: number; fieldCount: number; document: Record<string, any> } {
    const payloadSize = buf.readUInt16LE(0);
    const docId = buf.readUInt32LE(2);
    let p = 6; const end = 2 + payloadSize; const obj: Record<string, any> = {}; let fields = 0;
    while (p < end) {
      const klen = buf.readUInt8(p); p += 1;
      const key = buf.toString("utf8", p, p + klen); p += klen;
      if (p >= end) break;
      const vlen = buf.readUInt8(p); p += 1;
      const val = buf.toString("utf8", p, p + vlen); p += vlen;
      obj[key] = val; fields += 1;
    }
    return { docId, fieldCount: fields, document: obj };
  }
  private async _tryLoadIndexFromFooter(): Promise<boolean> {
    if (this.fileSize < 13n) return false;
    const sizeBuf = Buffer.alloc(4);
    await this.fd!.read(sizeBuf, 0, 4, this.fileSize - 4n);
    const footerSize = sizeBuf.readUInt32LE(0);
    if (footerSize < 9 || BigInt(footerSize) + 4n > this.fileSize) return false;
    const footerStart = this.fileSize - 4n - BigInt(footerSize);
    const footer = Buffer.alloc(footerSize);
    await this.fd!.read(footer, 0, footerSize, footerStart);
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
      const { bytesRead } = await this.fd!.read(headerBuf, 0, 2, offset);
      if (bytesRead < 2) break;
      const payloadSize = headerBuf.readUInt16LE(0);
      const idBuf = Buffer.alloc(4);
      await this.fd!.read(idBuf, 0, 4, offset + 2n);
      const docId = idBuf.readUInt32LE(0);
      if (payloadSize === 4) this.index.delete(docId);
      else this.index.set(docId, offset);
      offset += BigInt(2 + payloadSize);
    }
  }
}

export class ZPackAdapter extends IDatabase {
  private db: ZPackDatabase;
  private initPromise: Promise<void>;
  private tableMaxId: Map<string, number> = new Map();
  private keyIndex: Map<string, Map<number, number>> = new Map();
  private rowCache: Map<string, Map<number, any>> = new Map();
  private secondary: Map<string, Map<string, Map<string, Set<number>>>> = new Map();

  constructor(config: ZPackConfig) {
    super();
    this.db = new ZPackDatabase(config.filePath, { autoFlush: !!config.autoFlush });
    this.initPromise = this._init();
  }

  private async _init(): Promise<void> {
    await this.db.open();
    for (const physicalDocId of this.db.keys()) {
      const doc = await this.db.get(physicalDocId);
      if (!doc || !doc.t || !Number.isFinite(Number(doc._id))) continue;
      const table = String(doc.t), idNum = Number(doc._id);
      if (!this.keyIndex.has(table)) {
        this.keyIndex.set(table, new Map());
        this.tableMaxId.set(table, 0);
        this.rowCache.set(table, new Map());
        this.secondary.set(table, new Map());
      }
      this.keyIndex.get(table)!.set(idNum, physicalDocId);
      if (idNum > (this.tableMaxId.get(table) || 0)) this.tableMaxId.set(table, idNum);
    }
  }

  async ensureTable(table: string): Promise<void> {
    await this.initPromise;
    if (!this.tableMaxId.has(table)) {
      this.tableMaxId.set(table, 0);
      this.keyIndex.set(table, new Map());
      this.rowCache.set(table, new Map());
      this.secondary.set(table, new Map());
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
    if (!where) return true;
    return Object.entries(where).every(([k, v]) => String(row[k]) === String(v));
  }

  async select<T = any>(table: string, where: Record<string, any> | null = null): Promise<T[]> {
    await this.ensureTable(table);
    const results: T[] = [];
    for (const [logicalId, physicalId] of this.keyIndex.get(table)!.entries()) {
      let row = this.rowCache.get(table)!.get(logicalId);
      if (!row) {
        const doc = await this.db.get(physicalId);
        if (!doc) continue;
        row = { _id: Number(doc._id) };
        for (const [k, v] of Object.entries(doc)) if (k !== 't' && k !== '_id') row[k] = v;
        this.rowCache.get(table)!.set(logicalId, row);
      }
      if (this._matches(row, where)) results.push({ ...row } as unknown as T);
    }
    return results;
  }

  async selectOne<T = any>(table: string, where: Record<string, any> | null = null): Promise<T | null> {
    const res = await this.select<T>(table, where);
    return res[0] || null;
  }

  async insert(table: string, data: Record<string, any>): Promise<number> {
    await this.ensureTable(table);
    const nextId = (this.tableMaxId.get(table) || 0) + 1;
    const record = this._coerce(table, data, nextId);
    const physicalId = await this.db.insert(record);
    this.tableMaxId.set(table, nextId);
    this.keyIndex.get(table)!.set(nextId, physicalId);
    const row = { _id: nextId, ...data };
    this.rowCache.get(table)!.set(nextId, row);
    return nextId;
  }

  async update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<number> {
    const rows = await this.select(table, where);
    for (const row of rows) {
      const merged = { ...row, ...data };
      const record = this._coerce(table, merged, (row as any)._id);
      const physicalId = await this.db.insert(record);
      this.keyIndex.get(table)!.set((row as any)._id, physicalId);
      this.rowCache.get(table)!.set((row as any)._id, merged);
    }
    return rows.length;
  }

  async set(table: string, data: Record<string, any>, where: Record<string, any>): Promise<any> {
    const existing = await this.selectOne(table, where);
    return existing ? this.update(table, data, where) : this.insert(table, { ...where, ...data });
  }

  async delete(table: string, where: Record<string, any>): Promise<number> {
    const rows = await this.select(table, where);
    for (const row of rows) {
      const physicalId = this.keyIndex.get(table)!.get((row as any)._id);
      if (physicalId !== undefined) {
        await this.db.delete(physicalId);
        this.keyIndex.get(table)!.delete((row as any)._id);
        this.rowCache.get(table)!.delete((row as any)._id);
      }
    }
    return rows.length;
  }

  async bulkInsert(table: string, dataArray: Record<string, any>[]): Promise<number> {
    for (const data of dataArray) await this.insert(table, data);
    return dataArray.length;
  }

  async increment(table: string, increments: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    const rows = await this.select(table, where);
    for (const row of rows) {
      const updated = { ...row };
      for (const [f, v] of Object.entries(increments)) (updated as any)[f] = (Number((updated as any)[f]) || 0) + v;
      await this.update(table, updated, { _id: (row as any)._id });
    }
    return rows.length;
  }

  async decrement(table: string, decrements: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    const rows = await this.select(table, where);
    for (const row of rows) {
      const updated = { ...row };
      for (const [f, v] of Object.entries(decrements)) (updated as any)[f] = (Number((updated as any)[f]) || 0) - v;
      await this.update(table, updated, { _id: (row as any)._id });
    }
    return rows.length;
  }

  async close(): Promise<void> { await this.db.close(); }
}

export default ZPackAdapter;
