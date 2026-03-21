/**
 * In-memory fallback store for when DATABASE_URL is not configured.
 * Provides the same interface as db.ts chat functions but stores data in memory.
 */

interface MemorySession {
  id: number;
  userId: number;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MemoryMessage {
  id: number;
  sessionId: number;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: Date;
}

let sessionIdCounter = 1;
let messageIdCounter = 1;
const sessions: MemorySession[] = [];
const messages: MemoryMessage[] = [];

export function memCreateChatSession(userId: number, title?: string) {
  const session: MemorySession = {
    id: sessionIdCounter++,
    userId,
    title: title ?? "新对话",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  sessions.push(session);
  return { id: session.id };
}

export function memGetUserChatSessions(userId: number) {
  return sessions
    .filter((s) => s.userId === userId)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export function memDeleteChatSession(sessionId: number, userId: number) {
  const idx = sessions.findIndex((s) => s.id === sessionId && s.userId === userId);
  if (idx >= 0) sessions.splice(idx, 1);
  // Remove associated messages
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sessionId === sessionId) {
      messages.splice(i, 1);
    }
  }
}

export function memAddChatMessage(sessionId: number, role: "system" | "user" | "assistant", content: string) {
  const msg: MemoryMessage = {
    id: messageIdCounter++,
    sessionId,
    role,
    content,
    createdAt: new Date(),
  };
  messages.push(msg);
  // Update session timestamp
  const session = sessions.find((s) => s.id === sessionId);
  if (session) session.updatedAt = new Date();
}

export function memGetSessionMessages(sessionId: number) {
  return messages
    .filter((m) => m.sessionId === sessionId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
