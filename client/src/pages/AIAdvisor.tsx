import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, Bot, User, Zap, AlertTriangle, TrendingUp, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  streaming?: boolean
}

const INSIGHT_ICONS = { WARNING: AlertTriangle, OPPORTUNITY: TrendingUp, INFO: Info }
const INSIGHT_COLORS = { WARNING: 'text-amber-400', OPPORTUNITY: 'gain', INFO: 'text-blue-400' }

export function AIAdvisor() {
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: "Hello! I'm FinVault AI, your expert financial advisor. I have access to your complete portfolio data and current market conditions. Ask me anything — from portfolio analysis and risk assessment to specific trade ideas and macro outlook.",
    timestamp: new Date(),
  }])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { data: insights = [] } = useQuery({
    queryKey: ['ai-insights'],
    queryFn: () => axios.get('/api/ai/insights').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || isStreaming) return
    const userMsg = input.trim()
    setInput('')

    const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))

    setMessages(prev => [
      ...prev,
      { role: 'user', content: userMsg, timestamp: new Date() },
      { role: 'assistant', content: '', timestamp: new Date(), streaming: true },
    ])
    setIsStreaming(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history }),
      })

      if (!res.ok) throw new Error('Chat request failed')
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        const lines = text.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.chunk) {
                accumulated += data.chunk
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: accumulated,
                  }
                  return updated
                })
              }
              if (data.done) break
            } catch { /* skip parse errors */ }
          }
        }
      }

      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...updated[updated.length - 1], streaming: false }
        return updated
      })
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: 'Sorry, I encountered an error. Please check your ANTHROPIC_API_KEY in the .env file.',
          streaming: false,
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const quickPrompts = [
    'What are the biggest risks in my portfolio?',
    'Analyze my biggest position',
    'Should I rebalance my allocation?',
    'What\'s the current market sentiment?',
  ]

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold">FinVault AI</h1>
              <p className="text-xs text-muted-foreground">Expert financial advisor · Portfolio-aware · Real-time data</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
              <div className={cn('w-8 h-8 rounded-full shrink-0 flex items-center justify-center',
                msg.role === 'assistant' ? 'bg-primary/20' : 'bg-secondary')}>
                {msg.role === 'assistant' ? <Bot className="w-4 h-4 text-primary" /> : <User className="w-4 h-4" />}
              </div>
              <div className={cn('max-w-[80%] rounded-xl px-4 py-3 text-sm',
                msg.role === 'assistant'
                  ? 'bg-card border border-border'
                  : 'bg-primary text-primary-foreground',
                msg.streaming && 'cursor-blink'
              )}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm prose-invert max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content || '…'}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
                <p className={cn('text-xs mt-1.5 opacity-50', msg.role === 'user' && 'text-right')}>
                  {format(msg.timestamp, 'HH:mm')}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Quick prompts */}
        {messages.length <= 1 && (
          <div className="px-6 pb-2 flex flex-wrap gap-2">
            {quickPrompts.map(p => (
              <button key={p} onClick={() => { setInput(p); textareaRef.current?.focus() }}
                className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border px-4 py-3">
          <div className="flex gap-2 items-end bg-secondary rounded-xl px-3 py-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your portfolio, markets, or get trade ideas…"
              rows={1}
              className="flex-1 bg-transparent text-sm resize-none outline-none max-h-32 text-foreground placeholder:text-muted-foreground"
              style={{ minHeight: '24px' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
              className="p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-1.5">
            FinVault AI uses your real portfolio data · Powered by Claude · Not financial advice
          </p>
        </div>
      </div>

      {/* Insights panel */}
      <div className="hidden lg:flex flex-col w-80 border-l border-border bg-card/50">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Daily Insights
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Auto-generated portfolio analysis</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {insights.length > 0 ? insights.map((insight: any, i: number) => {
            const Icon = INSIGHT_ICONS[insight.type as keyof typeof INSIGHT_ICONS] ?? Info
            return (
              <div key={i} className="bg-card border border-border rounded-lg p-3.5 cursor-pointer hover:bg-secondary/40 transition-colors"
                onClick={() => setInput(`Tell me more about: ${insight.title}`)}>
                <div className="flex items-start gap-2 mb-1.5">
                  <Icon className={cn('w-4 h-4 shrink-0 mt-0.5', INSIGHT_COLORS[insight.type as keyof typeof INSIGHT_COLORS] ?? 'text-muted-foreground')} />
                  <p className="text-sm font-semibold">{insight.title}</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{insight.body}</p>
              </div>
            )
          }) : (
            <div className="text-center text-muted-foreground text-sm mt-6">
              <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Connect accounts to get personalized insights</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
