import { describe, it, expect, vi } from 'vitest';
import { webPageTool } from '../src/tools/web-page';

// Mock the spider-rs library
const { Website } = vi.hoisted(() => {
  const mockPage = {
    content: '<html><head><title>Test Page</title><meta name="description" content="Test description"></head><body><main><h1>Main Content</h1><p>This is the main content of the page.</p></main></body></html>',
    url: 'https://example.com',
    statusCode: 200,
  };

  const mockWebsite = {
    getPages: vi.fn().mockReturnValue([mockPage]),
    withHeaders: vi.fn(),
    scrape: vi.fn().mockResolvedValue(undefined),
    build: vi.fn().mockReturnThis(),
    withChromeIntercept: vi.fn().mockReturnThis(),
    withBudget: vi.fn().mockReturnThis(),
  };

  return {
    Website: vi.fn().mockImplementation(() => mockWebsite),
  };
});

vi.mock('@spider-rs/spider-rs', () => {
  return {
    Website,
  };
});

describe('webPageTool', () => {
  it('should fetch a single web page successfully', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'setImmediate'] });
    vi.setSystemTime(new Date(2025, 0, 1));
    const resultPromise = webPageTool({
      urls: ['https://example.com'],
      includeImages: false,
      includeLinks: false,
      maxLength: 1000,
      maxRetries: 3,
      retryDelay: 1000,
      concurrency: 5,
    });

    await vi.runAllTimersAsync();
    const result = await resultPromise;
    expect(result.content[0].type).toBe('text');
    const parsedContent = JSON.parse(result.content[0].text);
    expect(parsedContent).toHaveLength(1);
    expect(parsedContent[0].url).toBe('https://example.com');
    expect(parsedContent[0].title).toBe('Test Page');
    expect(parsedContent[0].content).toContain('Main Content');
    expect(parsedContent[0].metadata.description).toBe('Test description');
    vi.useRealTimers();
  }, 10000);

  it('should handle multiple URLs successfully', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'setImmediate'] });
    vi.setSystemTime(new Date(2025, 0, 1));
    const resultPromise = webPageTool({
      urls: ['https://example.com', 'https://example.org'],
      includeImages: false,
      includeLinks: false,
      maxLength: 1000,
      maxRetries: 3,
      retryDelay: 1000,
      concurrency: 5,
    });

    await vi.runAllTimersAsync();
    const result = await resultPromise;
    expect(result.content[0].type).toBe('text');
    const parsedContent = JSON.parse(result.content[0].text);
    expect(parsedContent).toHaveLength(2);
    expect(parsedContent[0].url).toBe('https://example.com');
    expect(parsedContent[1].url).toBe('https://example.org');
    vi.useRealTimers();
  }, 10000);

  it('should handle error for a single URL', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'setImmediate'] });
    vi.setSystemTime(new Date(2025, 0, 1));
    // Mock error scenario for all retry attempts
    const errorMockImplementation = vi.fn().mockImplementation(() => {
      const mockWebsite = {
        getPages: vi.fn().mockReturnValue([]),
        withHeaders: vi.fn(),
        scrape: vi.fn().mockRejectedValue(new Error('Network error')),
        build: vi.fn().mockReturnThis(),
        withChromeIntercept: vi.fn().mockReturnThis(),
        withBudget: vi.fn().mockReturnThis(),
      };
      return mockWebsite;
    });
    vi.mocked(Website).mockImplementation(errorMockImplementation);

    const resultPromise = webPageTool({
      urls: ['https://error.com'],
      includeImages: false,
      includeLinks: false,
      maxLength: 1000,
      maxRetries: 3,
      retryDelay: 1000,
      concurrency: 5,
    });

    await vi.runAllTimersAsync();
    const result = await resultPromise;
    expect(result.content[0].type).toBe('text');
    const parsedContent = JSON.parse(result.content[0].text);
    expect(parsedContent).toHaveLength(1);
    expect(parsedContent[0].url).toBe('https://error.com');
    expect(parsedContent[0].error).toBeDefined();
    expect(parsedContent[0].error).toBe('Network error');
    vi.useRealTimers();
  }, 10000);

  it('should handle mixed success and error for multiple URLs', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'setImmediate'] });
    vi.setSystemTime(new Date(2025, 0, 1));
    // First call succeeds, second call fails
    const mockImplementation = vi.fn()
      .mockImplementationOnce(() => {
        const mockPage = {
          content: '<html><head><title>Success Page</title></head><body><main>Success content</main></body></html>',
          url: 'https://success.com',
          statusCode: 200,
        };
        const mockWebsite = {
          getPages: vi.fn().mockReturnValue([mockPage]),
          withHeaders: vi.fn(),
          scrape: vi.fn().mockResolvedValue(undefined),
          build: vi.fn().mockReturnThis(),
          withChromeIntercept: vi.fn().mockReturnThis(),
          withBudget: vi.fn().mockReturnThis(),
        };
        return mockWebsite;
      })
      .mockImplementationOnce(() => {
        const mockWebsite = {
          getPages: vi.fn().mockReturnValue([]),
          withHeaders: vi.fn(),
          scrape: vi.fn().mockRejectedValue(new Error('Network error')),
          build: vi.fn().mockReturnThis(),
          withChromeIntercept: vi.fn().mockReturnThis(),
          withBudget: vi.fn().mockReturnThis(),
        };
        return mockWebsite;
      });

    vi.mocked(Website).mockImplementation(mockImplementation);

    const resultPromise = webPageTool({
      urls: ['https://success.com', 'https://error.com'],
      includeImages: false,
      includeLinks: false,
      maxLength: 1000,
      maxRetries: 3,
      retryDelay: 1000,
      concurrency: 5,
    });

    await vi.runAllTimersAsync();
    const result = await resultPromise;
    expect(result.content[0].type).toBe('text');
    const parsedContent = JSON.parse(result.content[0].text);
    expect(parsedContent).toHaveLength(2);
    expect(parsedContent[0].url).toBe('https://success.com');
    expect(parsedContent[0].error).toBeUndefined();
    expect(parsedContent[1].url).toBe('https://error.com');
    expect(parsedContent[1].error).toBeDefined();
    vi.useRealTimers();
  }, 10000);

  it('should truncate content when maxLength is exceeded', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'setImmediate'] });
    vi.setSystemTime(new Date(2025, 0, 1));
    let longContent = '<html><head><title>Long Page</title></head><body><main>';
    for (let i = 0; i < 1000; i++) {
      longContent += `This is a very long sentence number ${i}. `;
    }
    longContent += '</main></body></html>';

    vi.mocked(Website).mockImplementationOnce(() => {
      const mockPage = {
        content: longContent,
        url: 'https://long.com',
        statusCode: 200,
      };
      const mockWebsite = {
        getPages: vi.fn().mockReturnValue([mockPage]),
        withHeaders: vi.fn(),
        scrape: vi.fn().mockResolvedValue(undefined),
        build: vi.fn().mockReturnThis(),
        withChromeIntercept: vi.fn().mockReturnThis(),
        withBudget: vi.fn().mockReturnThis(),
      };
      return mockWebsite;
    });

    const resultPromise = webPageTool({
      urls: ['https://long.com'],
      includeImages: false,
      includeLinks: false,
      maxLength: 50,
      maxRetries: 3,
      retryDelay: 1000,
      concurrency: 5,
    });

    await vi.runAllTimersAsync();
    const result = await resultPromise;
    expect(result.content[0].type).toBe('text');
    const parsedContent = JSON.parse(result.content[0].text);
    expect(parsedContent[0].content.length).toBe(53); // 50 + '...'
    expect(parsedContent[0].content).toMatch(/.+...$/);
    vi.useRealTimers();
  }, 10000);
});