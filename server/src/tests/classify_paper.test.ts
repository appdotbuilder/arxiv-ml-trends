import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { classifyPaper } from '../handlers/classify_paper';
import { type LlmClassification } from '../schema';

// Mock fetch globally
const originalFetch = global.fetch;

describe('classifyPaper', () => {
  beforeEach(() => {
    createDB();
    // Set up API key for tests
    process.env['OPENROUTER_API_KEY'] = 'test-api-key';
  });
  
  afterEach(() => {
    resetDB();
    // Restore original fetch
    global.fetch = originalFetch;
  });

  it('should classify a foundation models paper correctly', async () => {
    // Mock successful OpenRouter API response
    global.fetch = mock(() => Promise.resolve(new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            primary_category: "Foundation Models",
            secondary_categories: ["LLM Fine-tuning"],
            potential_impact: 4
          })
        }
      }]
    }), { status: 200 }))) as any;

    const title = "GPT-5: A New Foundation Model for Language Understanding";
    const summary = "We present GPT-5, a large-scale transformer model trained on diverse text data with novel architectural improvements.";

    const result = await classifyPaper(title, summary);

    expect(result.primary_category).toBe("Foundation Models");
    expect(result.secondary_categories).toEqual(["LLM Fine-tuning"]);
    expect(result.potential_impact).toBe(4);
    expect(typeof result.potential_impact).toBe('number');
  });

  it('should classify a RAG paper correctly', async () => {
    // Mock successful OpenRouter API response
    global.fetch = mock(() => Promise.resolve(new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            primary_category: "Retrieval-Augmented Generation (RAG)",
            secondary_categories: ["Natural Language Processing (Specific Techniques)"],
            potential_impact: 3
          })
        }
      }]
    }), { status: 200 }))) as any;

    const title = "Enhanced RAG with Dynamic Knowledge Retrieval";
    const summary = "This paper introduces a novel approach to retrieval-augmented generation that dynamically selects relevant knowledge sources.";

    const result = await classifyPaper(title, summary);

    expect(result.primary_category).toBe("Retrieval-Augmented Generation (RAG)");
    expect(result.secondary_categories).toEqual(["Natural Language Processing (Specific Techniques)"]);
    expect(result.potential_impact).toBe(3);
  });

  it('should handle response with no secondary categories', async () => {
    // Mock response with empty secondary categories
    global.fetch = mock(() => Promise.resolve(new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            primary_category: "Ethical AI / AI Safety",
            secondary_categories: [],
            potential_impact: 5
          })
        }
      }]
    }), { status: 200 }))) as any;

    const title = "AI Safety Frameworks for Critical Applications";
    const summary = "We propose comprehensive safety frameworks for deploying AI in critical infrastructure.";

    const result = await classifyPaper(title, summary);

    expect(result.primary_category).toBe("Ethical AI / AI Safety");
    expect(result.secondary_categories).toEqual([]);
    expect(result.potential_impact).toBe(5);
  });

  it('should handle response wrapped in code blocks', async () => {
    // Mock response with JSON wrapped in markdown code blocks
    global.fetch = mock(() => Promise.resolve(new Response(JSON.stringify({
      choices: [{
        message: {
          content: `\`\`\`json
{
  "primary_category": "Computer Vision (Specific Techniques)",
  "secondary_categories": ["Multimodality"],
  "potential_impact": 2
}
\`\`\``
        }
      }]
    }), { status: 200 }))) as any;

    const title = "Improved Object Detection in Low-Light Conditions";
    const summary = "This paper presents incremental improvements to existing object detection algorithms for challenging lighting conditions.";

    const result = await classifyPaper(title, summary);

    expect(result.primary_category).toBe("Computer Vision (Specific Techniques)");
    expect(result.secondary_categories).toEqual(["Multimodality"]);
    expect(result.potential_impact).toBe(2);
  });

  it('should fallback to default classification on API error', async () => {
    // Mock API error response
    global.fetch = mock(() => Promise.resolve(new Response('Internal Server Error', { status: 500 }))) as any;

    const title = "Some Research Paper";
    const summary = "This is a research paper about something.";

    await expect(classifyPaper(title, summary)).rejects.toThrow(/OpenRouter API error/i);
  });

  it('should fallback to default classification on invalid JSON response', async () => {
    // Mock response with invalid JSON
    global.fetch = mock(() => Promise.resolve(new Response(JSON.stringify({
      choices: [{
        message: {
          content: "This is not valid JSON for classification"
        }
      }]
    }), { status: 200 }))) as any;

    const title = "Research Paper Title";
    const summary = "This paper discusses various techniques in machine learning.";

    const result = await classifyPaper(title, summary);

    // Should fallback to default values
    expect(result.primary_category).toBe("Other");
    expect(result.secondary_categories).toEqual([]);
    expect(result.potential_impact).toBe(1);
  });

  it('should handle missing API key', async () => {
    // Temporarily unset the API key
    const originalApiKey = process.env['OPENROUTER_API_KEY'];
    delete process.env['OPENROUTER_API_KEY'];

    const title = "Test Paper";
    const summary = "Test summary";

    await expect(classifyPaper(title, summary)).rejects.toThrow(/OPENROUTER_API_KEY environment variable is required/i);

    // Restore the API key
    process.env['OPENROUTER_API_KEY'] = originalApiKey;
  });

  it('should validate schema constraints', async () => {
    // Mock response that violates schema constraints
    global.fetch = mock(() => Promise.resolve(new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            primary_category: "Foundation Models",
            secondary_categories: ["LLM Fine-tuning", "RAG", "Too Many Categories"], // Too many secondary categories
            potential_impact: 4
          })
        }
      }]
    }), { status: 200 }))) as any;

    const title = "Test Paper";
    const summary = "Test summary";

    const result = await classifyPaper(title, summary);

    // Should fallback to default on validation error
    expect(result.primary_category).toBe("Other");
    expect(result.secondary_categories).toEqual([]);
    expect(result.potential_impact).toBe(1);
  });

  it('should handle empty API response', async () => {
    // Mock empty choices array
    global.fetch = mock(() => Promise.resolve(new Response(JSON.stringify({
      choices: []
    }), { status: 200 }))) as any;

    const title = "Test Paper";
    const summary = "Test summary";

    await expect(classifyPaper(title, summary)).rejects.toThrow(/No response generated from OpenRouter API/i);
  });
});