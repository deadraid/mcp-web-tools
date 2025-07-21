# MCP Search Tools

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-blue?style=flat-square&logo=github)](https://github.com/deadraid/mcp-search-tools)
[![NPM Version](https://img.shields.io/npm/v/mcp-search-tools?style=flat-square)](https://www.npmjs.com/package/mcp-search-tools)

> MCP Server for web search and page access tools

MCP (Model Context Protocol) server providing internet access tools. This server is categorized under "internet" and "web" to indicate its capability for online connectivity.

## Overview

This package provides MCP-compatible tools for internet operations:

- **web_search**: Search the web using DuckDuckGo (requires internet access)
- **web_page**: Fetch and extract content from web pages (requires internet access)

## 🚀 Quick Start

### Universal MCP Configuration
All modern AI editors use the same MCP configuration format:

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

### Editor Configuration Locations

| Editor | Configuration File |
|--------|-------------------|
| **Claude Desktop** | `claude_desktop_config.json` |
| **Cursor** | Settings > MCP > Add Server |
| **Claude Code** | `.claude.json` in project root |
| **Windsurf** | `.windsurfrc` in project root |
| **Cline** | `.cline/mcp.json` in project root |
| **Zed** | Settings > Extensions > MCP |

## 📋 Available Tools

### web_search
Search the web using DuckDuckGo.

**Parameters:**
- `query` (string): Search query to execute
- `maxResults` (number, optional): Maximum number of results (default: 10)
- `region` (string, optional): Region for search results (default: 'wt-wt')
- `time` (string, optional): Time filter ('d', 'w', 'm', 'y')
- `maxRetries` (number, optional): Maximum retry attempts (default: 3)
- `retryDelay` (number, optional): Base delay in milliseconds (default: 1000)

### web_page
Fetch and extract content from a web page.

**Parameters:**
- `url` (string): URL of the web page to fetch
- `maxLength` (number, optional): Maximum content length (default: 8000)
- `includeImages` (boolean, optional): Include images in response (default: false)
- `includeLinks` (boolean, optional): Include links in response (default: true)
- `maxRetries` (number, optional): Maximum retry attempts (default: 3)
- `retryDelay` (number, optional): Base delay in milliseconds (default: 1000)

## 🔧 Development

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
```

## 📁 Examples
See the `examples/` directory for configuration files for different editors:
- `examples/claude-desktop-config.json`
- `examples/cursor-config.json`
- `examples/claude-code-config.json`
