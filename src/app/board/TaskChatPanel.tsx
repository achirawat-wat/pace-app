'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { MessageSquare, Send, Users, CheckCircle2, User, Smile, Coffee, Gamepad2, Code, Zap, ShieldAlert } from 'lucide-react'

const ICON_MAP: Record<string, any> = { user: User, smile: Smile, coffee: Coffee, gamepad: Gamepad2, code: Code, zap: Zap }

interface TaskChatPanelProps {
  taskId: string
  taskTitle: string
  profileId: string
  teamMembers: any[]
  taskAssignees: any[]
}

export default function TaskChatPanel({ taskId, taskTitle, profileId, teamMembers, taskAssignees }: TaskChatPanelProps) {
  const [messages, setMessages] = useState<any[]>([])
  const [chatInput, setChatInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [cursorPos, setCursorPos] = useState(0)

  const assigneeIds = taskAssignees?.map(a => a.user_id) || []

  useEffect(() => {
    if (!taskId) return
    const fetchChatMessages = async () => {
      const { data } = await supabase.from('task_messages').select(`*, profiles(display_name, icon_name, bg_color, icon_color)`).eq('task_id', taskId).order('created_at', { ascending: true })
      if (data) setMessages(data)
    }
    fetchChatMessages()

    const chatChannel = supabase.channel(`realtime:task_messages:${taskId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_messages', filter: `task_id=eq.${taskId}` }, () => fetchChatMessages() )
      .subscribe()

    return () => { supabase.removeChannel(chatChannel) }
  }, [taskId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setChatInput(val)
    const cursor = e.target.selectionStart || 0
    setCursorPos(cursor)

    const textBeforeCursor = val.substring(0, cursor)
    const match = textBeforeCursor.match(/@([^@]*)$/)
    
    if (match) setMentionQuery(match[1].toLowerCase())
    else setMentionQuery(null)
  }

  const handleSelectMention = (displayName: string) => {
    if (mentionQuery === null) return
    const textBeforeCursor = chatInput.substring(0, cursorPos)
    const textAfterCursor = chatInput.substring(cursorPos)
    const replacedText = textBeforeCursor.replace(/@[^@]*$/, `@${displayName} `)
    
    setChatInput(replacedText + textAfterCursor)
    setMentionQuery(null)
  }

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    const msg = chatInput.trim()
    if (!msg) return
    
    await supabase.from('task_messages').insert([{ task_id: taskId, user_id: profileId, message: msg }])
    setChatInput('')
    setMentionQuery(null)

    const taggedUsers = teamMembers.filter(m => m.id !== profileId && msg.includes(`@${m.display_name}`))
      
    if (taggedUsers.length > 0) {
      const uniqueIds = Array.from(new Set(taggedUsers.map(u => u.id)))
      const myName = teamMembers.find(m => m.id === profileId)?.display_name || 'Someone'
      
      const inserts = uniqueIds.map(uid => ({
        user_id: uid,
        title: '💬 You were mentioned!',
        message: `${myName} mentioned you in: ${taskTitle}`,
        type: 'action',
        payload: { task_id: taskId }
      }))
      await supabase.from('notifications').insert(inserts)
    }
  }

  const renderMessageText = (text: string) => {
    const names = teamMembers.map(m => m.display_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length)
    if (names.length === 0) return text

    const regex = new RegExp(`(@(?:${names.join('|')}))`, 'g')
    const parts = text.split(regex)
    
    return parts.map((part, i) => {
      if (part.startsWith('@') && teamMembers.some(m => `@${m.display_name}` === part)) {
        return <span key={i} className="text-indigo-600 font-bold bg-indigo-50/80 px-1 py-0.5 rounded transition-colors cursor-pointer hover:bg-indigo-100">{part}</span>
      }
      return <span key={i}>{part}</span>
    })
  }

  const groupedMessages: any[] = []
  messages.forEach((m) => {
    if (groupedMessages.length === 0) {
      groupedMessages.push({ ...m, msgs: [m] })
      return
    }
    const lastGroup = groupedMessages[groupedMessages.length - 1]
    const timeDiff = new Date(m.created_at).getTime() - new Date(lastGroup.created_at).getTime()
    
    if (lastGroup.user_id === m.user_id && timeDiff < 5 * 60 * 1000) {
      lastGroup.msgs.push(m)
    } else {
      groupedMessages.push({ ...m, msgs: [m] })
    }
  })

  // 🌟 กรองรายชื่อผู้คนตาม Query
  const filteredMembers = mentionQuery !== null 
    ? teamMembers.filter(m => m.id !== profileId && m.display_name.toLowerCase().includes(mentionQuery))
    : []

  // 🌟 แบ่งออกเป็น 3 หมวดหมู่: คนใน Task, Manager, และคนอื่นๆ
  const inTaskMembers = filteredMembers.filter(m => assigneeIds.includes(m.id))
  const managerMembers = filteredMembers.filter(m => !assigneeIds.includes(m.id) && (m.role === 'owner' || m.role === 'manager'))
  const otherMembers = filteredMembers.filter(m => !assigneeIds.includes(m.id) && m.role !== 'owner' && m.role !== 'manager')

  // 🌟 เปลี่ยน Props ให้รับ `type` เพื่อแสดงผลสีและไอคอนตามกลุ่ม
  const MentionRow = ({ m, type }: { m: any, type: 'assignee' | 'manager' | 'other' }) => {
    const MemberIcon = ICON_MAP[m.icon_name] || User
    return (
      <button type="button" onClick={() => handleSelectMention(m.display_name)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-100 transition-colors text-left border-b border-neutral-50 last:border-0 group">
        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-neutral-100" style={{ backgroundColor: m.bg_color }}>
          <MemberIcon size={12} style={{ color: m.icon_color }} />
        </div>
        <div className="flex flex-col flex-1">
          <span className={`text-xs font-bold ${type === 'assignee' ? 'text-indigo-700' : type === 'manager' ? 'text-amber-700' : 'text-neutral-700'} flex items-center gap-1`}>
            {m.display_name} 
            {type === 'assignee' && <CheckCircle2 size={10} className="text-indigo-500"/>}
            {type === 'manager' && <ShieldAlert size={10} className="text-amber-500"/>}
          </span>
          <span className="text-[9px] text-neutral-400 font-medium capitalize">{m.position || m.role}</span>
        </div>
      </button>
    )
  }

  return (
    <div className="flex-[2] flex flex-col bg-white border-l border-neutral-100 relative max-w-[40%]"> 
      <div className="p-5 border-b border-neutral-100 bg-white z-10 shrink-0 flex justify-between items-center">
        <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
          <MessageSquare size={16} className="text-neutral-400"/> Discussion
        </h3>
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{messages.length} messages</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 no-scrollbar bg-neutral-50/30">
        {groupedMessages.map((group, idx) => {
          const isMe = group.user_id === profileId
          const ProfileIcon = ICON_MAP[group.profiles?.icon_name] || User

          return (
            <div key={`group-${idx}`} className={`flex gap-3 items-start group w-full ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-neutral-100 mt-0.5" style={{ backgroundColor: group.profiles?.bg_color }}>
                <ProfileIcon size={14} style={{ color: group.profiles?.icon_color }} />
              </div>
              
              <div className={`flex flex-col flex-1 min-w-0 max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-baseline gap-2 mb-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <span className="text-xs font-bold text-neutral-900">{isMe ? 'You' : group.profiles?.display_name}</span>
                  <span className="text-[9px] font-medium text-neutral-400 group-hover:text-neutral-500 transition-colors">
                    {new Date(group.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                <div className={`flex flex-col gap-2 w-full ${isMe ? 'items-end text-right' : 'items-start text-left'}`}>
                  {group.msgs.map((msg: any) => (
                    <p key={msg.id} className="text-[11.5px] text-neutral-700 leading-relaxed whitespace-pre-wrap break-words">
                      {renderMessageText(msg.message)}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={chatEndRef} />
      </div>

      {/* 🌟 กล่องค้นหา Mention โฉมใหม่ แยก 3 หมวดชัดเจน */}
      {mentionQuery !== null && filteredMembers.length > 0 && (
        <div className="absolute bottom-[72px] left-4 right-4 bg-white border border-neutral-200 shadow-[0_10px_40px_rgb(0,0,0,0.12)] rounded-xl overflow-hidden z-20 max-h-64 overflow-y-auto">
          
          {inTaskMembers.length > 0 && (
            <div>
              <div className="px-3 py-1.5 bg-indigo-50/50 border-y border-indigo-100 text-[9px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5 sticky top-0 backdrop-blur-md">
                <CheckCircle2 size={10}/> In this task
              </div>
              {inTaskMembers.map(m => <MentionRow key={m.id} m={m} type="assignee" />)}
            </div>
          )}

          {managerMembers.length > 0 && (
            <div>
              <div className="px-3 py-1.5 bg-amber-50/50 border-y border-amber-100 text-[9px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5 sticky top-0 backdrop-blur-md">
                <ShieldAlert size={10}/> Managers
              </div>
              {managerMembers.map(m => <MentionRow key={m.id} m={m} type="manager" />)}
            </div>
          )}

          {otherMembers.length > 0 && (
            <div>
              <div className="px-3 py-1.5 bg-neutral-50 border-y border-neutral-100 text-[9px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5 sticky top-0 backdrop-blur-md">
                <Users size={10}/> Team Members
              </div>
              {otherMembers.map(m => <MentionRow key={m.id} m={m} type="other" />)}
            </div>
          )}

        </div>
      )}

      <form onSubmit={handleSendChatMessage} className="p-4 bg-white border-t border-neutral-100 shrink-0">
        <div className="relative group">
          <input 
            type="text" 
            placeholder="Type @ to mention someone..." 
            value={chatInput} 
            onChange={handleInputChange} 
            className="w-full px-3.5 py-3 pr-12 text-xs bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-indigo-400 focus:bg-white focus:shadow-sm transition-all" 
          />
          <button type="submit" disabled={!chatInput.trim()} className="absolute right-2 top-2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-30 disabled:bg-neutral-300">
            <Send size={14}/>
          </button>
        </div>
      </form>
    </div>
  )
}