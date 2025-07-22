import { Website } from '@spider-rs/spider-rs';
import * as cheerio from 'cheerio';
import { z } from 'zod';

import { withRetry } from '../utils/retry.js';

export const webPageSchema = z.object({
  urls: z.array(z.string()).describe('URLs of the web pages to fetch'),
  includeImages: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include images in the response'),
  includeLinks: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include links in the response'),
  maxLength: z
    .number()
    .optional()
    .default(8000)
    .describe('Maximum length of content to return'),
  maxRetries: z
    .number()
    .optional()
    .default(3)
    .describe('Maximum number of retry attempts for failed requests'),
  retryDelay: z
    .number()
    .optional()
    .default(1000)
    .describe('Base delay in milliseconds between retry attempts'),
});

export type WebPageInput = z.infer<typeof webPageSchema>;

interface WebPageResult {
  url: string;
  title: string;
  content: string;
  images?: string[];
  links?: string[];
  metadata: {
    description?: string;
    keywords?: string;
    author?: string;
    publishDate?: string;
  };
  error?: string;
}

export async function webPageTool(input: WebPageInput) {
  try {
    const results = await Promise.all(
      input.urls.map(async (url) => {
        try {
          const result = await withRetry(
            () => fetchWebPage({ ...input, url }),
            input.maxRetries,
            input.retryDelay
          );
          return result;
        } catch (error) {
          return {
            url,
            title: 'Error',
            content: '',
            metadata: {},
            error:
              error instanceof Error
                ? error.message
                : String(error) || 'Unknown error occurred',
          };
        }
      })
    );

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            [
              {
                url: input.urls[0],
                title: 'Error',
                content: '',
                metadata: {},
                error: error instanceof Error ? error.message : String(error),
              },
            ],
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}

async function fetchWebPage(
  input: WebPageInput & { url: string }
): Promise<WebPageResult> {
  const { url, includeImages, includeLinks, maxLength } = input;

  const w = new Website(url)
    .withChromeIntercept(true, true)
    .withBudget({ '*': 1 })
    .build();

  w.withHeaders({
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'Accept-Language': 'en-US,en;q=0.9',
  });

  await w.scrape();
  const page = w.getPages()[0];

  if (!page?.content) {
    throw new Error(`Failed to fetch content from ${url}`);
  }

  const $ = cheerio.load(page.content);

  // Extract title
  const title = $('title').text().trim() || 'No title found';

  // Remove script and style elements
  $('script, style, nav, footer, aside, .advertisement, .ads').remove();

  // Extract main content
  const contentSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '.main-content',
    '.post-content',
    '.entry-content',
    'body',
  ];

  let content = '';
  for (const selector of contentSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      content = element.text().trim();
      break;
    }
  }

  if (!content) {
    content = $('body').text().trim();
  }

  // Truncate content if needed
  if (content.length > maxLength) {
    content = content.substring(0, maxLength) + '...';
  }

  // Extract metadata
  const metadata = {
    description: $('meta[name="description"]').attr('content'),
    keywords: $('meta[name="keywords"]').attr('content'),
    author: $('meta[name="author"]').attr('content'),
    publishDate:
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="publishdate"]').attr('content'),
  };

  // Extract images if requested
  let images: string[] | undefined;
  if (includeImages) {
    images = $('img')
      .map((_, img) => {
        const src = $(img).attr('src');
        if (src && !src.startsWith('data:')) {
          try {
            return new URL(src, url).toString();
          } catch {
            return null;
          }
        }
        return null;
      })
      .get()
      .filter((src): src is string => src !== null);
  }

  // Extract links if requested
  let links: string[] | undefined;
  if (includeLinks) {
    links = $('a[href]')
      .map((_, a) => {
        const href = $(a).attr('href');
        if (href && !href.startsWith('#') && !href.startsWith('mailto:')) {
          try {
            return new URL(href, url).toString();
          } catch {
            return null;
          }
        }
        return null;
      })
      .get()
      .filter((href): href is string => href !== null);
  }

  return {
    url,
    title,
    content,
    images,
    links,
    metadata,
  };
}
