export interface ChatbotWidgetOptions {
  botName?: string
  title?: string
  subtitle?: string
  welcomeMessage?: string
  placeholder?: string
  primaryColor?: string
  position?: 'bottom-right' | 'bottom-left'
  zIndex?: number
  aiSupport?: {
    apiBaseUrl: string
    apiKey: string
    chatPath?: string
  }
  humanSupport?: {
    apiBaseUrl: string
    widgetKey?: string
  }
  onUserMessage?: (message: string) => string | Promise<string> | void
  onTalkToHumanClick?: () => string | Promise<string> | void
}

export interface ChatbotWidgetInstance {
  open: () => void
  close: () => void
  toggle: () => void
  destroy: () => void
  sendMessage: (message: string) => Promise<void>
}

export type ResolvedOptions = Required<
  Omit<ChatbotWidgetOptions, 'onUserMessage' | 'onTalkToHumanClick' | 'aiSupport' | 'humanSupport'>
> &
  ChatbotWidgetOptions

export type StoredMessage = { role: 'user' | 'bot'; text: string }
