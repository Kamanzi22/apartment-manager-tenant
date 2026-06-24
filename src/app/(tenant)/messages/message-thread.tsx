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
    <div className="flex flex-col flex-1 bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-8">No messages yet — send one below</p>
        )}
        {messages.map(msg => {
          const isBroadcast = msg.recipient_id === null
          const isMe = msg.sender_id === currentUserId

          if (isBroadcast) {
            return (
              <div key={msg.id} className="flex items-start gap-2 bg-blue-50 rounded-xl px-3 py-2">
                <Megaphone className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-blue-600 mb-0.5">Announcement</p>
                  <p className="text-sm text-slate-700">{msg.body}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{format(new Date(msg.created_at), 'MMM d, h:mm a')}</p>
                </div>
              </div>
            )
          }

          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${isMe ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'}`}>
                <p className="text-sm">{msg.body}</p>
                <p className={`text-xs mt-0.5 ${isMe ? 'text-slate-400' : 'text-slate-400'}`}>
                  {format(new Date(msg.created_at), 'h:mm a')}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t px-4 py-3 flex items-end gap-2">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send)"
          className="flex-1 resize-none text-sm border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500 max-h-32 min-h-[40px]"
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={pending || !body.trim()}
          className="shrink-0 bg-slate-900 text-white rounded-xl p-2 hover:bg-slate-700 transition-colors disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
