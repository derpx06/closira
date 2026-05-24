import { STYLE_ID } from './constants'
import { CHAT_BUBBLE_CSS } from './chatBubble/styles'

export const WIDGET_CSS = `
.chatbot-widget-root {
  position: fixed;
  bottom: 16px;
  font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
}

.chatbot-widget-root.right {
  right: 16px;
}

.chatbot-widget-root.left {
  left: 16px;
}

.chatbot-launcher {
  width: 56px;
  height: 56px;
  border-radius: 9999px;
  border: 0;
  background: linear-gradient(135deg, var(--chatbot-primary), #1d4ed8);
  color: #ffffff;
  box-shadow: 0 16px 30px rgba(37, 99, 235, 0.35);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.2px;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.chatbot-launcher svg {
  width: 20px;
  height: 20px;
}

.chatbot-launcher:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 34px rgba(37, 99, 235, 0.42);
}

.chatbot-panel {
  position: absolute;
  bottom: 66px;
  width: min(378px, calc(100vw - 24px));
  height: min(610px, calc(100vh - 88px));
  border-radius: 16px;
  border: 1px solid #dbe4f5;
  overflow: hidden;
  box-shadow: 0 28px 56px rgba(15, 23, 42, 0.24);
  background: #f8fbff;
  display: flex;
  flex-direction: column;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(10px) scale(0.98);
  transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease;
}

.chatbot-widget-root.right .chatbot-panel {
  right: 0;
  transform-origin: bottom right;
}

.chatbot-widget-root.left .chatbot-panel {
  left: 0;
  transform-origin: bottom left;
}

.chatbot-widget-root.open .chatbot-panel {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateY(0) scale(1);
}

.chatbot-header {
  background: linear-gradient(135deg, var(--chatbot-primary), #1d4ed8);
  color: #ffffff;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.chatbot-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chatbot-avatar {
  width: 38px;
  height: 38px;
  border-radius: 9999px;
  background: #ffffff;
  color: var(--chatbot-primary);
  border: 1px solid rgba(255, 255, 255, 0.84);
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 700;
}

.chatbot-avatar svg {
  width: 18px;
  height: 18px;
}

.chatbot-header-info h2 {
  margin: 0;
  font-size: 15px;
  line-height: 1.15;
  font-weight: 700;
}

.chatbot-status {
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  opacity: 0.95;
}

.chatbot-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  background: #22c55e;
}

.chatbot-controls {
  display: flex;
  align-items: center;
  margin-left: auto;
  gap: 6px;
}

.chatbot-controls button {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.42);
  background: rgba(255, 255, 255, 0.24);
  color: #ffffff;
  cursor: pointer;
  line-height: 0;
  display: grid;
  place-items: center;
  font-size: 14px;
  transition: background 0.2s ease, transform 0.2s ease;
}

.chatbot-controls button svg {
  width: 16px;
  height: 16px;
  stroke-width: 2.25;
}

.chatbot-controls button:hover {
  background: rgba(255, 255, 255, 0.36);
  transform: translateY(-1px);
}

.chatbot-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 12px 10px;
  background: linear-gradient(180deg, #f8fbff 0%, #f1f6ff 100%);
}

.chatbot-body::-webkit-scrollbar {
  width: 8px;
}

.chatbot-body::-webkit-scrollbar-thumb {
  background: #bfdbfe;
  border-radius: 999px;
}

.chatbot-body-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chatbot-intro {
  text-align: center;
  color: #334155;
  border: 1px solid #dbe4f5;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 14px;
  padding: 16px 12px;
}

.chatbot-intro-icon {
  width: 44px;
  height: 44px;
  border-radius: 9999px;
  background: #dbeafe;
  color: #1d4ed8;
  display: grid;
  place-items: center;
  font-size: 22px;
  font-weight: 700;
  margin: 0 auto 12px;
}

.chatbot-intro h3 {
  margin: 0;
  font-size: 25px;
  color: #0f172a;
}

.chatbot-intro p {
  margin: 10px auto 0;
  max-width: 290px;
  font-size: 13px;
  line-height: 1.45;
  color: #475569;
}

.chatbot-intro .chatbot-human-note {
  margin-top: 12px;
  font-style: italic;
  font-size: 12px;
  color: #6b7a92;
}

.chatbot-messages {
  display: none;
  flex-direction: column;
  gap: 8px;
}

.chatbot-body.has-messages .chatbot-intro {
  display: none;
}

.chatbot-body.has-messages .chatbot-messages {
  display: flex;
}
.chatbot-body.human-mode .chatbot-intro {
  display: none;
}
.chatbot-human-hero {
  display: none;
  text-align: center;
  color: #0f172a;
  border: 1px solid #dbe4f5;
  background: rgba(255, 255, 255, 0.88);
  border-radius: 14px;
  padding: 18px 14px;
}
.chatbot-body.human-mode .chatbot-human-hero {
  display: block;
}
.chatbot-human-hero h3 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}
.chatbot-human-hero p {
  margin: 8px 0 0;
  font-size: 13px;
  color: #475569;
}
.chatbot-history-label {
  margin-top: 14px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #94a3b8;
  text-align: center;
}
.chatbot-divider {
  display: none;
  align-items: center;
  gap: 10px;
  margin: 16px 0 10px;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.chatbot-divider::before,
.chatbot-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: #e2e8f0;
}
.chatbot-body.human-mode .chatbot-divider {
  display: flex;
}

.chatbot-recent-history {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chatbot-recent-label {
  text-align: center;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #94a3b8;
}

${CHAT_BUBBLE_CSS}

.chatbot-ref-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.chatbot-ref-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 999px;
  background: #eef2ff;
  color: #1e40af;
  text-decoration: none;
  border: 1px solid #e0e7ff;
}

.chatbot-ref-chip:hover {
  background: #e0e7ff;
}

.chatbot-image {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: 10px;
  margin-top: 6px;
  border: 1px solid #e2e8f0;
}

.chatbot-md-p {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: inherit;
}

.chatbot-md-spacer {
  height: 8px;
}

.chatbot-md-list {
  margin: 6px 0 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.5;
}

.chatbot-md-list li + li {
  margin-top: 4px;
}

.chatbot-footer {
  border-top: 1px solid #dbe4f5;
  padding: 12px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chatbot-loading-row {
  display: none;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  background: #f1f5ff;
  border: 1px solid #dbeafe;
  color: #1e40af;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.chatbot-loading-dots {
  display: inline-flex;
  gap: 4px;
}

.chatbot-loading-dots span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #1d4ed8;
  animation: chatbot-loading-pulse 1.2s infinite ease-in-out;
}

.chatbot-loading-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.chatbot-loading-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes chatbot-loading-pulse {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  50% {
    transform: translateY(-3px);
    opacity: 1;
  }
}

.chatbot-input-row {
  display: flex;
  gap: 8px;
}

.chatbot-input {
  flex: 1;
  border-radius: 12px;
  border: 1px solid #dbe4f5;
  padding: 10px 12px;
  font-size: 13px;
  resize: none;
  min-height: 44px;
  max-height: 110px;
  font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
  line-height: 1.4;
  color: #0f172a;
  transition: border 0.2s ease;
}

.chatbot-input:focus {
  outline: none;
  border-color: var(--chatbot-primary);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}

.chatbot-input::placeholder {
  color: #94a3b8;
}

.chatbot-attach-input {
  display: none;
}

.chatbot-attach {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #0f172a;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.chatbot-attach svg {
  width: 18px;
  height: 18px;
}

.chatbot-attach:hover {
  transform: translateY(-1px);
  border-color: #cbd5f0;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
}

.chatbot-send {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 0;
  background: var(--chatbot-primary);
  color: #ffffff;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.chatbot-send svg {
  width: 18px;
  height: 18px;
}

.chatbot-send:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.32);
}

.chatbot-footer .chatbot-human-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: #eff6ff;
  border: 1px solid #dbeafe;
  color: #1d4ed8;
  font-weight: 600;
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.2s ease, border 0.2s ease;
}

.chatbot-footer .chatbot-human-button:hover {
  background: #dbeafe;
}

.chatbot-footer .chatbot-human-button svg {
  width: 16px;
  height: 16px;
}

.chatbot-powered {
  margin: 0;
  font-size: 10px;
  color: #94a3b8;
  text-align: center;
}

.chatbot-widget-root.show-human-form .chatbot-body,
.chatbot-widget-root.show-human-form .chatbot-footer {
  display: none;
}

.chatbot-widget-root.show-human-form .chatbot-human-container {
  display: flex;
}

.chatbot-human-container {
  flex: 1;
  display: none;
  flex-direction: column;
  padding: 18px 14px;
  gap: 16px;
  overflow: auto;
  background: #f8fbff;
}

.chatbot-human-header {
  background: #ffffff;
  border: 1px solid #dbe4f5;
  border-radius: 14px;
  padding: 14px;
  text-align: center;
}

.chatbot-human-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.chatbot-human-header p {
  margin: 6px 0 0;
  font-size: 13px;
  color: #64748b;
}

.chatbot-human-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chatbot-form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.chatbot-form-group input,
.chatbot-form-group textarea {
  border-radius: 10px;
  border: 1px solid #dbe4f5;
  padding: 10px 12px;
  font-size: 13px;
  font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
  color: #0f172a;
  background: #ffffff;
}

.chatbot-form-group input:focus,
.chatbot-form-group textarea:focus {
  outline: none;
  border-color: var(--chatbot-primary);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}

.chatbot-form-group textarea {
  min-height: 110px;
  resize: vertical;
}

.chatbot-form-actions {
  display: flex;
  gap: 10px;
  justify-content: space-between;
}

.chatbot-btn-primary {
  flex: 1;
  border-radius: 12px;
  border: 0;
  background: var(--chatbot-primary);
  color: #ffffff;
  font-weight: 600;
  padding: 10px 12px;
  cursor: pointer;
}

.chatbot-btn-secondary {
  flex: 1;
  border-radius: 12px;
  border: 1px solid #dbe4f5;
  background: #ffffff;
  color: #334155;
  font-weight: 600;
  padding: 10px 12px;
  cursor: pointer;
}

.chatbot-human-success {
  display: none;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 24px 16px;
  border-radius: 14px;
  border: 1px solid #dbe4f5;
  background: #ffffff;
}

.chatbot-widget-root.show-human-success .chatbot-body,
.chatbot-widget-root.show-human-success .chatbot-footer {
  display: none;
}

.chatbot-widget-root.show-human-success .chatbot-human-container {
  display: flex;
}

.chatbot-widget-root.show-human-success .chatbot-human-form {
  display: none;
}

.chatbot-widget-root.show-human-success .chatbot-human-success {
  display: flex;
}

.chatbot-success-icon {
  width: 54px;
  height: 54px;
  border-radius: 999px;
  background: #dcfce7;
  color: #16a34a;
  display: grid;
  place-items: center;
  font-size: 26px;
}

.chatbot-human-success h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.chatbot-human-success p {
  margin: 0;
  font-size: 13px;
  color: #64748b;
}

.chatbot-widget-root.show-human-form .chatbot-footer,
.chatbot-widget-root.show-human-success .chatbot-footer {
  display: none;
}

.chatbot-error {
  color: #dc2626;
  font-size: 12px;
  text-align: center;
}

.chatbot-loading {
  text-align: center;
  font-size: 12px;
  color: #64748b;
}

.chatbot-human-note {
  font-size: 12px;
  color: #475569;
  text-align: center;
}

.chatbot-human-note span {
  font-weight: 600;
}

@media (max-width: 520px) {
  .chatbot-panel {
    height: min(560px, calc(100vh - 80px));
    width: min(360px, calc(100vw - 20px));
  }

  .chatbot-widget-root.right,
  .chatbot-widget-root.left {
    right: 10px;
    left: 10px;
  }

  .chatbot-widget-root {
    bottom: 10px;
  }

  .chatbot-panel {
    width: min(360px, calc(100vw - 20px));
    height: min(520px, calc(100vh - 70px));
  }

  .chatbot-intro h3 {
    font-size: 22px;
  }
}
`

export const ensureStyles = (): void => {
  if (document.getElementById(STYLE_ID)) {
    return
  }

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = WIDGET_CSS
  document.head.appendChild(style)
}
