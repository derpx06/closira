import type { ResolvedOptions } from './types'
import { createBubble } from './chatBubble'

export const createControlButton = (
  iconName: string,
  ariaLabel: string,
  onClick?: () => void,
): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.innerHTML = `<i data-lucide="${iconName}" aria-hidden="true"></i>`
  button.setAttribute('aria-label', ariaLabel)
  if (onClick) {
    button.addEventListener('click', onClick)
  }
  return button
}

export const buildHeader = (config: ResolvedOptions, onClose: () => void) => {
  const header = document.createElement('header')
  header.className = 'chatbot-header'

  const headerLeft = document.createElement('div')
  headerLeft.className = 'chatbot-header-left'

  const avatar = document.createElement('div')
  avatar.className = 'chatbot-avatar'
  avatar.innerHTML = '<i data-lucide="bot" aria-hidden="true"></i>'

  const headerInfo = document.createElement('div')
  headerInfo.className = 'chatbot-header-info'

  const title = document.createElement('h2')
  title.textContent = config.title

  const status = document.createElement('div')
  status.className = 'chatbot-status'

  const statusDot = document.createElement('span')
  statusDot.className = 'chatbot-status-dot'

  const statusText = document.createElement('span')
  statusText.textContent = config.subtitle

  status.append(statusDot, statusText)
  headerInfo.append(title, status)
  headerLeft.append(avatar, headerInfo)

  const controls = document.createElement('div')
  controls.className = 'chatbot-controls'

  const closeControl = createControlButton('x', 'Close chat', onClose)
  controls.append(closeControl)

  header.append(headerLeft, controls)

  return {
    header,
    statusText,
  }
}

export const buildBody = (config: ResolvedOptions) => {
  const body = document.createElement('div')
  body.className = 'chatbot-body'

  const intro = document.createElement('section')
  intro.className = 'chatbot-intro'

  const introIcon = document.createElement('div')
  introIcon.className = 'chatbot-intro-icon'
  introIcon.textContent = '?'

  const introTitle = document.createElement('h3')
  introTitle.textContent = 'Hi there!'

  const introDescription = document.createElement('p')
  introDescription.textContent = 'I am your AI support assistant. Ask me anything.'

  const introHumanNote = document.createElement('p')
  introHumanNote.className = 'chatbot-human-note'
  introHumanNote.textContent =
    'If I cannot help, you can connect with our human support team.'

  intro.append(introIcon, introTitle, introDescription, introHumanNote)

  const humanHero = document.createElement('section')
  humanHero.className = 'chatbot-human-hero'
  const humanHeroTitle = document.createElement('h3')
  humanHeroTitle.textContent = 'Talk to Support'
  const humanHeroCopy = document.createElement('p')
  humanHeroCopy.textContent = 'Our team typically replies in a few minutes.'
  const historyLabel = document.createElement('div')
  historyLabel.className = 'chatbot-history-label'
  historyLabel.textContent = 'Previous Messages'
  humanHero.append(humanHeroTitle, humanHeroCopy, historyLabel)

  const humanDivider = document.createElement('div')
  humanDivider.className = 'chatbot-divider'
  humanDivider.textContent = 'Previous Messages'

  const messages = document.createElement('div')
  messages.className = 'chatbot-messages'
  messages.setAttribute('aria-live', 'polite')
  messages.appendChild(createBubble(config.welcomeMessage, 'bot', true))

  body.append(intro, humanHero, messages)

  return {
    body,
    humanDivider,
    messages,
  }
}

export const buildFooter = (config: ResolvedOptions) => {
  const footer = document.createElement('div')
  footer.className = 'chatbot-footer'

  const inputRow = document.createElement('form')
  inputRow.className = 'chatbot-input-row'

  const input = document.createElement('textarea')
  input.className = 'chatbot-input'
  input.rows = 1
  input.placeholder = config.placeholder

  const attachInput = document.createElement('input')
  attachInput.type = 'file'
  attachInput.accept = 'image/*'
  attachInput.className = 'chatbot-attach-input'

  const attachButton = document.createElement('button')
  attachButton.type = 'button'
  attachButton.className = 'chatbot-attach'
  attachButton.setAttribute('aria-label', 'Upload image')
  attachButton.innerHTML = '<i data-lucide="image" aria-hidden="true"></i>'

  const sendButton = document.createElement('button')
  sendButton.type = 'submit'
  sendButton.className = 'chatbot-send'
  sendButton.setAttribute('aria-label', 'Send message')
  sendButton.innerHTML = '<i data-lucide="send-horizontal" aria-hidden="true"></i>'

  inputRow.append(input, attachButton, sendButton, attachInput)

  const humanButton = document.createElement('button')
  humanButton.type = 'button'
  humanButton.className = 'chatbot-human-button'

  const poweredText = document.createElement('p')
  poweredText.className = 'chatbot-powered'
  poweredText.innerHTML = 'Powered by <strong>AI assistant</strong>'

  const loadingRow = document.createElement('div')
  loadingRow.className = 'chatbot-loading-row'
  loadingRow.innerHTML = `
    <span class="chatbot-loading-label">Waiting for support</span>
    <span class="chatbot-loading-dots" aria-hidden="true">
      <span></span><span></span><span></span>
    </span>
  `

  footer.append(inputRow, loadingRow, humanButton, poweredText)

  return {
    footer,
    inputRow,
    input,
    humanButton,
    loadingRow,
    attachInput,
    attachButton,
  }
}

export const buildHumanContainer = () => {
  const humanContainer = document.createElement('div')
  humanContainer.className = 'chatbot-human-container'

  const humanHeader = document.createElement('div')
  humanHeader.className = 'chatbot-human-header'
  const humanTitle = document.createElement('h3')
  humanTitle.textContent = 'Contact Support'
  const humanSubtitle = document.createElement('p')
  humanSubtitle.textContent = 'Please provide your details and we will get back to you shortly.'
  humanHeader.append(humanTitle, humanSubtitle)

  const humanForm = document.createElement('form')
  humanForm.className = 'chatbot-human-form'

  const createFormGroup = (labelStr: string, inputEl: HTMLElement) => {
    const group = document.createElement('div')
    group.className = 'chatbot-form-group'
    const label = document.createElement('label')
    label.textContent = labelStr
    group.append(label, inputEl)
    return group
  }

  const nameInput = document.createElement('input')
  nameInput.type = 'text'
  nameInput.placeholder = 'John Doe'
  nameInput.required = true

  const emailInput = document.createElement('input')
  emailInput.type = 'email'
  emailInput.placeholder = 'john@example.com'
  emailInput.required = true

  const issueTextarea = document.createElement('textarea')
  issueTextarea.placeholder = 'How can we help you?'
  issueTextarea.required = true

  const formActions = document.createElement('div')
  formActions.className = 'chatbot-form-actions'

  const cancelBtn = document.createElement('button')
  cancelBtn.type = 'button'
  cancelBtn.className = 'chatbot-btn-secondary'
  cancelBtn.innerHTML =
    '<i data-lucide="arrow-left" aria-hidden="true" style="width: 16px; height: 16px;"></i> Back'

  const submitBtn = document.createElement('button')
  submitBtn.type = 'submit'
  submitBtn.className = 'chatbot-btn-primary'
  submitBtn.textContent = 'Send Message'

  formActions.append(cancelBtn, submitBtn)
  humanForm.append(
    createFormGroup('Name', nameInput),
    createFormGroup('Email', emailInput),
    createFormGroup('Description', issueTextarea),
    formActions,
  )

  const humanSuccess = document.createElement('div')
  humanSuccess.className = 'chatbot-human-success'

  const successIcon = document.createElement('div')
  successIcon.className = 'chatbot-success-icon'
  successIcon.innerHTML = '<i data-lucide="check-circle" aria-hidden="true"></i>'

  const successTitle = document.createElement('h3')
  successTitle.textContent = 'Message Sent!'

  const successMsg = document.createElement('p')
  successMsg.textContent = 'Our support team will reach out to you via email shortly.'

  const successBackBtn = document.createElement('button')
  successBackBtn.type = 'button'
  successBackBtn.className = 'chatbot-btn-primary'
  successBackBtn.textContent = 'Back to Chat'

  humanSuccess.append(successIcon, successTitle, successMsg, successBackBtn)
  humanContainer.append(humanHeader, humanForm, humanSuccess)

  return {
    humanContainer,
    humanForm,
    cancelBtn,
    successBackBtn,
  }
}
