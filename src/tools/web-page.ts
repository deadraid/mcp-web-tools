import { Website } from '@spider-rs/spider-rs';
import * as cheerio from 'cheerio';
import { z } from 'zod';
import TurndownService from 'turndown';

import { withRetry } from '../utils/retry.js';
import pLimit from 'p-limit';

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
    .default(50000)
    .describe(
      'Maximum length of content to return (default: 50000 characters)'
    ),
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
  concurrency: z
    .number()
    .optional()
    .default(5)
    .describe('Maximum number of parallel requests'),
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
  const limit = pLimit(input.concurrency);
  const tasks = input.urls.map((url) =>
    limit(async () => {
      try {
        return await withRetry(
          () => fetchWebPage({ ...input, url }),
          input.maxRetries,
          input.retryDelay
        );
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
        } as WebPageResult;
      }
    })
  );

  const settled = await Promise.allSettled(tasks);
  const results: WebPageResult[] = settled.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          url: input.urls[i],
          title: 'Error',
          content: '',
          metadata: {},
          error:
            r.reason instanceof Error
              ? r.reason.message
              : String(r.reason) || 'Unknown error occurred',
        }
  );

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(results, null, 2),
      },
    ],
  };
}

async function fetchWebPage(
  input: WebPageInput & { url: string }
): Promise<WebPageResult> {
  const { url, includeImages, includeLinks, maxLength } = input;

  const w = new Website(url)
    .withChromeIntercept(true, true)
    .withBudget({ '*': 3 })
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

  // Try to find main content area first
  let contentHtml = '';
  const mainSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.main-content',
    '.content',
    '.post-content',
    '.entry-content',
  ];

  for (const selector of mainSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      contentHtml = element.html() || '';
      break;
    }
  }

  // If no main content found, fall back to body
  if (!contentHtml) {
    contentHtml = $('body').html() || '';
  }

  // Convert HTML to markdown with optimized settings
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    strongDelimiter: '**',
    emDelimiter: '*',
  });

  // Configure turndown to keep more content
  turndownService.keep(['del', 'ins', 'mark', 'sup', 'sub']);

  // Add custom rules for better content preservation
  turndownService.addRule('preserveCodeBlocks', {
    filter: ['pre', 'code'],
    replacement: function (content) {
      return '\n```\n' + content + '\n```\n';
    },
  });

  let content = turndownService.turndown(contentHtml);

  // Truncate if needed (after markdown conversion to match test expectations)
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
    const imageUrls: string[] = [];
    $('img').each((_, img) => {
      const src = $(img).attr('src');
      if (src && !src.startsWith('data:')) {
        try {
          const resolvedUrl = new URL(src, url).toString();
          imageUrls.push(resolvedUrl);
        } catch (error) {
          console.log(
            `[web-page] Failed to resolve image URL: ${src} relative to ${url}`,
            error
          );
        }
      }
    });
    images = imageUrls;
  }

  // Extract links if requested
  let links: string[] | undefined;
  if (includeLinks) {
    const linkUrls: string[] = [];
    $('a[href]').each((_, a) => {
      const href = $(a).attr('href');
      if (href && !href.startsWith('#') && !href.startsWith('mailto:')) {
        try {
          const resolvedUrl = new URL(href, url).toString();
          linkUrls.push(resolvedUrl);
        } catch (error) {
          console.log(
            `[web-page] Failed to resolve link URL: ${href} relative to ${url}`,
            error
          );
        }
      }
    });
    links = linkUrls;
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
