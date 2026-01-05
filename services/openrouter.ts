import type { AIService, ChatMessage } from '../types';

export const openrouterService: AIService = {
  name: 'OpenRouter',
  async chat(messages: ChatMessage[]) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not set');
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://api-ralf.local",
        "X-Title": "API_RALF",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "google/gemini-2.0-flash-exp:free",
        "messages": messages,
        "stream": true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `OpenRouter Error: ${response.status} ${response.statusText}`;
      try {
        const json = JSON.parse(errorText);
        if (json.error?.message) errorMsg += ` - ${json.error.message}`;
      } catch (e) {
        errorMsg += ` - ${errorText}`;
      }

      // Re-throw with status if possible for circuit breaker
      const err: any = new Error(errorMsg);
      err.status = response.status;
      throw err;
    }

    if (!response.body) {
      throw new Error('No response body received from OpenRouter');
    }

    // Return async generator for streaming
    return async function* () {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const data = trimmed.slice(6); // Remove 'data: '
            if (data === '[DONE]') return;

            try {
              const json = JSON.parse(data);
              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              console.warn('Error parsing OpenRouter SSE chunk:', e);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }();
  }
};