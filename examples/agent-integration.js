#!/usr/bin/env node

/**
 * Example: Using MCP Web Tools in an AI Agent
 * This shows how to integrate web search and page fetching
 * into your AI agent workflow
 */

import { MCPWebToolsClient } from '../dist/client/index.js';

class AIAgent {
  constructor() {
    this.client = new MCPWebToolsClient();
    this.isConnected = false;
  }

  async initialize() {
    if (!this.isConnected) {
      await this.client.connect();
      this.isConnected = true;
      console.log('🤖 AI Agent initialized with web tools');
    }
  }

  async shutdown() {
    if (this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  async researchTopic(topic) {
    console.log(`🔍 Researching: ${topic}`);
    
    // Step 1: Search for information
    const searchResults = await this.client.searchWeb({
      query: topic,
      maxResults: 5
    });

    if (!searchResults.content?.[0]) {
      throw new Error('No search results');
    }

    const results = JSON.parse(searchResults.content[0].text);
    
    // Step 2: Fetch detailed content from top results
    const detailedContent = [];
    
    for (const result of results.results.slice(0, 3)) {
      try {
        console.log(`📄 Fetching: ${result.title}`);
        const pageContent = await this.client.fetchWebPage({
          urls: [result.url],
          maxLength: 1000
        });
        
        if (pageContent.content?.[0]?.text) {
          const pageResults = JSON.parse(pageContent.content[0].text);
          detailedContent.push({
            title: result.title,
            url: result.url,
            content: pageResults[0]?.content || 'No content available'
          });
        } else {
          detailedContent.push({
            title: result.title,
            url: result.url,
            content: 'No content available'
          });
        }
      } catch (error) {
        console.warn(`⚠️ Failed to fetch ${result.url}: ${error.message}`);
        detailedContent.push({
          title: result.title,
          url: result.url,
          content: `Error fetching content: ${error.message}`
        });
      }
    }

    return {
      topic,
      searchResults: results.results,
      detailedContent
    };
  }

  async answerQuestion(question) {
    console.log(`❓ Answering: ${question}`);
    
    const research = await this.researchTopic(question);
    
    // Here you would typically pass this to your LLM
    const context = research.detailedContent
      .map(item => `Source: ${item.title}\n${item.content.substring(0, 500)}`)
      .join('\n\n---\n\n');
    
    return {
      question,
      sources: research.detailedContent.map(item => ({
        title: item.title,
        url: item.url
      })),
      context
    };
  }

  async downloadResearchSources(topic, directory) {
    console.log(`📥 Downloading sources for: ${topic}`);
    
    // First, search for information
    const searchResults = await this.client.searchWeb({
      query: topic,
      maxResults: 3
    });

    if (!searchResults.content?.[0]) {
      throw new Error('No search results');
    }

    const results = JSON.parse(searchResults.content[0].text);
    
    // Extract URLs from search results
    const urls = results.results.map(result => result.url);
    
    // Download files
    const downloadResults = await this.client.downloadFiles({
      urls: urls,
      directory: directory
    });
    
    if (downloadResults.content?.[0]?.text) {
      return JSON.parse(downloadResults.content[0].text);
    }
    
    return [];
  }
}

// Demo usage
async function demo() {
  const agent = new AIAgent();
  
  try {
    await agent.initialize();
    
    // Research example
    const answer = await agent.answerQuestion(
      'What are the latest developments in AI for 2024?'
    );
    
    console.log('\n📊 Research Summary:');
    console.log(`Found ${answer.sources.length} sources`);
    answer.sources.forEach(source => {
      console.log(`  - ${source.title}: ${source.url}`);
    });
    
    // Download example (commented out)
    /*
    console.log('\n📥 Downloading sources...');
    const downloadResults = await agent.downloadResearchSources(
      'AI developments 2024',
      './downloads'
    );
    
    console.log(`Downloaded ${downloadResults.filter(r => r.success).length} files:`);
    downloadResults.forEach(result => {
      if (result.success) {
        console.log(`  ✅ ${result.filename} (${result.size} bytes)`);
      } else {
        console.log(`  ❌ ${result.filename || result.url}: ${result.error}`);
      }
    });
    */
    console.log('\n📁 Download example commented out (requires valid directory)');
    
  } catch (error) {
    console.error('❌ Agent error:', error);
  } finally {
    await agent.shutdown();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  demo().catch(console.error);
}

export default AIAgent;