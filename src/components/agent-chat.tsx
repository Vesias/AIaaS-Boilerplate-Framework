'use client'

import { useState, useRef, useEffect } from 'react'
import { useAgentChat } from '@/hooks/use-agent'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Bot, 
  User, 
  Send, 
  Loader2, 
  AlertCircle, 
  Settings, 
  Trash2,
  Copy,
  Check,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import { AgentMessage } from '@/lib/ag-ui-client'

interface AgentChatProps {
  url?: string
  apiKey?: string
  transport?: 'sse' | 'websocket' | 'webhook'
  className?: string
  showHeader?: boolean
  showStatus?: boolean
  placeholder?: string
  maxHeight?: string
}

export function AgentChat({
  url,
  apiKey,
  transport = 'sse',
  className = '',
  showHeader = true,
  showStatus = true,
  placeholder = 'Type your message...',
  maxHeight = '600px',
}: AgentChatProps) {
  const [input, setInput] = useState('')
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  const {
    connected,
    connecting,
    chatMessages,
    isProcessing,
    sendMessage,
    connect,
    disconnect,
    clearMessages,
    lastError,
    clearError,
    sessionId,
  } = useAgentChat({
    url,
    apiKey,
    transport,
    onMessage: (message) => {
      // Auto-scroll to bottom on new messages
      setTimeout(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
        }
      }, 100)
    },
    onError: (error) => {
      toast.error(`Agent error: ${error.message || error}`)
    },
    onConnect: () => {
      toast.success('Connected to agent')
    },
    onDisconnect: () => {
      toast.info('Disconnected from agent')
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !connected || isProcessing) return

    const messageText = input.trim()
    setInput('')

    try {
      await sendMessage(messageText)
    } catch (error: any) {
      toast.error(`Failed to send message: ${error.message}`)
      setInput(messageText) // Restore input on error
    }
  }

  const handleClearChat = () => {
    clearMessages()
    toast.success('Chat cleared')
  }

  const handleReconnect = async () => {
    try {
      if (connected) {
        await disconnect()
      }
      await connect()
    } catch (error: any) {
      toast.error(`Failed to reconnect: ${error.message}`)
    }
  }

  const copyMessage = async (message: AgentMessage) => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopiedMessageId(message.id)
      setTimeout(() => setCopiedMessageId(null), 2000)
      toast.success('Message copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy message')
    }
  }

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Auto-scroll to bottom on mount and when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [chatMessages.length])

  return (
    <Card className={`flex flex-col ${className}`} style={{ height: maxHeight }}>
      {showHeader && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Agent Chat
              {sessionId && (
                <Badge variant="outline" className="text-xs">
                  {sessionId.slice(-8)}
                </Badge>
              )}
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={handleReconnect}
                variant="outline"
                size="sm"
                disabled={connecting}
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              
              <Button
                onClick={handleClearChat}
                variant="outline"
                size="sm"
                disabled={chatMessages.length === 0}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {showStatus && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Badge variant={connected ? "default" : "secondary"}>
                  {connecting ? 'Connecting...' : connected ? 'Connected' : 'Disconnected'}
                </Badge>
                
                {isProcessing && (
                  <Badge variant="outline">
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Processing
                  </Badge>
                )}
              </div>
              
              <div className="text-muted-foreground">
                {chatMessages.length} messages
              </div>
            </div>
          )}
        </CardHeader>
      )}

      <Separator />

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Error Display */}
        {lastError && (
          <div className="p-3 bg-destructive/10 border-b">
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{lastError}</span>
              <Button
                onClick={clearError}
                variant="ghost"
                size="sm"
                className="ml-auto"
              >
                ×
              </Button>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {chatMessages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Start a conversation with the agent</p>
              </div>
            ) : (
              chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.type === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.type === 'agent' && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-4 w-4" />
                      </div>
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[80%] ${
                      message.type === 'user' 
                        ? 'order-1' 
                        : 'order-2'
                    }`}
                  >
                    <div
                      className={`rounded-lg px-4 py-2 relative group ${
                        message.type === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words">
                        {message.content}
                      </div>
                      
                      <div className="flex items-center justify-between mt-2 gap-2">
                        <span className="text-xs opacity-70">
                          {formatTimestamp(message.timestamp)}
                        </span>
                        
                        <Button
                          onClick={() => copyMessage(message)}
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {copiedMessageId === message.id ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {message.type === 'user' && (
                    <div className="flex-shrink-0 order-2">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-4 w-4" />
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
            
            {isProcessing && (
              <div className="flex justify-start">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4" />
                  </div>
                </div>
                <div className="ml-3">
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Agent is thinking...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              disabled={!connected || isProcessing}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
            />
            <Button
              type="submit"
              disabled={!connected || !input.trim() || isProcessing}
              size="icon"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          
          <div className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Simplified version with minimal props
export function SimpleAgentChat({ className }: { className?: string }) {
  return (
    <AgentChat
      className={className}
      showHeader={true}
      showStatus={true}
      placeholder="Ask the agent anything..."
    />
  )
}

// Compact version for sidebars
export function CompactAgentChat({ className }: { className?: string }) {
  return (
    <AgentChat
      className={className}
      showHeader={false}
      showStatus={false}
      maxHeight="400px"
      placeholder="Quick question..."
    />
  )
}