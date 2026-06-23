'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { LayoutGrid, Plus, Loader2, Copy, Check, Users, Search, UserPlus, LogIn, Sparkles, Lock } from 'lucide-react'

interface Project {
  id: string
  name: string
  description?: string
  invite_code: string
}

interface Profile {
  id: string
  display_name: string
  email?: string
}

interface SidebarProps {
  onSelectProject: (id: string | null) => void
  triggerRefresh?: number
  openInviteModalExternally?: number
}

export default function Sidebar({ onSelectProject, triggerRefresh, openInviteModalExternally }: SidebarProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  
  // Modal States
  const [isCreating, setIsCreating] = useState(false)
  const [modalTab, setModalTab] = useState<'create' | 'join'>('create')
  const [currentStep, setCurrentStep] = useState(1) 
  
  // Create Form States
  const [projectName, setProjectName] = useState('')
  const [projectDesc, setProjectDesc] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [newProjectId, setNewProjectId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  // Join Form States
  const [joinCode, setJoinCode] = useState('')
  const [joinMessage, setJoinMessage] = useState('')

  // Search & Invite States
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [suggestedUsers, setSuggestedUsers] = useState<Profile[]>([]) 
  const [invitedUsers, setInvitedUsers] = useState<Profile[]>([]) 
  const [isSearching, setIsSearching] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  const fetchProjects = async () => {
    if (!currentUserId) return
    const { data: myMemberships } = await supabase.from('project_members').select('project_id').eq('user_id', currentUserId)
    if (myMemberships) {
      const projectIds = myMemberships.map(m => m.project_id)
      const { data, error } = await supabase.from('projects').select('*').in('id', projectIds).order('created_at', { ascending: true })
      if (data && !error) setProjects(data)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [triggerRefresh, currentUserId])

  useEffect(() => {
    if (!currentUserId) return
    const channel = supabase.channel('sidebar_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_members', filter: `user_id=eq.${currentUserId}` }, () => {
        fetchProjects() 
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [currentUserId])

  const fetchSuggestions = async () => {
    if (!currentUserId) return
    const { data: myProjects } = await supabase.from('project_members').select('project_id').eq('user_id', currentUserId)
    if (myProjects && myProjects.length > 0) {
      const pIds = myProjects.map(p => p.project_id)
      const { data: coWorkers } = await supabase.from('project_members').select('user_id').in('project_id', pIds).neq('user_id', currentUserId)
      if (coWorkers && coWorkers.length > 0) {
        const uniqueUserIds = Array.from(new Set(coWorkers.map(c => c.user_id)))
        const { data: profiles } = await supabase.from('profiles').select('id, display_name, email').in('id', uniqueUserIds).limit(4)
        if (profiles) setSuggestedUsers(profiles)
      }
    }
  }

  useEffect(() => {
    if (currentStep === 2 && isCreating) {
      fetchSuggestions()
    }
  }, [currentStep, isCreating])

  useEffect(() => {
    const handleOpenInviteViaEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const projectId = customEvent.detail;
      setNewProjectId(projectId);
      setGeneratedCode(projects.find(p => p.id === projectId)?.invite_code || '');
      setModalTab('create');
      setCurrentStep(2);
      setIsCreating(true);
    };
    window.addEventListener('open-invite-modal', handleOpenInviteViaEvent);
    return () => window.removeEventListener('open-invite-modal', handleOpenInviteViaEvent);
  }, [projects]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }

    const searchUsers = async () => {
      setIsSearching(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, email')
        .neq('id', currentUserId) 
        .or(`display_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`) 
        .limit(5)

      if (data && !error) setSearchResults(data)
      setIsSearching(false)
    }

    const delayDebounce = setTimeout(() => searchUsers(), 300)
    return () => clearTimeout(delayDebounce)
  }, [searchQuery, currentUserId])

  const generateMeetCode = (name: string) => {
    const prefix = name.substring(0, 3).toUpperCase().padEnd(3, 'X').replace(/[^A-Z0-9]/g, 'X')
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const part1 = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    const part2 = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    return `${prefix}-${part1}-${part2}`
  }

  const handleNextStep = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectName.trim() || !currentUserId) return
    setLoading(true)

    const code = generateMeetCode(projectName)
    const { data, error } = await supabase.from('projects').insert([{ name: projectName, description: projectDesc, invite_code: code, created_by: currentUserId }]).select()

    if (!error && data) {
      const createdProject = data[0]
      setNewProjectId(createdProject.id)
      await supabase.from('project_members').insert([{ project_id: createdProject.id, user_id: currentUserId, role: 'owner' }])
      
      setGeneratedCode(code)
      setCurrentStep(2)
      fetchProjects()
    }
    setLoading(false)
  }

  const handleJoinProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim() || !currentUserId) return
    setLoading(true)
    setJoinMessage('')

    const { data: targetProject } = await supabase.from('projects').select('id, name').eq('invite_code', joinCode).single()
    if (!targetProject) {
      setJoinMessage('❌ ไม่พบรหัสโปรเจกต์นี้')
      setLoading(false)
      return
    }

    const { data: existingMember } = await supabase.from('project_members').select('*').eq('project_id', targetProject.id).eq('user_id', currentUserId).maybeSingle()
    if (existingMember) {
      setJoinMessage('⚠️ คุณเป็นสมาชิกในโปรเจกต์นี้อยู่แล้ว')
      setLoading(false)
      return
    }

    const { error } = await supabase.from('project_join_requests').insert([{ project_id: targetProject.id, user_id: currentUserId, status: 'pending' }])

    if (!error) {
      setJoinMessage('✅ ส่งคำขอเข้าร่วมสำเร็จ! รอผู้ดูแลอนุมัติ')
      setJoinCode('')
      window.dispatchEvent(new CustomEvent('refresh-notifications'))
    } else {
      setJoinMessage('⚠️ คุณได้ส่งคำขอไปแล้ว หรือเกิดข้อผิดพลาด')
    }
    setLoading(false)
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleInvite = async (user?: Profile) => {
    if (!newProjectId) return
    setLoading(true)
    setInviteMessage('')

    const inviteMemberToDb = async (targetUser: Profile) => {
      if (invitedUsers.find(u => u.id === targetUser.id)) {
         setInviteMessage(`⚠️ ${targetUser.display_name} อยู่ในรายชื่อที่เชิญไปแล้ว`)
         return
      }

      const { error } = await supabase.from('project_members').insert([{ project_id: newProjectId, user_id: targetUser.id, role: 'member' }])
      if (!error) {
        setInviteMessage(`✅ เพิ่ม ${targetUser.display_name} สำเร็จ!`)
        setInvitedUsers(prev => [...prev, targetUser]) 
      } else {
        setInviteMessage('❌ มีคนนี้ในทีมอยู่แล้ว หรือเกิดข้อผิดพลาด')
      }
      setSearchQuery('')
      setSearchResults([])
    }

    if (user) {
      await inviteMemberToDb(user)
    } else if (searchQuery.includes('@')) {
      
      // 🌟 TEMPORARILY DISABLED FOR GIT REVIEW: Email Invite Logic
      /* 
      const { data: existingUser } = await supabase.from('profiles').select('id, display_name, email').eq('email', searchQuery).maybeSingle()
      if (existingUser) {
        await inviteMemberToDb(existingUser)
      } else {
        try {
          const res = await fetch('/api/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: searchQuery, projectName, inviteCode: generatedCode })
          })
          if (res.ok) {
            setInviteMessage(`✉️ ส่งอีเมลคำเชิญไปที่ ${searchQuery} สำเร็จ!`)
            setInvitedUsers(prev => [...prev, { id: searchQuery, display_name: searchQuery, email: searchQuery }])
            setSearchQuery('')
          } else {
            setInviteMessage('❌ ไม่สามารถส่งอีเมลได้ ลองใหม่อีกครั้ง')
          }
        } catch (err) {
          setInviteMessage('❌ เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่')
        }
      }
      */
      
      // แสดงข้อความแทนการยิง API
      setInviteMessage('⚠️ การเชิญผ่านอีเมลถูกปิดใช้งานชั่วคราว (อ่านเหตุผลด้านล่าง)')
    }
    setLoading(false)
  }

  const handleSelect = (id: string | null) => {
    setActiveId(id)
    onSelectProject(id)
  }

  const handleCloseModal = () => {
    setIsCreating(false)
    setCurrentStep(1)
    setModalTab('create')
    setProjectName('')
    setProjectDesc('')
    setGeneratedCode('')
    setSearchQuery('')
    setInviteMessage('')
    setSearchResults([])
    setJoinCode('')
    setJoinMessage('')
    setInvitedUsers([]) 
    if (newProjectId) handleSelect(newProjectId)
    setNewProjectId(null)
  }

  return (
    <div className="flex h-screen w-20 flex-col items-center border-r border-neutral-200 bg-neutral-50 py-4">
      <div className="group relative flex w-full justify-center">
        <button
          onClick={() => handleSelect(null)}
          className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-200 ${
            activeId === null ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-500 shadow-sm hover:bg-neutral-100 hover:text-neutral-900'
          }`}
        >
          <LayoutGrid size={20} />
        </button>
      </div>

      <div className="my-3 h-[2px] w-8 rounded-full bg-neutral-200" />

      <div className="flex w-full flex-1 flex-col items-center gap-3 overflow-y-auto no-scrollbar">
        {projects.map((project) => (
          <div key={project.id} className="group relative flex w-full justify-center">
            {activeId === project.id && (
              <div className="absolute -left-1 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-neutral-900" />
            )}
            <button
              onClick={() => handleSelect(project.id)}
              title={`${project.name}\n${project.description || ''}`}
              className={`flex h-12 w-12 items-center justify-center rounded-xl font-semibold uppercase transition-colors duration-200 ${
                activeId === project.id ? 'bg-neutral-900 text-white shadow-sm' : 'bg-white text-neutral-600 shadow-sm hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              {project.name.substring(0, 2)}
            </button>
          </div>
        ))}

        <button
          onClick={() => { setIsCreating(true); setModalTab('create'); }}
          className="mt-2 flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-transparent text-neutral-400 transition-colors duration-200 hover:border-neutral-900 hover:text-neutral-900"
        >
          <Plus size={22} />
        </button>
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-neutral-100 animate-in fade-in zoom-in-95 duration-150">
            
            {currentStep === 1 && (
              <div className="flex gap-2 p-1 bg-neutral-100 rounded-xl mb-6">
                <button 
                  onClick={() => { setModalTab('create'); setJoinMessage(''); }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${modalTab === 'create' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                >
                  Create New Project
                </button>
                <button 
                  onClick={() => setModalTab('join')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${modalTab === 'join' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                >
                  Join with Code
                </button>
              </div>
            )}

            {modalTab === 'create' && currentStep === 1 && (
              <form onSubmit={handleNextStep} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-500">Project Name</label>
                  <input
                    type="text" required placeholder="e.g. pace-app" value={projectName} onChange={(e) => setProjectName(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-900 bg-neutral-50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-500">Description (Optional)</label>
                  <textarea
                    placeholder="อธิบายรายละเอียดโปรเจกต์นี้..." value={projectDesc} onChange={(e) => setProjectDesc(e.target.value)} rows={3}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-900 bg-neutral-50 resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={handleCloseModal} className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-100">Cancel</button>
                  <button type="submit" disabled={loading || !projectName.trim()} className="flex items-center justify-center rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : 'Next'}
                  </button>
                </div>
              </form>
            )}

            {modalTab === 'join' && currentStep === 1 && (
              <form onSubmit={handleJoinProject} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-500">Project Invite Code</label>
                  <div className="relative">
                    <LogIn size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text" required placeholder="e.g. PAC-X9K-2P4" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      className="w-full rounded-lg border border-neutral-200 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-neutral-900 bg-neutral-50 font-mono tracking-wider"
                    />
                  </div>
                </div>
                {joinMessage && (
                  <p className={`text-xs font-medium mt-2 ${joinMessage.includes('✅') ? 'text-emerald-600' : 'text-amber-600'}`}>{joinMessage}</p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={handleCloseModal} className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-100">Cancel</button>
                  <button type="submit" disabled={loading || !joinCode.trim()} className="flex items-center justify-center rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : 'Request to Join'}
                  </button>
                </div>
              </form>
            )}

            {modalTab === 'create' && currentStep === 2 && (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center gap-2 text-neutral-900">
                    <Users size={18} />
                    <h2 className="text-lg font-semibold">Invite Team Members</h2>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">โปรเจกต์ <span className="font-medium text-neutral-700">"{projectName || projects.find(p => p.id === newProjectId)?.name}"</span> สร้างเสร็จแล้ว</p>
                </div>

                <div className="rounded-xl bg-neutral-50 p-4 border border-neutral-200/60">
                  <span className="text-xs font-medium text-neutral-400 block mb-1.5">Project Invite Code</span>
                  <div className="flex items-center justify-between bg-white rounded-lg border border-neutral-200 p-2.5 shadow-sm">
                    <span className="font-mono text-base font-semibold tracking-wider text-neutral-800 px-1">{generatedCode}</span>
                    <button onClick={handleCopyCode} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors border border-neutral-100 hover:bg-neutral-50">
                      {copied ? <><Check size={14} className="text-green-600" /><span className="text-green-600">Copied!</span></> : <><Copy size={14} className="text-neutral-500" /><span className="text-neutral-600">Copy</span></>}
                    </button>
                  </div>
                </div>

                <div className="space-y-2 relative">
                  <label className="text-xs font-medium text-neutral-500">Search by Name</label>
                  
                  {/* 🌟 Notice box แจ้งเตือนการปิด Email Invite */}
                  <div className="mb-2 p-3 bg-amber-50/50 rounded-xl border border-amber-200/60 text-amber-700">
                    <p className="text-[10px] font-medium leading-relaxed flex items-start gap-1.5">
                      <Lock size={12} className="shrink-0 mt-0.5" />
                      <span><b>Email Invite Disabled:</b> การส่งอีเมลเชิญถูกระงับชั่วคราว เนื่องจากข้อจำกัดของระบบ SMTP ที่ต้องเชื่อมต่อ Custom Domain ในระดับ Production (ค้นหาและเชิญได้เฉพาะคนในระบบเท่านั้น)</span>
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input type="text" placeholder="เช่น Mintra (ปิดค้นหาอีเมลชั่วคราว)" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full rounded-lg border border-neutral-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-neutral-900 bg-neutral-50" />
                    </div>
                    <button type="button" onClick={() => handleInvite()} disabled={loading || (!searchQuery.includes('@') && searchResults.length === 0)} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-40">
                      {loading && searchQuery.includes('@') ? <Loader2 size={16} className="animate-spin" /> : 'Invite'}
                    </button>
                  </div>

                  {searchQuery.length >= 2 && !searchQuery.includes('@') && (
                    <div className="absolute top-full mt-1 w-full bg-white border border-neutral-100 rounded-lg shadow-lg z-10 overflow-hidden">
                      {isSearching ? (
                        <div className="p-3 text-xs text-neutral-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> ค้นหา...</div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map(user => (
                          <button key={user.id} type="button" onClick={() => handleInvite(user)} className="w-full text-left px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 flex items-center justify-between transition-colors">
                            <div className="flex flex-col">
                              <span className="font-medium text-neutral-900">{user.display_name}</span>
                              {user.email && <span className="text-[10px] text-neutral-400">{user.email}</span>}
                            </div>
                            <UserPlus size={16} className="text-neutral-400" />
                          </button>
                        ))
                      ) : (<div className="p-3 text-xs text-neutral-500">ไม่พบชื่อนี้ในระบบ (การเชิญผ่านอีเมลถูกปิดชั่วคราว)</div>)}
                    </div>
                  )}
                  {inviteMessage && <p className={`text-xs font-medium mt-2 ${inviteMessage.includes('⚠️') ? 'text-amber-600' : inviteMessage.includes('❌') ? 'text-red-600' : 'text-emerald-600'}`}>{inviteMessage}</p>}
                </div>

                {invitedUsers.length > 0 && (
                  <div className="mt-2">
                    <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-2">Added Members</span>
                    <div className="flex flex-wrap gap-2">
                      {invitedUsers.map(user => (
                        <span key={user.id} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 border border-neutral-200/60">
                          {user.display_name} <Check size={12} className="text-emerald-600" />
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {suggestedUsers.length > 0 && searchQuery.length === 0 && (
                  <div className="pt-2 border-t border-neutral-100">
                    <div className="flex items-center gap-1.5 mb-2 text-neutral-400">
                      <Sparkles size={14} />
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Suggested from past projects</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {suggestedUsers.filter(u => !invitedUsers.find(i => i.id === u.id)).map(user => (
                        <button
                          key={user.id}
                          onClick={() => handleInvite(user)}
                          className="flex items-center justify-between rounded-lg border border-neutral-200 p-2 text-left transition-colors hover:border-neutral-400 hover:bg-neutral-50 group"
                        >
                          <div className="flex flex-col overflow-hidden pr-2">
                            <span className="truncate text-xs font-medium text-neutral-800">{user.display_name}</span>
                          </div>
                          <Plus size={14} className="text-neutral-400 group-hover:text-neutral-900 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4 mt-4 border-t border-neutral-100">
                  <button type="button" onClick={handleCloseModal} className="rounded-lg bg-neutral-100 hover:bg-neutral-200/80 px-6 py-2.5 text-sm font-medium text-neutral-800 transition-colors w-full sm:w-auto text-center">Done & Start Working</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}