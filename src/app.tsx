import React, { useState, useEffect, useCallback } from 'react';
import { render, Text, Box } from 'ink';
import TextInput from 'ink-text-input';
import { AIService } from './ai.js';
import { ProjectContext } from './context/ProjectContext.js';
import { FileSystem } from './utils/fs.js';
import { Loading } from './components/Loading.js';
import path from 'node:path';

type Message = {
  id: number;
  type: 'user' | 'assistant';
  content: string;
};

const App = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [aiService, setAiService] = useState<AIService | null>(null);
  const [projectContext, setProjectContext] = useState<ProjectContext | null>(null);
  const [pendingCodePrompt, setPendingCodePrompt] = useState<string | null>(null);
  const [isAwaitingCodeConfirmation, setIsAwaitingCodeConfirmation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState('deepseek/deepseek-chat-v3-0324:free');
  const [isProcessing, setIsProcessing] = useState(false);

  const availableModels = [
    'openai/gpt-3.5-turbo',
    'openai/gpt-4',
    'anthropic/claude-2',
    'google/gemini-pro',
    'mistralai/mistral-7b-instruct',
    'meta-llama/llama-2-70b-chat',
    'deepseek/deepseek-r1:free',
    'qwen/qwen3-235b-a22b:free',
  ];

  useEffect(() => {
    const init = async () => {
      setIsProcessing(true);
      try {
        const context = new ProjectContext();
        await context.scanProject();
        setProjectContext(context);
        setAiService(new AIService({
          model: currentModel,
          systemPrompt: `You are an AI assistant running on the OpenRouter platform. 
          Your current model configuration is: ${currentModel}. 
          When asked about your identity or model, always respond with: "I am an AI assistant running on the ${currentModel} model via OpenRouter."`,
        }));
        
        // Add welcome message
        setMessages([{
          id: 1,
          type: 'assistant',
          content: `Hello! I am your coding assistant running on ${currentModel}. How can I help you today?`
        }]);
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        setIsProcessing(false);
      }
    };

    init();
  }, [currentModel]);

  const sendChatMessage = useCallback(async (message: string) => {
    if (!aiService) return;
    
    try {
      setIsLoading(true);
      const response = await aiService.chat(message);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          type: 'assistant',
          content: response,
        },
      ]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          type: 'assistant',
          content: 'Sorry, I encountered an error processing your message.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [aiService]);

  const processFileOperations = async (content: string): Promise<string> => {
	const fileOperationRegex = /<FILE:(.*?)>([\s\S]*?)<\/FILE>/g;
	let match;
	let output = content;
	const generatedDir = 'generated';
  
	try {
	  if (!(await new FileSystem().fileExists(generatedDir))) {
		await new FileSystem().mkdir(generatedDir);
	  }
	} catch (error) {
	  console.error('Error creating generated directory:', error);
	  return output;
	}
  
	while ((match = fileOperationRegex.exec(content)) !== null) {
	  const [fullMatch, filePath, fileContent] = match;
	  try {
		// Normalize the path and remove any leading slashes or dots
		const normalizedPath = filePath
		  .replace(/^[./\\]+/, '')  // Remove leading ./ or .\ or /
		  .replace(/\\/g, '/');     // Convert Windows paths to forward slashes
		
		// Create the full target path
		const targetPath = path.posix.join(generatedDir, normalizedPath);
		
		// Ensure the directory exists
		const dirPath = path.posix.dirname(targetPath);
		if (dirPath) {
		  await new FileSystem().mkdir(dirPath, { recursive: true });
		}
		
		// Write the file
		await new FileSystem().writeFile(targetPath, fileContent.trim());
		
		// Update the output to show success
		output = output.replace(
		  fullMatch, 
		  `✅ Generated file: ${targetPath}\n\`\`\`\n${fileContent.trim()}\n\`\`\``
		);
	  } catch (error) {
		console.error(`Error processing file operation for ${filePath}:`, error);
		output = output.replace(
		  fullMatch,
		  `❌ Error generating file: ${filePath}\n${error instanceof Error ? error.message : String(error)}`
		);
	  }
	}
	
	return output;
  };

  const generateCode = useCallback(async (prompt: string) => {
    if (!aiService || !projectContext) return;
    
    try {
      setIsLoading(true);
      const context = projectContext.getContext();
      const response = await aiService.generateCode(prompt, JSON.stringify(context, null, 2));
      
      const processedResponse = await processFileOperations(response);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          type: 'assistant',
          content: processedResponse,
        },
      ]);
    } catch (error) {
      console.error('Error generating code:', error);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          type: 'assistant',
          content: 'Sorry, I encountered an error generating the code.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [aiService, projectContext]);

  const handleSubmit = async (value: string) => {
    if (!value.trim() || isLoading) return;

    if (isAwaitingCodeConfirmation) {
      const response = value.trim().toLowerCase();
      if (response === 'y' || response === 'yes') {
        setIsLoading(true);
        try {
          await generateCode(pendingCodePrompt!);
        } finally {
          setIsLoading(false);
        }
      } else {
        const newUserMessage: Message = {
          id: Date.now(),
          type: 'user',
          content: pendingCodePrompt!,
        };
        setMessages(prev => [...prev, newUserMessage]);
        await sendChatMessage(pendingCodePrompt!);
      }
      setPendingCodePrompt(null);
      setIsAwaitingCodeConfirmation(false);
      setInput('');
      return;
    }

    const newUserMessage: Message = {
      id: Date.now(),
      type: 'user',
      content: value,
    };
    setMessages(prev => [...prev, newUserMessage]);
    setInput('');

    const isCodePrompt = /(write|create|generate|edit|update|make).*(code|file|component|function|class|script)/i.test(value);

    if (isCodePrompt) {
      setPendingCodePrompt(value);
      setIsAwaitingCodeConfirmation(true);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          type: 'assistant',
          content: `I can help generate code for: "${value}"\n\nWould you like me to generate this code? (yes/no)`,
        },
      ]);
    } else {
      setIsLoading(true);
      try {
        await sendChatMessage(value);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCommand = (input: string): boolean => {
    const trimmed = input.trim();
    if (trimmed === '/clear') {
      setMessages([]);
      return true;
    }
    if (trimmed === '/models') {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          type: 'assistant',
          content: `Available models:\n${availableModels.map(m => `- ${m}`).join('\n')}\n\nUse /model <name> to switch models.`,
        },
      ]);
      return true;
    }
    if (trimmed.startsWith('/model ')) {
      const model = trimmed.split(' ')[1];
      if (availableModels.includes(model)) {
        setCurrentModel(model);
        setMessages(prev => [
          ...prev,
          {
            id: Date.now(),
            type: 'assistant',
            content: `Switched to model: ${model}`,
          },
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: Date.now(),
            type: 'assistant',
            content: `Unknown model: ${model}. Use /models to see available models.`,
          },
        ]);
      }
      return true;
    }
    if (trimmed === '/help') {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          type: 'assistant',
          content: `Available commands:
/clear - Clear the chat
/models - List available models
/model <name> - Switch to a different model
/help - Show this help message`,
        },
      ]);
      return true;
    }
    return false;
  };

  return (
    <Box flexDirection="column" width="100%">
      {/* Messages */}
      <Box flexDirection="column" flexGrow={1} padding={1}>
        {messages.map(message => (
          <Box key={message.id} marginBottom={1}>
            {message.type === 'assistant' ? (
              <Text>
                <Text color="yellow">❯ 🤖</Text> {message.content}
              </Text>
            ) : (
              <Text>
                <Text color="yellow">❯ 👤</Text> {message.content}
              </Text>
            )}
          </Box>
        ))}
      </Box>

      {/* Input */}
      <Box borderStyle="round" borderColor="gray" paddingLeft={1}>
        <Text color="cyan">› </Text>
        {isLoading ? (
          <Loading message="Generating response..." />
        ) : (
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder={
              isAwaitingCodeConfirmation 
                ? "Type 'yes' to generate code or 'no' to continue chatting..." 
                : "Type your message..."
            }
          />
        )}
      </Box>
    </Box>
  );
};

export default App;