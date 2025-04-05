const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// Random İşlemler
function makeUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function randomArray(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomText(length = 8) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () =>
    characters.charAt(Math.floor(Math.random() * characters.length))
  ).join("");
}

function randomNumber(min = 0, max = 9999999) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomEmoji() {
  const emojiler = [
    "😄",
    "😃",
    "😀",
    "😊",
    "😉",
    "😍",
    "😘",
    "😚",
    "😜",
    "😝",
    "😛",
    "😁",
  ];
  return emojiler[Math.floor(Math.random() * emojiler.length)];
}

function randomHex() {
  return `#${Array.from({ length: 6 }, () =>
    "0123456789ABCDEF".charAt(Math.floor(Math.random() * 16))
  ).join("")}`;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

// String İşlemleri
function titleCase(sentence) {
  return sentence
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Array İşlemleri
function shuffleArray(array) {
  let currentIndex = array.length;
  while (currentIndex !== 0) {
    const randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }
  return array;
}

function flattenArray(arr) {
  return arr.reduce(
    (flat, toFlatten) =>
      flat.concat(
        Array.isArray(toFlatten) ? flattenArray(toFlatten) : toFlatten
      ),
    []
  );
}

function removeFalsyValues(arr) {
  return arr.filter(Boolean);
}

function groupBy(arr, key) {
  return arr.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) result[group] = [];
    result[group].push(item);
    return result;
  }, {});
}

function pluck(arr, key) {
  return arr.map((item) => item[key]);
}

function sortBy(arr, key) {
  return [...arr].sort((a, b) => (a[key] > b[key] ? 1 : -1));
}

// Object İşlemleri
function filterObjectByKey(obj, keys) {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => keys.includes(key))
  );
}

function deepMerge(obj1, obj2) {
  const isObject = (obj) => obj && typeof obj === "object";
  return Object.keys({ ...obj1, ...obj2 }).reduce((result, key) => {
    result[key] =
      isObject(obj1[key]) && isObject(obj2[key])
        ? deepMerge(obj1[key], obj2[key])
        : obj2[key] ?? obj1[key];
    return result;
  }, {});
}

// Şifreleme ve Güvenlik
function encryptText(text, secret) {
  const cipher = crypto.createCipher("aes-256-cbc", secret);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

function decryptText(encryptedText, secret) {
  const decipher = crypto.createDecipher("aes-256-cbc", secret);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function hashPassword(password) {
  const saltRounds = 10;
  return bcrypt.hashSync(password, saltRounds);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function generateJWT(payload, secret) {
  return jwt.sign(payload, secret, { expiresIn: "1h" });
}

function verifyJWT(token, secret) {
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

function generateSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function generateRandomString(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () =>
    characters.charAt(Math.floor(Math.random() * characters.length))
  ).join("");
}

function validateUUID(uuid) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

function isPasswordStrong(password) {
  const strongPasswordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return strongPasswordRegex.test(password);
}

// Matematiksel İşlemler
function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((sum, num) => sum + num, 0) / arr.length;
}

function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function variance(arr) {
  if (!arr.length) return 0;
  const avg = mean(arr);
  return arr.reduce((sum, num) => sum + Math.pow(num - avg, 2), 0) / arr.length;
}

function standardDeviation(arr) {
  return Math.sqrt(variance(arr));
}

function sum(arr) {
  return arr.reduce((total, num) => total + num, 0);
}

function max(arr) {
  return Math.max(...arr);
}

function min(arr) {
  return Math.min(...arr);
}

function range(start, end) {
  if (start > end) return [];
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function isPrime(num) {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;
  for (let i = 5; i * i <= num; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
  }
  return true;
}

// Exportlar
module.exports = {
  random: {
    makeUniqueId,
    randomArray,
    randomText,
    randomNumber,
    randomEmoji,
    randomHex,
    randomFloat,
  },
  string: {
    titleCase,
    generateRandomString,
  },
  array: {
    shuffleArray,
    flattenArray,
    removeFalsyValues,
    groupBy,
    pluck,
    sortBy,
  },
  object: {
    filterObjectByKey,
    deepMerge,
  },
  crypto: {
    encryptText,
    decryptText,
    hashPassword,
    verifyPassword,
    generateJWT,
    verifyJWT,
    generateSalt,
    validateUUID,
    isPasswordStrong,
  },
  math: {
    mean,
    median,
    variance,
    standardDeviation,
    sum,
    max,
    min,
    range,
    isPrime,
  },
};
