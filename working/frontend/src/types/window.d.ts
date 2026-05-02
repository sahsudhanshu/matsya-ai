/**
 * Extend the global Window interface with MatsyaAI-specific injections.
 * This lets us use `window.__agentChatInject` and `window.dispatchReply`
 * without `as any` casts throughout the codebase.
 */

interface ReferenceContext {
  label: string;
  detail: string;
  icon: string;
  backendText: string;
}

interface AgentChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  replyTo?: string;
  replyToId?: string;
}

interface Window {
  /** Injected by AgentChat to allow other components to send messages */
  __agentChatInject?: (text: string, referenceContext?: ReferenceContext) => void;
  /** Injected by AgentChat to allow reply-to-message from other components */
  dispatchReply?: (msg: AgentChatMessage) => void;
}
