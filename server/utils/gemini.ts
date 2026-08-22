import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY || '');

const ALLOWED_MODELS = new Set<string>([
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-3.1-pro-preview',
  'gemini-3-pro-preview',
  'gemini-embedding-001',
  'gemini-embedding-2',
]);

export function getChatModel(modelName?: string): string {
  if (!modelName || modelName.includes('1.5')) return 'gemini-3.5-flash';
  if (modelName === 'gemini-3.1-pro' || modelName === 'gemini-3.5-pro') return 'gemini-3.1-pro-preview';
  if (!ALLOWED_MODELS.has(modelName)) {
    console.warn(`[SECURITY] Rejected unknown model: '${modelName}'. Falling back to gemini-3.5-flash.`);
    return 'gemini-3.5-flash';
  }
  return modelName;
}

export function formatGeminiError(error: any, defaultMsg: string, modelName = 'Unknown'): string {
  if (error && error.status === 429) {
    if (error.isZeroLimit) {
      return `The model '${modelName}' requires a paid Google AI API tier and has a Free Tier limit of 0 tokens. Please go to Settings and switch to a standard model like Gemini 3.5 Flash.`;
    }
    let msg = `Gemini API Quota Exceeded (429) for model '${modelName}'.`;
    const retryInfo = error.errorDetails?.find((d: any) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
    if (retryInfo && retryInfo.retryDelay) {
      msg += ` Please retry in ${retryInfo.retryDelay}.`;
    } else {
      msg += ' You have exceeded your input token limit. Please wait a minute for the quota to refresh.';
    }
    return msg;
  }
  if (error && error.status === 503) {
    return 'The AI model is currently experiencing high demand. Please try again in a few moments.';
  }
  return defaultMsg;
}
