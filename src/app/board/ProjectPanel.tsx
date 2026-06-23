import { Inbox, ListTodo } from 'lucide-react'
import TaskCard from './taskcard'

interface ProjectPanelProps {
  tasks: any[]
  profileId: string
  isAuthorizedToManage: boolean
  onTaskClick: (task: any) => void
}

export default function ProjectPanel({ tasks, profileId, isAuthorizedToManage, onTaskClick }: ProjectPanelProps) {
  const isCompleted = (t: any) => t.status === 'Completed' || t.status === 'Done'
  // เพิ่มคำว่า 'Pending Review' เข้าไป
const isPending = (t: any) => t.status === 'Pending Acceptance' || t.status === 'Negotiating' || t.status === 'Pending Review' || t.status === 'Draft'
  const isMyTask = (t: any) => t.task_assignees?.some((a: any) => a.user_id === profileId)

  // 1. Pending Tasks สำหรับ Manager (เห็นงาน Pending ทั้งหมดในโปรเจกต์)
  const pendingTasks = tasks.filter(t => isPending(t) && !isCompleted(t))
  
  // 🌟 2. งานของเรา (ดึงงานที่เรารอ Accept/Negotiating มารวมกับงานที่ Active)
  const myPendingTasks = tasks.filter(t => isPending(t) && !isCompleted(t) && isMyTask(t))
  const myActiveTasks = tasks.filter(t => !isPending(t) && !isCompleted(t) && isMyTask(t))
  
  // เอาคิวงานที่ต้องรีบตอบรับ (Pending) วางไว้บนสุด ตามด้วยงานปกติ
  const displayMyTasks = [...myPendingTasks, ...myActiveTasks]             

  // 3. งานคนอื่นในโปรเจกต์ (โชว์เฉพาะงานที่ Active แล้ว เพื่อไม่ให้รก)
  const otherActiveTasks = tasks.filter(t => !isPending(t) && !isCompleted(t) && !isMyTask(t))           
  
  // 4. งานที่เสร็จแล้ว
  const completedTasks = tasks.filter(t => isCompleted(t))

  return (
    <div className="flex-1 flex gap-4 overflow-hidden">
      
      {/* 🌟 1. ช่อง Pending / Review (เฉพาะ Owner/Manager) */}
      {isAuthorizedToManage && (
        <div className="flex-[3] flex flex-col bg-amber-50/40 rounded-2xl border border-amber-100/60 p-4 shrink-0">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Inbox size={14} className="text-amber-500" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Pending / Review</h3>
              <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{pendingTasks.length}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 no-scrollbar">
            {pendingTasks.length > 0 ? pendingTasks.map(task => (
              <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
            )) : (
              <div className="h-full flex flex-col items-center justify-center text-amber-400/60">
                <p className="text-xs">No pending tasks</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🌟 2. ช่อง My Tasks (ลูกทีมจะเห็นงานใหม่ที่รอรับในช่องนี้เลย!) */}
      <div className="flex-[5] flex flex-col bg-neutral-50/50 rounded-2xl border border-neutral-200/60 p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-600">My Tasks</h3>
            <span className="bg-neutral-200 text-neutral-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{displayMyTasks.length}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 no-scrollbar">
          {displayMyTasks.length > 0 ? displayMyTasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          )) : (
            <div className="h-full flex flex-col items-center justify-center text-neutral-400 border-2 border-dashed border-neutral-200 rounded-xl">
              <ListTodo size={24} className="mb-2 opacity-20" />
              <p className="text-xs">No tasks for you yet</p>
            </div>
          )}
        </div>
      </div>

      {/* 🌟 3. ช่อง Project Tasks */}
      <div className={`${isAuthorizedToManage ? 'flex-[3]' : 'flex-[4]'} flex flex-col bg-neutral-50/50 rounded-2xl border border-neutral-200/60 p-4`}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Project Tasks</h3>
            <span className="bg-neutral-200 text-neutral-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{otherActiveTasks.length}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 no-scrollbar">
          {otherActiveTasks.length > 0 ? otherActiveTasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          )) : (
            <div className="h-full flex flex-col items-center justify-center text-neutral-400">
              <p className="text-xs">No active tasks</p>
            </div>
          )}
        </div>
      </div>

      {/* 🌟 4. ช่อง History & Done */}
      <div className={`${isAuthorizedToManage ? 'flex-[2]' : 'flex-[3]'} flex flex-col bg-neutral-50/30 rounded-2xl border border-neutral-100 p-4 opacity-80 hover:opacity-100 transition-opacity`}>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">History & Done</h3>
          <span className="bg-neutral-100 text-neutral-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{completedTasks.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 no-scrollbar">
          {completedTasks.length > 0 ? completedTasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          )) : (
            <div className="h-full flex items-center justify-center text-neutral-300">
              <p className="text-xs text-center px-4">Completed tasks will appear here</p>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}