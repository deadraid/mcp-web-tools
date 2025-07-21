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

// Default configuration constants
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;

const mcpConfig = {
  defaults: {
    maxRetries: DEFAULT_MAX_RETRIES,
    retryDelay: DEFAULT_RETRY_DELAY,
  },
};

const server = new Server(
  {
    name: 'mcp-web-tools',
    version: '1.0.0',
    description:
      'Provides web search and web page access tools for internet connectivity',
    categories: ['internet', 'web'],
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List available tools. This handler is synchronous, so we remove the
 * unnecessary `async` keyword to satisfy `@typescript-eslint/require-await`.
 */
server.setRequestHandler(ListToolsRequestSchema, () => {
  return {
    tools: [
      {
        name: 'web_search',
        description: 'Search the web using DuckDuckGo',
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
              description:
                'Maximum number of retry attempts for failed requests',
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
        description: 'Fetch and extract content from a web page',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL of the web page to fetch',
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
              description:
                'Maximum number of retry attempts for failed requests',
              default: mcpConfig.defaults.maxRetries,
            },
            retryDelay: {
              type: 'number',
              description: 'Base delay in milliseconds between retry attempts',
              default: mcpConfig.defaults.retryDelay,
            },
          },
          required: ['url'],
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

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Invalid input: ${error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
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
// This fixes issues with npx and ESM module detection
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});

export { server };
