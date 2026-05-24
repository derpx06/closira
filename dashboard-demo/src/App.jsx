import { useEffect, useMemo, useRef, useState } from 'react'
import { createChatbotWidget } from 'chatbot-package'

const stats = [
  { title: 'Open Tickets', value: '124' },
  { title: 'Resolved Today', value: '39' },
  { title: 'Avg. Response', value: '6m' },
]

const tickets = [
  { id: '#1041', customer: 'Acme Corp', issue: 'Billing cycle confusion', status: 'Open' },
  { id: '#1042', customer: 'GreenHub', issue: 'Email verification failed', status: 'In Progress' },
  { id: '#1043', customer: 'Nova Retail', issue: 'Unable to add team member', status: 'Open' },
]

export default function App() {
  const defaultApiBase = useMemo(() => {
    const envBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api'
    return String(envBase).replace(/\/+$/, '')
  }, [])

  const [apiBaseUrl, setApiBaseUrl] = useState(() =>
    localStorage.getItem('demo_api_base_url') || defaultApiBase,
  )
  const [apiKey, setApiKey] = useState(() => {
    const storedApiKey = localStorage.getItem('demo_api_key')
    return storedApiKey || ''
  })
  const [isWidgetEnabled, setIsWidgetEnabled] = useState(() => {
    return localStorage.getItem('demo_widget_enabled') === 'true'
  })
  const [statusMessage, setStatusMessage] = useState('Configure API base URL and API key, then enable chatbot.')
  const widgetRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('demo_api_base_url', apiBaseUrl)
  }, [apiBaseUrl])

  useEffect(() => {
    localStorage.setItem('demo_api_key', apiKey)
  }, [apiKey])

  useEffect(() => {
    const legacyWidgetKey = localStorage.getItem('demo_widget_key')
    if (legacyWidgetKey && !apiKey) {
      localStorage.removeItem('demo_widget_key')
      setStatusMessage('Paste the API key (not the widget key) to use the correct knowledge base.')
    }
  }, [apiKey])

  useEffect(() => {
    localStorage.setItem('demo_widget_enabled', String(isWidgetEnabled))
  }, [isWidgetEnabled])

  useEffect(() => {
    if (!isWidgetEnabled) {
      if (widgetRef.current) {
        widgetRef.current.destroy()
        widgetRef.current = null
      }
      setStatusMessage('Chatbot disabled.')
      return
    }

    if (!apiBaseUrl.trim() || !apiKey.trim()) {
      setStatusMessage('Cannot enable chatbot: API base URL and API key are required.')
      return
    }

    if (widgetRef.current) {
      widgetRef.current.destroy()
      widgetRef.current = null
    }

    const widget = createChatbotWidget({
      title: 'Support Assistant',
      subtitle: 'AI + Human Support',
      welcomeMessage: 'Hi! Ask anything about your knowledge base. You can switch to a human agent any time.',
      placeholder: 'Type your support question...',
      primaryColor: '#2563eb',
      aiSupport: {
        apiBaseUrl: apiBaseUrl.trim(),
        apiKey: apiKey.trim(),
      },
      humanSupport: {
        apiBaseUrl: apiBaseUrl.trim(),
      },
    })

    widgetRef.current = widget
    setStatusMessage('Chatbot enabled. AI answers use your API key; human handoff creates a ticket/session for your company.')

    return () => {
      if (widgetRef.current) {
        widgetRef.current.destroy()
        widgetRef.current = null
      }
    }
  }, [apiBaseUrl, apiKey, isWidgetEnabled])

  const toggleWidget = () => {
    setIsWidgetEnabled((prev) => !prev)
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h2>Demo Admin</h2>
        <nav>
          <a href="#" className="active">Overview</a>
          <a href="#">Customers</a>
          <a href="#">Tickets</a>
          <a href="#">Reports</a>
          <a href="#">Settings</a>
        </nav>
      </aside>

      <main className="content">
        <header className="topbar">
          <h1>Support Dashboard</h1>
          <button type="button" onClick={toggleWidget}>
            {isWidgetEnabled ? 'Disable Chatbot' : 'Enable Chatbot'}
          </button>
        </header>

        <section className="config-card">
          <h2>Widget Setup (Tenant Test)</h2>
          <p className="config-note">
            Use the API base URL and API key generated for the admin company. This simulates how customers
            install chatbot on their own website with their own key.
          </p>
          <div className="config-grid">
            <label>
              <span>API Base URL</span>
              <input
                type="text"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder="http://127.0.0.1:5000/api"
              />
            </label>
            <label>
              <span>API Key</span>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste API key from Knowledge Base > Deployment"
              />
            </label>
          </div>
          <div className="status-line">
            <strong>Status:</strong> {statusMessage}
          </div>
        </section>

        <section className="cards">
          {stats.map((item) => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.value}</p>
            </article>
          ))}
        </section>

        <section className="table-wrap">
          <h2>Recent Issues</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Issue</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.customer}</td>
                  <td>{row.issue}</td>
                  <td><span className="pill">{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  )
}
