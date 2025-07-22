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
        
        detailedContent.push({
          title: result.title,
          url: result.url,
          content: pageContent.content?.[0]?.text || 'No content available'
        });
      } catch (error) {
        console.warn(`⚠️ Failed to fetch ${result.url}: ${error.message}`);
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
      .map(item => `Source: ${item.title}\n${item.content}`)
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
}

// Demo usage
async function demo() {
  const agent = new AIAgent();
  
  try {
    await agent.initialize();
    
    const answer = await agent.answerQuestion(
      'What are the latest developments in AI for 2024?'
    );
    
    console.log('\n📊 Research Summary:');
    console.log(`Found ${answer.sources.length} sources`);
    answer.sources.forEach(source => {
      console.log(`  - ${source.title}: ${source.url}`);
    });
    
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