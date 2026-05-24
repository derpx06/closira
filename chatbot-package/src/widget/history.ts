import type { ChatbotWidgetOptions, StoredMessage } from './types'

export const resolveHistoryKey = (options?: ChatbotWidgetOptions): string => {
  const base = 'chatbot_ai_history'
  const apiKey =
    options?.aiSupport?.apiKey ||
    options?.humanSupport?.widgetKey ||
    ''
  if (apiKey) {
    return `${base}:${apiKey}`
  }
  if (typeof window !== 'undefined') {
    return `${base}:${window.location.origin}`
  }
  return base
}

export const loadHistory = (storageKey: string): StoredMessage[] => {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry) => entry && (entry.role === 'user' || entry.role === 'bot'))
      .map((entry) => ({ role: entry.role, text: String(entry.text || '') }))
  } catch {
    return []
  }
}

export const saveHistory = (storageKey: string, history: StoredMessage[]): void => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(storageKey, JSON.stringify(history))
  } catch {
    // ignore storage errors
  }
}

export const pushHistory = (
  storageKey: string,
  history: StoredMessage[],
  entry: StoredMessage,
) => {
  history.push(entry)
  saveHistory(storageKey, history)
}

export const clearHistory = (storageKey: string, history: StoredMessage[]) => {
  history.splice(0, history.length)
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(storageKey)
  } catch {
    // ignore storage errors
  }
}
