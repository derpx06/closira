export const CHAT_BUBBLE_CSS = `
.chatbot-bubble {
  position: relative;
  max-width: 84%;
  border-radius: 14px;
  padding: 8px 10px;
  line-height: 1.42;
  font-size: 12.5px;
  white-space: pre-wrap;
  word-break: break-word;
  animation: chatbot-bubble-in 0.22s ease;
}

.chatbot-bubble.user {
  align-self: flex-end;
  background: linear-gradient(145deg, var(--chatbot-primary), #1d4ed8);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-bottom-right-radius: 6px;
  box-shadow: 0 10px 26px rgba(37, 99, 235, 0.28);
}

.chatbot-bubble.user::after {
  content: "";
  position: absolute;
  right: -6px;
  bottom: 8px;
  width: 12px;
  height: 12px;
  background: #1d4ed8;
  border-radius: 2px 0 10px 0;
  transform: rotate(35deg);
}

.chatbot-bubble.bot {
  align-self: flex-start;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  color: #0f172a;
  border: 1px solid #d7e3f8;
  border-bottom-left-radius: 6px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.1);
}

.chatbot-bubble.bot::after {
  content: "";
  position: absolute;
  left: -6px;
  bottom: 8px;
  width: 12px;
  height: 12px;
  background: #ffffff;
  border-left: 1px solid #d7e3f8;
  border-bottom: 1px solid #d7e3f8;
  border-radius: 0 0 0 9px;
  transform: rotate(35deg);
}

.chatbot-bubble.system {
  align-self: center;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 700;
  font-size: 10px;
  padding: 6px 12px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1e3a8a;
}

.chatbot-bubble.typing {
  min-width: 52px;
  padding: 6px 10px;
  background: linear-gradient(180deg, #ffffff 0%, #f1f5ff 100%);
  border: 1px solid #dbeafe;
  box-shadow: 0 10px 22px rgba(30, 64, 175, 0.12);
}

.chatbot-bubble.typing .chatbot-typing {
  justify-content: center;
}

.chatbot-bubble p,
.chatbot-bubble ul,
.chatbot-bubble ol,
.chatbot-bubble pre {
  margin: 0;
}

.chatbot-bubble ul,
.chatbot-bubble ol {
  padding-left: 18px;
  margin-top: 6px;
}

.chatbot-bubble li + li {
  margin-top: 3px;
}

.chatbot-bubble.user a {
  color: #dbeafe;
}

.chatbot-md-h1 {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 6px;
}
.chatbot-md-h2 {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 6px;
}
.chatbot-md-h3 {
  font-size: 14px;
  font-weight: 700;
  margin: 0 0 6px;
}
.chatbot-bubble a {
  color: #2563eb;
  text-decoration: underline;
}
.chatbot-bubble code {
  font-family: "SFMono-Regular", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  background: #eff6ff;
  padding: 2px 4px;
  border-radius: 6px;
}
.chatbot-bubble pre {
  background: #eff6ff;
  border-radius: 10px;
  padding: 8px;
  overflow-x: auto;
  margin-top: 6px;
}

.chatbot-typing {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #475569;
  font-weight: 500;
}

.chatbot-typing span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(135deg, #1d4ed8, #60a5fa);
  animation: typing-bounce 1.05s infinite ease-in-out;
}

.chatbot-typing span:nth-child(2) {
  animation-delay: 0.2s;
}

.chatbot-typing span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing-bounce {
  0%,
  100% {
    transform: translateY(0) scale(0.9);
    opacity: 0.7;
  }
  50% {
    transform: translateY(-5px) scale(1);
    opacity: 1;
  }
}

@keyframes chatbot-bubble-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
`
