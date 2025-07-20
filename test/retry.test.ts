import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../src/utils/retry';

describe('withRetry', () => {
  it('should succeed on first attempt', async () => {
    const mockFn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(mockFn, 3, 100);
    
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry and succeed on second attempt', async () => {
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue('success');
    
    const result = await withRetry(mockFn, 3, 10);
    
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should fail after max retries', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Persistent error'));
    
    await expect(withRetry(mockFn, 3, 10)).rejects.toThrow('Persistent error');
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should not retry on 4xx errors', async () => {
    const error = new Error('Not found');
    (error as any).statusCode = 404;
    const mockFn = vi.fn().mockRejectedValue(error);
    
    await expect(withRetry(mockFn, 3, 100)).rejects.toThrow('Not found');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on 429 errors', async () => {
    const error = new Error('Rate limit');
    (error as any).statusCode = 429;
    const mockFn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('success');
    
    const result = await withRetry(mockFn, 3, 10);
    
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});