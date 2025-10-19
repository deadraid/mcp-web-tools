import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
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
    .int()
    .min(1)
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
    .int()
    .min(1)
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
export type WebSearchArgs = z.input<typeof webSearchSchema>;

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

interface ExtractedLink {
  href: string;
  title: string;
  snippet: string;
}

export async function webSearchTool(
  input: WebSearchInput
): Promise<CallToolResult> {
  try {
    const results = await withRetry(
      () => performWebSearch(input),
      input.maxRetries,
      input.retryDelay
    );

    const payload = {
      query: input.query,
      results: results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        source: r.source,
      })),
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(payload, null, 2),
        },
      ],
      structuredContent: payload,
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
  const { query, maxResults, region, time } = input;

  const buildSearchUrl = (baseUrl: string) => {
    const params = new URLSearchParams({ q: query });
    if (region) {
      params.set('kl', region);
    }
    if (time) {
      params.set('df', time);
    }
    return `${baseUrl}?${params.toString()}`;
  };

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

  const primaryUrl = buildSearchUrl('https://duckduckgo.com/html/');
  let page = await fetchSearch(primaryUrl);

  // Fallback to lite version if needed
  if (!page?.content || (page.statusCode && page.statusCode >= 400)) {
    const liteUrl = buildSearchUrl('https://lite.duckduckgo.com/lite/');
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
    const extractLink = (_: number, el: Element): ExtractedLink | null => {
      const $el = $(el);
      const hrefAttr = $el.attr('href');
      if (!hrefAttr) return null;

      try {
        const url = new URL(hrefAttr, baseUrl);
        const snippet = extractSnippet($, $el);

        if (url.hostname.endsWith('duckduckgo.com') && url.pathname === '/l/') {
          const targetUrl = url.searchParams.get('uddg');
          if (targetUrl) {
            return {
              href: targetUrl,
              title: $el.text().trim(),
              snippet,
            };
          }
        }
        return {
          href: url.toString(),
          title: $el.text().trim(),
          snippet,
        };
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
    const liteUrl = buildSearchUrl('https://lite.duckduckgo.com/lite/');
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
    title: link.title,
    url: link.href,
    snippet: link.snippet,
    source: new URL(link.href).hostname,
  }));

  return results;
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

function extractSnippet(
  $: cheerio.CheerioAPI,
  linkElement: cheerio.Cheerio<Element>
): string {
  const snippetSelectors = [
    '.result__snippet',
    '.result__snippet.js-result-snippet',
    '.result__snippet.js-snippet',
    '.result__description',
    '.result-snippet',
    'td.result-snippet',
  ];

  const containers = [
    linkElement.closest('.result'),
    linkElement.closest('.web-result'),
    linkElement.closest('.result__body'),
    linkElement.parent(),
  ];

  for (const container of containers) {
    if (!container || !container.length) continue;
    for (const selector of snippetSelectors) {
      const text = container.find(selector).first().text().trim();
      if (text) {
        return text;
      }
    }
  }

  const tableRow = linkElement.closest('tr');
  if (tableRow.length) {
    const snippetRow = tableRow.next('tr');
    if (snippetRow.length) {
      const text = snippetRow
        .find('td.result-snippet, .result-snippet')
        .first()
        .text()
        .trim();
      if (text) {
        return text;
      }
      const fallbackText = snippetRow.text().trim();
      if (fallbackText) {
        return fallbackText;
      }
    }
  }

  const titleAttr = linkElement.attr('title');
  return titleAttr ? titleAttr.trim() : '';
}
