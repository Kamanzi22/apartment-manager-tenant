'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { sendMessage } from '@/app/actions/messages'
import { Send, Megaphone } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface Message {
  id: string
  sender_id: string
  recipient_id: string | null
  body: string
  created_at: string
}

export function MessageThread({ messages, currentUserId }: { messages: Message[]; currentUserId: string }) {
  const [body, setBody] = useState('')
  const [pending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleSend() {
    const text = body.trim()
    if (!text) return
    setBody('')
    startTransition(async () => {
      const result = await sendMessage(text)
      if (result?.error) toast.error(result.error)
    })
  }

  return (
    <div className="glass flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="empty-state mt-4"><Send className="h-5 w-5" /><p>No messages yet — send one below</p></div>
        )}
        {messages.map(msg => {
          const isBroadcast = msg.recipient_id === null
          const isMe = msg.sender_id === currentUserId

          if (isBroadcast) {
            return (
              <div key={msg.id} className="flex items-start gap-2 bg-white/80 border border-white/85 rounded-2xl px-3.5 py-2.5">
                <Megaphone className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-[var(--accent-2)] mb-0.5">Announcement</p>
                  <p className="text-sm text-slate-700">{msg.body}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{format(new Date(msg.created_at), 'MMM d, h:mm a')}</p>
                </div>
              </div>
            )
          }

          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${isMe ? 'bg-[var(--ink)] text-[var(--on-dark)] rounded-br-md' : 'bg-white/80 border border-white/85 text-[var(--ink)] rounded-bl-md'}`}>
                <p className="text-sm">{msg.body}</p>
                <p className={`text-xs mt-0.5 ${isMe ? 'text-[var(--metal)]' : 'text-[var(--muted)]'}`}>
                  {format(new Date(msg.created_at), 'h:mm a')}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/70 bg-white/40 px-3 py-3 flex items-end gap-2">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send)"
          className="glass-input flex-1 resize-none text-sm h-auto! py-3 max-h-32 min-h-[46px]"
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={pending || !body.trim()}
          aria-label="Send message" className="shrink-0 h-[46px] w-[46px] inline-flex items-center justify-center bg-[var(--ink)] text-[var(--on-dark)] rounded-full hover:bg-[#2B3640] transition-colors disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
