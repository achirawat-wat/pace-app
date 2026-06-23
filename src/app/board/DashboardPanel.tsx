import { Zap, Clock, CheckCircle2, Calendar, ChevronRight, AlertTriangle, Briefcase, TrendingUp } from 'lucide-react'

interface DashboardPanelProps {
  tasks: any[]
  profileId: string
  onTaskClick: (task: any) => void
}

export default function DashboardPanel({ tasks, profileId, onTaskClick }: DashboardPanelProps) {
  const isCompleted = (t: any) => t.status === 'Completed' || t.status === 'Done'
  const isPending = (t: any) => t.status === 'Pending Acceptance' || t.status === 'Negotiating' || t.status === 'Pending Review' || t.status === 'Draft' || t.status === 'Blocked'
  const isMyTask = (t: any) => t.task_assignees?.some((a: any) => a.user_id === profileId)

  // จัดกลุ่มงานทั้งหมดของเรา
  const myTasks = tasks.filter(t => isMyTask(t))
  const myCompletedTasks = myTasks.filter(t => isCompleted(t))
  const myActiveTasks = myTasks.filter(t => !isPending(t) && !isCompleted(t)) 
  const myPendingTasks = myTasks.filter(t => isPending(t) && t.status !== 'Blocked')
  const myBlockedTasks = myTasks.filter(t => t.status === 'Blocked')

  // คำนวณเปอร์เซ็นต์ความคืบหน้า (Progress Bar)
  const totalMyTasks = myTasks.length
  const percentCompleted = totalMyTasks > 0 ? Math.round((myCompletedTasks.length / totalMyTasks) * 100) : 0
  const percentActive = totalMyTasks > 0 ? Math.round((myActiveTasks.length / totalMyTasks) * 100) : 0
  const percentPending = totalMyTasks > 0 ? Math.round((myPendingTasks.length / totalMyTasks) * 100) : 0
  const percentBlocked = totalMyTasks > 0 ? Math.round((myBlockedTasks.length / totalMyTasks) * 100) : 0

  // หางานที่เลยกำหนด (Overdue)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const overdueTasks = myActiveTasks.filter(t => t.expected_deadline && new Date(t.expected_deadline) < today)

  // จัดเรียง Timeline
  const timelineTasks = [...myBlockedTasks, ...myPendingTasks, ...myActiveTasks].sort((a, b) => {
    const dateA = a.expected_deadline ? new Date(a.expected_deadline).getTime() : Infinity
    const dateB = b.expected_deadline ? new Date(b.expected_deadline).getTime() : Infinity
    return dateA - dateB
  })

  // ฟังก์ชันคำนวณวันคงเหลือ
  const getDaysLeft = (deadlineStr: string) => {
    if (!deadlineStr) return null
    const deadline = new Date(deadlineStr)
    const diffTime = deadline.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-y-auto no-scrollbar pb-6">
      
      {/* 🌟 Section 1: Overview Stats & Progress */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        <div className="bg-neutral-900 text-white rounded-2xl p-5 shadow-sm md:col-span-2 relative overflow-hidden flex flex-col justify-between">
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1 opacity-80">
                <TrendingUp size={16} />
                <h3 className="text-xs font-semibold uppercase tracking-wider">Overall Progress</h3>
              </div>
              <p className="text-3xl font-bold mt-2">{percentCompleted}% <span className="text-sm font-medium opacity-60">Completed</span></p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-medium opacity-60 uppercase tracking-wider block">Total Tasks</span>
              <span className="text-xl font-bold">{totalMyTasks}</span>
            </div>
          </div>

          <div className="relative z-10 mt-6">
            <div className="flex h-3 w-full rounded-full bg-neutral-800 overflow-hidden">
              <div style={{ width: `${percentCompleted}%` }} className="bg-emerald-500 transition-all duration-1000"></div>
              <div style={{ width: `${percentActive}%` }} className="bg-indigo-500 transition-all duration-1000"></div>
              <div style={{ width: `${percentPending}%` }} className="bg-amber-500 transition-all duration-1000"></div>
              <div style={{ width: `${percentBlocked}%` }} className="bg-red-500 transition-all duration-1000"></div>
            </div>
            <div className="flex justify-between mt-3 text-[10px] font-medium opacity-70">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Done</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> Active</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Pending</div>
              {percentBlocked > 0 && <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span> Blocked</div>}
            </div>
          </div>
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
        </div>

        <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-3 text-indigo-600">
            <Zap size={18} />
            <h3 className="text-xs font-bold uppercase tracking-wider">In Progress</h3>
          </div>
          <p className="text-4xl font-black text-neutral-900">{myActiveTasks.length}</p>
          <p className="text-[11px] font-medium text-neutral-500 mt-2">กำลังดำเนินการอยู่ตอนนี้</p>
        </div>

        <div className={`border rounded-2xl p-5 shadow-sm flex flex-col justify-center transition-colors ${overdueTasks.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-amber-100'}`}>
          <div className={`flex items-center gap-2 mb-3 ${overdueTasks.length > 0 ? 'text-red-600' : 'text-amber-500'}`}>
            {overdueTasks.length > 0 ? <AlertTriangle size={18} /> : <Clock size={18} />}
            <h3 className="text-xs font-bold uppercase tracking-wider">{overdueTasks.length > 0 ? 'Overdue Tasks' : 'Pending Actions'}</h3>
          </div>
          <p className="text-4xl font-black text-neutral-900">{overdueTasks.length > 0 ? overdueTasks.length : myPendingTasks.length}</p>
          <p className="text-[11px] font-medium text-neutral-500 mt-2">
            {overdueTasks.length > 0 ? <span className="text-red-600 font-bold">รีบเคลียร์ด่วน เลยกำหนดแล้ว!</span> : 'รอการตอบรับหรือรอตรวจ'}
          </p>
        </div>
      </div>

      {/* 🌟 Section 2: Task Timeline & Upcoming */}
      <div className="flex-1 bg-white border border-neutral-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
          <div className="flex items-center gap-2 text-neutral-900">
            <Briefcase size={18} className="text-indigo-600" />
            <h3 className="text-sm font-bold">My Task Timeline</h3>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-white border border-neutral-200 px-2.5 py-1 rounded-md text-neutral-500 shadow-sm">
            {timelineTasks.length} Tasks Remaining
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {timelineTasks.length > 0 ? timelineTasks.map(task => {
            const daysLeft = getDaysLeft(task.expected_deadline)
            const isOverdue = daysLeft !== null && daysLeft < 0
            const isDueSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 2
            
            return (
              <div 
                key={task.id} 
                onClick={() => onTaskClick(task)}
                className="flex items-center justify-between p-4 rounded-xl border border-neutral-100 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group bg-white"
              >
                <div className="flex items-start gap-4">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${
                    task.status === 'Blocked' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                    isPending(task) ? 'bg-amber-400' : 'bg-indigo-500'
                  }`}></span>
                  <div className="flex flex-col">
                    <h4 className="text-[13px] font-bold text-neutral-900 leading-snug">{task.title}</h4>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[10px] font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-md">
                        {task.projects?.name || 'No Project'}
                      </span>
                      
                      {task.status !== 'In Progress' && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                          task.status === 'Blocked' ? 'bg-red-100 text-red-700' :
                          task.status === 'Pending Review' ? 'bg-purple-100 text-purple-700' :
                          task.status === 'Negotiating' ? 'bg-orange-100 text-orange-700' : 
                          'bg-amber-50 text-amber-600'
                        }`}>
                          {task.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 shrink-0 pl-2">
                  {task.expected_deadline && (
                    <div className={`flex flex-col items-end`}>
                      <span className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-md border ${
                        isOverdue ? 'bg-red-50 text-red-600 border-red-200' :
                        isDueSoon ? 'bg-orange-50 text-orange-600 border-orange-200' :
                        'bg-white text-neutral-600 border-neutral-200'
                      }`}>
                        {isOverdue && <AlertTriangle size={12} />}
                        {!isOverdue && <Calendar size={12} className={isDueSoon ? 'text-orange-500' : 'text-neutral-400'} />}
                        {new Date(task.expected_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                      {daysLeft !== null && !isPending(task) && (
                        <span className={`text-[9px] font-bold mt-1 uppercase tracking-wider ${isOverdue ? 'text-red-500' : isDueSoon ? 'text-orange-500' : 'text-neutral-400'}`}>
                          {isOverdue ? `${Math.abs(daysLeft)} days late` : daysLeft === 0 ? 'Due Today' : `${daysLeft} days left`}
                        </span>
                      )}
                    </div>
                  )}
                  <ChevronRight size={16} className="text-neutral-300 group-hover:text-indigo-500 transition-colors" />
                </div>
              </div>
            )
          }) : (
            <div className="h-full flex flex-col items-center justify-center text-neutral-400 gap-3 py-10">
              <div className="w-16 h-16 rounded-full bg-neutral-50 flex items-center justify-center">
                <CheckCircle2 size={24} className="text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-neutral-700">You're all caught up! 🎉</p>
                <p className="text-[11px] text-neutral-500 mt-1">ไม่มีงานค้างอยู่ในตอนนี้ ไปพักผ่อนได้เลยครับ</p>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}