import { QuestionComment } from '@/lib/types';

export const kinds = [
  ['discussion', 'Discussion'],
  ['feedback', 'Feedback'],
  ['example', 'Example'],
] as const;

export type CommentKind = QuestionComment['kind'];
export type ReportReason = 'spam' | 'off_topic' | 'unsafe';

export const kindDot: Record<CommentKind, string> = {
  discussion: 'bg-primary',
  feedback: 'bg-amber-500',
  example: 'bg-success',
};

export const kindTag: Record<CommentKind, string> = {
  discussion: 'bg-primary/10 text-primary',
  feedback: 'bg-amber-500/10 text-amber-600',
  example: 'bg-success/10 text-success',
};

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';

export const updateComment = (
  items: QuestionComment[],
  id: string,
  update: (comment: QuestionComment) => QuestionComment,
): QuestionComment[] =>
  items.map((comment) => comment.id === id ? update(comment) : { ...comment, replies: updateComment(comment.replies, id, update) });

export const findComment = (items: QuestionComment[], id: string): QuestionComment | undefined => {
  for (const item of items) {
    if (item.id === id) return item;
    const nested = findComment(item.replies, id);
    if (nested) return nested;
  }
};

export const appendReply = (items: QuestionComment[], parentId: string, reply: QuestionComment): QuestionComment[] =>
  items.map((item) => item.id === parentId ? { ...item, replies: [...item.replies, reply] } : { ...item, replies: appendReply(item.replies, parentId, reply) });

export const removeComment = (items: QuestionComment[], id: string): QuestionComment[] =>
  items
    .filter((item) => item.id !== id)
    .map((item) => ({ ...item, replies: removeComment(item.replies, id) }));

export const flattenReplies = (items: QuestionComment[]): QuestionComment[] =>
  items.flatMap((item) => [item, ...flattenReplies(item.replies)]);
