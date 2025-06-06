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
}
