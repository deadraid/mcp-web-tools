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
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'setImmediate'] });
    vi.setSystemTime(new Date(2025, 0, 1));
    
    // Act
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
    
    // Assert
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
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'setImmediate'] });
    vi.setSystemTime(new Date(2025, 0, 1));
    
    // Act
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
    
    // Assert
    expect(result.content[0].type).toBe('text');
    const parsedContent = JSON.parse(result.content[0].text);
    expect(parsedContent).toHaveLength(2);
    expect(parsedContent[0].url).toBe('https://example.com');
    expect(parsedContent[1].url).toBe('https://example.org');
    vi.useRealTimers();
  }, 10000);

  it('should handle error for a single URL', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'setImmediate'] });
    vi.setSystemTime(new Date(2025, 0, 1));
    
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

    // Act
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
    
    // Assert
    expect(result.content[0].type).toBe('text');
    const parsedContent = JSON.parse(result.content[0].text);
    expect(parsedContent).toHaveLength(1);
    expect(parsedContent[0].url).toBe('https://error.com');
    expect(parsedContent[0].error).toBeDefined();
    expect(parsedContent[0].error).toBe('Network error');
    vi.useRealTimers();
  }, 10000);

  it('should handle mixed success and error for multiple URLs', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'setImmediate'] });
    vi.setSystemTime(new Date(2025, 0, 1));
    
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

    // Act
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
    
    // Assert
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
    // Arrange
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

    // Act
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
    
    // Assert
    expect(result.content[0].type).toBe('text');
    const parsedContent = JSON.parse(result.content[0].text);
    expect(parsedContent[0].content.length).toBe(53); // 50 + '...'
    expect(parsedContent[0].content).toMatch(/.+...$/);
    vi.useRealTimers();
  }, 10000);

  it('should preserve navigation and other content without aggressive filtering', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'setImmediate'] });
    vi.setSystemTime(new Date(2025, 0, 1));
    
    const mockContentWithNav = `
      <html>
        <head><title>Page with Navigation</title></head>
        <body>
          <nav>
            <a href="/home">Home</a>
            <a href="/about">About</a>
          </nav>
          <header>
            <h1>Website Header</h1>
          </header>
          <main>
            <h1>Main Content</h1>
            <p>This is the main content.</p>
          </main>
          <aside>
            <h2>Sidebar</h2>
            <p>Sidebar content</p>
          </aside>
          <footer>
            <p>Footer content</p>
          </footer>
        </body>
      </html>
    `;

    vi.mocked(Website).mockImplementationOnce(() => {
      const mockPage = {
        content: mockContentWithNav,
        url: 'https://nav-test.com',
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

    // Act
    const resultPromise = webPageTool({
      urls: ['https://nav-test.com'],
      includeImages: false,
      includeLinks: false,
      maxLength: 2000,
      maxRetries: 3,
      retryDelay: 1000,
      concurrency: 5,
    });

    await vi.runAllTimersAsync();
    const result = await resultPromise;
    
    // Assert
    expect(result.content[0].type).toBe('text');
    const parsedContent = JSON.parse(result.content[0].text);
    expect(parsedContent[0].content).toContain('Main Content');
    expect(parsedContent[0].content).toContain('This is the main content');
    
    vi.useRealTimers();
  }, 10000);

  it('should preserve all content when no main content element exists', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'setImmediate'] });
    vi.setSystemTime(new Date(2025, 0, 1));
    
    const mockContentWithoutMain = `
      <html>
        <head><title>Page without Main Element</title></head>
        <body>
          <nav>
            <a href="/home">Home</a>
            <a href="/about">About</a>
          </nav>
          <header>
            <h1>Website Header</h1>
          </header>
          <div>
            <h1>Main Content</h1>
            <p>This is the content without main element.</p>
          </div>
          <aside>
            <h2>Sidebar</h2>
            <p>Sidebar content</p>
          </aside>
          <footer>
            <p>Footer content</p>
          </footer>
        </body>
      </html>
    `;

    vi.mocked(Website).mockImplementationOnce(() => {
      const mockPage = {
        content: mockContentWithoutMain,
        url: 'https://no-main-test.com',
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

    // Act
    const resultPromise = webPageTool({
      urls: ['https://no-main-test.com'],
      includeImages: false,
      includeLinks: false,
      maxLength: 2000,
      maxRetries: 3,
      retryDelay: 1000,
      concurrency: 5,
    });

    await vi.runAllTimersAsync();
    const result = await resultPromise;
    
    // Assert
    expect(result.content[0].type).toBe('text');
    const parsedContent = JSON.parse(result.content[0].text);
    expect(parsedContent[0].content).toContain('Home');
    expect(parsedContent[0].content).toContain('About');
    expect(parsedContent[0].content).toContain('Website Header');
    expect(parsedContent[0].content).toContain('Sidebar');
    expect(parsedContent[0].content).toContain('Footer content');
    expect(parsedContent[0].content).toContain('Main Content');
    
    vi.useRealTimers();
  }, 10000);
});