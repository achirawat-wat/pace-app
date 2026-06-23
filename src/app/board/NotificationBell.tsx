'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Bell, X, User, Smile, Coffee, Gamepad2, Code, Zap, CheckCircle2, AlertCircle, Trash2, CheckSquare, Inbox, MailOpen } from 'lucide-react'

const ICON_MAP: Record<string, any> = { user: User, smile: Smile, coffee: Coffee, gamepad: Gamepad2, code: Code, zap: Zap }

interface NotificationBellProps {
  profileId: string
  addToast: any
  onRefresh: () => void
  onRouteToTask: (taskId: string) => void // 🌟 เพิ่ม Props สำหรับสั่ง Route
}

export default function NotificationBell({ profileId, addToast, onRefresh, onRouteToTask }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'unread' | 'all'>('unread')
  
  const [incomingRequests, setIncomingRequests] = useState<any[]>([])
  const [myRequests, setMyRequests] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchData = async () => {
    if (!profileId) return
    const { data: myRoles } = await supabase.from('project_members').select('project_id').eq('user_id', profileId).in('role', ['owner', 'manager'])
    if (myRoles && myRoles.length > 0) {
      const projectIds = myRoles.map(r => r.project_id)
      const { data: incoming } = await supabase.from('project_join_requests').select(`id, status, project_id, user_id, projects(name), profiles(display_name, icon_name, bg_color, icon_color)`).in('project_id', projectIds).eq('status', 'pending').order('created_at', { ascending: false })
      setIncomingRequests(incoming || [])
    }
    const { data: myReq } = await supabase.from('project_join_requests').select('id, status, projects(name)').eq('user_id', profileId).order('created_at', { ascending: false })
    setMyRequests(myReq || [])

    const { data: notifs } = await supabase.from('notifications').select('*').eq('user_id', profileId).order('created_at', { ascending: false }).limit(30)
    setNotifications(notifs || [])
  }

  useEffect(() => {
    fetchData()
    if (!profileId) return

    const channel = supabase.channel(`realtime:bell_${profileId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profileId}` }, (payload) => {
        const newNotif = payload.new
        addToast({ type: newNotif.type || 'info', title: newNotif.title, message: newNotif.message })
        fetchData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_join_requests' }, () => { fetchData() })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profileId])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 🌟 แจ้งเตือนเวลาโดนรับเข้าโปรเจกต์
  const handleAcceptRequest = async (requestId: string, projectId: string, requestUserId: string, projectName: string) => {
    await supabase.from('project_join_requests').update({ status: 'approved' }).eq('id', requestId)
    await supabase.from('project_members').insert([{ project_id: projectId, user_id: requestUserId, role: 'member', position: 'Unassigned' }])
    
    // แจ้งเตือนไปบอกคนที่โดนรับเข้าโปรเจกต์
    await supabase.from('notifications').insert([{
      user_id: requestUserId,
      title: '🎉 Welcome to the Team!',
      message: `คำขอเข้าร่วมโปรเจกต์ ${projectName} ของคุณได้รับการอนุมัติแล้ว!`,
      type: 'success',
      payload: { project_id: projectId } // แอบเก็บ project_id ไว้
    }])

    addToast({ type: 'success', title: 'Member Approved', message: 'เพิ่มสมาชิกเข้าโปรเจกต์เรียบร้อยแล้ว' })
    fetchData(); onRefresh();
  }

  const handleRejectRequest = async (requestId: string) => {
    await supabase.from('project_join_requests').update({ status: 'rejected' }).eq('id', requestId)
    addToast({ type: 'info', title: 'Member Declined', message: 'ปฏิเสธคำขอเข้าโปรเจกต์เรียบร้อย' })
    fetchData();
  }

  const handleClearRequest = async (requestId: string) => {
    await supabase.from('project_join_requests').delete().eq('id', requestId)
    fetchData();
  }

  // 🌟 ฟังก์ชันเมื่อกดแจ้งเตือน
  const handleNotificationClick = async (n: any) => {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
      fetchData()
    }
    setIsOpen(false)
    
    // สั่ง Route ไปหา Task ID ถ้าระบบเจอ payload 
    if (n.payload?.task_id) {
      onRouteToTask(n.payload.task_id)
    }
  }

  const markAllAsRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profileId).eq('is_read', false)
    addToast({ type: 'success', title: 'All Caught Up!', message: 'อ่านการแจ้งเตือนทั้งหมดแล้ว' })
    fetchData()
  }

  const clearReadNotifications = async () => {
    await supabase.from('notifications').delete().eq('user_id', profileId).eq('is_read', true)
    addToast({ type: 'info', title: 'Inbox Cleared', message: 'ลบการแจ้งเตือนที่อ่านแล้วออกจากระบบ' })
    fetchData()
  }

  const unreadNotifs = notifications.filter(n => !n.is_read)
  const readNotifs = notifications.filter(n => n.is_read)
  const unreadCount = incomingRequests.length + unreadNotifs.length
  
  const displayNotifs = activeTab === 'unread' ? unreadNotifs : notifications

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setIsOpen(!isOpen)} className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${isOpen ? 'bg-neutral-100 border-neutral-300 text-neutral-900' : 'bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'}`}>
        <Bell size={18} className={unreadCount > 0 ? "animate-pulse" : ""} />
        {unreadCount > 0 && <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 md:w-96 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl z-50 flex flex-col max-h-[80vh]">
          <div className="border-b border-neutral-100 bg-white px-4 pt-4 pb-0 flex flex-col gap-3 shrink-0">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5"><Bell size={16}/> Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadNotifs.length > 0 && (
                  <button onClick={markAllAsRead} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md">
                    <CheckSquare size={12}/> Read All
                  </button>
                )}
                {readNotifs.length > 0 && (
                  <button onClick={clearReadNotifications} title="Clear Read Notifications" className="p-1 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                    <Trash2 size={14}/>
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex gap-4 border-b border-transparent">
              <button onClick={() => setActiveTab('unread')} className={`pb-2 text-xs font-bold transition-colors relative ${activeTab === 'unread' ? 'text-indigo-600' : 'text-neutral-400 hover:text-neutral-600'}`}>
                Unread <span className="ml-1 bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-full text-[9px]">{unreadNotifs.length}</span>
                {activeTab === 'unread' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></span>}
              </button>
              <button onClick={() => setActiveTab('all')} className={`pb-2 text-xs font-bold transition-colors relative ${activeTab === 'all' ? 'text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'}`}>
                All
                {activeTab === 'all' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-neutral-900 rounded-t-full"></span>}
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 p-2 flex flex-col gap-1.5 bg-neutral-50/50">
            {incomingRequests.length > 0 && (
              <div className="mb-2">
                <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-2 py-1">Action Required</h4>
                {incomingRequests.map((req) => {
                  const ReqIcon = ICON_MAP[req.profiles.icon_name] || User
                  return (
                    <div key={req.id} className="relative flex flex-col rounded-xl bg-white border border-neutral-200 p-3 shadow-sm mb-1.5 group">
                      <div className="flex items-center gap-2 mb-3 pr-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-100" style={{ backgroundColor: req.profiles.bg_color }}><ReqIcon size={14} style={{ color: req.profiles.icon_color }} /></div>
                        <div className="flex-1 text-xs leading-snug">
                          <span className="font-bold text-neutral-900">{req.profiles.display_name}</span> has requested to join <span className="font-bold text-indigo-600">{req.projects.name}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {/* 🌟 ส่งชื่อโปรเจกต์ไปด้วย */}
                        <button onClick={() => handleAcceptRequest(req.id, req.project_id, req.user_id, req.projects.name)} className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors shadow-sm">Approve</button>
                        <button onClick={() => handleRejectRequest(req.id)} className="flex-[0.5] rounded-lg border border-neutral-200 bg-white py-1.5 text-xs font-bold text-neutral-600 hover:bg-neutral-50 transition-colors">Decline</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            
            {myRequests.map((req) => (
              <div key={req.id} className="group flex items-center justify-between rounded-xl px-3 py-2.5 bg-white border border-neutral-100 hover:border-neutral-200 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-neutral-600">Your request to join <b className="text-neutral-900">{req.projects?.name}</b></span>
                  {req.status === 'pending' && <span className="rounded-md bg-amber-50 border border-amber-200/50 px-2 py-0.5 text-[9px] font-bold text-amber-600">Pending</span>}
                  {req.status === 'approved' && <span className="rounded-md bg-emerald-50 border border-emerald-200/50 px-2 py-0.5 text-[9px] font-bold text-emerald-600">Approved</span>}
                  {req.status === 'rejected' && <span className="rounded-md bg-red-50 border border-red-200/50 px-2 py-0.5 text-[9px] font-bold text-red-600">Declined</span>}
                </div>
                {req.status !== 'pending' && <button onClick={() => handleClearRequest(req.id)} className="rounded-md p-1 text-neutral-300 opacity-0 transition-all hover:bg-neutral-100 hover:text-neutral-600 group-hover:opacity-100"><X size={12} /></button>}
              </div>
            ))}

            <div className="mt-1">
               {displayNotifs.length > 0 ? displayNotifs.map((n) => (
                <div 
                  key={n.id} 
                  onClick={() => handleNotificationClick(n)} 
                  className={`relative flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border mb-1.5 ${
                    n.is_read 
                      ? 'bg-transparent border-transparent hover:bg-white hover:border-neutral-200 hover:shadow-sm opacity-70 hover:opacity-100' 
                      : 'bg-white border-indigo-100 shadow-sm hover:border-indigo-300'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {n.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-500" /> : 
                     n.type === 'warning' ? <AlertCircle size={16} className="text-amber-500" /> : 
                     n.type === 'action'  ? <User size={16} className="text-blue-500" /> :
                     <Bell size={16} className="text-indigo-500" />}
                  </div>
                  <div className="flex-1 pr-6">
                    <h4 className={`text-[11px] font-bold mb-0.5 ${n.is_read ? 'text-neutral-600' : 'text-neutral-900'}`}>{n.title}</h4>
                    <p className={`text-[11px] leading-relaxed ${n.is_read ? 'text-neutral-400' : 'text-neutral-600'}`}>{n.message}</p>
                  </div>
                  {!n.is_read && <span className="absolute top-1/2 -translate-y-1/2 right-4 w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.6)]"></span>}
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-10 text-neutral-400">
                  {activeTab === 'unread' ? <MailOpen size={32} className="mb-3 opacity-20" /> : <Inbox size={32} className="mb-3 opacity-20" />}
                  <p className="text-xs font-bold text-neutral-500">You're all caught up!</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  )
}