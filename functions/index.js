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
// Tarih ve Saat İşlemleri
function formatDate(date, format = "YYYY-MM-DD") {
  const options = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  };
  const formattedDate = new Intl.DateTimeFormat("en-US", options).format(date);
  const [month, day, year, hour, minute, second] = formattedDate.match(/\d+/g);

  return format
    .replace("YYYY", year)
    .replace("MM", month)
    .replace("DD", day)
    .replace("HH", hour)
    .replace("mm", minute)
    .replace("ss", second);
}

function dateDifference(date1, date2) {
  const diffTime = Math.abs(date2 - date1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Gün cinsinden fark
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function subtractDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function combination(n, r) {
  return factorial(n) / (factorial(r) * factorial(n - r));
}

function permutation(n, r) {
  return factorial(n) / factorial(n - r);
}
const https = require("https");
const http = require("http");

function fetchData(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;

    client
      .get(url, (response) => {
        let data = "";

        // Gelen veriyi parça parça topluyoruz
        response.on("data", (chunk) => {
          data += chunk;
        });

        // Veri tamamen alındığında çözümleme yapıyoruz
        response.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            resolve(data); // JSON değilse düz metin döndür
          }
        });
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

function postData(url, data) {
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
          resolve(responseData); // JSON değilse düz metin döndür
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    // Gönderilecek veriyi yazıyoruz
    req.write(JSON.stringify(data));
    req.end();
  });
}

function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function wordCount(text) {
  return text.trim().split(/\s+/).length;
}
// Exportlar
module.exports = {
  http: {
    fetchData,
    postData,
  },
  date: {
    formatDate,
    dateDifference,
    addDays,
    subtractDays,
  },
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
    generateSlug,
    wordCount,
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
    combination,
    permutation,
  },
};
