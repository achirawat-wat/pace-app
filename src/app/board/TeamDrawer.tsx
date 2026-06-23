import { useState } from 'react'
import { User, Smile, Coffee, Gamepad2, Code, Zap, Users, X, ChevronDown, Trash2, Plus, Briefcase } from 'lucide-react'

const ICON_MAP: Record<string, any> = {
  user: User, smile: Smile, coffee: Coffee, gamepad: Gamepad2, code: Code, zap: Zap
}

const JOB_POSITIONS = ['Developer', 'UX/UI Designer', 'Marketing', 'Data Analyst', 'Project Manager', 'Other', 'Unassigned']

interface TeamDrawerProps {
  isOpen: boolean
  onClose: () => void
  teamMembers: any[]
  currentProfileId: string
  isAuthorizedToManage: boolean
  userRoleInProject: string | null
  onUpdateRole: (userId: string, newRole: string) => void
  onUpdatePosition: (userId: string, newPosition: string) => void
  onRemoveMember: (userId: string) => void
  activeProjectId: string | null
}

export default function TeamDrawer({
  isOpen, onClose, teamMembers, currentProfileId, isAuthorizedToManage, userRoleInProject, 
  onUpdateRole, onUpdatePosition, onRemoveMember, activeProjectId
}: TeamDrawerProps) {
  const [openRoleMenuId, setOpenRoleMenuId] = useState<string | null>(null)
  const [openPosMenuId, setOpenPosMenuId] = useState<string | null>(null) 
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  
  // 🌟 State สำหรับจัดการช่องพิมพ์ Position เอง (Other)
  const [customPosInputId, setCustomPosInputId] = useState<string | null>(null)
  const [customPosValue, setCustomPosValue] = useState('')

  return (
    <div className={`flex h-full flex-col border-neutral-200 bg-white transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'w-[340px] border-l' : 'w-0 border-l-0'}`}>
      <div className="flex h-full w-[340px] flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 p-5">
          <div className="flex items-center gap-2 font-semibold text-neutral-900">
            <Users size={18} /><h2>Project Members</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"><X size={18} /></button>
        </div>

        {/* Member List */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex flex-col gap-1">
            {teamMembers.map((member) => {
              const MemberIcon = ICON_MAP[member.icon_name] || User
              const isMe = member.id === currentProfileId
              const canManageThisUser = isAuthorizedToManage && !isMe && member.role !== 'owner' && !(userRoleInProject === 'manager' && member.role === 'manager')

              return (
                <div key={member.id} className="flex flex-col rounded-xl border border-transparent hover:border-neutral-100 hover:bg-neutral-50 transition-colors group p-2">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm mt-0.5" style={{ backgroundColor: member.bg_color }}>
                      <MemberIcon size={16} style={{ color: member.icon_color }} />
                    </div>
                    
                    <div className="flex flex-1 flex-col overflow-visible">
                      <span className="truncate text-sm font-medium text-neutral-900">
                        {member.display_name} {isMe && <span className="text-neutral-400 font-normal">(You)</span>}
                      </span>
                      
                      <div className="flex flex-col items-start gap-1 mt-1">
                        
                        {/* 1. ปุ่มเปลี่ยน Role (Manager / Member) */}
                        <div className="relative">
                          <button 
                            disabled={!canManageThisUser}
                            onClick={() => { 
                              setOpenRoleMenuId(openRoleMenuId === member.id ? null : member.id); 
                              setOpenPosMenuId(null); 
                              setCustomPosInputId(null);
                            }} 
                            className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors outline-none ${!canManageThisUser ? 'text-neutral-400 cursor-default' : openRoleMenuId === member.id ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-300 cursor-pointer'}`}
                          >
                            <span className="capitalize">{member.role}</span>
                            {canManageThisUser && <ChevronDown size={10} className={openRoleMenuId === member.id ? 'text-neutral-300' : 'text-neutral-400'} />}
                          </button>
                          {openRoleMenuId === member.id && (
                            <div className="absolute left-0 top-full mt-1 w-28 overflow-hidden rounded-xl border border-neutral-100 bg-white shadow-lg z-20">
                              <button onClick={() => { onUpdateRole(member.id, 'member'); setOpenRoleMenuId(null); }} className="w-full px-3 py-2 text-left text-[11px] font-medium hover:bg-neutral-50">Member</button>
                              <button onClick={() => { onUpdateRole(member.id, 'manager'); setOpenRoleMenuId(null); }} className="w-full px-3 py-2 text-left text-[11px] font-medium hover:bg-neutral-50">Manager</button>
                            </div>
                          )}
                        </div>

                        {/* 2. 🌟 ปุ่มเปลี่ยนสายงาน (Position) */}
                        <div className="relative">
                          <button 
                            disabled={!isAuthorizedToManage}
                            onClick={() => { 
                              setOpenPosMenuId(openPosMenuId === member.id ? null : member.id); 
                              setOpenRoleMenuId(null); 
                              setCustomPosInputId(null); // รีเซ็ตสถานะพิมพ์เองทุกครั้งที่เปิด/ปิดเมนู
                            }} 
                            className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors outline-none ${!isAuthorizedToManage ? 'text-indigo-500 bg-indigo-50/50 cursor-default' : openPosMenuId === member.id ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 cursor-pointer'}`}
                          >
                            <Briefcase size={10} />
                            <span>{member.position || 'Unassigned'}</span>
                            {isAuthorizedToManage && <ChevronDown size={10} className={openPosMenuId === member.id ? 'text-indigo-300' : 'text-indigo-400'} />}
                          </button>
                          
                          {openPosMenuId === member.id && (
                            <div className="absolute left-0 top-full mt-1 w-44 overflow-hidden rounded-xl border border-neutral-100 bg-white shadow-lg z-30">
                              
                              {/* 🌟 ถ้ากด Other ให้แสดงช่องกรอกข้อความแทนลิสต์ */}
                              {customPosInputId === member.id ? (
                                <div className="p-2 bg-neutral-50/50">
                                  <input 
                                    type="text" 
                                    autoFocus
                                    placeholder="Type custom position..." 
                                    value={customPosValue}
                                    onChange={(e) => setCustomPosValue(e.target.value)}
                                    className="w-full p-1.5 text-[11px] border border-neutral-200 rounded-md outline-none focus:border-indigo-400 mb-1.5 bg-white"
                                  />
                                  <div className="flex gap-1.5">
                                    <button onClick={() => setCustomPosInputId(null)} className="flex-1 py-1 text-[10px] font-medium text-neutral-500 bg-white border border-neutral-200 rounded-md hover:bg-neutral-50">Cancel</button>
                                    <button 
                                      onClick={() => {
                                        if (customPosValue.trim()) {
                                          onUpdatePosition(member.id, customPosValue.trim());
                                          setOpenPosMenuId(null);
                                          setCustomPosInputId(null);
                                        }
                                      }} 
                                      disabled={!customPosValue.trim()}
                                      className="flex-1 py-1 text-[10px] font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                JOB_POSITIONS.map(pos => (
                                  <button 
                                    key={pos} 
                                    onClick={() => { 
                                      if (pos === 'Other') {
                                        setCustomPosInputId(member.id);
                                        setCustomPosValue('');
                                      } else {
                                        onUpdatePosition(member.id, pos); 
                                        setOpenPosMenuId(null); 
                                      }
                                    }} 
                                    className={`w-full px-3 py-2 text-left text-[11px] font-medium hover:bg-indigo-50 transition-colors ${member.position === pos ? 'bg-indigo-50 text-indigo-600' : 'text-neutral-600'}`}
                                  >
                                    {pos}
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>

                      </div>
                    </div>

                    {/* ปุ่มถังขยะ */}
                    {canManageThisUser && confirmDeleteId !== member.id && (
                      <button onClick={() => { setConfirmDeleteId(member.id); setOpenRoleMenuId(null); setOpenPosMenuId(null); }} className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {confirmDeleteId === member.id && (
                    <div className="mt-3 flex items-center justify-between rounded-lg border border-red-100 bg-red-50/50 p-2 pl-3">
                      <span className="text-[11px] font-medium text-red-600">Remove from project?</span>
                      <div className="flex gap-1.5">
                        <button onClick={() => setConfirmDeleteId(null)} className="rounded-md bg-white border border-neutral-200 px-2.5 py-1 text-[10px] font-medium text-neutral-600 hover:bg-neutral-50">Cancel</button>
                        <button onClick={() => { onRemoveMember(member.id); setConfirmDeleteId(null); }} className="rounded-md bg-red-500 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-red-600 shadow-sm">Yes</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="border-t border-neutral-100 p-4">
          <button 
            onClick={() => { window.dispatchEvent(new CustomEvent('open-invite-modal', { detail: activeProjectId })); }} 
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:border-neutral-900 hover:text-neutral-900"
          >
            <Plus size={16} /><span>Invite Member</span>
          </button>
        </div>

      </div>
    </div>
  )
}