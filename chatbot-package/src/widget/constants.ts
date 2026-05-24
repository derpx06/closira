import type { ChatbotWidgetOptions } from './types'

export const STYLE_ID = 'chatbot-package-styles'

export const DEFAULT_OPTIONS: Required<
  Omit<ChatbotWidgetOptions, 'onUserMessage' | 'onTalkToHumanClick' | 'aiSupport' | 'humanSupport'>
> = {
  botName: 'Support Assistant',
  title: 'Support Assistant',
  subtitle: 'Online',
  welcomeMessage: 'Hi there! I am your support assistant. Ask me anything.',
  placeholder: 'Type your question...',
  primaryColor: '#2563eb',
  position: 'bottom-right',
  zIndex: 9999,
}

export const HISTORY_PAGE_SIZE = 30
