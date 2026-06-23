import { User, Smile, Coffee, Gamepad2, Code, Zap, Calendar, ChevronRight, AlertTriangle } from 'lucide-react'

const ICON_MAP: Record<string, any> = {
  user: User, smile: Smile, coffee: Coffee, gamepad: Gamepad2, code: Code, zap: Zap
}

export default function TaskCard({ task, onClick }: { task: any, onClick?: () => void }) {
  
  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'Pending Acceptance': 
        return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'Negotiating': 
        return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'In Progress': 
        return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'Pending Review': 
        return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'Blocked': 
        return 'bg-red-500 text-white border-red-600 shadow-sm animate-pulse'
      case 'Completed': 
        return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      default: 
        return 'bg-neutral-100 text-neutral-600 border-neutral-200'
    }
  }

  return (
    // 🌟 เอา flex-col กับ h-full ออก เพื่อให้การ์ดไม่ยืดทะลุจอ
    <div onClick={onClick} className="bg-white p-4 rounded-xl border border-neutral-200 hover:border-neutral-300 hover:shadow-md transition-all shadow-sm cursor-pointer group w-full">
      
      <div className="flex justify-between items-start mb-3 gap-2">
        {/* 🌟 เพิ่มขนาดป้าย Status เป็น text-[11px] */}
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md border flex items-center gap-1.5 shrink-0 ${getStatusStyles(task.status)}`}>
          {task.status === 'Blocked' && <AlertTriangle size={12} />}
          {task.status || 'Draft'}
        </span>
        
        {/* 🌟 เพิ่มขนาดป้ายวันที่ เป็น text-[11px] */}
        {task.expected_deadline && (
          <span className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md shrink-0 ${
            new Date(task.expected_deadline) < new Date() && task.status !== 'Completed' 
              ? 'text-red-600 bg-red-50' 
              : 'text-neutral-500 bg-neutral-50'
          }`}>
            <Calendar size={12} />
            {new Date(task.expected_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>

      {/* 🌟 เพิ่มขนาดชื่องานจาก text-sm (14px) เป็น text-base (16px) */}
      <h4 className="text-base font-bold text-neutral-900 mb-3 leading-snug line-clamp-2">{task.title}</h4>
      
      <div className="flex justify-between items-center mt-2 pt-3 border-t border-neutral-100">
        <div className="flex -space-x-1.5">
          {task.task_assignees?.length > 0 ? (
            task.task_assignees.map((a: any) => {
              const AssigneeIcon = ICON_MAP[a.profiles?.icon_name] || User
              return (
                // 🌟 ขยายขนาด Avatar คนรับงานจาก w-6 เป็น w-7
                <div key={a.user_id} title={a.profiles?.display_name} className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center shadow-sm relative" style={{ backgroundColor: a.profiles?.bg_color || '#f3f4f6' }}>
                  <AssigneeIcon size={12} style={{ color: a.profiles?.icon_color || '#171717' }} />
                </div>
              )
            })
          ) : (
            // 🌟 เพิ่มขนาดคำว่า Unassigned
            <span className="text-xs text-neutral-400 font-medium italic bg-neutral-50 px-2 py-0.5 rounded-md">Unassigned</span>
          )}
        </div>
        
        {/* 🌟 เพิ่มขนาดคำว่า View */}
        <span className="text-xs font-bold text-neutral-400 group-hover:text-indigo-600 flex items-center gap-0.5 transition-colors">
          View <ChevronRight size={14} />
        </span>
      </div>
    </div>
  )
}