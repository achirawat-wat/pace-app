'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import {
  User, Smile, Coffee, Gamepad2, Code, Zap, X,
  PanelRightOpen, PanelRightClose, Plus, Pencil, Check,
  Loader2
} from 'lucide-react'

import Sidebar from './Sidebar'
import DashboardPanel from './DashboardPanel'
import ProjectPanel from './ProjectPanel'
import TeamDrawer from './TeamDrawer'
import TaskDetailModal from './TaskDetailModal'
import NotificationBell from './NotificationBell'
import CreateTaskModal from './CreateTaskModal' // 🌟 นำเข้า Modal สร้างงาน
import { Anton } from 'next/font/google'

const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
})

const ICON_MAP: Record<string, any> = {
  user: User, smile: Smile, coffee: Coffee, gamepad: Gamepad2, code: Code, zap: Zap
}

interface Toast {
  id: string
  type: 'info' | 'success' | 'warning' | 'action'
  title: string
  message: string
  payload?: any
}

export default function BoardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [isWorkspaceReady, setIsWorkspaceReady] = useState(false)

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activeProject, setActiveProject] = useState<any>(null)
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [userRoleInProject, setUserRoleInProject] = useState<string | null>(null)

  const [tasks, setTasks] = useState<any[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any>(null)

  const [isTeamDrawerOpen, setIsTeamDrawerOpen] = useState(false)
  const [sidebarTrigger, setSidebarTrigger] = useState(0)

  const [isEditingProject, setIsEditingProject] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [isSavingProject, setIsSavingProject] = useState(false)

  // 🌟 ลบ States เก่าๆ ทิ้งไปหมดแล้ว เหลือแค่คุมเปิด/ปิด กับ โหลดดิ้ง
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [isSubmittingTask, setIsSubmittingTask] = useState(false)

  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = (toastData: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, ...toastData }])
    if (toastData.type !== 'action') setTimeout(() => removeToast(id), 6000)
  }
  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))

useEffect(() => {
    const checkAuthAndProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/')
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!data) return router.push('/onboarding')
      setProfile(data)
      
      // ❌ ลบบรรทัด setLoading(false) ที่เคยอยู่ตรงนี้ทิ้งไปเลยครับ!
    }
    checkAuthAndProfile()
  }, [router])

  const fetchTasks = async () => {
    if (!profile?.id) return
    setLoadingTasks(true)
    if (activeProjectId) {
      const { data } = await supabase.from('tasks').select(`*, projects(name), task_assignees(user_id, has_accepted, is_ready_to_pass, profiles(display_name, icon_name, bg_color, icon_color))`).eq('project_id', activeProjectId).order('created_at', { ascending: false })
      if (data) setTasks(data)
    } else {
      const { data: myAssigns } = await supabase.from('task_assignees').select('task_id').eq('user_id', profile.id)
      const { data: myCreated } = await supabase.from('tasks').select('id').eq('created_by', profile.id)
      const allIds = Array.from(new Set([...(myAssigns?.map(a => a.task_id) || []), ...(myCreated?.map(c => c.id) || [])]))
      if (allIds.length > 0) {
        const { data } = await supabase.from('tasks').select(`*, projects(name), task_assignees(user_id, has_accepted, is_ready_to_pass, profiles(display_name, icon_name, bg_color, icon_color))`).in('id', allIds).order('expected_deadline', { ascending: true })
        if (data) setTasks(data)
      } else {
        setTasks([])
      }
    }
    setLoadingTasks(false)
    setIsWorkspaceReady(true) // 🌟 เพิ่มบรรทัดนี้: แจ้งว่าโหลดงานรอบแรกเสร็จแล้ว ปิด Splash Screen ได้เลย!
  }

  const fetchProjectAndTeam = async () => {
    if (!activeProjectId) return
    const { data: projectData } = await supabase.from('projects').select('*').eq('id', activeProjectId).single()
    if (projectData) {
      setActiveProject(projectData)
      setEditName(projectData.name)
      setEditDesc(projectData.description || '')
    }

    const { data: membersData } = await supabase.from('project_members').select(`role, position, profiles ( id, display_name, icon_name, bg_color, icon_color )`).eq('project_id', activeProjectId)
    if (membersData) {
      const formattedMembers = membersData.map((m: any) => {
        const profileData = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
        return profileData ? { role: m.role, position: m.position, ...profileData } : null
      }).filter(Boolean)
      setTeamMembers(formattedMembers)
      const currentMemberRecord = formattedMembers.find(m => m.id === profile?.id)
      setUserRoleInProject(currentMemberRecord ? currentMemberRecord.role : 'member')
    }
  }

  useEffect(() => {
    if (!activeProjectId) {
      setActiveProject(null); setTeamMembers([]); setIsTeamDrawerOpen(false); setUserRoleInProject(null); setIsEditingProject(false);
      return
    }
    fetchProjectAndTeam()

    const memberChannel = supabase.channel(`realtime:project_members:${activeProjectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_members' }, () => { fetchProjectAndTeam() })
      .subscribe()

    return () => { supabase.removeChannel(memberChannel) }
  }, [activeProjectId, profile?.id])

  useEffect(() => {
    fetchTasks()
    const taskChannel = supabase.channel('realtime:all_tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => { fetchTasks() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, () => { fetchTasks() })
      .subscribe()
    return () => { supabase.removeChannel(taskChannel) }
  }, [activeProjectId, profile?.id])

  useEffect(() => {
    if (selectedTask) {
      const updatedTask = tasks.find(t => t.id === selectedTask.id)
      if (updatedTask) setSelectedTask(updatedTask)
      else setSelectedTask(null)
    }
  }, [tasks])

  const isAuthorizedToManage = userRoleInProject === 'owner' || userRoleInProject === 'manager'

  const notifyUsers = async (userIds: string[], title: string, message: string, type: 'info' | 'success' | 'warning' | 'action' = 'info', payload: any = null) => {
    const validIds = userIds.filter(id => id !== profile?.id)
    if (validIds.length === 0) return
    const inserts = validIds.map(id => ({ user_id: id, title, message, type, payload }))
    await supabase.from('notifications').insert(inserts)
  }

  const handleRouteToTask = async (targetTaskId: string) => {
    const t = tasks.find(x => x.id === targetTaskId)
    if (t) {
      setSelectedTask(t)
    } else {
      const { data } = await supabase.from('tasks').select(`*, projects(name), task_assignees(user_id, has_accepted, is_ready_to_pass, profiles(display_name, icon_name, bg_color, icon_color))`).eq('id', targetTaskId).single()
      if (data) {
        if (data.project_id && data.project_id !== activeProjectId) {
          setActiveProjectId(data.project_id) 
        }
        setSelectedTask(data) 
      }
    }
  }

  const getManagerIds = async (projectId: string) => {
    const { data } = await supabase.from('project_members').select('user_id').eq('project_id', projectId).in('role', ['owner', 'manager'])
    return data ? data.map(m => m.user_id) : []
  }

  const handleUpdateRole = async (targetUserId: string, newRole: string) => {
    await supabase.from('project_members').update({ role: newRole }).eq('project_id', activeProjectId).eq('user_id', targetUserId)
    fetchProjectAndTeam()
  }

  const handleUpdatePosition = async (targetUserId: string, newPosition: string) => {
    await supabase.from('project_members').update({ position: newPosition }).eq('project_id', activeProjectId).eq('user_id', targetUserId)
    fetchProjectAndTeam()
  }

  const handleRemoveMember = async (targetUserId: string) => {
    await supabase.from('project_members').delete().eq('project_id', activeProjectId).eq('user_id', targetUserId)
    fetchProjectAndTeam()
  }
  // 🌟 ฟังก์ชันอัปโหลดไฟล์ขึ้น Supabase Storage
  const uploadFileToSupabase = async (file: File, folderName: string) => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
      const filePath = `${folderName}/${fileName}`
      
      const { data, error } = await supabase.storage.from('attachments').upload(filePath, file)
      if (error) throw error
      
      // ดึง URL กลับมา
      const { data: publicUrlData } = supabase.storage.from('attachments').getPublicUrl(filePath)
      return publicUrlData.publicUrl
    } catch (error) {
      console.error("Upload error:", error)
      return null
    }
  }
  const handleEditTask = async (taskId: string, title: string, desc: string, deadline: string, newAssignees: string[]) => {
    await supabase.from('tasks').update({ 
      title, description: desc, expected_deadline: deadline ? new Date(deadline).toISOString() : null 
    }).eq('id', taskId)

    const { data: currAssignees } = await supabase.from('task_assignees').select('user_id').eq('task_id', taskId)
    const currIds = currAssignees?.map((c: any) => c.user_id) || []
    
    const toRemove = currIds.filter((id: string) => !newAssignees.includes(id))
    const toAdd = newAssignees.filter((id: string) => !currIds.includes(id))

    if (toRemove.length > 0) {
      await supabase.from('task_assignees').delete().eq('task_id', taskId).in('user_id', toRemove)
    }
    
    if (toAdd.length > 0) {
      const inserts = toAdd.map((id: string) => ({
        task_id: taskId,
        user_id: id,
        has_accepted: id === profile.id
      }))
      await supabase.from('task_assignees').insert(inserts)
      await notifyUsers(toAdd, 'Assigned to Existing Task', `คุณถูกเพิ่มเข้าไปในงาน: ${title}`, 'info', { task_id: taskId })
    }

    fetchTasks()
    addToast({ type: 'success', title: 'Task Updated', message: 'Task details updated successfully!' })
  }

  const handleDeleteTask = async (taskId: string) => {
    await supabase.from('task_assignees').delete().eq('task_id', taskId)
    await supabase.from('task_messages').delete().eq('task_id', taskId)
    await supabase.from('tasks').delete().eq('id', taskId)
    
    setSelectedTask(null)
    fetchTasks()
    addToast({ type: 'success', title: 'Task Deleted', message: 'Task removed successfully.' })
  }

  const handleSaveProjectInfo = async () => {
    if (!editName.trim() || !activeProjectId) return
    setIsSavingProject(true)
    await supabase.from('projects').update({ name: editName, description: editDesc }).eq('id', activeProjectId)
    setActiveProject({ ...activeProject, name: editName, description: editDesc })
    setIsEditingProject(false)
    setSidebarTrigger(prev => prev + 1)
    setIsSavingProject(false)
  }

  // 🌟 ฟังก์ชันจัดการข้อมูลตอนสร้างงาน (รับข้อมูลมาจาก Modal)
// 🌟 อัปเดต: รับ attachmentFile มาด้วย
  const handleCreateTask = async (title: string, desc: string, deadline: string, assignees: string[], attachmentLink: string, attachmentFile: File | null) => {
    if (!activeProjectId || !profile?.id) return
    setIsSubmittingTask(true)

    // อัปโหลดไฟล์ (ถ้ามี)
    let uploadedFileUrl = ''
    if (attachmentFile) {
      uploadedFileUrl = await uploadFileToSupabase(attachmentFile, 'task_briefs') || ''
    }

    let finalDesc = desc
    if (attachmentLink) finalDesc += `\n\n🔗 [Link]: ${attachmentLink}`
    if (uploadedFileUrl) finalDesc += `\n\n📁 [File]: ${uploadedFileUrl}`

    const { data: taskData, error: taskError } = await supabase.from('tasks').insert([{
      title, description: finalDesc, project_id: activeProjectId, created_by: profile.id,
      expected_deadline: deadline ? new Date(deadline).toISOString() : null,
      status: 'Pending Acceptance'
    }]).select()

    if (!taskError && taskData) {
      const newTaskId = taskData[0].id
      if (assignees.length > 0) {
        const assigneesToInsert = assignees.map(userId => ({ task_id: newTaskId, user_id: userId, is_ready_to_pass: false, has_accepted: userId === profile.id }))
        await supabase.from('task_assignees').insert(assigneesToInsert)
        await notifyUsers(assignees, 'New Task Assigned', `คุณได้รับมอบหมายงานใหม่: ${title}`, 'info', { task_id: newTaskId })

        if (assignees.every(id => id === profile.id)) {
           await supabase.from('tasks').update({ status: 'In Progress', agreed_deadline: deadline ? new Date(deadline).toISOString() : null }).eq('id', newTaskId)
        }
      }



      setIsCreatingTask(false)
      fetchTasks()
      addToast({ type: 'success', title: 'Task Created', message: 'สร้างงานใหม่สำเร็จ!' })
    } else {
      addToast({ type: 'warning', title: 'Error', message: 'เกิดข้อผิดพลาดในการสร้างงาน' })
    }
    setIsSubmittingTask(false)
  }

  const handleAcceptTask = async (taskId: string, negotiatedDeadline?: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    await supabase.from('task_assignees').update({ has_accepted: true }).eq('task_id', taskId).eq('user_id', profile.id)
    
    const { data: currentAssignees } = await supabase.from('task_assignees').select('*').eq('task_id', taskId)
    const allOtherAccepted = currentAssignees?.filter((a: any) => a.user_id !== profile.id).every((a: any) => a.has_accepted)

    const updateData: any = {}
    if (negotiatedDeadline) updateData.expected_deadline = negotiatedDeadline

    const managers = await getManagerIds(task.project_id)
    await notifyUsers(managers, 'Task Accepted', `${profile.display_name} กดรับงาน: ${task.title}`, 'success', { task_id: taskId })

    if (allOtherAccepted || ((currentAssignees?.length ?? 0) <= 1)) {
      updateData.status = 'In Progress'
      updateData.agreed_deadline = negotiatedDeadline || task.expected_deadline
      await supabase.from('tasks').update(updateData).eq('id', taskId)
    } else {
      if (task.status === 'Negotiating') updateData.status = 'Pending Acceptance'
      if (Object.keys(updateData).length > 0) await supabase.from('tasks').update(updateData).eq('id', taskId)
    }
    fetchTasks()
  }

  const handleNegotiateTask = async (taskId: string, message: string, proposedDeadline: string) => {
    const task = tasks.find(t => t.id === taskId)
    const newHistory = [...(task.negotiation_history || []), {
      user_id: profile.id, message, proposed_deadline: proposedDeadline, created_at: new Date().toISOString()
    }]

    await supabase.from('task_assignees').update({ has_accepted: false }).eq('task_id', taskId)
    await supabase.from('tasks').update({ status: 'Negotiating', negotiation_history: newHistory, bounce_count: (task.bounce_count || 0) + 1 }).eq('id', taskId)
    
    const isAssignee = task.task_assignees.some((a:any) => a.user_id === profile.id)
    if (isAssignee) {
      const managers = await getManagerIds(task.project_id)
      await notifyUsers(managers, 'Task Negotiation', `${profile.display_name} ขอเจรจาในงาน: ${task.title}`, 'warning', { task_id: taskId })
    } else {
      const assignees = task.task_assignees.map((a:any) => a.user_id)
      await notifyUsers(assignees, 'Manager Response', `Manager ส่งข้อเสนอใหม่ในงาน: ${task.title}`, 'warning', { task_id: taskId })
    }
    fetchTasks()
  }

  const handleApproveNegotiation = async (taskId: string, agreedDeadline: string) => {
    const task = tasks.find(t => t.id === taskId)
    await supabase.from('tasks').update({ status: 'Pending Acceptance', expected_deadline: agreedDeadline }).eq('id', taskId)
    await supabase.from('task_assignees').update({ has_accepted: false }).eq('task_id', taskId)
    
    const assignees = task.task_assignees.map((a:any) => a.user_id)
    await notifyUsers(assignees, 'Terms Approved', `Manager อนุมัติข้อตกลงใหม่ในงาน: ${task.title}`, 'success', { task_id: taskId })
    
    fetchTasks()
  }

  const handleRejectNegotiation = async (taskId: string, message: string) => {
    const task = tasks.find(t => t.id === taskId)
    const newHistory = [...(task.negotiation_history || []), {
      user_id: profile.id, message: `[REJECTED] ${message}`, proposed_deadline: task.expected_deadline, created_at: new Date().toISOString()
    }]

    await supabase.from('task_assignees').update({ has_accepted: false }).eq('task_id', taskId)
    await supabase.from('tasks').update({ status: 'Pending Acceptance', negotiation_history: newHistory, bounce_count: (task.bounce_count || 0) + 1 }).eq('id', taskId)
    
    const assignees = task.task_assignees.map((a:any) => a.user_id)
    await notifyUsers(assignees, 'Negotiation Rejected', `Manager ปฏิเสธข้อเสนอเจรจาในงาน: ${task.title}`, 'warning', { task_id: taskId })

    fetchTasks()
  }

// 🌟 อัปเดต: รับ deliverableFile มาด้วย
  const handleSubmitForReview = async (taskId: string, comment: string, deliverableLink: string, deliverableFile: File | null) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    setIsSubmittingTask(true)

    // อัปโหลดไฟล์ผลงาน (ถ้ามี)
    let uploadedFileUrl = ''
    if (deliverableFile) {
      uploadedFileUrl = await uploadFileToSupabase(deliverableFile, 'submissions') || ''
    }

    await supabase.from('task_assignees').update({ is_ready_to_pass: true }).eq('task_id', taskId).eq('user_id', profile.id)
    
    let currentContext = []
    if (task.last_context) {
      try { currentContext = JSON.parse(task.last_context); if (!Array.isArray(currentContext)) currentContext = [] } 
      catch (e) { currentContext = [] }
    }
    
    // 🌟 เอา URL ไฟล์เข้าไปรวมกับ Link ที่กรอก
    const finalLink = [deliverableLink, uploadedFileUrl].filter(Boolean).join(' | ')

    currentContext.push({
      user_id: profile.id,
      name: profile.display_name,
      comment: comment,
      link: finalLink, // เก็บทั้งคู่
      submitted_at: new Date().toISOString()
    })

    const contextPayload = JSON.stringify(currentContext)

    let msg = `🚀 [SUBMITTED WORK]\n📝 คำอธิบาย: ${comment || 'ไม่มี'}`

    await supabase.from('task_messages').insert([{ task_id: taskId, user_id: profile.id, message: msg }])

    const allOtherReady = task.task_assignees.filter((a: any) => a.user_id !== profile.id).every((a: any) => a.is_ready_to_pass)

    if (allOtherReady || task.task_assignees.length <= 1) {
      await supabase.from('tasks').update({ status: 'Pending Review', last_context: contextPayload }).eq('id', taskId)
      const managers = await getManagerIds(task.project_id)
      await notifyUsers(managers, 'Task Ready for Review', `งาน "${task.title}" ทุกคนส่งครบแล้ว รอตรวจสอบ`, 'info', { task_id: taskId })
      addToast({ type: 'success', title: 'Task Submitted', message: 'ทุกคนส่งงานครบแล้ว! ส่งให้ผู้ดูแลตรวจสอบ' })
    } else {
      await supabase.from('tasks').update({ last_context: contextPayload }).eq('id', taskId)
      const otherAssignees = task.task_assignees.filter((a: any) => a.user_id !== profile.id && !a.is_ready_to_pass).map((a:any) => a.user_id)
      await notifyUsers(otherAssignees, 'Team Submission', `${profile.display_name} ส่งงานส่วนตัวแล้ว รีบส่งส่วนของคุณนะ!`, 'info', { task_id: taskId })
      addToast({ type: 'info', title: 'Partially Submitted', message: 'ส่งงานส่วนของคุณแล้ว รอเพื่อนคนอื่นส่งให้ครบ' })
    }
    fetchTasks()
    setIsSubmittingTask(false)
  }

  const handleApproveComplete = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    await supabase.from('tasks').update({ status: 'Completed' }).eq('id', taskId)
    
    const assignees = task.task_assignees.map((a: any) => a.user_id)
    await notifyUsers(assignees, 'Task Approved! 🎉', `งานของคุณได้รับการอนุมัติแล้ว: ${task.title}`, 'success', { task_id: taskId })
    
    fetchTasks()
    addToast({ type: 'success', title: 'Task Completed', message: 'อนุมัติงานเสร็จสมบูรณ์เรียบร้อย!' })
  }

  const handleBounceTask = async (taskId: string, feedback: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const newHistory = [...(task.negotiation_history || []), {
      user_id: profile.id, message: `[BOUNCED] ${feedback}`, created_at: new Date().toISOString()
    }]

    await supabase.from('task_assignees').update({ is_ready_to_pass: false }).eq('task_id', taskId)
    await supabase.from('tasks').update({ 
      status: 'In Progress', 
      negotiation_history: newHistory, 
      bounce_count: (task.bounce_count || 0) + 1,
      last_context: null 
    }).eq('id', taskId)
    
    await supabase.from('task_messages').insert([{ task_id: taskId, user_id: profile.id, message: `❌ [TASK BOUNCED] ขอให้แก้ไขงาน:\n💬 ${feedback}` }])

    const assignees = task.task_assignees.map((a: any) => a.user_id)
    await notifyUsers(assignees, 'Task Revisions Required', `งานโดนตีกลับแก้ไข: ${task.title}`, 'warning', { task_id: taskId })

    fetchTasks()
    addToast({ type: 'warning', title: 'Task Sent Back', message: 'ดีดงานกลับไปให้ลูกทีมแก้ไขแล้ว' })
  }

  const handleForwardTask = async (parentTask: any, nextTitle: string, nextDesc: string, deadline: string, nextAssigneeId: string) => {
    await supabase.from('tasks').update({ status: 'Completed' }).eq('id', parentTask.id)

    let oldComment = ''
    let oldLink = ''
    if (parentTask.last_context) {
      try {
        const parsed = JSON.parse(parentTask.last_context)
        if (Array.isArray(parsed) && parsed.length > 0) {
          oldComment = parsed[0].comment || ''
          oldLink = parsed[0].link || ''
        } else {
          oldComment = parsed.comment || ''
          oldLink = parsed.link || ''
        }
      } catch (e) {
        oldLink = parentTask.last_context
      }
    }
    
    const oldWorkerNames = parentTask.task_assignees?.map((a: any) => a.profiles?.display_name).join(', ') || 'ไม่ระบุ'
    const durationDays = Math.ceil((new Date().getTime() - new Date(parentTask.created_at).getTime()) / (1000 * 3600 * 24))

    const newLogEntry = {
      parent_task_id: parentTask.id,
      parent_title: parentTask.title,
      done_by: oldWorkerNames,
      duration_days: durationDays || 1,
      attachment_link: oldLink,
      submission_comment: oldComment,
      completed_at: new Date().toISOString()
    }

    const currentLogs = Array.isArray(parentTask.history_logs) ? parentTask.history_logs : []
    const updatedHistoryLogs = [...currentLogs, newLogEntry]

    // 🌟 เช็กว่าคนที่รับงานต่อคือตัวเราเองหรือเปล่า
    const isSelfAssigned = nextAssigneeId === profile.id
    const deadlineISO = deadline ? new Date(deadline).toISOString() : null

    const { data: nextTask, error } = await supabase.from('tasks').insert([{
      title: nextTitle,
      description: nextDesc,
      project_id: parentTask.project_id,
      created_by: profile.id,
      expected_deadline: deadlineISO,
      agreed_deadline: isSelfAssigned ? deadlineISO : null, // 🌟 ถ้าทำเอง ให้เซ็ตวันเดดไลน์จริงไปเลย
      status: isSelfAssigned ? 'In Progress' : 'Pending Acceptance', // 🌟 ถ้าทำเอง ข้ามไปสถานะกำลังทำทันที!
      history_logs: updatedHistoryLogs, 
      last_context: parentTask.last_context 
    }]).select()

    if (nextTask && !error) {
      const nextTaskId = nextTask[0].id
      await supabase.from('task_assignees').insert([{
        task_id: nextTaskId,
        user_id: nextAssigneeId,
        has_accepted: isSelfAssigned // 🌟 ส่งให้ตัวเองกดรับงานให้อัตโนมัติ
      }])

      await notifyUsers([nextAssigneeId], 'Task Forwarded to You', `คุณได้รับช่วงงานส่งต่อถัดไป: ${nextTitle}`, 'info', { task_id: nextTaskId })
      addToast({ type: 'success', title: 'Task Chain Forwarded', message: 'ส่งต่องานชิ้นถัดไปให้ทีมเสร็จสิ้น!' })
      fetchTasks()
    }
  }

  const handleBlockTask = async (taskId: string, reason: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const newHistory = [...(Array.isArray(task.history_logs) ? task.history_logs : []), {
      type: 'blocked',
      user_id: profile.id,
      message: reason,
      created_at: new Date().toISOString()
    }]

    await supabase.from('tasks').update({ status: 'Blocked', history_logs: newHistory }).eq('id', taskId)

    await supabase.from('task_messages').insert([{
      task_id: taskId,
      user_id: profile.id,
      message: `🛑 [TASK BLOCKED] แจ้งติดปัญหา:\n💬 "${reason}"`
    }])

    const managers = await getManagerIds(task.project_id)
    await notifyUsers(managers, 'Task Blocked 🚨', `งาน "${task.title}" ติดปัญหา: ${reason}`, 'warning', { task_id: taskId })

    fetchTasks()
    addToast({ type: 'warning', title: 'Task Blocked', message: 'Reported the issue to manager successfully.' })
  }

  const handleUnblockTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const newHistory = [...(Array.isArray(task.history_logs) ? task.history_logs : []), {
      type: 'unblocked',
      user_id: profile.id,
      created_at: new Date().toISOString()
    }]

    await supabase.from('tasks').update({ status: 'In Progress', history_logs: newHistory }).eq('id', taskId)

    await supabase.from('task_messages').insert([{
      task_id: taskId,
      user_id: profile.id,
      message: `✅ [ISSUE RESOLVED] ปัญหาถูกเคลียร์แล้ว กลับมาดำเนินการต่อได้!`
    }])

    const assignees = task.task_assignees.map((a: any) => a.user_id)
    await notifyUsers(assignees, 'Task Resumed ▶️', `ปัญหาในงาน "${task.title}" ถูกเคลียร์แล้ว ลุยต่อได้!`, 'success', { task_id: taskId })

    fetchTasks()
    addToast({ type: 'success', title: 'Task Resumed', message: 'Issue resolved. Task is back in progress.' })
  }

  // ✅ ของใหม่ หน้าจอโหลดจะไร้รอยต่อมากๆ
// เปลี่ยนโค้ดเดิมที่เป็น if (loading) return (...) เป็นแบบนี้ครับ

  const ProfileIcon = ICON_MAP[profile?.icon_name] || User
  // 🌟 รอจนกว่า Workspace จะ Ready ถึงจะเปิดม่านโชว์ UI บอร์ด
  if (!isWorkspaceReady) return (
    <div className="fixed inset-0 z-[100] flex flex-col h-screen w-screen items-center justify-center bg-white transition-opacity duration-300">
      <h1 className={`${anton.className} text-[60px] md:text-[80px] text-neutral-900 tracking-[0.3em] pl-[0.3em] animate-in fade-in zoom-in-95 duration-700`}>
        PACE
      </h1>
      <p className="text-[10px] md:text-[11px] font-bold text-neutral-400 uppercase tracking-[0.2em] mt-3 flex items-center gap-2 animate-in fade-in duration-1000 delay-300">
        <Loader2 size={12} className="animate-spin" /> Starting Workspace...
      </p>
    </div>
  )
  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-neutral-900 relative">
      <Sidebar onSelectProject={(id) => setActiveProjectId(id)} triggerRefresh={sidebarTrigger} />

      <div className="flex flex-1 flex-col p-8 transition-all duration-300">
        <div className="mb-6 flex items-start justify-between">
          <div className="flex-1 max-w-2xl">
            {isEditingProject ? (
              <div className="space-y-3 bg-neutral-50 p-4 rounded-2xl border border-neutral-200/60">
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full text-xl font-bold tracking-tight px-2 py-1.5 rounded-lg border border-neutral-200 outline-none focus:border-neutral-900 bg-white" placeholder="ชื่อโปรเจกต์" />
                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="w-full text-sm text-neutral-600 px-2 py-1.5 rounded-lg border border-neutral-200 outline-none focus:border-neutral-900 bg-white resize-none" placeholder="คำอธิบายโปรเจกต์ (ไม่บังคับ)" rows={2} />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setIsEditingProject(false)} className="px-3 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-200 rounded-lg transition-colors">Cancel</button>
                  <button onClick={handleSaveProjectInfo} disabled={isSavingProject || !editName.trim()} className="flex items-center gap-1 px-4 py-1.5 text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-40">
                    {isSavingProject ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}<span>Save Changes</span>
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 group">
                  <h1 className="text-2xl font-bold tracking-tight">{activeProject ? activeProject.name : 'All Tasks Dashboard'}</h1>
                  {activeProject && isAuthorizedToManage && (
                    <button onClick={() => setIsEditingProject(true)} className="p-1 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" title="แก้ไขข้อมูลโปรเจกต์"><Pencil size={16} /></button>
                  )}
                </div>
                <p className="mt-1 text-sm text-neutral-500">{activeProject?.description || 'ภาพรวมงานของคุณจากทุกโปรเจกต์'}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {activeProject && isAuthorizedToManage && (
              <button className="flex items-center gap-1.5 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 transition-colors" onClick={() => setIsCreatingTask(true)}>
                <Plus size={16} /><span>New Task</span>
              </button>
            )}

            {activeProject && (
              <button onClick={() => setIsTeamDrawerOpen(!isTeamDrawerOpen)} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${isTeamDrawerOpen ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}`}>
                {isTeamDrawerOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                <span>Team ({teamMembers.length})</span>
              </button>
            )}

            <div className="h-6 w-px bg-neutral-200 mx-1" />

            <NotificationBell 
              profileId={profile?.id} 
              addToast={addToast} 
              onRefresh={fetchProjectAndTeam} 
              onRouteToTask={handleRouteToTask} 
            />

            <div className="flex items-center gap-2.5 rounded-xl border border-neutral-100 bg-neutral-50 p-1.5 pr-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg shadow-sm" style={{ backgroundColor: profile?.bg_color }}><ProfileIcon size={16} style={{ color: profile?.icon_color }} /></div>
              <span className="text-sm font-medium text-neutral-700">{profile?.display_name}</span>
            </div>
          </div>
        </div>

        {loadingTasks ? (
          <div className="flex-1 flex items-center justify-center text-neutral-400"><Loader2 className="animate-spin" size={24} /></div>
        ) : activeProject ? (
          <ProjectPanel tasks={tasks} profileId={profile?.id} isAuthorizedToManage={isAuthorizedToManage} onTaskClick={(task) => setSelectedTask(task)} />
        ) : (
          <DashboardPanel tasks={tasks} profileId={profile?.id} onTaskClick={(task) => setSelectedTask(task)} />
        )}
      </div>

      <TeamDrawer
        isOpen={isTeamDrawerOpen}
        onClose={() => setIsTeamDrawerOpen(false)}
        teamMembers={teamMembers}
        currentProfileId={profile?.id}
        isAuthorizedToManage={isAuthorizedToManage}
        userRoleInProject={userRoleInProject}
        onUpdateRole={handleUpdateRole}
        onUpdatePosition={handleUpdatePosition}
        onRemoveMember={handleRemoveMember}
        activeProjectId={activeProjectId}
      />

      {selectedTask && (
        <TaskDetailModal 
          task={selectedTask}
          profileId={profile?.id}
          teamMembers={teamMembers} 
          isAuthorizedToManage={isAuthorizedToManage}
          onClose={() => setSelectedTask(null)}
          onAccept={handleAcceptTask}
          onNegotiate={handleNegotiateTask}
          onApproveNegotiation={handleApproveNegotiation}
          onRejectNegotiation={handleRejectNegotiation}
          onSubmitForReview={handleSubmitForReview}
          onApproveComplete={handleApproveComplete}
          onBounceTask={handleBounceTask}
          onForwardTask={handleForwardTask}
          onEditTask={handleEditTask}
          onDeleteTask={handleDeleteTask}
          onBlockTask={handleBlockTask}
          onUnblockTask={handleUnblockTask}
        />
      )}

      {/* 🌟 เรียกใช้งาน Component ใหม่แทนฟอร์มยาวๆ */}
      <CreateTaskModal 
        isOpen={isCreatingTask}
        onClose={() => setIsCreatingTask(false)}
        teamMembers={teamMembers}
        tasks={tasks}
        isSubmitting={isSubmittingTask}
        onCreateTask={handleCreateTask}
      />

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 w-80 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="bg-white border border-neutral-200 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden pointer-events-auto animate-in slide-in-from-right-8 fade-in duration-300">
            <div className="p-4">
              <div className="flex justify-between items-start mb-1">
                <h4 className="text-sm font-bold text-neutral-900">{toast.title}</h4>
                <button onClick={() => removeToast(toast.id)} className="text-neutral-400 hover:text-neutral-700"><X size={14} /></button>
              </div>
              <p className="text-xs text-neutral-600 mb-3">{toast.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}