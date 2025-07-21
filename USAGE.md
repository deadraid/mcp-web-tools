# MCP Search Tools - Usage Guide

## Quick Start

### Universal MCP Configuration
All modern AI editors use the same MCP configuration format. Add this configuration to your editor's settings:

```json
{
  "mcpServers": {
    "web-search": {
      "command": "npx",
      "args": ["-y", "mcp-search-server"]
    }
  }
}
```

### Editor-Specific Locations

| Editor | Configuration File Location |
|--------|----------------------------|
| **Claude Desktop** | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows) |
| **Cursor** | Settings > MCP > Add Server |
| **Claude Code** | `.claude.json` in project root |
| **Windsurf** | `.windsurfrc` in project root |
| **Cline** | `.cline/mcp.json` in project root |
| **Zed** | Settings > Extensions > MCP |

### Installation
No installation required! The server works directly with npx.

## Usage Examples

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

const server = spawn('npx', ['-y', 'mcp-search-server'], {
  stdio: ['pipe', 'pipe', 'pipe']
});
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

### Development Setup
```bash
# Clone repository
git clone https://github.com/deadraid/mcp-web-tools.git
cd mcp-web-tools

# Install dependencies
npm install

# Build
npm run build

# Run server
npm run start:server