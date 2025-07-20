# MCP Search Tools

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-blue?style=flat-square&logo=github)](https://github.com/deadraid/mcp-search-tools)
[![NPM Version](https://img.shields.io/npm/v/mcp-search-tools?style=flat-square)](https://www.npmjs.com/package/mcp-search-tools)

> MCP Server and Client for web search and page access tools

MCP (Model Context Protocol) server and client providing internet access tools. This server is categorized under "internet" and "web" to indicate its capability for online connectivity.

## Overview

This package provides MCP-compatible tools for internet operations:

- **web_search**: Search the web using DuckDuckGo (requires internet access)
- **web_page**: Fetch and extract content from web pages (requires internet access)

## 📥 Installation

### Global Installation (Recommended for MCP)
```bash
npm install -g mcp-search-tools
```

### Local Installation
```bash
npm install mcp-search-tools
```

## Usage

### As MCP Server

#### Using npx (Recommended)
```bash
npx -y mcp-search-tools mcp-search-server
```

#### Using global installation
```bash
mcp-search-server
```

#### Using npm scripts (development)
```bash
npm run start:server
```

### As MCP Client

Use the client programmatically:

```typescript
import { MCPWebToolsClient } from 'mcp-search-tools';

const client = new MCPWebToolsClient();
await client.connect();

// Search the web
const searchResult = await client.searchWeb({
  query: 'TypeScript MCP',
  maxResults: 5,
});

// Fetch a web page
const pageResult = await client.fetchWebPage({
  url: 'https://example.com',
  maxLength: 1000,
});

await client.disconnect();
```

### Available Tools

#### web_search

Search the web using DuckDuckGo.

**Parameters:**

- `query` (string): Search query to execute
- `maxResults` (number, optional): Maximum number of results (default: 10)
- `region` (string, optional): Region for search results (default: 'wt-wt')
- `time` (string, optional): Time filter ('d', 'w', 'm', 'y')
- `maxRetries` (number, optional): Maximum retry attempts for failed requests (default: 3)
- `retryDelay` (number, optional): Base delay in milliseconds between retry attempts (default: 1000)

#### web_page

Fetch and extract content from a web page.

**Parameters:**

- `url` (string): URL of the web page to fetch
- `includeImages` (boolean, optional): Include images in response (default: false)
- `includeLinks` (boolean, optional): Include links in response (default: false)
- `maxLength` (number, optional): Maximum content length (default: 8000)
- `maxRetries` (number, optional): Maximum retry attempts for failed requests (default: 3)
- `retryDelay` (number, optional): Base delay in milliseconds between retry attempts (default: 1000)

## Configuration

The server uses default configuration values:
- `maxRetries`: 3 (maximum retry attempts for failed requests)
- `retryDelay`: 1000 (base delay in milliseconds between retry attempts)

These defaults can be overridden per request using the `maxRetries` and `retryDelay` parameters.

## Retry Behavior

The server implements intelligent retry logic with the following features:

- **Exponential backoff**: Delay increases exponentially with each retry
- **Jitter**: Random delay added to prevent thundering herd
- **Fatal error detection**: 4xx errors (except 429) are not retried
- **Configurable parameters**: Both max retries and delay can be configured

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Automatically fix linting issues
npm run lint -- --fix
```

## Architecture

The package consists of:

- **Server** (`src/server/index.ts`): MCP server implementation
- **Client** (`src/client/index.ts`): MCP client for programmatic usage
- **Tools** (`src/tools/`): Web search and page fetching implementations
