import OpenAI from 'openai';

export interface AIConfig {
	model?: string;
	apiKey?: string;
	systemPrompt?: string;
}

export class AIService {
	private model: string;
	private apiKey: string;
	private client: OpenAI;
	private systemPrompt: string;

	constructor(config: AIConfig = {}) {
		this.model = config.model || 'openai/gpt-3.5-turbo';
		this.apiKey = config.apiKey || process.env['OPENROUTER_API_KEY'] || '';
		this.systemPrompt = config.systemPrompt || `You are a helpful AI coding assistant integrated into the Compute SDK Agent. You are running through the OpenRouter API.`;
		
		if (!this.apiKey) {
			throw new Error('OPENROUTER_API_KEY is required. Get one at https://openrouter.ai/keys');
		}

		this.client = new OpenAI({
			baseURL: 'https://openrouter.ai/api/v1',
			defaultHeaders: {
				'HTTP-Referer': 'https://github.com/compute/agent',
				'X-Title': 'Compute Agent',
			},
			apiKey: this.apiKey,
		});
	}

	async generateResponse(prompt: string, systemPrompt?: string): Promise<string> {
		try {
			const messages: Array<{
				role: 'system' | 'user' | 'assistant';
				content: string;
			}> = [
				{
					role: 'system',
					content: systemPrompt || this.systemPrompt,
				},
				{
					role: 'user',
					content: prompt,
				},
			];

			const completion = await this.client.chat.completions.create({
				model: this.model,
				messages,
				temperature: 0.7,
				max_tokens: 2000,
			});

			return completion.choices[0]?.message?.content || 'No response generated';
		} catch (error) {
			console.error('AI generation error:', error);
			return `Sorry, I encountered an error: ${error instanceof Error ? error.message : String(error)}`;
		}
	}

	setModel(modelName: string) {
		this.model = modelName;
	}

	getModel(): string {
		if (!this.model) return ''; // Handle empty string case
		const parts = this.model.split('/');
		return parts[parts.length - 1] || '';
	}
	
	private getCodeGenerationPrompt(): string {
		return `You are an expert AI coding assistant with deep knowledge of TypeScript, React, and Node.js.
	When generating code:
	1. Follow best practices for the language/framework
	2. Include proper error handling
	3. Add appropriate TypeScript types
	4. Include JSDoc comments for public APIs
	5. Follow the project's existing code style
	6. Only generate code that's explicitly requested
	
	For file operations, use these special tags:
	<FILE:path/to/file>
	// Code goes here
	</FILE>
	
	You can create multiple files in a single response by using multiple FILE tags.`;
	  }
	
	  async generateCode(prompt: string, context: string = ''): Promise<string> {
		const systemPrompt = `${this.systemPrompt}\n\n${this.getCodeGenerationPrompt()}`;
		
		const response = await this.client.chat.completions.create({
		  model: this.model,
		  messages: [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: `Context:\n${context}\n\nTask: ${prompt}` }
		  ],
		  temperature: 0.2,
		});
	
		return response.choices[0]?.message?.content || '';
	  }

	async chat(message: string, history: Array<{role: 'user' | 'assistant', content: string}> = []): Promise<string> {
		try {
			const response = await this.client.chat.completions.create({
				model: this.model,
				messages: [
					{ role: 'system', content: this.systemPrompt },
					...history,
					{ role: 'user', content: message }
				],
				temperature: 0.7,
			});

			return response.choices[0]?.message?.content?.trim() || 'Sorry, I did not get that.';
		} catch (error) {
			console.error('Error in chat:', error);
			return 'Sorry, I encountered an error processing your message.';
		}
	}
}
