import { z } from 'zod';

export const chatMessageSchema = z.object({
  message: z.string().trim().min(1, 'Message cannot be empty'),
  repoId: z.string().optional().nullable(),
  repoUrl: z.string().optional().nullable(),
  conversationId: z.string().optional().nullable(),
  chatModel: z.string().optional(),
  embeddingModel: z.string().optional(),
});

export const onboardingSchema = z.object({
  repoUrl: z.string().trim().optional(),
  repoId: z.string().trim().optional(),
  chatModel: z.string().optional(),
}).refine(data => Boolean(data.repoUrl || data.repoId), {
  message: 'Repository URL is required',
});

export const bugTraceSchema = z.object({
  repoUrl: z.string().trim().optional(),
  repoId: z.string().trim().optional(),
  stackTrace: z.string().trim().min(1, 'Stack trace or error description is required'),
  chatModel: z.string().optional(),
  embeddingModel: z.string().optional(),
}).refine(data => Boolean(data.repoUrl || data.repoId), {
  message: 'Repository URL is required',
});

export const commitStorySchema = z.object({
  repoUrl: z.string().trim().optional(),
  repoId: z.string().trim().optional(),
  commitCount: z.number().int().positive().max(100).optional().default(20),
  chatModel: z.string().optional(),
}).refine(data => Boolean(data.repoUrl || data.repoId), {
  message: 'Repository URL is required',
});

export const prReviewSchema = z.object({
  repoUrl: z.string().trim().optional(),
  repoId: z.string().trim().optional(),
  prNumber: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]),
  message: z.string().optional(),
  conversationId: z.string().optional().nullable(),
  chatModel: z.string().optional(),
  embeddingModel: z.string().optional(),
}).refine(data => Boolean(data.repoUrl || data.repoId), {
  message: 'Repository URL is required',
});

export const conversationIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Conversation ID is required'),
});

export const truncateConversationSchema = z.object({
  messageIndex: z.number().int().min(0, 'messageIndex must be non-negative integer'),
});

export const historyQuerySchema = z.object({
  repoId: z.string().trim().optional(),
  repoUrl: z.string().trim().optional(),
}).refine(data => Boolean(data.repoId || data.repoUrl), {
  message: 'repoId or repoUrl query parameter is required'
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type BugTraceInput = z.infer<typeof bugTraceSchema>;
export type PrReviewInput = z.infer<typeof prReviewSchema>;
