#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { webPageTool, webPageSchema } from '../tools/web-page.js';
import { webSearchTool, webSearchSchema } from '../tools/web-search.js';
import {
  downloadFilesTool,
  downloadFilesSchema,
} from '../tools/download-files.js';

const server = new McpServer({
  name: 'mcp-web-tools',
  version: '1.0.0',
});

// Register web_search tool
server.registerTool(
  'web_search',
  {
    description: `
Search the web using DuckDuckGo for any query.

**Best for:** Finding information across the web, researching topics, getting current information.
**Not recommended for:** When you already know the exact URL you need (use web_page instead).
**Common mistakes:** Using web_search when you have a specific URL to scrape.
**Prompt Example:** "Search for latest TypeScript features released"
**Usage Example:**
\`\`\`json
{
  "name": "web_search",
  "arguments": {
    "query": "latest TypeScript features",
    "maxResults": 5,
    "time": "m"
  }
}
\`\`\`
**Returns:** Search results with titles, URLs, and descriptions.
`,
    inputSchema: webSearchSchema,
    outputSchema: z.object({
      query: z.string(),
      results: z.array(
        z.object({
          title: z.string(),
          url: z.string(),
          snippet: z.string(),
          source: z.string(),
        })
      ),
    }),
  },
  async (input) => {
    return await webSearchTool(input);
  }
);

// Register web_page tool
server.registerTool(
  'web_page',
  {
    description: `
Fetch and extract content from a specific web page URL.

**Best for:** Getting full content from a known URL, extracting article text, documentation, or specific page content.
**Not recommended for:** When you don't know the exact URL (use web_search first).
**Common mistakes:** Using web_page for general web searches instead of specific URLs.
**Prompt Example:** "Get the content from https://docs.python.org/3/library/asyncio.html"
**Usage Example:**
\`\`\`json
{
  "name": "web_page",
  "arguments": {
    "urls": ["https://docs.python.org/3/library/asyncio.html", "https://example.com"],
    "maxLength": 30000,
    "includeLinks": true,
    "concurrency": 10
  }
}
\`\`\`
**Returns:** Page content in markdown format with optional links and metadata.
`,
    inputSchema: webPageSchema,
    outputSchema: z.object({
      results: z.array(
        z.object({
          url: z.string(),
          title: z.string().optional(),
          content: z.string(),
          metadata: z
            .object({
              description: z.string().optional(),
              keywords: z.string().optional(),
              author: z.string().optional(),
              publishedTime: z.string().optional(),
              language: z.string().optional(),
            })
            .optional(),
          error: z.string().optional(),
        })
      ),
    }),
  },
  async (input) => {
    return await webPageTool(input);
  }
);

// Register download_files tool
server.registerTool(
  'download_files',
  {
    description: `
Download one or more files from URLs to a specified directory.

**Best for:** Downloading files from URLs to local storage with security and error handling.
**Not recommended for:** When you don't have permission to write to the target directory.
**Common mistakes:** Not specifying a valid directory path or providing invalid URLs.
**Prompt Example:** "Download these files to /tmp/downloads"
**Usage Example:**
\`\`\`json
{
  "name": "download_files",
  "arguments": {
    "urls": ["https://example.com/file1.txt", "https://example.com/file2.pdf"],
    "directory": "/tmp/downloads",
    "filenames": ["custom1.txt", "custom2.pdf"],
    "maxRetries": 3,
    "retryDelay": 1000,
    "timeout": 30000,
    "concurrency": 5
  }
}
\`\`\`
**Returns:** Download results with file paths, sizes, and success status.
`,
    inputSchema: downloadFilesSchema,
    outputSchema: z.object({
      results: z.array(
        z.object({
          url: z.string(),
          filepath: z.string().optional(),
          size: z.number().optional(),
          error: z.string().optional(),
        })
      ),
    }),
  },
  async (input) => {
    return await downloadFilesTool(input);
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Web Tools server started');
}

// Always run the server when executed directly
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});

export { server };
