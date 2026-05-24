export const resolveApiBase = (input: string): string => {
  const trimmed = String(input || '').trim().replace(/\/+$/, '')
  if (!trimmed) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('/')) {
    return `${window.location.origin}${trimmed}`
  }
  return trimmed
}

export const resolveApiPath = (input: string): string =>
  input.startsWith('/') ? input : `/${input}`

export const resolveSocketBase = (apiBase: string): string => apiBase.replace(/\/api\/?$/i, '')

export const unwrapResponseData = <T>(payload: unknown): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data
  }
  return payload as T
}
