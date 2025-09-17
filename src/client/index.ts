#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { ListToolsResult } from '@modelcontextprotocol/sdk/types.js';

import { webPageSchema } from '../tools/web-page.js';
import { webSearchSchema } from '../tools/web-search.js';
import { downloadFilesSchema } from '../tools/download-files.js';

interface WebSearchInput {
  query: string;
  maxResults?: number;
  region?: string;
  time?: string;
  maxRetries?: number;
  retryDelay?: number;
}

interface WebPageInput {
  urls: string[];
  includeImages?: boolean;
  includeLinks?: boolean;
  maxLength?: number;
  maxRetries?: number;
  retryDelay?: number;
  concurrency?: number;
}

interface DownloadFilesInput {
  urls: string[];
  directory: string;
  filenames?: string[];
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  concurrency?: number;
}

export class MCPWebToolsClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;

  constructor() {
    this.client = new Client(
      {
        name: 'mcp-web-tools-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );
  }

  async connect(command?: string, args?: string[]): Promise<void> {
    const serverCommand = command || 'node';
    const serverArgs = args || ['./dist/server/index.js'];

    this.transport = new StdioClientTransport({
      command: serverCommand,
      args: serverArgs,
    });

    await this.client.connect(this.transport);
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
  }

  async listTools(): Promise<ListToolsResult> {
    return await this.client.listTools();
  }

  async searchWeb(input: WebSearchInput): Promise<unknown> {
    const validatedInput = webSearchSchema.parse(input);
    return await this.client.callTool({
      name: 'web_search',
      arguments: validatedInput,
    });
  }

  async fetchWebPage(input: WebPageInput): Promise<unknown> {
    const validatedInput = webPageSchema.parse(input);
    return await this.client.callTool({
      name: 'web_page',
      arguments: validatedInput,
    });
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.listTools();
      return true;
    } catch {
      return false;
    }
  }

  async downloadFiles(input: DownloadFilesInput): Promise<unknown> {
    const validatedInput = downloadFilesSchema.parse(input);
    return await this.client.callTool({
      name: 'download_files',
      arguments: validatedInput,
    });
  }
}

// Example usage
async function example() {
  const client = new MCPWebToolsClient();

  try {
    await client.connect();

    console.log('Available tools:', await client.listTools());

    // Example web search
    const searchResult = await client.searchWeb({
      query: 'TypeScript MCP server',
      maxResults: 5,
      region: 'wt-wt',
    });
    console.log('Search results:', searchResult);

    // Example web page fetch with concurrency control
    const pageResult = await client.fetchWebPage({
      urls: ['https://example.com'],
      maxLength: 1000,
      includeImages: false,
      includeLinks: false,
      concurrency: 10, // Control parallel requests
    });
    console.log('Page content:', pageResult);

    // Example download files with concurrency control
    const downloadResult = await client.downloadFiles({
      urls: ['https://example.com/file1.txt', 'https://example.com/file2.pdf'],
      directory: '/tmp/downloads',
      concurrency: 5, // Control parallel downloads
    });
    console.log('Download results:', downloadResult);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  example().catch(console.error);
}

export default MCPWebToolsClient;
