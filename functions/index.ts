import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import https from "https";
import http from "http";
import { URL } from "url";

// Random İşlemler
export function makeUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function randomArray<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomText(length: number = 8): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () =>
    characters.charAt(Math.floor(Math.random() * characters.length))
  ).join("");
}

export function randomNumber(min: number = 0, max: number = 9999999): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomEmoji(): string {
  const emojiler = ["😄", "😃", "😀", "😊", "😉", "😍", "😘", "😚", "😜", "😝", "😛", "😁"];
  return emojiler[Math.floor(Math.random() * emojiler.length)];
}

export function randomHex(): string {
  return `#${Array.from({ length: 6 }, () =>
    "0123456789ABCDEF".charAt(Math.floor(Math.random() * 16))
  ).join("")}`;
}

export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// String İşlemleri
export function titleCase(sentence: string): string {
  return sentence
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function generateRandomString(length: number): string {
  return randomText(length);
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

// Array İşlemleri
export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  let currentIndex = arr.length;
  while (currentIndex !== 0) {
    const randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [arr[currentIndex], arr[randomIndex]] = [arr[randomIndex], arr[currentIndex]];
  }
  return arr;
}

export function flattenArray(arr: any[]): any[] {
  return arr.reduce(
    (flat, toFlatten) =>
      flat.concat(Array.isArray(toFlatten) ? flattenArray(toFlatten) : toFlatten),
    []
  );
}

export function removeFalsyValues<T>(arr: T[]): T[] {
  return arr.filter(Boolean);
}

export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((result, item) => {
    const group = String(item[key]);
    if (!result[group]) result[group] = [];
    result[group].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

export function pluck<T, K extends keyof T>(arr: T[], key: K): T[K][] {
  return arr.map((item) => item[key]);
}

export function sortBy<T>(arr: T[], key: keyof T): T[] {
  return [...arr].sort((a, b) => (a[key] > b[key] ? 1 : -1));
}

// Object İşlemleri
export function filterObjectByKey<T extends object>(obj: T, keys: string[]): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => keys.includes(key))
  ) as Partial<T>;
}

export function deepMerge(obj1: any, obj2: any): any {
  const isObject = (obj: any) => obj && typeof obj === "object";
  return Object.keys({ ...obj1, ...obj2 }).reduce((result, key) => {
    result[key] = 
      isObject(obj1[key]) && isObject(obj2[key])
        ? deepMerge(obj1[key], obj2[key])
        : obj2[key] ?? obj1[key];
    return result;
  }, {} as any);
}

// Şifreleme ve Güvenlik
function getKeyFromSecret(secret: string): Buffer {
  const salt = Buffer.from('some_fixed_salt_for_testing_only', 'utf8');
  return crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha512');
}

export function encryptText(text: string, secret: string): { encryptedText: string; iv: string } {
  const key = getKeyFromSecret(secret);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return { encryptedText: encrypted, iv: iv.toString('hex') };
}

export function decryptText(encryptedText: string, secret: string, ivHex: string): string {
  const key = getKeyFromSecret(secret);
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function hashPassword(password: string): string {
  const saltRounds = 10;
  return bcrypt.hashSync(password, saltRounds);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function generateJWT(payload: object, secret: string): string {
  return jwt.sign(payload, secret, { expiresIn: "1h" });
}

export function verifyJWT(token: string, secret: string): any {
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function isPasswordStrong(password: string): boolean {
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return strongPasswordRegex.test(password);
}

// Matematiksel İşlemler
export function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((sum, num) => sum + num, 0) / arr.length;
}

export function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function variance(arr: number[]): number {
  if (!arr.length) return 0;
  const avg = mean(arr);
  return arr.reduce((sum, num) => sum + Math.pow(num - avg, 2), 0) / arr.length;
}

export function standardDeviation(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

export function sum(arr: number[]): number {
  return arr.reduce((total, num) => total + num, 0);
}

export function max(arr: number[]): number {
  return Math.max(...arr);
}

export function min(arr: number[]): number {
  return Math.min(...arr);
}

export function range(start: number, end: number): number[] {
  if (start > end) return [];
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function isPrime(num: number): boolean {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;
  for (let i = 5; i * i <= num; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
  }
  return true;
}

export function factorial(n: number): number {
  if (n === 0 || n === 1) return 1;
  return n * factorial(n - 1);
}

export function combination(n: number, r: number): number {
  return factorial(n) / (factorial(r) * factorial(n - r));
}

export function permutation(n: number, r: number): number {
  return factorial(n) / factorial(n - r);
}

// Tarih ve Saat İşlemleri
export function formatDate(date: Date, format: string = "YYYY-MM-DD"): string {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  };
  const formattedDate = new Intl.DateTimeFormat("en-US", options).format(date);
  const match = formattedDate.match(/\d+/g);
  if (!match) return "";
  const [month, day, year, hour, minute, second] = match;

  return format
    .replace("YYYY", year)
    .replace("MM", month)
    .replace("DD", day)
    .replace("HH", hour)
    .replace("mm", minute)
    .replace("ss", second);
}

export function dateDifference(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function subtractDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

// HTTP İşlemleri
export function fetchData(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;

    client
      .get(url, (response) => {
        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            resolve(data);
          }
        });
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

export function postData(url: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const parsedUrl = new URL(url);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (url.startsWith("https") ? 443 : 80),
      path: parsedUrl.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(JSON.stringify(data)),
      },
    };

    const req = client.request(options, (response) => {
      let responseData = "";
      response.on("data", (chunk) => {
        responseData += chunk;
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (error) {
          resolve(responseData);
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(JSON.stringify(data));
    req.end();
  });
}

// Validasyon İşlemleri
export function isEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isPhone(phone: string): boolean {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

export function isURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeHTML(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

export function validateCreditCard(cardNumber: string): boolean {
  const cleanNumber = cardNumber.replace(/\D/g, '');
  if (cleanNumber.length < 13 || cleanNumber.length > 19) return false;
  
  let sum = 0;
  let isEven = false;
  
  for (let i = cleanNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanNumber[i]);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

export interface ValidationSchema {
  [key: string]: {
    required?: boolean;
    type?: string;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    min?: number;
    max?: number;
  };
}

export function validateSchema(data: any, schema: ValidationSchema): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const [key, rules] of Object.entries(schema)) {
    const value = data[key];
    
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${key} alanı zorunludur`);
      continue;
    }
    
    if (value !== undefined && value !== null) {
      if (rules.type && typeof value !== rules.type) {
        errors.push(`${key} alanı ${rules.type} tipinde olmalıdır`);
      }
      if (rules.minLength && String(value).length < rules.minLength) {
        errors.push(`${key} en az ${rules.minLength} karakter olmalıdır`);
      }
      if (rules.maxLength && String(value).length > rules.maxLength) {
        errors.push(`${key} en fazla ${rules.maxLength} karakter olmalıdır`);
      }
      if (rules.pattern && !rules.pattern.test(String(value))) {
        errors.push(`${key} geçerli formatta değil`);
      }
      if (rules.min && value < rules.min) {
        errors.push(`${key} en az ${rules.min} olmalıdır`);
      }
      if (rules.max && value > rules.max) {
        errors.push(`${key} en fazla ${rules.max} olmalıdır`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function sanitizeInput(input: any, options: { trim?: boolean; removeHTML?: boolean; escape?: boolean } = {}): any {
  if (typeof input !== 'string') return input;
  
  let sanitized = input;
  if (options.trim !== false) {
    sanitized = sanitized.trim();
  }
  if (options.removeHTML) {
    sanitized = sanitizeHTML(sanitized);
  }
  if (options.escape) {
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
  return sanitized;
}

// Logger İşlemleri
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LoggerOptions {
  level?: LogLevel;
  enableColors?: boolean;
  enableTimestamp?: boolean;
  logFile?: string | null;
}

export class Logger {
  private level: LogLevel;
  private enableColors: boolean;
  private enableTimestamp: boolean;
  private logFile: string | null;
  private levels: Record<LogLevel, number> = {
    error: 0,
    warn: 1, 
    info: 2,
    debug: 3
  };
  private colors = {
    error: '\x1b[31m',
    warn: '\x1b[33m',
    info: '\x1b[36m',
    debug: '\x1b[35m',
    reset: '\x1b[0m'
  };

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || 'info';
    this.enableColors = options.enableColors !== false;
    this.enableTimestamp = options.enableTimestamp !== false;
    this.logFile = options.logFile || null;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] <= this.levels[this.level];
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    let formatted = '';
    if (this.enableTimestamp) {
      formatted += `[${new Date().toISOString()}] `;
    }
    if (this.enableColors) {
      formatted += `${this.colors[level]}[${level.toUpperCase()}]${this.colors.reset} `;
    } else {
      formatted += `[${level.toUpperCase()}] `;
    }
    formatted += message;
    if (data !== undefined) {
      formatted += ' ' + (typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
    }
    return formatted;
  }

  private writeToFile(message: string): void {
    if (this.logFile) {
      const fs = require('fs');
      const timestamp = new Date().toISOString();
      const logEntry = `${timestamp} ${message}\n`;
      try {
        fs.appendFileSync(this.logFile, logEntry);
      } catch (error: any) {
        console.error('Log dosyasına yazılamadı:', error.message);
      }
    }
  }

  log(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;
    const formatted = this.formatMessage(level, message, data);
    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
    this.writeToFile(formatted);
  }

  error(message: string, data?: any): void { this.log('error', message, data); }
  warn(message: string, data?: any): void { this.log('warn', message, data); }
  info(message: string, data?: any): void { this.log('info', message, data); }
  debug(message: string, data?: any): void { this.log('debug', message, data); }

  setLevel(level: LogLevel): void {
    if (this.levels.hasOwnProperty(level)) {
      this.level = level;
    } else {
      throw new Error(`Geçersiz log seviyesi: ${level}`);
    }
  }

  getLevel(): LogLevel { return this.level; }
}

export function createLogger(options: LoggerOptions = {}): Logger {
  return new Logger(options);
}

const defaultLogger = new Logger();

export function logInfo(message: string, data?: any): void { defaultLogger.info(message, data); }
export function logError(message: string, data?: any): void { defaultLogger.error(message, data); }
export function logWarn(message: string, data?: any): void { defaultLogger.warn(message, data); }
export function logDebug(message: string, data?: any): void { defaultLogger.debug(message, data); }

// Grouped exports
export const http_module = {
  fetchData,
  postData,
};

export const date_module = {
  formatDate,
  dateDifference,
  addDays,
  subtractDays,
};

export const random_module = {
  makeUniqueId,
  randomArray,
  randomText,
  randomNumber,
  randomEmoji,
  randomHex,
  randomFloat,
};

export const string_module = {
  titleCase,
  generateRandomString,
  generateSlug,
  wordCount,
};

export const array_module = {
  shuffleArray,
  flattenArray,
  removeFalsyValues,
  groupBy,
  pluck,
  sortBy,
};

export const object_module = {
  filterObjectByKey,
  deepMerge,
};

export const crypto_module = {
  encryptText,
  decryptText,
  hashPassword,
  verifyPassword,
  generateJWT,
  verifyJWT,
  generateSalt,
  validateUUID,
  isPasswordStrong,
};

export const math_module = {
  mean,
  median,
  variance,
  standardDeviation,
  sum,
  max,
  min,
  range,
  isPrime,
  combination,
  permutation,
};

export const validation_module = {
  isEmail,
  isPhone,
  isURL,
  sanitizeHTML,
  validateCreditCard,
  validateSchema,
  sanitizeInput,
};

export const logger_module = {
  createLogger,
  Logger,
  info: logInfo,
  error: logError,
  warn: logWarn,
  debug: logDebug,
};
