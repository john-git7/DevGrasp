/**
 * Shared SSE (Server-Sent Events) streaming client utility.
 * Replaces the duplicated while(true) { reader.read() } blocks that were
 * copy-pasted across sendMessage, generateOnboarding, generateTechDebt, etc.
 *
 * @param {string} url - The endpoint URL to POST to
 * @param {object} payload - The JSON body to send
 * @param {object} headers - Extra headers (e.g. x-api-key)
 * @param {object} handlers - Callbacks for each SSE event type
 * @param {function} [handlers.onStatus] - Called with a status string
 * @param {function} [handlers.onText] - Called with each streamed text chunk
 * @param {function} [handlers.onWarning] - Called with a warning string
 * @param {function} [handlers.onError] - Called with an error string
 * @param {function} [handlers.onConversationId] - Called with the conversation ID
 * @param {function} [handlers.onDone] - Called when the stream completes
 */
export async function streamSSE(url, payload, extraHeaders = {}, handlers = {}) {
  const { onStatus, onText, onWarning, onError, onConversationId, onDone } = handlers;

  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => `HTTP ${response.status}`);
    const errMsg = response.status === 401
      ? 'Unauthorized: Check that your API_SECRET matches between server and client .env files.'
      : `Network error (${response.status}): ${errText}`;
    if (onError) onError(errMsg);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    // Accumulate in buffer to handle chunks that split across SSE boundaries
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split('\n\n');
    // Keep the last (potentially incomplete) part in the buffer
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data: ')) continue;

      const dataStr = line.slice(6); // remove 'data: ' prefix
      if (dataStr === '[DONE]') {
        if (onDone) onDone();
        return;
      }

      try {
        const data = JSON.parse(dataStr);
        if (data.conversationId && onConversationId) onConversationId(data.conversationId);
        if (data.status && onStatus) onStatus(data.status);
        if (data.text && onText) onText(data.text);
        if (data.warning && onWarning) onWarning(data.warning);
        if (data.error && onError) onError(data.error);
      } catch (err) {
        // Log parse errors instead of swallowing them silently
        console.warn('[streamSSE] Failed to parse SSE chunk:', err.message, '| raw:', dataStr);
      }
    }
  }

  if (onDone) onDone();
}
