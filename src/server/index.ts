#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { webPageTool, webPageSchema } from '../tools/web-page.js';
import { webSearchTool, webSearchSchema } from '../tools/web-search.js';
import {
  downloadFilesTool,
  downloadFilesSchema,
} from '../tools/download-files.js';

// Default configuration constants
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_CONCURRENCY = 5;

const mcpConfig = {
  defaults: {
    maxRetries: DEFAULT_MAX_RETRIES,
    retryDelay: DEFAULT_RETRY_DELAY,
    concurrency: DEFAULT_CONCURRENCY,
  },
};

const server = new Server(
  {
    name: 'mcp-web-tools',
    version: '1.0.0',
    description: 'MCP server providing web search and page access tools',
    categories: ['internet', 'web'],
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List available tools with LLM-friendly descriptions
 */
server.setRequestHandler(ListToolsRequestSchema, () => {
  return {
    tools: [
      {
        name: 'web_search',
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
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query to execute' },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to return',
              default: 10,
            },
            region: {
              type: 'string',
              description: 'Region for search results',
              default: 'wt-wt',
            },
            time: {
              type: 'string',
              description: 'Time filter for search results (d, w, m, y)',
            },
            maxRetries: {
              type: 'number',
              description: 'Maximum retry attempts',
              default: mcpConfig.defaults.maxRetries,
            },
            retryDelay: {
              type: 'number',
              description: 'Base delay in milliseconds between retry attempts',
              default: mcpConfig.defaults.retryDelay,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'web_page',
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
        inputSchema: {
          type: 'object',
          properties: {
            urls: {
              type: 'array',
              items: { type: 'string' },
              description: 'URLs of the web pages to fetch',
            },
            maxLength: {
              type: 'number',
              description: 'Maximum length of content to return',
              default: 5000,
            },
            includeImages: {
              type: 'boolean',
              description: 'Include images in the response',
              default: false,
            },
            includeLinks: {
              type: 'boolean',
              description: 'Include links in the response',
              default: true,
            },
            maxRetries: {
              type: 'number',
              description: 'Maximum retry attempts',
              default: mcpConfig.defaults.maxRetries,
            },
            retryDelay: {
              type: 'number',
              description: 'Base delay in milliseconds between retry attempts',
              default: mcpConfig.defaults.retryDelay,
            },
            concurrency: {
              type: 'number',
              description: 'Maximum number of parallel requests',
              default: mcpConfig.defaults.concurrency,
            },
          },
          required: ['urls'],
        },
      },
      {
        name: 'download_files',
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
        inputSchema: {
          type: 'object',
          properties: {
            urls: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of URLs to download',
            },
            directory: {
              type: 'string',
              description: 'Target directory path for downloads',
            },
            filenames: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Optional array of custom filenames (same length as urls)',
            },
            maxRetries: {
              type: 'number',
              description:
                'Maximum number of retry attempts for failed downloads',
              default: mcpConfig.defaults.maxRetries,
            },
            retryDelay: {
              type: 'number',
              description: 'Base delay in milliseconds between retry attempts',
              default: mcpConfig.defaults.retryDelay,
            },
            timeout: {
              type: 'number',
              description: 'Request timeout in milliseconds',
              default: 30000,
            },
            concurrency: {
              type: 'number',
              description: 'Maximum number of parallel downloads',
              default: mcpConfig.defaults.concurrency,
            },
          },
          required: ['urls', 'directory'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'web_search': {
        const searchInput = webSearchSchema.parse(args);
        return await webSearchTool(searchInput);
      }

      case 'web_page': {
        const pageInput = webPageSchema.parse(args);
        return await webPageTool(pageInput);
      }

      case 'download_files': {
        const downloadInput = downloadFilesSchema.parse(args);
        return await downloadFilesTool(downloadInput);
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        content: [
          {
            type: 'text',
            text: `Invalid input: ${error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

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
