import { Website } from '@spider-rs/spider-rs';
// Cheerio core
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

import { z } from 'zod';

import { withRetry } from '../utils/retry.js';

export const webSearchSchema = z.object({
  query: z.string().describe('Search query to execute'),
  maxResults: z
    .number()
    .optional()
    .default(10)
    .describe('Maximum number of results to return'),
  region: z
    .string()
    .optional()
    .default('wt-wt')
    .describe('Region for search results'),
  time: z
    .string()
    .optional()
    .describe('Time filter for search results (d, w, m, y)'),
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

export type WebSearchInput = z.infer<typeof webSearchSchema>;

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export async function webSearchTool(input: WebSearchInput) {
  try {
    const results = await withRetry(
      () => performWebSearch(input),
      input.maxRetries,
      input.retryDelay
    );

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              query: input.query,
              results: results.map((r) => ({
                title: r.title,
                url: r.url,
                snippet: r.snippet,
                source: r.source,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error performing web search after ${
            input.maxRetries
          } attempts: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
}

async function performWebSearch(
  input: WebSearchInput
): Promise<SearchResult[]> {
  const maxResults = input.maxResults || 10;
  const query = input.query;

  async function fetchSearch(url: string) {
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
      Referer: 'https://duckduckgo.com/',
    });
    await w.scrape();
    return w.getPages()[0] ?? null;
  }

  const primaryUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(
    query
  )}`;
  let page = await fetchSearch(primaryUrl);

  // Fallback to lite version if needed
  if (!page?.content || (page.statusCode && page.statusCode >= 400)) {
    const liteUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(
      query
    )}`;
    page = await fetchSearch(liteUrl);
  }

  if (!page) {
    throw new Error(`No results retrieved for query "${query}"`);
  }

  // Helper to resolve relative URLs and extract DDG redirect links
  const extractLinks = (
    $: cheerio.CheerioAPI,
    baseUrl: string,
    selector: string
  ) => {
    const extractLink = (_: number, el: Element) => {
      const $el = $(el);
      const hrefAttr = $el.attr('href');
      if (!hrefAttr) return null;

      try {
        const url = new URL(hrefAttr, baseUrl);

        if (url.hostname.endsWith('duckduckgo.com') && url.pathname === '/l/') {
          const targetUrl = url.searchParams.get('uddg');
          if (targetUrl) {
            return { href: targetUrl, text: $el.text().trim() };
          }
        }
        return { href: url.toString(), text: $el.text().trim() };
      } catch {
        return null;
      }
    };
    return ($(selector) as unknown as cheerio.Cheerio<Element>)
      .map(extractLink)
      .get()
      .filter(isNotNull);
  };

  // Load once, then try different selectors
  const $ = cheerio.load(page.content || '');
  let links = extractLinks($, page.url, 'a.result__a');

  // Lite selectors fallback
  if (!links.length) {
    links = extractLinks($, page.url, 'td.result-link > a, a.result-link');
  }

  links = links.slice(0, maxResults);

  // Last resort – retry lite interface directly if not already done
  if (!links.length) {
    const liteUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(
      query
    )}`;
    const litePage = await fetchSearch(liteUrl);
    if (litePage && litePage.content) {
      const $lite = cheerio.load(litePage.content);
      links = extractLinks(
        $lite,
        litePage.url,
        'td.result-link > a, a.result-link, a.result__a'
      ).slice(0, maxResults);
    }
  }

  if (!links.length) {
    throw new Error(`No search results parsed for query "${query}".`);
  }

  // Convert to SearchResult format
  const results: SearchResult[] = links.map((link) => ({
    title: link.text,
    url: link.href,
    snippet: '', // We could add snippet extraction here if needed
    source: new URL(link.href).hostname,
  }));

  return results;
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}
