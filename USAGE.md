# MCP Search Tools - Usage Guide

## Installation

### As NPM Package
```bash
npm install mcp-search-tools
```

### As MCP Server
```bash
# Global installation
npm install -g mcp-search-tools

# Run server
mcp-search-server
```

### In Claude Desktop
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "web-search": {
      "command": "npx",
      "args": ["-y", "mcp-search-tools", "mcp-search-server"]
    }
  }
}
```

> Полный исходный код: [github.com/deadraid/mcp-search-tools](https://github.com/deadraid/mcp-search-tools)

## Usage in Your Agent

### As Library
```typescript
import { MCPWebToolsClient } from 'mcp-search-tools';

const client = new MCPWebToolsClient();
await client.connect();

// Web search
const searchResults = await client.searchWeb({
  query: 'latest AI developments',
  maxResults: 5
});

// Fetch web page
const pageContent = await client.fetchWebPage({
  url: 'https://example.com',
  maxLength: 2000
});
```

### As MCP Server Process
```typescript
import { spawn } from 'child_process';

const server = spawn('npx', ['mcp-search-server'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Use with MCP client
```

## API Reference

### Web Search Tool
```typescript
interface WebSearchInput {
  query: string;
  maxResults?: number;
  region?: string;
  time?: string;
  maxRetries?: number;
  retryDelay?: number;
}
```

### Web Page Tool
```typescript
interface WebPageInput {
  url: string;
  maxLength?: number;
  includeImages?: boolean;
  includeLinks?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}
```

## Environment Variables
- `NODE_ENV`: Set to 'production' for production use
- Custom headers can be configured via environment variables

## Examples

### Basic Usage
```javascript
const { MCPWebToolsClient } = require('mcp-search-tools');

async function main() {
  const client = new MCPWebToolsClient();
  await client.connect();
  
  const results = await client.searchWeb({
    query: 'TypeScript best practices'
  });
  
  console.log(results);
  await client.disconnect();
}

main();
```

### With Claude Desktop
1. Install package globally: `npm install -g mcp-search-tools`
2. Add to Claude Desktop config
3. Restart Claude Desktop
4. Use web search and page fetching directly in conversations