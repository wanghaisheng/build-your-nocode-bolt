import { google } from '@ai-sdk/google';
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText as _streamText, convertToCoreMessages } from 'ai';
import { MAX_TOKENS } from './constants';
import { getSystemPrompt } from '@/utils/prompts';
import { type Provider, ProviderType } from '@/lib/stores/provider';

export interface ToolResult<Name extends string, Args, Result> {
  toolCallId: string;
  toolName: Name;
  args: Args;
  result: Result;
}

export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], 'model'>;

export function streamText({ messages, provider, ...options }: { messages: any, provider: Provider } & StreamingOptions) {
  const initialMessages = messages.slice(0, -1);
  const currentMessage = messages[messages.length - 1];

  const image = currentMessage.data?.url; //Base64 image
  console.log("messagesStreamImage:", image);

  let model;

  switch (provider.type) {
    case ProviderType.ANTHROPIC:
      model = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" })(provider.model.id);
      break;
    case ProviderType.GOOGLE:
      model = google(provider.model.id);
      break;
    case ProviderType.TOGETHER:
      model = createOpenAI({ baseURL: "https://api.together.xyz/v1", apiKey: process.env.TOGETHER_API_KEY ?? "" })(provider.model.id);
      break;
    case ProviderType.XAI:
      model = createOpenAI({ baseURL: "https://api.x.ai", apiKey: process.env.XAI_API_KEY ?? "" })(provider.model.id);
      break;
    default:
      model = google("gemini-2.0-flash-thinking-exp-1219");
  }

  const content = [];

  content.push({ type: 'text', text: currentMessage.content });

  if (image) {
    content.push({ type: 'image', image: new URL(image) });
  }

  return _streamText({
    model,
    system: getSystemPrompt(),
    maxTokens: MAX_TOKENS,
    messages: [
      ...initialMessages,
      {
        role: 'user',
        content,
      },
    ],
    ...options,
  });
}