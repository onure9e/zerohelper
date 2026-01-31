import {
  estimateTokens,
  truncateToTokenLimit,
  splitByTokenLimit,
  formatChatMessage,
  createFewShotPrompt,
  mergeSystemAndUser,
  fitMessagesToContext,
  estimateConversationCost,
  getModelTokenLimit,
  getModelPricing,
  extractJSONFromMarkdown,
  parseStreamingChunk,
  isTokenLimitExceeded,
  truncatePromptByPercentage,
  compressConversationHistory,
  ChatMessage
} from '../../functions/ai';

describe('AI Module', () => {
  describe('Token Operations', () => {
    test('estimateTokens should estimate tokens correctly', () => {
      const text = 'Hello world this is a test';
      const tokens = estimateTokens(text);
      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe('number');
    });

    test('estimateTokens should return 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
      expect(estimateTokens(null as any)).toBe(0);
    });

    test('truncateToTokenLimit should truncate text to token limit', () => {
      const longText = 'word '.repeat(100);
      const truncated = truncateToTokenLimit(longText, 10);
      expect(estimateTokens(truncated)).toBeLessThanOrEqual(10);
    });

    test('truncateToTokenLimit should return original if under limit', () => {
      const text = 'Short text';
      expect(truncateToTokenLimit(text, 100)).toBe(text);
    });

    test('splitByTokenLimit should split text into chunks', () => {
      const longText = 'word '.repeat(200);
      const chunks = splitByTokenLimit(longText, 50);
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk: string) => {
        expect(estimateTokens(chunk)).toBeLessThanOrEqual(50);
      });
    });

    test('splitByTokenLimit should handle empty text', () => {
      expect(splitByTokenLimit('', 50)).toEqual([]);
    });
  });

  describe('Prompt Management', () => {
    test('formatChatMessage should create chat message', () => {
      const message = formatChatMessage('user', 'Hello');
      expect(message).toEqual({ role: 'user', content: 'Hello' });
    });

    test('createFewShotPrompt should format few-shot prompt', () => {
      const examples = [
        { input: 'What is 2+2?', output: '4' },
        { input: 'What is 3+3?', output: '6' }
      ];
      const query = 'What is 4+4?';
      const prompt = createFewShotPrompt(examples, query);
      expect(prompt).toContain('Input: What is 2+2?');
      expect(prompt).toContain('Output: 4');
      expect(prompt).toContain('Input: What is 4+4?');
      expect(prompt).toContain('Output:');
    });

    test('mergeSystemAndUser should combine prompts', () => {
      const messages = mergeSystemAndUser('You are helpful', 'Hello');
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ role: 'system', content: 'You are helpful' });
      expect(messages[1]).toEqual({ role: 'user', content: 'Hello' });
    });
  });

  describe('Context Management', () => {
    test('fitMessagesToContext should fit messages within token limit', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Message 1' },
        { role: 'assistant', content: 'Response 1' },
        { role: 'user', content: 'Message 2' },
        { role: 'assistant', content: 'Response 2' }
      ];
      const fitted = fitMessagesToContext(messages, 50);
      expect(fitted.length).toBeLessThanOrEqual(messages.length);
    });

    test('fitMessagesToContext should prioritize recent messages', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Old message' },
        { role: 'user', content: 'New message' }
      ];
      const fitted = fitMessagesToContext(messages, 10);
      if (fitted.length === 1) {
        expect(fitted[0].content).toBe('New message');
      }
    });

    test('compressConversationHistory should compress old messages', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Old 1' },
        { role: 'assistant', content: 'Response 1' },
        { role: 'user', content: 'Old 2' },
        { role: 'assistant', content: 'Response 2' },
        { role: 'user', content: 'Recent 1' },
        { role: 'assistant', content: 'Recent response' }
      ];
      const compressed = compressConversationHistory(messages, 2);
      expect(compressed.length).toBe(3); // summary + 2 recent
      expect(compressed[0].role).toBe('system');
    });
  });

  describe('Cost Estimation', () => {
    test('estimateConversationCost should calculate costs', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];
      const cost = estimateConversationCost(messages, 'gpt-4');
      expect(cost.inputTokens).toBeGreaterThan(0);
      expect(cost.outputTokens).toBeGreaterThan(0);
      expect(cost.inputCost).toBeGreaterThanOrEqual(0);
      expect(cost.outputCost).toBeGreaterThanOrEqual(0);
      expect(cost.totalCost).toBe(cost.inputCost + cost.outputCost);
    });

    test('estimateConversationCost should use default model if not specified', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'Test' }];
      const cost = estimateConversationCost(messages);
      expect(cost.inputTokens).toBeGreaterThan(0);
    });
  });

  describe('Model Information', () => {
    test('getModelTokenLimit should return token limits', () => {
      expect(getModelTokenLimit('gpt-4')).toBe(8192);
      expect(getModelTokenLimit('gpt-4o')).toBe(128000);
      expect(getModelTokenLimit('unknown-model')).toBe(4096); // default
    });

    test('getModelPricing should return pricing', () => {
      const pricing = getModelPricing('gpt-4');
      expect(pricing.input).toBeGreaterThan(0);
      expect(pricing.output).toBeGreaterThan(0);
    });

    test('getModelPricing should return default for unknown model', () => {
      const pricing = getModelPricing('unknown');
      expect(pricing.input).toBeGreaterThan(0);
      expect(pricing.output).toBeGreaterThan(0);
    });
  });

  describe('Output Processing', () => {
    test('extractJSONFromMarkdown should extract JSON from markdown', () => {
      const markdown = '```json\n{"key": "value"}\n```';
      const result = extractJSONFromMarkdown(markdown);
      expect(result).toEqual({ key: 'value' });
    });

    test('extractJSONFromMarkdown should handle plain JSON', () => {
      const json = '{"key": "value"}';
      const result = extractJSONFromMarkdown(json);
      expect(result).toEqual({ key: 'value' });
    });

    test('extractJSONFromMarkdown should return null for invalid JSON', () => {
      expect(extractJSONFromMarkdown('not json')).toBeNull();
      expect(extractJSONFromMarkdown('')).toBeNull();
    });

    test('parseStreamingChunk should parse OpenAI streaming format', () => {
      const chunk = 'data: {"choices": [{"delta": {"content": "Hello"}}]}';
      const result = parseStreamingChunk(chunk);
      expect(result.content).toBe('Hello');
      expect(result.isComplete).toBe(false);
    });

    test('parseStreamingChunk should handle [DONE]', () => {
      const chunk = 'data: [DONE]';
      const result = parseStreamingChunk(chunk);
      expect(result.isComplete).toBe(true);
    });

    test('parseStreamingChunk should handle plain text', () => {
      const chunk = 'Hello world';
      const result = parseStreamingChunk(chunk);
      expect(result.content).toBe('Hello world');
      expect(result.isComplete).toBe(false);
    });
  });

  describe('Utility Functions', () => {
    test('isTokenLimitExceeded should check token limit', () => {
      expect(isTokenLimitExceeded('Hello', 100)).toBe(false);
      expect(isTokenLimitExceeded('word '.repeat(100), 10)).toBe(true);
    });

    test('truncatePromptByPercentage should truncate by percentage', () => {
      const text = 'Hello world test';
      expect(truncatePromptByPercentage(text, 50).length).toBe(8);
      expect(truncatePromptByPercentage(text, 0)).toBe(text);
      expect(truncatePromptByPercentage(text, 100)).toBe('');
    });
  });
});
