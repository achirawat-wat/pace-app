'use client'

import { useState, useEffect } from 'react'
import { X, CalendarDays, Plus, Loader2, User, Check, Smile, Coffee, Gamepad2, Code, Zap, Link as LinkIcon, Paperclip } from 'lucide-react'

const ICON_MAP: Record<string, any> = { user: User, smile: Smile, coffee: Coffee, gamepad: Gamepad2, code: Code, zap: Zap }

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  teamMembers: any[]
  tasks: any[]
  isSubmitting: boolean
  onCreateTask: (title: string, desc: string, deadline: string, assignees: string[], attachmentLink: string, attachmentFile: File | null) => Promise<void>
}

export default function CreateTaskModal({ isOpen, onClose, teamMembers, tasks, isSubmitting, onCreateTask }: CreateTaskModalProps) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [deadline, setDeadline] = useState('')
  const [attachmentLink, setAttachmentLink] = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null) // 🌟 State สำหรับไฟล์
  const [assignees, setAssignees] = useState<string[]>([])

  useEffect(() => {
    if (isOpen) {
      setTitle(''); setDesc(''); setDeadline(''); setAttachmentLink(''); setAttachmentFile(null); setAssignees([])
    }
  }, [isOpen])

  if (!isOpen) return null

  const activeTasksForLoad = tasks.filter(t => t.status !== 'Completed' && t.status !== 'Done')
  const membersWithLoad = teamMembers.map(m => {
    const activeLoad = activeTasksForLoad.filter(t => t.task_assignees?.some((a: any) => a.user_id === m.id)).length
    return { ...m, activeLoad }
  })

  const groupedMembers = membersWithLoad.reduce((acc, m) => {
    const pos = m.position && m.position !== 'Unassigned' ? m.position : 'Unassigned Roles'
    if (!acc[pos]) acc[pos] = []
    acc[pos].push(m)
    return acc
  }, {} as Record<string, any[]>)

  const positionGroups = Object.keys(groupedMembers).sort((a, b) => {
    if (a === 'Unassigned Roles') return 1
    if (b === 'Unassigned Roles') return -1
    return a.localeCompare(b)
  })

  const toggleAssignee = (userId: string) => setAssignees(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onCreateTask(title, desc, deadline, assignees, attachmentLink, attachmentFile) // 🌟 ส่งไฟล์ไปด้วย
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-[0_20px_50px_rgb(0,0,0,0.1)] border border-neutral-100 animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 tracking-tight">Create New Task</h2>
            <p className="text-xs text-neutral-500 mt-1">Assign work and provide necessary references to your team.</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 p-2 rounded-full transition-colors"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Task Title</label>
            <input type="text" required placeholder="e.g., Design Login Page..." value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 bg-neutral-50 focus:bg-white transition-all shadow-sm" />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Description (Optional)</label>
            <textarea placeholder="Provide details, steps, or instructions..." rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 bg-neutral-50 focus:bg-white resize-none transition-all shadow-sm" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5"><CalendarDays size={12} /> Deadline</label>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 bg-neutral-50 focus:bg-white transition-all shadow-sm text-neutral-700" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5"><LinkIcon size={12} /> External Link</label>
              <input type="url" placeholder="Google Drive, Figma, etc..." value={attachmentLink} onChange={(e) => setAttachmentLink(e.target.value)} className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 bg-neutral-50 focus:bg-white transition-all shadow-sm" />
            </div>
          </div>

          {/* 🌟 ช่องอัปโหลดไฟล์จากเครื่อง */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5"><Paperclip size={12} /> Upload File</label>
            <input 
              type="file" 
              onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-neutral-500 border border-neutral-200 rounded-xl bg-neutral-50 file:mr-4 file:py-2 file:px-4 file:rounded-l-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all shadow-sm outline-none focus:border-indigo-500 cursor-pointer"
            />
          </div>

          <div className="space-y-1.5 mt-2">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Assign To</label>
            <div className="max-h-36 overflow-y-auto pr-2 flex flex-col gap-4 no-scrollbar border border-neutral-200 rounded-xl p-3 bg-neutral-50/50">
              {positionGroups.map((pos: string) => (
                <div key={pos}>
                  <h4 className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="w-1 h-3 bg-indigo-500 rounded-full"></span>{pos}
                  </h4>
                  <div className="flex flex-col gap-1.5">
                    {groupedMembers[pos].sort((a: any, b: any) => a.activeLoad - b.activeLoad).map((m: any) => {
                        const isSelected = assignees.includes(m.id)
                        const MemberIcon = ICON_MAP[m.icon_name] || User
                        return (
                          <button key={m.id} type="button" onClick={() => toggleAssignee(m.id)} className={`flex items-center justify-between w-full p-2.5 rounded-lg border transition-all text-left group ${isSelected ? 'border-indigo-300 bg-white shadow-sm' : 'border-transparent hover:bg-neutral-100'}`}>
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center shadow-sm shrink-0 border border-neutral-100" style={{ backgroundColor: m.bg_color }}>
                                <MemberIcon size={12} style={{ color: m.icon_color }} />
                              </div>
                              <span className="text-xs font-bold text-neutral-800">{m.display_name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${m.activeLoad === 0 ? 'bg-emerald-50 text-emerald-600' : m.activeLoad > 3 ? 'bg-red-50 text-red-600' : 'bg-neutral-100 text-neutral-500'}`}>{m.activeLoad} tasks</span>
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors border ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-neutral-300 bg-white'}`}>
                                {isSelected && <Check size={10} className="text-white" />}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-neutral-100 mt-2">
            <button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-xs font-bold text-neutral-500 hover:bg-neutral-100 transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting || !title.trim()} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm">
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create Task
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}