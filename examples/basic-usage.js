#!/usr/bin/env node

import { MCPWebToolsClient } from '../dist/client/index.js';

async function main() {
  console.log('🌐 MCP Web Tools Demo\n');

  const client = new MCPWebToolsClient();

  try {
    console.log('Connecting to MCP server...');
    await client.connect();
    console.log('✅ Connected!\n');

    // List available tools
    console.log('📋 Available tools:');
    const tools = await client.listTools();
    tools.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    console.log();

    // Example 1: Web search
    console.log('🔍 Searching for "AI news"...');
    const searchResults = await client.searchWeb({
      query: 'AI news',
      maxResults: 3
    });
    
    if (searchResults.content && searchResults.content[0]) {
      const results = JSON.parse(searchResults.content[0].text);
      console.log(`Found ${results.results.length} results:`);
      results.results.forEach((result, i) => {
        console.log(`  ${i + 1}. ${result.title}`);
        console.log(`     ${result.url}`);
        console.log(`     ${result.snippet}\n`);
      });
    }

    // Example 2: Fetch web page
    console.log('📄 Fetching example.com...');
    const pageContent = await client.fetchWebPage({
      url: 'https://example.com',
      maxLength: 500
    });

    if (pageContent.content && pageContent.content[0]) {
      console.log('Page content preview:');
      console.log(pageContent.content[0].text.substring(0, 200) + '...\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    console.log('🔌 Disconnecting...');
    await client.disconnect();
    console.log('✅ Done!');
  }
}

main().catch(console.error);