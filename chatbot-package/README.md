# chatbot-package

Embeddable chatbot widget for websites.

## Install

```bash
npm install chatbot-package
```

## Usage

```ts
import { createChatbotWidget } from 'chatbot-package'

createChatbotWidget({
  title: 'Support',
  subtitle: 'We are online',
  welcomeMessage: 'Hi! Tell us how we can help.',
  primaryColor: '#0f766e',
  aiSupport: {
    apiBaseUrl: 'https://your-api.example.com/api',
    apiKey: 'YOUR_WIDGET_API_KEY',
    // optional: chatPath: '/rag/chat'
  },
  humanSupport: {
    apiBaseUrl: 'https://your-api.example.com/api',
    // optional: widgetKey (defaults to aiSupport.apiKey)
  },
})
```

This creates:
- A floating circular chat button in the bottom-right corner
- A chat screen that opens when the button is clicked

## Options

- `botName?: string`
- `title?: string`
- `subtitle?: string`
- `welcomeMessage?: string`
- `placeholder?: string`
- `primaryColor?: string`
- `position?: 'bottom-right' | 'bottom-left'`
- `zIndex?: number`
- `aiSupport?: { apiBaseUrl: string; apiKey: string; chatPath?: string; sessionId?: string }`
- `onUserMessage?: (message: string) => string | Promise<string> | void`
- `humanSupport?: { apiBaseUrl: string; widgetKey?: string }`
- `onTalkToHumanClick?: () => string | Promise<string> | void`

## CLI

Use CLI like this:

```bash
npm run cli -- <command>
```

Interactive commands:

```bash
npm run cli -- crawl
npm run cli -- config
npm run cli -- ingest
npm run cli -- classify
npm run cli -- ask
npm run cli -- navigate
npm run cli -- act
npm run cli -- status
npm run cli -- hello
```

Each command asks for required parameters after command trigger.
Example: `npm run cli -- crawl` will ask codebase path, scan mode, test-file inclusion, and output folder.

`crawl` now performs non-AI static extraction and writes a full report folder containing:

- `repo-map.json`
- `summary.json`
- `apis.json`
- `pages.json`
- `components.json`
- `content.json`
- `config.json`
- `calls.json`
- `linkages.json`
- `knowledge-chunks.json`
- `tooling.json`
- `server-actions.json` (Next.js/`use server` action discovery)
- `i18n-map.json` (translation key usage + locale coverage)
- `dropped-files.json` (low-signal files filtered with reasons)
- `extraction-health.json` (coverage checks + warnings)
- `crawl-report.mdx`

## Build

```bash
npm run build
```
