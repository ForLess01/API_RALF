import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIService, ChatMessage } from '../types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const geminiService: AIService = {
  name: 'Gemini',
  async chat(messages: ChatMessage[]) {
    if (messages.length === 0) {
      throw new Error('No messages provided');
    }

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
    });

    const chatHistory = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
        topP: 0.95,
      },
    });

    const lastMessage = messages[messages.length - 1]!;
    const result = await chat.sendMessageStream(lastMessage.content);

    return (async function* () {
      for await (const chunk of result.stream) {
        const content = chunk.text();
        if (content) yield content;
      }
    })();
  }
};
