// AI Utility Functions
// LLM/AI çalışmaları için yardımcı fonksiyonlar

// Chat message tipi
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Maliyet tahmini tipi
export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

// Streaming response tipi
export interface StreamingResponse {
  content: string;
  finishReason?: string;
  isComplete: boolean;
}

// Model bilgileri
const MODEL_TOKEN_LIMITS: Record<string, number> = {
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-4-turbo': 128000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-3.5-turbo': 4096,
  'gpt-3.5-turbo-16k': 16384,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'claude-2': 100000,
  'gemini-pro': 32768,
  'gemini-ultra': 32768,
  'default': 4096,
};

// Model fiyatları (per 1K tokens - USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-32k': { input: 0.06, output: 0.12 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
  'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'claude-2': { input: 0.008, output: 0.024 },
  'gemini-pro': { input: 0.0005, output: 0.0015 },
  'gemini-ultra': { input: 0.001, output: 0.003 },
  'default': { input: 0.001, output: 0.002 },
};

// Token İşlemleri

/**
 * Metin için yaklaşık token sayısı hesaplar
 * Basit heuristic: kelime başına ~1.3 token, karakter başına ~0.25 token
 * @param text - Token sayısı hesaplanacak metin
 * @returns Yaklaşık token sayısı
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) return 0;
  
  // Kelime sayısı (boşluklara göre)
  const wordCount = text.trim().split(/\s+/).length;
  // Karakter sayısı
  const charCount = text.length;
  
  // Heuristic: kelime başına 1.3 token + karakter başına 0.25 token
  // Bu yaklaşık bir tahmindir, tiktoken gibi kütüphaneler daha doğrudur
  const estimatedTokens = Math.ceil(wordCount * 1.3 + charCount * 0.25);
  
  return estimatedTokens;
}

/**
 * Metni belirli bir token limitine göre kırpar
 * @param text - Kırpılacak metin
 * @param maxTokens - Maksimum token sayısı
 * @returns Kırpılmış metin
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  if (!text || estimateTokens(text) <= maxTokens) {
    return text;
  }
  
  // Binary search ile doğru kesme noktasını bul
  let left = 0;
  let right = text.length;
  let bestLength = 0;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const truncated = text.substring(0, mid);
    const tokens = estimateTokens(truncated);
    
    if (tokens <= maxTokens) {
      bestLength = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  
  return text.substring(0, bestLength);
}

/**
 * Metni belirli token limitlerinde parçalara böler
 * @param text - Bölünecek metin
 * @param maxTokens - Her parça için maksimum token sayısı
 * @returns Metin parçaları dizisi
 */
export function splitByTokenLimit(text: string, maxTokens: number): string[] {
  if (!text || text.length === 0) return [];
  
  const chunks: string[] = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    if (estimateTokens(remaining) <= maxTokens) {
      chunks.push(remaining);
      break;
    }
    
    // Binary search ile token limitine sığan en uzun kısmı bul
    let left = 0;
    let right = remaining.length;
    let bestLength = 0;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const testText = remaining.substring(0, mid);
      const tokens = estimateTokens(testText);
      
      if (tokens <= maxTokens) {
        bestLength = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    // En iyi kesme noktasını bul (cümle/paragraf/kelime sonu)
    let cutPoint = findBestCutPoint(remaining, bestLength);
    
    chunks.push(remaining.substring(0, cutPoint));
    remaining = remaining.substring(cutPoint).trim();
  }
  
  return chunks;
}

/**
 * En iyi kesme noktasını bulur (cümle/paragraf sonu tercih eder)
 */
function findBestCutPoint(text: string, maxLength: number): number {
  // Cümle sonu ara (.!? followed by space)
  const textToSearch = text.substring(0, maxLength);
  const sentenceMatches = textToSearch.match(/[.!?]\s+/g);
  if (sentenceMatches) {
    const lastSentenceEnd = textToSearch.lastIndexOf(sentenceMatches[sentenceMatches.length - 1]);
    if (lastSentenceEnd > maxLength * 0.5) {
      return lastSentenceEnd + 2;
    }
  }
  
  // Paragraf sonu ara
  const paragraphEnd = textToSearch.lastIndexOf('\n\n');
  if (paragraphEnd > maxLength * 0.3) {
    return paragraphEnd + 2;
  }
  
  // Kelime sonu ara
  const lastSpace = textToSearch.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.8) {
    return lastSpace + 1;
  }
  
  return maxLength;
}

// Prompt Yönetimi

/**
 * Chat mesajı formatında oluşturur
 * @param role - Mesaj rolü (system/user/assistant)
 * @param content - Mesaj içeriği
 * @returns ChatMessage objesi
 */
export function formatChatMessage(role: 'system' | 'user' | 'assistant', content: string): ChatMessage {
  return { role, content };
}

/**
 * Few-shot öğrenme için prompt oluşturur
 * @param examples - Örnek input/output çiftleri
 * @param query - Kullanıcının sorgusu
 * @returns Formatlanmış few-shot prompt
 */
export function createFewShotPrompt(
  examples: Array<{ input: string; output: string }>,
  query: string
): string {
  let prompt = '';
  
  for (const example of examples) {
    prompt += `Input: ${example.input}\n`;
    prompt += `Output: ${example.output}\n\n`;
  }
  
  prompt += `Input: ${query}\n`;
  prompt += 'Output:';
  
  return prompt;
}

/**
 * Sistem ve kullanıcı promptlarını chat mesajlarına dönüştürür
 * @param systemPrompt - Sistem talimatları
 * @param userPrompt - Kullanıcı sorgusu
 * @returns ChatMessage dizisi
 */
export function mergeSystemAndUser(systemPrompt: string, userPrompt: string): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
}

// Context & Conversation

/**
 * Mesajları context penceresine sığdırır (eski mesajları çıkarır)
 * @param messages - Mevcut mesajlar
 * @param maxTokens - Maksimum token sayısı
 * @returns Sığdırılmış mesajlar
 */
export function fitMessagesToContext(
  messages: ChatMessage[],
  maxTokens: number
): ChatMessage[] {
  if (!messages || messages.length === 0) return [];
  
  let totalTokens = 0;
  const fittedMessages: ChatMessage[] = [];
  
  // Sondan başa doğru ekle (en yeni mesajlar önemli)
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const messageTokens = estimateTokens(message.content) + 4; // +4 for role tokens
    
    if (totalTokens + messageTokens <= maxTokens) {
      fittedMessages.unshift(message);
      totalTokens += messageTokens;
    } else {
      break;
    }
  }
  
  return fittedMessages;
}

/**
 * Konuşma maliyetini tahmin eder
 * @param messages - Mesajlar
 * @param model - Model adı
 * @param expectedOutputTokens - Beklenen output token sayısı (varsayılan: input'un %50'si)
 * @returns Maliyet tahmini
 */
export function estimateConversationCost(
  messages: ChatMessage[],
  model: string = 'default',
  expectedOutputTokens?: number
): CostEstimate {
  // Input token sayısı
  let inputTokens = 0;
  for (const message of messages) {
    inputTokens += estimateTokens(message.content) + 4; // +4 for role tokens
  }
  
  // Output token sayısı (tahmin)
  const outputTokens = expectedOutputTokens ?? Math.ceil(inputTokens * 0.5);
  
  // Fiyatları al
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['default'];
  
  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;
  
  return {
    inputTokens,
    outputTokens,
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost
  };
}

// Model Bilgileri

/**
 * Model için context limitini döndürür
 * @param model - Model adı
 * @returns Token limiti
 */
export function getModelTokenLimit(model: string): number {
  return MODEL_TOKEN_LIMITS[model] || MODEL_TOKEN_LIMITS['default'];
}

/**
 * Model için fiyat bilgilerini döndürür
 * @param model - Model adı
 * @returns Input ve output fiyatları (per 1K tokens)
 */
export function getModelPricing(model: string): { input: number; output: number } {
  return MODEL_PRICING[model] || MODEL_PRICING['default'];
}

// Output İşlemleri

/**
 * Markdown formatındaki metinden JSON çıkarır
 * @param text - Markdown formatındaki metin (```json ... ```)
 * @returns Parse edilmiş JSON objesi veya null
 */
export function extractJSONFromMarkdown(text: string): any {
  if (!text) return null;
  
  // ```json ... ``` veya ``` ... ``` bloklarını ara
  const jsonRegex = /```(?:json)?\s*([\s\S]*?)```/;
  const match = text.match(jsonRegex);
  
  if (match && match[1]) {
    try {
      return JSON.parse(match[1].trim());
    } catch {
      return null;
    }
  }
  
  // Markdown yoksa direkt parse dene
  try {
    return JSON.parse(text.trim());
  } catch {
    return null;
  }
}

/**
 * Streaming response chunk'ını parse eder
 * @param chunk - Streaming chunk
 * @returns StreamingResponse objesi
 */
export function parseStreamingChunk(chunk: string): StreamingResponse {
  if (!chunk) {
    return { content: '', isComplete: true };
  }
  
  // OpenAI formatı: data: {...}
  if (chunk.startsWith('data: ')) {
    const jsonStr = chunk.substring(6).trim();
    
    if (jsonStr === '[DONE]') {
      return { content: '', isComplete: true };
    }
    
    try {
      const data = JSON.parse(jsonStr);
      const content = data.choices?.[0]?.delta?.content || '';
      const finishReason = data.choices?.[0]?.finish_reason;
      
      return {
        content,
        finishReason,
        isComplete: finishReason !== null && finishReason !== undefined
      };
    } catch {
      return { content: '', isComplete: false };
    }
  }
  
  // Düz metin
  return {
    content: chunk,
    isComplete: false
  };
}

// Yardımcı Fonksiyonlar

/**
 * Prompt için token sayısı kontrolü yapar ve limit aşımı durumunda uyarır
 * @param prompt - Kontrol edilecek prompt
 * @param maxTokens - Maksimum token sayısı
 * @returns Limit aşıldıysa true
 */
export function isTokenLimitExceeded(prompt: string, maxTokens: number): boolean {
  return estimateTokens(prompt) > maxTokens;
}

/**
 * Prompt'u belirli bir yüzde oranında kısaltır
 * @param prompt - Kısaltılacak prompt
 * @param percentage - Kısaltma yüzdesi (0-100)
 * @returns Kısaltılmış prompt
 */
export function truncatePromptByPercentage(prompt: string, percentage: number): string {
  if (percentage <= 0) return prompt;
  if (percentage >= 100) return '';
  
  const targetLength = Math.floor(prompt.length * (1 - percentage / 100));
  return prompt.substring(0, targetLength);
}

/**
 * Konuşma geçmişini özetlemek için mesajları sıkıştırır
 * (Eski mesajları birleştirir, son N mesajı ayrı tutar)
 * @param messages - Tüm mesajlar
 * @param keepRecent - Son tutulacak mesaj sayısı
 * @param maxSummaryTokens - Özet için ayrılacak token sayısı
 * @returns Sıkıştırılmış mesajlar
 */
export function compressConversationHistory(
  messages: ChatMessage[],
  keepRecent: number = 4,
  maxSummaryTokens: number = 500
): ChatMessage[] {
  if (messages.length <= keepRecent) {
    return messages;
  }
  
  // Son mesajları ayır
  const recentMessages = messages.slice(-keepRecent);
  
  // Eski mesajları al ve özetle (basit birleştirme)
  const oldMessages = messages.slice(0, -keepRecent);
  let summary = 'Previous conversation summary:\n';
  
  for (const msg of oldMessages) {
    const prefix = msg.role === 'user' ? 'User' : 'Assistant';
    summary += `${prefix}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}\n`;
  }
  
  // Özeti kırp
  summary = truncateToTokenLimit(summary, maxSummaryTokens);
  
  return [
    { role: 'system', content: summary },
    ...recentMessages
  ];
}
