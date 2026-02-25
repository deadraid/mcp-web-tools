import { describe, it, expect } from 'vitest';
import { downloadFilesSchema } from '../src/tools/download-files.js';

describe('downloadFilesTool', () => {
  it('should validate input schema correctly', () => {
    const validInput = {
      urls: ['https://example.com/file.txt'],
      directory: '/tmp/downloads',
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      concurrency: 5
    };

    expect(() => downloadFilesSchema.parse(validInput)).not.toThrow();

    const invalidInput = {
      urls: ['not-a-url'],
      directory: '/tmp/downloads',
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      concurrency: 5
    };

    expect(() => downloadFilesSchema.parse(invalidInput)).toThrow();
  });
});