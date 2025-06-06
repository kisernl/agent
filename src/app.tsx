import process from 'node:process';
import {useState, useEffect} from 'react';
import {Box, Text, useInput, useApp} from 'ink';
import TextInput from 'ink-text-input';
import {AIService} from './ai.js';

type Message = {
	id: number;
	type: 'user' | 'assistant';
	content: string;
};

export default function App() {
	const {exit} = useApp();
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState('');
	const [isProcessing, setIsProcessing] = useState(false);
	const [aiService, setAiService] = useState<AIService | null>(null);
	const [currentModel, setCurrentModel] = useState(
		'deepseek/deepseek-chat-v3-0324:free',
	);

	const availableModels = [
		'deepseek/deepseek-chat-v3-0324:free',
		'meta-llama/llama-4-maverick:free',
		'deepseek/deepseek-r1:free',
		'qwen/qwen3-235b-a22b:free',
	];

	useEffect(() => {
		setAiService(new AIService({
			model: currentModel,
			systemPrompt: `You are an AI assistant running on the OpenRouter platform. \
			Your current model configuration is: ${currentModel}. \
			When asked about your identity or model, always respond with: "I am an AI assistant running on the ${currentModel} model via OpenRouter."`,
		}));
	}, [currentModel]);

	useEffect(() => {
		setMessages([
			{
				id: 1,
				type: 'assistant',
				content: `Welcome to @ComputeSDK's Agent!\n\n` +
					`I'm an AI coding assistant running on ${aiService?.getModel() || ''}.\n` +
					`I can help you with coding tasks, answer questions, and assist with development.\n` +
					`Type /help to see available commands.`
			}
		]);
	}, [aiService]);

	useInput((_, key) => {
		if (key.escape) {
			exit();
		}
	});

	const handleCommand = (input: string): boolean => {
		const trimmed = input.trim();

		if (trimmed === '/exit') {
			exit();
			return true;
		}

		if (trimmed === '/clear') {
			setMessages([]);
			return true;
		}

		if (trimmed === '/help') {
			const helpMessage: Message = {
				id: messages.length + 1,
				type: 'assistant',
				content: [
					'Available commands:',
					'/help - Show this help message',
					'/clear - Clear the conversation',
					'/exit - Exit the application',
					'/model <name> - Switch AI model',
					'',
					'',
					'Or just type normally to chat!',
				].join('\n'),
			};
			setMessages([...messages, helpMessage]);
			return true;
		}

		if (trimmed.startsWith('/model')) {
			const parts = trimmed.split(' ');
			if (parts.length === 1) {
				const modelList = availableModels.map(m => `- ${m}`).join('\n');
				const currentModelMessage: Message = {
					id: messages.length + 1,
					type: 'assistant',
					content: `Current model: ${currentModel}\n\nAvailable models:\n${modelList}\n\nUse /model <name> to switch`,
				};
				setMessages([...messages, currentModelMessage]);
			} else {
				const newModel = parts.slice(1).join(' ');
				if (!availableModels.includes(newModel)) {
					const errorMessage: Message = {
						id: messages.length + 1,
						type: 'assistant',
						content: `Unknown model: ${newModel}. Use /model to see available models.`,
					};
					setMessages([...messages, errorMessage]);
					return true;
				}

				if (aiService) {
					aiService.setModel(newModel);
					setCurrentModel(newModel);
					const successMessage: Message = {
						id: messages.length + 1,
						type: 'assistant',
						content: `Switched to model: ${newModel}`,
					};
					setMessages([...messages, successMessage]);
				}
			}
			return true;
		}

		if (trimmed.startsWith('/')) {
			const errorMessage: Message = {
				id: messages.length + 1,
				type: 'assistant',
				content: `Unknown command: ${trimmed}. Type /help for available commands.`,
			};
			setMessages([...messages, errorMessage]);
			return true;
		}

		return false;
	};

	const handleSubmit = (value: string) => {
		if (value.trim()) {
			// Check if it's a command
			if (handleCommand(value)) {
				setInput('');
				return;
			}

			const newUserMessage: Message = {
				id: messages.length + 1,
				type: 'user',
				content: value,
			};
			setMessages([...messages, newUserMessage]);
			setInput('');

			// Generate AI response
			if (aiService) {
				setIsProcessing(true);
				aiService.generateResponse(value).then(responseText => {
					const response: Message = {
						id: messages.length + 2,
						type: 'assistant',
						content: responseText,
					};
					setMessages(previous => [...previous, response]);
					setIsProcessing(false);
				});
			} else {
				const errorResponse: Message = {
					id: messages.length + 2,
					type: 'assistant',
					content:
						'AI service not initialized. Please check your ANTHROPIC_API_KEY.',
				};
				setMessages(previous => [...previous, errorResponse]);
			}
		}
	};

	return (
		<Box flexDirection="column" height="100%">
			{/* Header */}
			<Box borderStyle="round" borderColor="yellow" paddingX={1} paddingY={0}>
				<Box flexDirection="column" width="100%">
					<Box>
						<Text> Welcome to @ComputeSDK&apos;s </Text>
						<Text bold>Agent</Text>
						<Text>!</Text>
					</Box>
					<Text> </Text>
					<Text dimColor>/help for help</Text>
					<Text> </Text>
					<Text dimColor>cwd: {process.cwd()}</Text>
				</Box>
			</Box>

			<Box padding={1}>
				<Text dimColor>What are you going to build today?</Text>
			</Box>

			{/* Messages */}
			<Box flexDirection="column" flexGrow={1} paddingLeft={1} paddingTop={1}>
				{messages.map(message => (
					<Box key={message.id} marginBottom={1}>
						{message.type === 'assistant' ? (
							<Text>
								<Text color="yellow">❯ 🤖</Text> {message.content}
							</Text>
						) : (
							<Text dimColor>
								<Text>›</Text> {message.content}
							</Text>
						)}
					</Box>
				))}
				{isProcessing && (
					<Box marginBottom={1}>
						<Text color="yellow">❯ 🤖 Thinking...</Text>
					</Box>
				)}
			</Box>

			{/* Input */}
			<Box borderStyle="round" borderColor="gray" paddingLeft={1}>
				<Text color="cyan">› </Text>
				<TextInput
					placeholder="Type your message..."
					value={input}
					onChange={setInput}
					onSubmit={handleSubmit}
				/>
			</Box>
		</Box>
	);
}
