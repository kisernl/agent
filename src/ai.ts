import OpenAI from 'openai';

export interface AIConfig {
	model?: string;
	apiKey?: string;
}

export class AIService {
	private model: string;
	private apiKey: string;
	private client: OpenAI;

	constructor(config: AIConfig = {}) {
		this.model = config.model || 'openai/gpt-3.5-turbo';
		this.apiKey = config.apiKey || process.env['OPENROUTER_API_KEY'] || '';
		
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

	async generateResponse(prompt: string): Promise<string> {
		try {
			const completion = await this.client.chat.completions.create({
				model: this.model,
				messages: [
					{
						role: 'user',
						content: prompt,
					},
				],
				temperature: 0.7,
				max_tokens: 2000,
			});

			return completion.choices[0]?.message?.content || 'No response generated';
		} catch (error) {
			console.error('AI generation error:', error);
			return 'Sorry, I encountered an error while processing your request. Please check your API key and try again.';
		}
	}

	setModel(modelName: string) {
		this.model = modelName;
	}

	getModel(): string {
		return this.model;
	}
}
