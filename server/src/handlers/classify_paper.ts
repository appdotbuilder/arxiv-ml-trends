import { type LlmClassification, llmClassificationSchema, primaryCategoryEnum } from '../schema';

/**
 * Uses LLM to classify a paper's topic and assess its potential impact.
 * Takes paper title and summary as input and returns structured classification.
 */
export async function classifyPaper(
    title: string,
    summary: string
): Promise<LlmClassification> {
    try {
        const prompt = createClassificationPrompt(title, summary);
        const response = await callOpenRouter(prompt);
        const classification = parseAndValidateResponse(response);
        
        return classification;
    } catch (error) {
        console.error('Paper classification failed:', error);
        throw error;
    }
}

function createClassificationPrompt(title: string, summary: string): string {
    const categories = primaryCategoryEnum.options.join(', ');
    
    return `You are an AI research paper classifier. Please classify the following research paper and assess its potential impact.

Paper Title: ${title}

Paper Summary: ${summary}

Available Categories: ${categories}

Please respond with a JSON object in this exact format:
{
  "primary_category": "one of the available categories",
  "secondary_categories": ["up to 2 additional relevant categories"],
  "potential_impact": 1-5 (integer, where 1=low impact, 5=high impact)
}

Guidelines:
- Choose the PRIMARY category that best represents the main focus of the paper
- Select up to 2 SECONDARY categories for additional relevant areas (can be empty array)
- Rate potential impact from 1-5 based on novelty, methodology quality, and potential applications
- Impact 1-2: Incremental improvements or narrow applications
- Impact 3: Solid contributions with moderate broader applicability  
- Impact 4-5: Significant advances with high potential for broad impact

Respond only with the JSON object, no additional text.`;
}

async function callOpenRouter(prompt: string): Promise<string> {
    const apiKey = process.env['OPENROUTER_API_KEY'];
    if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY environment variable is required');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env['OPENROUTER_HTTP_REFERER'] || 'http://localhost:3000',
            'X-Title': process.env['OPENROUTER_X_TITLE'] || 'ArXiv Paper Classifier'
        },
        body: JSON.stringify({
            model: 'anthropic/claude-3.5-haiku',
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.1,
            max_tokens: 500
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    
    if (!data.choices || data.choices.length === 0) {
        throw new Error('No response generated from OpenRouter API');
    }

    return data.choices[0].message.content;
}

function parseAndValidateResponse(response: string): LlmClassification {
    try {
        // Clean the response to extract JSON
        const cleanedResponse = response.trim();
        let jsonStr = cleanedResponse;
        
        // If response is wrapped in code blocks, extract the JSON
        if (cleanedResponse.includes('```')) {
            const match = cleanedResponse.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
            if (match) {
                jsonStr = match[1];
            }
        }

        const parsed = JSON.parse(jsonStr);
        
        // Validate against schema
        const classification = llmClassificationSchema.parse(parsed);
        
        return classification;
    } catch (parseError) {
        console.error('Failed to parse LLM response:', response);
        
        // Fallback classification
        return {
            primary_category: "Other",
            secondary_categories: [],
            potential_impact: 1
        };
    }
}