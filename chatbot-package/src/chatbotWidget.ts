import { io, type Socket } from 'socket.io-client'
import { DEFAULT_OPTIONS, HISTORY_PAGE_SIZE } from './widget/constants'
import { ensureStyles } from './widget/styles'
import { hydrateIcons } from './widget/icons'
import {
  resolveApiBase,
  resolveApiPath,
  resolveSocketBase,
  unwrapResponseData,
} from './widget/utils'
import { resolveHistoryKey, loadHistory, pushHistory, clearHistory } from './widget/history'
import { buildBody, buildFooter, buildHeader, buildHumanContainer } from './widget/ui'
import { createBubble, createTypingBubble } from './widget/chatBubble'
import type {
  ChatbotWidgetInstance,
  ChatbotWidgetOptions,
  ResolvedOptions,
} from './widget/types'

export type { ChatbotWidgetInstance, ChatbotWidgetOptions }

export const createChatbotWidget = (
  options: ChatbotWidgetOptions = {},
): ChatbotWidgetInstance => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('chatbot-package can only run in a browser environment.')
  }

  ensureStyles()

  const config: ResolvedOptions = { ...DEFAULT_OPTIONS, ...options }
  const root = document.createElement('div')
  root.className = `chatbot-widget-root ${
    config.position === 'bottom-left' ? 'left' : 'right'
  }`
  root.style.setProperty('--chatbot-primary', config.primaryColor)
  root.style.zIndex = String(config.zIndex)

  const launcherButton = document.createElement('button')
  launcherButton.type = 'button'
  launcherButton.className = 'chatbot-launcher'
  launcherButton.setAttribute('aria-label', 'Open chatbot')
  launcherButton.setAttribute('aria-expanded', 'false')
  launcherButton.innerHTML = '<i data-lucide="message-circle" aria-hidden="true"></i>'

  const panel = document.createElement('section')
  panel.className = 'chatbot-panel'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-label', config.title)

  const closePanel = (): void => {
    root.classList.remove('open')
    launcherButton.setAttribute('aria-expanded', 'false')
  }

  const { header, statusText } = buildHeader(config, closePanel)
  const { body, humanDivider, messages } = buildBody(config)
  const { footer, inputRow, input, humanButton, loadingRow, attachInput, attachButton } =
    buildFooter(config)
  const humanButtonMarkup =
    '<i data-lucide="user-round" aria-hidden="true"></i><span>Talk to a real human</span>'
  const aiButtonMarkup = '<i data-lucide="bot" aria-hidden="true"></i><span>Talk to AI</span>'
  humanButton.innerHTML = humanButtonMarkup

  const { humanContainer, humanForm, cancelBtn, successBackBtn } = buildHumanContainer()

  const historyStorageKey = resolveHistoryKey(options)
  const messageHistory = loadHistory(historyStorageKey)
  const humanMessages: Array<{
    role: 'user' | 'bot' | 'system'
    text: string
    markdown?: boolean
  }> = []
  const humanSessionHistory: Array<
    Array<{ role: 'user' | 'bot' | 'system'; text: string; markdown?: boolean }>
  > = []
  let showHumanRecent = true
  let historyOffset = Math.max(messageHistory.length - HISTORY_PAGE_SIZE, 0)
  let isHistoryPaging = false

  const getHistoryInsertAnchor = (): ChildNode | null => {
    if (messages.contains(humanDivider)) {
      return humanDivider.nextSibling
    }
    return messages.firstChild
  }

  const renderHistoryWindow = (): void => {
    messages.innerHTML = ''
    const windowItems = messageHistory.slice(historyOffset)
    if (windowItems.length === 0) {
      return
    }
    body.classList.add('has-messages')
    windowItems.forEach((entry) => {
      messages.appendChild(createBubble(entry.text, entry.role, entry.role === 'bot'))
    })
    body.scrollTop = body.scrollHeight
  }

  const renderHumanMessages = (): void => {
    messages.innerHTML = ''
    if (humanMessages.length === 0) {
      const recentSession =
        humanSessionHistory.length > 0
          ? humanSessionHistory[humanSessionHistory.length - 1]
          : []
      if (recentSession.length === 0 || !showHumanRecent) {
        body.classList.remove('has-messages')
        return
      }
      body.classList.add('has-messages')
      const recentWrapper = document.createElement('div')
      recentWrapper.className = 'chatbot-recent-history'
      const recentLabel = document.createElement('div')
      recentLabel.className = 'chatbot-recent-label'
      recentLabel.textContent = 'Previous Messages'
      recentWrapper.appendChild(recentLabel)
      const recentItems = recentSession.slice(-6)
      recentItems.forEach((entry) => {
        const entryMarkdown =
          entry.role === 'bot' ||
          (typeof (entry as { markdown?: boolean }).markdown === 'boolean'
            ? (entry as { markdown?: boolean }).markdown
            : false)
        recentWrapper.appendChild(createBubble(entry.text, entry.role, entryMarkdown))
      })
      messages.appendChild(recentWrapper)
      body.scrollTop = body.scrollHeight
      return
    }
    body.classList.add('has-messages')
    humanMessages.forEach((entry) => {
      messages.appendChild(createBubble(entry.text, entry.role, entry.markdown ?? false))
    })
    body.scrollTop = body.scrollHeight
  }

  const prependHistoryPage = (): void => {
    if (isHistoryPaging || historyOffset === 0) return
    isHistoryPaging = true
    const nextOffset = Math.max(historyOffset - HISTORY_PAGE_SIZE, 0)
    const chunk = messageHistory.slice(nextOffset, historyOffset)
    if (chunk.length === 0) {
      isHistoryPaging = false
      return
    }
    const prevScrollHeight = body.scrollHeight
    const prevScrollTop = body.scrollTop
    const anchor = getHistoryInsertAnchor()
    chunk.forEach((entry) => {
      messages.insertBefore(createBubble(entry.text, entry.role, entry.role === 'bot'), anchor)
    })
    historyOffset = nextOffset
    body.scrollTop = prevScrollTop + (body.scrollHeight - prevScrollHeight)
    isHistoryPaging = false
  }

  const handleHistoryScroll = (): void => {
    if (historyOffset === 0) return
    if (body.scrollTop <= 12) {
      prependHistoryPage()
    }
  }

  if (messageHistory.length > 0) {
    renderHistoryWindow()
  }

  body.addEventListener('scroll', handleHistoryScroll)

  panel.append(header, body, footer, humanContainer)
  root.append(panel, launcherButton)
  document.body.appendChild(root)
  hydrateIcons()

  let isOpen = false
  let isDestroyed = false
  let isHumanChatActive = false
  let isHumanAgentConnected = false
  let isHumanConnecting = false
  let agentJoinedNoticeSent = false
  let awaitingHumanIssue = false
  let widgetSocket: Socket | null = null
  let widgetSessionId: string | null = null
  let widgetTicketId: string | null = null
  const seenMessageIds = new Set<string>()

  const appendBotBubble = (
    text: string,
    options?: { markdown?: boolean; store?: boolean },
  ): void => {
    if (!text.trim()) return
    body.classList.add('has-messages')
    messages.appendChild(createBubble(text.trim(), 'bot', options?.markdown ?? true))
    body.scrollTop = body.scrollHeight
    if (options?.store && !isHumanChatActive && !awaitingHumanIssue) {
      pushHistory(historyStorageKey, messageHistory, { role: 'bot', text: text.trim() })
    }
  }

  const appendHumanBubble = (
    text: string,
    role: 'user' | 'bot' | 'system',
    options?: { markdown?: boolean },
  ): void => {
    if (!text.trim()) return
    body.classList.add('has-messages')
    humanMessages.push({ role, text: text.trim(), markdown: options?.markdown ?? false })
    messages.appendChild(createBubble(text.trim(), role, options?.markdown ?? false))
    body.scrollTop = body.scrollHeight
  }

  const setHumanLoading = (active: boolean, label?: string): void => {
    if (!loadingRow) return
    if (label) {
      const labelEl = loadingRow.querySelector('.chatbot-loading-label')
      if (labelEl) labelEl.textContent = label
    }
    loadingRow.style.display = active ? 'flex' : 'none'
  }

  const updateAttachmentVisibility = (): void => {
    if (!attachButton) return
    const shouldShow = isHumanChatActive && !awaitingHumanIssue
    attachButton.style.display = shouldShow ? 'grid' : 'none'
  }

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Unable to read file.'))
      reader.readAsDataURL(file)
    })

  const resolveWidgetKey = async (): Promise<string | null> => {
    if (config.humanSupport?.widgetKey) {
      return config.humanSupport.widgetKey
    }
    if (options.aiSupport?.apiKey && config.humanSupport?.apiBaseUrl) {
      const apiBaseUrl = resolveApiBase(config.humanSupport.apiBaseUrl)
      const keyUrl = /\/api$/i.test(apiBaseUrl)
        ? `${apiBaseUrl}/widget/key`
        : `${apiBaseUrl}/api/widget/key`
      const response = await fetch(keyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: options.aiSupport.apiKey }),
      })
      if (!response.ok) {
        return null
      }
      const payload = unwrapResponseData<{ widgetKey?: string }>(await response.json())
      if (payload?.widgetKey) {
        config.humanSupport.widgetKey = payload.widgetKey
        return payload.widgetKey
      }
    }
    return null
  }

  const uploadImage = async (file: File): Promise<string> => {
    const widgetKey = await resolveWidgetKey()
    if (!widgetKey) {
      throw new Error('Widget key is required for uploads.')
    }
    const apiBaseUrl = resolveApiBase(
      config.humanSupport?.apiBaseUrl || options.aiSupport?.apiBaseUrl || '',
    )
    const uploadUrl = /\/api$/i.test(apiBaseUrl)
      ? `${apiBaseUrl}/uploads/chat-image`
      : `${apiBaseUrl}/api/uploads/chat-image`
    const dataUrl = await readFileAsDataUrl(file)
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        widgetKey,
        fileName: file.name,
        dataUrl,
      }),
    })
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null)
      const msg =
        errorPayload?.message ||
        errorPayload?.error ||
        'Unable to upload image right now.'
      throw new Error(msg)
    }
    const payload = unwrapResponseData<{ url: string }>(await response.json())
    if (!payload?.url) {
      throw new Error('Upload succeeded but no URL was returned.')
    }
    return payload.url
  }

  let pendingImageUrl: string | null = null

  let setHumanMode = (enabled: boolean): void => {
    body.classList.toggle('human-mode', enabled)
    if (enabled) {
      if (!messages.contains(humanDivider)) {
        messages.insertBefore(humanDivider, messages.firstChild)
      }
      humanButton.innerHTML = aiButtonMarkup
    } else {
      if (messages.contains(humanDivider)) {
        humanDivider.remove()
      }
      humanButton.innerHTML = humanButtonMarkup
    }
    hydrateIcons()
    updateAttachmentVisibility()
  }

  const headerControls = header.querySelector('.chatbot-controls')
  if (headerControls) {
    const clearBtn = document.createElement('button')
    clearBtn.type = 'button'
    clearBtn.setAttribute('aria-label', 'Clear AI chat')
    clearBtn.innerHTML = '<i data-lucide="x" aria-hidden="true"></i>'
    headerControls.appendChild(clearBtn)

    const newHumanBtn = document.createElement('button')
    newHumanBtn.type = 'button'
    newHumanBtn.setAttribute('aria-label', 'Start new human session')
    newHumanBtn.innerHTML = '<i data-lucide="plus" aria-hidden="true"></i>'
    headerControls.appendChild(newHumanBtn)

    const updateControlVisibility = (humanMode: boolean) => {
      clearBtn.style.display = humanMode ? 'none' : 'grid'
      newHumanBtn.style.display = humanMode ? 'grid' : 'none'
    }

    updateControlVisibility(false)

    const resetAiHistory = () => {
      if (isHumanChatActive) return
      clearHistory(historyStorageKey, messageHistory)
      historyOffset = Math.max(messageHistory.length - HISTORY_PAGE_SIZE, 0)
      messages.innerHTML = ''
      body.classList.remove('has-messages')
      messages.appendChild(createBubble(config.welcomeMessage, 'bot', true))
      body.scrollTop = body.scrollHeight
    }

    const startNewHumanSession = () => {
      if (humanMessages.length > 0) {
        humanSessionHistory.push([...humanMessages])
      }
      if (widgetSocket) {
        widgetSocket.close()
        widgetSocket = null
      }
      widgetSessionId = null
      widgetTicketId = null
      isHumanChatActive = false
      isHumanAgentConnected = false
      agentJoinedNoticeSent = false
      awaitingHumanIssue = true
      humanMessages.splice(0, humanMessages.length)
      showHumanRecent = false
      setHumanMode(true)
      renderHumanMessages()
      appendHumanBubble('Please describe the issue you are facing.', 'bot')
      humanButton.innerHTML = aiButtonMarkup
      hydrateIcons()
    }

    clearBtn.addEventListener('click', resetAiHistory)
    newHumanBtn.addEventListener('click', startNewHumanSession)

    const originalSetHumanMode = setHumanMode
    setHumanMode = (enabled: boolean): void => {
      originalSetHumanMode(enabled)
      updateControlVisibility(enabled)
      if (enabled) {
        showHumanRecent = true
        renderHumanMessages()
      } else if (messageHistory.length > 0) {
        historyOffset = Math.max(messageHistory.length - HISTORY_PAGE_SIZE, 0)
        renderHistoryWindow()
      } else {
        messages.innerHTML = ''
        body.classList.remove('has-messages')
        messages.appendChild(createBubble(config.welcomeMessage, 'bot', true))
      }
    }
  }

  const setOpen = (nextOpen: boolean): void => {
    if (isDestroyed) {
      return
    }

    isOpen = nextOpen
    root.classList.toggle('open', isOpen)
    launcherButton.setAttribute('aria-expanded', String(isOpen))

    if (isOpen) {
      window.setTimeout(() => input.focus(), 0)
    }
  }

  const appendBotReply = async (message: string): Promise<void> => {
    if (isHumanChatActive && widgetSocket) {
      widgetSocket.emit('widget:message', { text: message })
      return
    }

    if (options.onUserMessage) {
      const result = await options.onUserMessage(message)
      if (typeof result === 'string' && result.trim()) {
        appendBotBubble(result, { store: true })
      }
      return
    }

    if (options.aiSupport) {
      try {
        const apiBaseUrl = resolveApiBase(options.aiSupport.apiBaseUrl)
        const chatPath = resolveApiPath(options.aiSupport.chatPath || '/rag/chat')
        const response = await fetch(`${apiBaseUrl}${chatPath}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': options.aiSupport.apiKey,
          },
          body: JSON.stringify({
            query: message,
          }),
        })

        if (!response.ok) {
          throw new Error('Unable to fetch chatbot response right now.')
        }

        const data = unwrapResponseData<Record<string, unknown>>(await response.json())
        const answer =
          (typeof data?.answer === 'string' && data.answer) ||
          (typeof data?.response === 'string' && data.response) ||
          (typeof data?.message === 'string' && data.message) ||
          'I processed your question, but no answer text was returned.'
        appendBotBubble(answer, { markdown: true, store: true })
        const references =
          (Array.isArray((data as any)?.sources) && (data as any).sources) ||
          (Array.isArray((data as any)?.references) && (data as any).references) ||
          []
        if (references.length > 0) {
          const items = references
            .slice(0, 5)
            .map((ref: any) => {
              const url = ref?.url || ref?.link
              if (!url) return null
              const title = ref?.title || ref?.name || url
              return `- [${title}](${url})`
            })
            .filter(Boolean)
          if (items.length > 0) {
            appendBotBubble(['### References', ...items].join('\n'), { markdown: true, store: true })
          }
        }
        if (data?.raise_ticket && data?.ticket_payload) {
          const payload = data.ticket_payload as {
            summary?: string
            priority?: string
            urgency?: string
          }
          const ticketId =
            (data as any)?.ticket?._id || (data as any)?.ticketId || (data as any)?.ticket_id
          const details = [
            '### Ticket Details',
            payload?.summary ? `- Summary: ${payload.summary}` : null,
            payload?.priority ? `- Priority: ${String(payload.priority).toUpperCase()}` : null,
            payload?.urgency ? `- Urgency: ${String(payload.urgency).toUpperCase()}` : null,
            ticketId ? `- Ticket ID: ${ticketId}` : null,
            '- Status: Pending',
          ].filter(Boolean) as string[]
          appendBotBubble(details.join('\n'), { markdown: true, store: true })
        }
      } catch (error) {
        const msg = error instanceof Error
          ? error.message
          : 'Sorry, I am having trouble connecting right now.'
        appendBotBubble(
          msg.includes('Failed to fetch')
            ? 'Unable to reach the AI server. Please try again.'
            : msg,
        )
      }
      return
    }

    appendBotBubble(`Thanks! ${config.botName} received: "${message}"`, { store: true })
  }

  const connectHumanSupport = async (payload: {
    name: string
    email: string
    issue: string
  }): Promise<void> => {
    if (!config.humanSupport) {
      appendHumanBubble('Human support is not configured for this widget yet.', 'bot')
      return
    }

    const widgetKey = await resolveWidgetKey()
    if (!widgetKey) {
      throw new Error('Human support requires a widget key or aiSupport.apiKey.')
    }

    const apiBaseUrl = resolveApiBase(config.humanSupport.apiBaseUrl)
    const sessionUrl = /\/api$/i.test(apiBaseUrl)
      ? `${apiBaseUrl}/widget/session`
      : `${apiBaseUrl}/api/widget/session`
    const response = await fetch(sessionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        widgetKey,
        visitorName: payload.name,
        visitorEmail: payload.email,
        issue: payload.issue,
        chatHistory: messageHistory,
      }),
    })

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null)
      const msg =
        errorPayload?.message ||
        errorPayload?.error ||
        'Unable to connect to human support right now.'
      throw new Error(msg)
    }

    const sessionData = unwrapResponseData<{
      sessionId: string
      ticketId: string
      chatToken: string
    }>(await response.json())

    widgetSessionId = sessionData.sessionId
    widgetTicketId = sessionData.ticketId
    isHumanChatActive = true
    setHumanMode(true)

    const socket = io(resolveSocketBase(apiBaseUrl), {
      path: '/socket.io',
      transports: ['websocket'],
      auth: {
        token: sessionData.chatToken,
      },
    })
    widgetSocket = socket

    socket.on('connect', () => {
      statusText.textContent = 'Connecting to a human agent...'
    })

    socket.on('disconnect', () => {
      if (isHumanChatActive) {
        statusText.textContent = 'Reconnecting to human support...'
      }
    })

    socket.on(
      'chat:message',
      (event: { _id?: string; sessionId?: string | null; sender?: string; text?: string }) => {
        if (event.sessionId !== widgetSessionId) return
        if (event._id && seenMessageIds.has(event._id)) return
        if (event._id) seenMessageIds.add(event._id)
        if (event.sender === 'agent' && typeof event.text === 'string') {
          if (!isHumanAgentConnected) {
            appendHumanBubble('You are now connected to a human agent.', 'bot')
            appendHumanBubble('AGENT JOINED THE SESSION', 'system')
            agentJoinedNoticeSent = true
          }
          setHumanLoading(false)
          appendHumanBubble(event.text, 'bot', { markdown: true })
          isHumanAgentConnected = true
        }
      },
    )

    socket.on(
      'chat:ticket_status',
      (event: { sessionId?: string | null; ticketId?: string | null; status?: string }) => {
        const sameSession =
          (event.sessionId && event.sessionId === widgetSessionId) ||
          (event.ticketId && event.ticketId === widgetTicketId)
        if (!sameSession) return

        if (event.status === 'assigned') {
          if (!isHumanAgentConnected) {
            appendHumanBubble('A human agent has accepted your chat. You are now connected.', 'bot')
          }
          isHumanAgentConnected = true
          setHumanLoading(false)
          if (!agentJoinedNoticeSent) {
            appendHumanBubble('AGENT JOINED THE SESSION', 'system')
            agentJoinedNoticeSent = true
          }
          statusText.textContent = 'Connected with human support'
          return
        }

        if (event.status === 'pending') {
          statusText.textContent = 'Connecting to a human agent...'
        }
      },
    )

    socket.on('chat:error', (event: { message?: string }) => {
      appendHumanBubble(event.message || 'Support connection error. Please try again.', 'bot')
    })

    socket.emit('widget:request_human', {
      name: payload.name,
      email: payload.email,
      issue: payload.issue,
    })
    statusText.textContent = 'Connecting to a human agent...'
    setHumanLoading(true, 'Connecting to support')
  }

  const sendMessage = async (message: string): Promise<void> => {
    const cleaned = message.trim()
    const attachmentUrl = pendingImageUrl
    if ((!cleaned && !attachmentUrl) || isDestroyed) {
      if (attachmentUrl) {
        pendingImageUrl = attachmentUrl
      }
      return
    }

    if (attachmentUrl) {
      pendingImageUrl = null
    }

    const finalMessage = attachmentUrl
      ? `${cleaned || 'Attached image:'}\n\n![Uploaded image](${attachmentUrl})`
      : cleaned

    if (awaitingHumanIssue) {
      body.classList.add('has-messages')
      setHumanMode(true)
      appendHumanBubble(finalMessage, 'user', { markdown: true })
      if (!isHumanChatActive && !awaitingHumanIssue) {
        pushHistory(historyStorageKey, messageHistory, { role: 'user', text: finalMessage })
      }
      input.value = ''
      body.scrollTop = body.scrollHeight
      awaitingHumanIssue = false
      updateAttachmentVisibility()
      try {
        await connectHumanSupport({
          name: 'Website Visitor',
          email: '',
          issue: finalMessage,
        })
        appendHumanBubble("You're now connected to a support agent. Please wait...", 'bot')
        setHumanLoading(true, 'Waiting for support')
        humanButton.innerHTML = aiButtonMarkup
        hydrateIcons()
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : 'Unable to connect to support right now.'
        appendHumanBubble(msg, 'bot')
        setHumanLoading(false)
        awaitingHumanIssue = true
      }
      return
    }

    body.classList.add('has-messages')
    setHumanMode(isHumanChatActive)
    if (isHumanChatActive) {
      appendHumanBubble(finalMessage, 'user', { markdown: !!attachmentUrl })
      setHumanLoading(true, 'Waiting for support')
    } else {
      messages.appendChild(createBubble(finalMessage, 'user', !!attachmentUrl))
    }
    updateAttachmentVisibility()
    if (!isHumanChatActive && !awaitingHumanIssue) {
      pushHistory(historyStorageKey, messageHistory, { role: 'user', text: finalMessage })
    }
    input.value = ''
    body.scrollTop = body.scrollHeight

    const typingBubble = !isHumanChatActive ? createTypingBubble() : null
    if (typingBubble) {
      messages.appendChild(typingBubble)
      body.scrollTop = body.scrollHeight
    }

    try {
      await appendBotReply(finalMessage)
    } finally {
      if (typingBubble?.isConnected) {
        typingBubble.remove()
      }
    }
  }

  launcherButton.addEventListener('click', () => {
    setOpen(!isOpen)
  })

  inputRow.addEventListener('submit', async (event) => {
    event.preventDefault()
    await sendMessage(input.value)
  })

  attachButton.addEventListener('click', () => {
    attachInput.click()
  })

  attachInput.addEventListener('change', async () => {
    const file = attachInput.files?.[0]
    attachInput.value = ''
    if (!file) return
    if (!isHumanChatActive && !awaitingHumanIssue) {
      appendBotBubble('Image uploads are available in human support chat.')
      return
    }
    try {
      const url = await uploadImage(file)
      pendingImageUrl = url
      appendHumanBubble('Image attached. Please include it with your message.', 'system')
      updateAttachmentVisibility()
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Unable to upload image right now.'
      appendHumanBubble(msg, 'bot')
    }
  })

  input.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      await sendMessage(input.value)
    }
  })

  humanButton.addEventListener('click', async () => {
    if (!isHumanChatActive && awaitingHumanIssue) {
      awaitingHumanIssue = false
      setHumanMode(false)
      setHumanLoading(false)
      humanButton.innerHTML = humanButtonMarkup
      hydrateIcons()
      return
    }
    if (isHumanChatActive) {
      // Switch back to AI mode.
      if (humanMessages.length > 0) {
        humanSessionHistory.push([...humanMessages])
        humanMessages.splice(0, humanMessages.length)
      }
      isHumanChatActive = false
      isHumanAgentConnected = false
      setHumanLoading(false)
      awaitingHumanIssue = false
      setHumanMode(false)
      appendBotBubble('You are now chatting with AI again.')
      humanButton.innerHTML = humanButtonMarkup
      hydrateIcons()
      return
    }

    if (isHumanConnecting) {
      return
    }
    isHumanConnecting = true
    setHumanMode(true)
    if (!awaitingHumanIssue) {
      appendHumanBubble('Please describe the issue you are facing.', 'bot')
      awaitingHumanIssue = true
      updateAttachmentVisibility()
    }
    try {
      humanButton.innerHTML = aiButtonMarkup
      hydrateIcons()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to connect to support right now.'
      appendBotBubble(
        msg.includes('Failed to fetch') ? 'Unable to reach support server. Please try again.' : msg,
      )
      isHumanChatActive = false
      isHumanAgentConnected = false
      setHumanLoading(false)
      awaitingHumanIssue = false
      setHumanMode(false)
      humanButton.innerHTML = humanButtonMarkup
      hydrateIcons()
    } finally {
      isHumanConnecting = false
    }
  })

  cancelBtn.addEventListener('click', () => {
    // no-op (legacy)
  })

  humanForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    // no-op (legacy)
  })

  successBackBtn.addEventListener('click', () => {
    root.classList.remove('show-human-form')
    root.classList.remove('show-human-success')
    humanForm.reset()

    body.classList.add('has-messages')
    messages.appendChild(
      createBubble(
        isHumanChatActive && widgetTicketId
          ? isHumanAgentConnected
            ? `You are now connected with our support team (ticket ${widgetTicketId.slice(-6)}).`
            : `Your ticket ${widgetTicketId.slice(-6)} is waiting for an available human agent.`
          : 'Your issue has been submitted. A human agent will contact you soon.',
        'bot',
      ),
    )
    body.scrollTop = body.scrollHeight
  })

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!isOpen),
    sendMessage,
    destroy: () => {
      if (isDestroyed) {
        return
      }

      isDestroyed = true
      body.removeEventListener('scroll', handleHistoryScroll)
      if (widgetSocket) {
        widgetSocket.close()
        widgetSocket = null
      }
      root.remove()
    },
  }
}
