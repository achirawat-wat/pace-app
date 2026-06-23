import { useState } from 'react'
import { X, Calendar, MessageSquare, CheckCircle2, User, Loader2, Zap, AlertTriangle, Link as LinkIcon, ArrowRight, History, Check, MoreVertical, Trash2, Edit3, PlayCircle, ImageIcon, FileIcon, Paperclip, ExternalLink } from 'lucide-react'
import TaskChatPanel from './TaskChatPanel'

const ASSIGNEE_REPLIES = ["Need deadline extension", "Scope is too large", "Currently busy with other tasks", "Need more details"]
const MANAGER_REPLIES = ["Cannot approve, keep original deadline", "Can give a slight extension", "Please process this urgently", "Will find someone to help"]
const BOUNCE_REPLIES = ["Work is incomplete, please revise", "Found errors, please fix", "Does not match agreed scope"]

interface TaskDetailModalProps {
  task: any
  profileId: string
  teamMembers: any[]
  isAuthorizedToManage: boolean
  onClose: () => void
  onAccept: (taskId: string, negotiatedDeadline?: string) => Promise<void>
  onNegotiate: (taskId: string, message: string, proposedDeadline: string) => Promise<void>
  onApproveNegotiation: (taskId: string, agreedDeadline: string) => Promise<void>
  onRejectNegotiation: (taskId: string, message: string) => Promise<void>
  onSubmitForReview: (taskId: string, comment: string, deliverableLink: string, deliverableFile: File | null) => Promise<void>
  onApproveComplete: (taskId: string) => Promise<void>
  onBounceTask: (taskId: string, feedback: string) => Promise<void>
  onForwardTask: (parentTask: any, nextTitle: string, nextDesc: string, deadline: string, nextAssigneeId: string) => Promise<void>
  onEditTask: (taskId: string, title: string, desc: string, deadline: string, assignees: string[]) => Promise<void>
  onDeleteTask: (taskId: string) => Promise<void>
  onBlockTask: (taskId: string, reason: string) => Promise<void>
  onUnblockTask: (taskId: string) => Promise<void>
}

export default function TaskDetailModal({ 
  task, profileId, teamMembers, isAuthorizedToManage, onClose, 
  onAccept, onNegotiate, onApproveNegotiation, onRejectNegotiation,
  onSubmitForReview, onApproveComplete, onBounceTask, onForwardTask,
  onEditTask, onDeleteTask, onBlockTask, onUnblockTask
}: TaskDetailModalProps) {
  
  const [isNegotiatingMode, setIsNegotiatingMode] = useState(false)
  const [isBouncingMode, setIsBouncingMode] = useState(false)
  const [isReviewingMode, setIsReviewingMode] = useState(false)
  
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editDesc, setEditDesc] = useState(task.description || '')
  const [editDeadline, setEditDeadline] = useState(task.expected_deadline ? task.expected_deadline.split('T')[0] : '')
  const [editAssignees, setEditAssignees] = useState<string[]>(task.task_assignees?.map((a:any) => a.user_id) || [])

  const [isBlockingMode, setIsBlockingMode] = useState(false)
  const [blockReason, setBlockReason] = useState('')

  const [negMessage, setNegMessage] = useState('')
  const [negDeadline, setNegDeadline] = useState(task.expected_deadline ? task.expected_deadline.split('T')[0] : '')
  const [reviewComment, setReviewComment] = useState('')
  const [reviewLink, setReviewLink] = useState('')
  const [reviewFile, setReviewFile] = useState<File | null>(null) 
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [isForwardMode, setIsForwardMode] = useState(false)
  const [forwardTitle, setForwardTitle] = useState('')
  const [forwardDesc, setForwardDesc] = useState('')
  const [forwardDeadline, setForwardDeadline] = useState('')
  const [forwardAssignee, setForwardAssignee] = useState('')

  const isAssignee = task.task_assignees?.some((a: any) => a.user_id === profileId)
  const myAssigneeRecord = task.task_assignees?.find((a: any) => a.user_id === profileId)
  const hasIAccepted = myAssigneeRecord?.has_accepted === true
  const haveISubmitted = myAssigneeRecord?.is_ready_to_pass === true 

  const isPending = task.status === 'Pending Acceptance'
  const isNegotiating = task.status === 'Negotiating'
  const isInProgress = task.status === 'In Progress'
  const isPendingReview = task.status === 'Pending Review'
  const isBlocked = task.status === 'Blocked' 

  const history = task.negotiation_history || []
  const lastNegotiation = history.length > 0 ? history[history.length - 1] : null
  const lastSenderId = lastNegotiation?.user_id
  const isMyLastNegotiation = lastSenderId === profileId
  const lastSenderRole = teamMembers.find(m => m.id === lastSenderId)?.role
  const lastSenderIsManagerRole = lastSenderRole === 'owner' || lastSenderRole === 'manager'

  const isManagerTurn = isNegotiating && isAuthorizedToManage && !isMyLastNegotiation
  const isAssigneeTurn = isNegotiating && isAssignee && lastSenderIsManagerRole && !isMyLastNegotiation

  const submissions = (() => {
    if (!task.last_context) return []
    try { const parsed = JSON.parse(task.last_context); return Array.isArray(parsed) ? parsed : [] } 
    catch { return [] }
  })()

  const lastBlockerLog = Array.isArray(task.history_logs) ? [...task.history_logs].reverse().find((l:any) => l.type === 'blocked') : null

  const handleAction = async (actionFn: () => Promise<void>) => {
    setIsSubmitting(true)
    await actionFn()
    setIsSubmitting(false)
    if (!isReviewingMode && !isEditMode && !isBlockingMode) onClose() 
    else { setIsReviewingMode(false); setIsEditMode(false); setIsBlockingMode(false); }
  }

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this task? This action cannot be undone.")) {
      await handleAction(() => onDeleteTask(task.id))
    }
  }

  const toggleEditAssignee = (userId: string) => setEditAssignees(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId])
  const handleQuickReply = (text: string) => setNegMessage((prev) => prev ? `${prev} ${text}` : text)
  const quickReplies = isBouncingMode ? BOUNCE_REPLIES : isManagerTurn ? MANAGER_REPLIES : ASSIGNEE_REPLIES

  const urlRegex = /(https?:\/\/[^\s]+)/g
  const descUrls = task.description?.match(urlRegex) || []
  const cleanDesc = task.description?.replace(urlRegex, '').replace(/🔗 \[Link\]:|📁 \[File\]:/g, '').trim()

  // 🌟 ฟังก์ชันเรนเดอร์ลิงก์ที่ปรับขนาดใหญ่ขึ้น สำหรับ Preview รูปภาพ
  const renderAttachmentCard = (url: string, idx: number) => {
    const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)$/i) !== null
    const isSupabaseStorage = url.includes('.supabase.co/storage/')
    
    let title = ''
    let subtitle = ''
    
    try {
      const urlObj = new URL(url)
      const host = urlObj.hostname.replace('www.', '')
      
      if (isSupabaseStorage) {
        const extracted = urlObj.pathname.split('/').pop() || 'File'
        title = decodeURIComponent(extracted)
        subtitle = 'Supabase Storage'
      } else {
        title = host
        subtitle = urlObj.pathname === '/' ? urlObj.href : urlObj.pathname
      }
    } catch {
      title = 'External Link'
      subtitle = url
    }

    if (isImage) {
      return (
        <a key={idx} href={url} target="_blank" rel="noreferrer" className="block border border-neutral-200 rounded-xl overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all w-full max-w-xs group bg-white">
          <img src={url} alt="Attachment" className="w-full h-auto max-h-[220px] object-cover bg-neutral-100 group-hover:opacity-95 transition-opacity" />
          <div className="p-3 border-t border-neutral-200 flex items-center gap-2">
             <ImageIcon size={16} className="text-indigo-500 shrink-0"/>
             <span className="text-xs font-bold text-neutral-800 truncate">{title}</span>
          </div>
        </a>
      )
    }

    return (
      <a key={idx} href={url} target="_blank" rel="noreferrer" 
         className="inline-flex items-center gap-3 px-3.5 py-2.5 bg-white border border-neutral-200 hover:border-indigo-300 hover:bg-indigo-50/50 rounded-xl transition-all shadow-sm group max-w-[300px]">
        
        {/* Thumbnail หรือ Icon */}
        <div className="w-8 h-8 rounded-lg bg-neutral-50 border border-neutral-100 flex items-center justify-center shrink-0 group-hover:border-indigo-200 group-hover:bg-white transition-colors">
          {isSupabaseStorage ? <FileIcon size={16} className="text-indigo-500" /> : <LinkIcon size={16} className="text-indigo-500" />}
        </div>

        {/* ข้อความ + เอฟเฟกต์ขีดเส้นใต้ตอนโฮเวอร์ */}
        <div className="flex flex-col min-w-0 flex-1 pr-1">
          <span className="text-[12px] font-bold text-neutral-800 group-hover:text-indigo-700 truncate group-hover:underline decoration-indigo-300 underline-offset-2">
            {title}
          </span>
          <span className="text-[10px] text-neutral-400 truncate">
            {subtitle}
          </span>
        </div>

        {/* ไอคอน External Link ที่มุมขวา */}
        <ExternalLink size={14} className="text-neutral-300 group-hover:text-indigo-500 shrink-0 ml-1" />
      </a>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-row h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex-[3] flex flex-col relative">
          
          <div className="shrink-0 flex justify-between items-start p-6 border-b border-neutral-100 bg-white z-10 relative">
            <div className="flex-1 pr-4">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md mb-2 inline-flex items-center gap-1 ${
                task.status === 'Pending Acceptance' ? 'bg-amber-100 text-amber-700' : 
                task.status === 'Negotiating' ? 'bg-red-100 text-red-700' : 
                task.status === 'Pending Review' ? 'bg-indigo-100 text-indigo-700' :
                task.status === 'Blocked' ? 'bg-red-500 text-white animate-pulse' : 
                task.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-700'
              }`}>
                {isBlocked && <AlertTriangle size={10}/>} {task.status}
              </span>
              <h2 className="text-xl font-bold text-neutral-900 leading-tight tracking-tight">{task.title}</h2>
              {task.projects && <p className="text-xs text-neutral-500 mt-1 font-medium">{task.projects.name}</p>}
            </div>
            
            <div className="flex items-center gap-2">
              {isAuthorizedToManage && (
                <div className="relative">
                  <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors"><MoreVertical size={18} /></button>
                  {isMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-neutral-100 shadow-lg rounded-xl overflow-hidden z-50">
                      <button onClick={() => { setIsEditMode(true); setIsMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 text-left"><Edit3 size={14}/> Edit Task</button>
                      <button onClick={handleDelete} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 text-left border-t border-neutral-50"><Trash2 size={14}/> Delete Task</button>
                    </div>
                  )}
                </div>
              )}
              <button onClick={onClose} className="p-2 bg-neutral-50 rounded-full text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200 transition-colors"><X size={18} /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 gap-6 flex flex-col bg-neutral-50/30">
            
            {isBlocked && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-800 flex flex-col gap-2 shadow-sm animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 font-bold text-sm"><AlertTriangle size={16} className="text-red-600"/> Task is currently Blocked!</div>
                <p className="text-xs bg-white/60 p-2.5 rounded-lg border border-red-100">
                  <span className="font-semibold text-red-700">Reason:</span> {lastBlockerLog?.message || 'No reason provided.'}
                </p>
              </div>
            )}

            {isEditMode ? (
              <div className="bg-white border border-indigo-200 rounded-xl p-5 shadow-sm animate-in fade-in">
                <h3 className="font-bold text-indigo-900 mb-4 flex items-center gap-2"><Edit3 size={16}/> Edit Task Details</h3>
                <div className="space-y-4">
                  <div><label className="text-[10px] text-neutral-500 uppercase font-bold mb-1 block">Task Title</label><input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full p-2.5 border rounded-lg bg-neutral-50 outline-none text-sm" /></div>
                  <div><label className="text-[10px] text-neutral-500 uppercase font-bold mb-1 block">Description</label><textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="w-full p-2.5 border rounded-lg bg-neutral-50 resize-none outline-none text-sm" rows={3}/></div>
                  <div><label className="text-[10px] text-neutral-500 uppercase font-bold mb-1 block">Deadline</label><input type="date" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} className="w-full p-2.5 border rounded-lg bg-neutral-50 outline-none text-sm" /></div>
                  <div>
                    <label className="text-[10px] text-neutral-500 uppercase font-bold mb-1 block">Assignees</label>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                      {teamMembers.map(m => {
                        const isSelected = editAssignees.includes(m.id)
                        return (
                          <button key={m.id} type="button" onClick={() => toggleEditAssignee(m.id)} className={`flex items-center gap-2 p-2 rounded-lg border text-left ${isSelected ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-neutral-200 hover:bg-neutral-50'}`}>
                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 border border-white shadow-sm" style={{ backgroundColor: m.bg_color }}><span className="text-[8px] font-bold" style={{ color: m.icon_color }}>{m.display_name.substring(0,2).toUpperCase()}</span></div>
                            <span className="text-[11px] font-semibold text-neutral-700 flex-1 truncate">{m.display_name}</span>
                            {isSelected && <CheckCircle2 size={14} className="text-indigo-600 shrink-0"/>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-4 mt-4 border-t border-neutral-100">
                  <button onClick={() => setIsEditMode(false)} className="px-4 py-2 text-neutral-500 text-xs font-medium hover:bg-neutral-100 rounded-lg">Cancel</button>
                  <button onClick={() => handleAction(() => onEditTask(task.id, editTitle, editDesc, editDeadline, editAssignees))} disabled={!editTitle || editAssignees.length === 0} className="px-4 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700">Save Changes</button>
                </div>
              </div>
            ) : (
              <>
                {Array.isArray(task.history_logs) && task.history_logs.filter((l:any)=>l.parent_title).length > 0 && (
                  <div className="bg-white rounded-xl p-4 border border-neutral-200/60 shadow-sm">
                    <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><History size={14}/> Forward History</h4>
                    <div className="space-y-3 max-h-40 overflow-y-auto no-scrollbar pr-2">
                      {task.history_logs.filter((l:any)=>l.parent_title).map((log: any, idx: number) => {
                        const urls = log.attachment_link ? log.attachment_link.split(' | ').filter(Boolean) : []
                        return (
                          <div key={idx} className="bg-neutral-50 border border-neutral-100 rounded-lg p-3 text-xs">
                            <p className="font-semibold text-neutral-800">🔨 Previous Task: <span className="text-neutral-600 font-normal">{log.parent_title}</span></p>
                            <p className="mt-1"><b>Assignee:</b> {log.done_by} ({log.duration_days} days)</p>
                            {log.submission_comment && <p className="text-neutral-500 mt-2 bg-white p-2 rounded border border-neutral-100 italic">" {log.submission_comment} "</p>}
                            
                            {urls.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-neutral-100">
                                {urls.map((u: string, i: number) => renderAttachmentCard(u, i))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {(cleanDesc || descUrls.length > 0) && (
                  <div>
                    <h3 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Paperclip size={12}/> Task Brief & Resources</h3>
                    {cleanDesc && <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap mb-3">{cleanDesc}</p>}
                    
                    {descUrls.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {descUrls.map((u: string, i: number) => renderAttachmentCard(u, i))}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 p-4 bg-white rounded-xl border border-neutral-200/60 shadow-sm text-xs">
                  <div>
                    <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Calendar size={12}/> Deadline</h3>
                    <span className="font-semibold text-neutral-900 text-sm">
                      {task.agreed_deadline ? new Date(task.agreed_deadline).toLocaleDateString('en-GB') : task.expected_deadline ? new Date(task.expected_deadline).toLocaleDateString('en-GB') : 'No Deadline'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1"><User size={12}/> Assignees Status</h3>
                    <div className="flex -space-x-1.5 mt-1">
                      {task.task_assignees?.map((a: any) => (
                        <div key={a.user_id} title={a.profiles?.display_name} className="relative w-7 h-7 rounded-full border-2 border-white flex items-center justify-center shadow-sm" style={{ backgroundColor: a.profiles?.bg_color }}>
                          <span className="text-[9px] font-bold" style={{ color: a.profiles?.icon_color }}>{a.profiles?.display_name.substring(0,2).toUpperCase()}</span>
                          <div className="absolute -bottom-1 -right-1 bg-white rounded-full">
                            {isInProgress || isPendingReview 
                              ? (a.is_ready_to_pass ? <CheckCircle2 size={12} className="text-indigo-500" /> : <Loader2 size={12} className="text-amber-500 animate-spin" />)
                              : (a.has_accepted ? <CheckCircle2 size={12} className="textemerald-500" /> : <Loader2 size={12} className="text-amber-500 animate-spin" />)
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {history.length > 0 && (
                  <div className="bg-white rounded-xl p-4 border border-neutral-200/60 shadow-sm">
                    <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><MessageSquare size={14}/> Negotiation & Revision History ({history.length})</h4>
                    <div className="space-y-2.5 max-h-40 overflow-y-auto no-scrollbar">
                      {history.map((h: any, idx: number) => {
                        const negotiatorName = teamMembers.find(m => m.id === h.user_id)?.display_name || 'Team Member'
                        const isBounce = h.message.includes('[BOUNCED]')
                        const isReject = h.message.includes('[REJECTED]')
                        return (
                          <div key={idx} className={`border rounded-xl p-3 text-xs ${isBounce ? 'bg-amber-50/40 border-amber-200' : isReject ? 'bg-amber-50/50 border-amber-100' : 'bg-neutral-50 border-neutral-200'}`}>
                            <p className="text-neutral-800"><span className="font-bold">{negotiatorName}:</span> {h.message.replace('[REJECTED] ', '').replace('[BOUNCED] ', '')}</p>
                            {h.proposed_deadline && !isBounce && (
                              <p className={`text-[10px] mt-1.5 font-bold ${isReject ? 'text-amber-600' : 'text-neutral-600'}`}>👉 {isReject ? 'Keep Original Deadline' : 'Proposed Deadline'}: {new Date(h.proposed_deadline).toLocaleDateString('en-GB')}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {(isPendingReview || task.status === 'Completed' || submissions.length > 0) && (
                  <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100/50">
                    <h4 className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-3">Deliverables ({submissions.length}/{task.task_assignees.length})</h4>
                    <div className="space-y-3">
                      {submissions.map((sub: any, idx: number) => {
                        const urls = sub.link ? sub.link.split(' | ').filter(Boolean) : []
                        return (
                          <div key={idx} className="bg-white border border-indigo-100 rounded-xl p-3 text-xs shadow-sm">
                            <span className="font-bold text-neutral-900 block mb-1">Submitted by: {sub.name}</span>
                            {sub.comment && <p className="text-neutral-600 italic mb-2">"{sub.comment}"</p>}
                            
                            {urls.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-indigo-50">
                                {urls.map((u: string, i: number) => renderAttachmentCard(u, i))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {isBlockingMode && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm animate-in zoom-in-95 text-xs space-y-3">
                    <h3 className="font-bold text-red-700 flex items-center gap-1.5"><AlertTriangle size={14}/> Report a Blocker</h3>
                    <div>
                      <label className="text-[10px] text-red-600 uppercase font-bold mb-1 block">What is blocking you?</label>
                      <textarea placeholder="Describe the issue, missing resources, or why you can't proceed..." value={blockReason} onChange={e => setBlockReason(e.target.value)} className="w-full p-2.5 border border-red-200 rounded-lg bg-white resize-none outline-none focus:border-red-400" rows={2}/>
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <button onClick={() => setIsBlockingMode(false)} className="px-3 py-1.5 text-neutral-500 hover:bg-red-100 rounded-lg font-medium transition-colors">Cancel</button>
                      <button onClick={() => handleAction(() => onBlockTask(task.id, blockReason))} disabled={!blockReason.trim()} className="px-4 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-sm transition-colors flex items-center gap-1.5">
                        <AlertTriangle size={14}/> Submit Blocker
                      </button>
                    </div>
                  </div>
                )}

                {isReviewingMode && (
                  <div className="bg-white border border-indigo-200 rounded-xl p-4 shadow-sm animate-in slide-in-from-top-2 text-xs">
                    <h3 className="font-bold text-indigo-900 mb-2">Submit Your Part</h3>
                    <textarea placeholder="Describe your deliverables..." value={reviewComment} onChange={e => setReviewComment(e.target.value)} className="w-full p-2.5 border border-neutral-200 rounded-lg bg-neutral-50 resize-none outline-none focus:border-indigo-400 mb-2" rows={2}/>
                    
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <input type="url" placeholder="Attach a link (e.g., Canva, Drive)..." value={reviewLink} onChange={e => setReviewLink(e.target.value)} className="w-full p-2.5 border border-neutral-200 rounded-lg bg-neutral-50 outline-none focus:border-indigo-400" />
                      
                      <input 
                        type="file" 
                        onChange={(e) => setReviewFile(e.target.files?.[0] || null)}
                        className="block w-full text-[11px] text-neutral-500 border border-neutral-200 rounded-lg bg-neutral-50 file:mr-2 file:py-2.5 file:px-3 file:rounded-l-lg file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all outline-none focus:border-indigo-500 cursor-pointer"
                      />
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setIsReviewingMode(false)} className="px-3 py-1.5 font-medium text-neutral-500 hover:bg-neutral-100 rounded-lg">Cancel</button>
                      <button onClick={() => handleAction(() => onSubmitForReview(task.id, reviewComment, reviewLink, reviewFile))} className="px-4 py-1.5 font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1.5">
                        <CheckCircle2 size={14}/> Submit My Part
                      </button>
                    </div>
                  </div>
                )}

                {isForwardMode && (
                  <div className="bg-white border border-indigo-200 rounded-xl p-4 shadow-sm animate-in zoom-in-95 text-xs space-y-4">
                    <h3 className="font-bold text-indigo-700 flex items-center gap-1.5"><ArrowRight size={14}/> Forward to Next Task</h3>
                    <div><label className="text-[10px] text-neutral-500 uppercase font-bold mb-1 block">New Task Title</label><input type="text" placeholder="e.g., Generate AI images based on refs..." value={forwardTitle} onChange={e => setForwardTitle(e.target.value)} className="w-full p-2.5 border border-neutral-200 rounded-lg bg-neutral-50 outline-none focus:border-indigo-400" /></div>
                    <div><label className="text-[10px] text-neutral-500 uppercase font-bold mb-1 block">Task Description</label><textarea placeholder="Describe the next steps for the assignee..." value={forwardDesc} onChange={e => setForwardDesc(e.target.value)} className="w-full p-2.5 border border-neutral-200 rounded-lg bg-neutral-50 resize-none outline-none focus:border-indigo-400" rows={2}/></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-[10px] text-neutral-500 uppercase font-bold mb-1 block">Deadline</label><input type="date" value={forwardDeadline} onChange={e => setForwardDeadline(e.target.value)} className="w-full p-2.5 border border-neutral-200 rounded-lg bg-neutral-50 outline-none focus:border-indigo-400" /></div>
                      <div>
                        <label className="text-[10px] text-neutral-500 uppercase font-bold mb-1.5 block">Assign To</label>
                        <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto pr-1 no-scrollbar border border-neutral-200 rounded-lg bg-neutral-50 p-1.5">
                          {teamMembers.map(m => {
                            const isSelected = forwardAssignee === m.id
                            return (
                              <button key={m.id} type="button" onClick={() => setForwardAssignee(m.id)} className={`flex items-center gap-2 p-2 rounded-md transition-colors border ${isSelected ? 'bg-white border-indigo-200 shadow-sm' : 'bg-transparent border-transparent hover:bg-neutral-100'}`}>
                                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 border border-white" style={{ backgroundColor: m.bg_color }}><span className="text-[8px] font-bold" style={{ color: m.icon_color }}>{m.display_name.substring(0,2).toUpperCase()}</span></div>
                                <div className="flex flex-col text-left flex-1 overflow-hidden">
                                  <span className={`text-[11px] font-bold truncate ${isSelected ? 'text-indigo-700' : 'text-neutral-700'}`}>{m.display_name}</span>
                                  <span className="text-[9px] text-neutral-400 truncate">{m.position}</span>
                                </div>
                                {isSelected && <CheckCircle2 size={14} className="text-indigo-600 shrink-0"/>}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-2 border-t border-neutral-100">
                      <button onClick={() => setIsForwardMode(false)} className="px-3 py-1.5 text-neutral-500 hover:bg-neutral-100 rounded-lg font-medium">Cancel</button>
                      <button onClick={() => handleAction(() => onForwardTask(task, forwardTitle, forwardDesc, forwardDeadline, forwardAssignee))} disabled={!forwardTitle.trim() || !forwardAssignee} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-1.5"><CheckCircle2 size={14}/> Complete & Forward</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {!isNegotiatingMode && !isBouncingMode && !isReviewingMode && !isForwardMode && !isEditMode && !isBlockingMode && (
            <div className="shrink-0 p-5 border-t border-neutral-100 bg-white flex flex-wrap justify-between items-center gap-3 z-10">
              <div className="flex-1">
                {isAssignee && isInProgress && haveISubmitted && <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1.5"><Loader2 size={14} className="animate-spin"/> Submitted. Waiting for others...</span>}
                {isAssignee && hasIAccepted && (isPending || isNegotiating) && <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5"><CheckCircle2 size={14}/> Accepted. Waiting for others...</span>}
                {isNegotiating && !hasIAccepted && isMyLastNegotiation && <span className="text-xs font-semibold text-amber-600 flex items-center gap-1.5"><Loader2 size={14} className="animate-spin"/> Waiting for response...</span>}
              </div>

              <div className="flex gap-2.5">
                {isBlocked && (isAssignee || isAuthorizedToManage) && (
                  <button onClick={() => handleAction(() => onUnblockTask(task.id))} className="px-5 py-2.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors flex items-center gap-1.5 border border-emerald-200">
                    <PlayCircle size={15}/> Resolve & Resume
                  </button>
                )}

                {isAssignee && isInProgress && !haveISubmitted && !isBlocked && (
                  <>
                    <button onClick={() => setIsBlockingMode(true)} className="px-4 py-2.5 text-xs font-bold text-red-600 bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm">
                      <AlertTriangle size={14}/> Report Blocker
                    </button>
                    <button onClick={() => setIsReviewingMode(true)} className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors">
                      <CheckCircle2 size={15}/> Submit Your Part
                    </button>
                  </>
                )}

                {isAuthorizedToManage && isPendingReview && (
                  <>
                    <button onClick={() => setIsBouncingMode(true)} className="px-5 py-2.5 text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors">Request Changes</button>
                    <button onClick={() => setIsForwardMode(true)} className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"><ArrowRight size={15}/> Approve & Forward</button>
                    <button onClick={() => handleAction(() => onApproveComplete(task.id))} className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"><Check size={15}/> Approve & Complete</button>
                  </>
                )}

                {isAssignee && !hasIAccepted && (isPending || isAssigneeTurn) && (
                  <>
                    <button onClick={() => setIsNegotiatingMode(true)} className="px-5 py-2.5 text-xs font-bold text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-xl transition-colors">Negotiate</button>
                    <button onClick={() => handleAction(() => isNegotiating ? onApproveNegotiation(task.id, lastNegotiation?.proposed_deadline) : onAccept(task.id))} className="px-5 py-2.5 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-colors shadow-sm">{isNegotiating ? 'Agree to New Terms' : 'Accept Task'}</button>
                  </>
                )}

                {isManagerTurn && (
                  <>
                    <button onClick={() => setIsNegotiatingMode(true)} className="px-5 py-2.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors">Reply to Proposal</button>
                    <button onClick={() => handleAction(() => onApproveNegotiation(task.id, lastNegotiation?.proposed_deadline))} className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"><Check size={15}/> Approve Terms</button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <TaskChatPanel 
           taskId={task.id} 
           taskTitle={task.title}
           profileId={profileId} 
           teamMembers={teamMembers} 
           taskAssignees={task.task_assignees} 
        />
        
      </div>
    </div>
  )
}