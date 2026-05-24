import { renderMarkdown } from '../markdown'

export type ChatBubbleRole = 'user' | 'bot' | 'system'

export const createBubble = (
  text: string,
  role: ChatBubbleRole,
  renderAsMarkdown = false,
): HTMLDivElement => {
  const bubble = document.createElement('div')
  bubble.className = `chatbot-bubble ${role}`
  if (renderAsMarkdown) {
    bubble.innerHTML = renderMarkdown(text)
  } else {
    bubble.textContent = text
  }
  return bubble
}

export const createTypingBubble = (): HTMLDivElement => {
  const bubble = document.createElement('div')
  bubble.className = 'chatbot-bubble bot typing'
  bubble.setAttribute('aria-label', 'Assistant is typing')
  bubble.innerHTML = `
    <div class="chatbot-typing" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `
  return bubble
}
