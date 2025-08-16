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
      console.log(`  - ${tool.name}: ${tool.description.split('\n')[0]}`);
    });
    console.log();

    // Example 1: Web search
    console.log('🔍 Searching for "AI news 2024"...');
    const searchResults = await client.searchWeb({
      query: 'AI news 2024',
      maxResults: 3
    });
    
    if (searchResults.content && searchResults.content[0]) {
      const results = JSON.parse(searchResults.content[0].text);
      console.log(`Found ${results.results.length} results:`);
      results.results.forEach((result, i) => {
        console.log(`  ${i + 1}. ${result.title}`);
        console.log(`     ${result.url}`);
        console.log(`     ${result.snippet.substring(0, 100)}...\n`);
      });
    }

    // Example 2: Fetch web pages
    console.log('📄 Fetching web page content...');
    const pageContent = await client.fetchWebPage({
      urls: ['https://example.com'],
      maxLength: 500
    });

    if (pageContent.content && pageContent.content[0]) {
      const results = JSON.parse(pageContent.content[0].text);
      if (results.length > 0) {
        console.log('Page content preview:');
        console.log(results[0].content.substring(0, 200) + '...\n');
      }
    }

    // Example 3: Download files
    console.log('📥 Downloading files...');
    // Note: For this example to work, you need to specify a valid directory
    // and URLs that you have permission to download
    /*
    const downloadResults = await client.downloadFiles({
      urls: ['https://httpbin.org/json'],
      directory: './downloads'
    });

    if (downloadResults.content && downloadResults.content[0]) {
      const results = JSON.parse(downloadResults.content[0].text);
      console.log(`Downloaded ${results.filter(r => r.success).length} files:`);
      results.forEach(result => {
        if (result.success) {
          console.log(`  ✅ ${result.filename} (${result.size} bytes)`);
        } else {
          console.log(`  ❌ ${result.filename}: ${result.error}`);
        }
      });
    }
    */
    console.log('📁 Download example commented out (requires valid directory and URLs)\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    console.log('🔌 Disconnecting...');
    await client.disconnect();
    console.log('✅ Done!');
  }
}

main().catch(console.error);