'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Anton } from 'next/font/google'

// 🌟 นำเข้าฟอนต์ Anton สไตล์มินิมอลตามที่ต้องการ
const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
})

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  
  // 🌟 States คุมจังหวะโหลดเพื่อไม่ให้ Splash ซ้อนกัน
  const [isInitializing, setIsInitializing] = useState(true)
  const [showSplash, setShowSplash] = useState(false)
  
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        // 1. ถ้ามี Session อยู่แล้ว ให้บินข้ามไปหน้า Board เลย (ไม่ต้องเปิด Splash หน้าล็อกอินให้ซ้อนกัน)
        router.push('/board')
      } else {
        // 2. ถ้าไม่มี Session ค้างอยู่ ค่อยมาเช็กประวัติความจำประหยัดเวลา
        const hasSeenSplash = sessionStorage.getItem('pace_splash_seen')
        
        if (hasSeenSplash) {
          setIsInitializing(false) // เคยเห็น Splash ในแท็บนี้แล้ว เปิดฟอร์มเลย
        } else {
          setShowSplash(true) // เป็นการเข้าเว็บครั้งแรก ให้เปิดป้ายไฟโลโก้ขึ้นมา
          setTimeout(() => {
            setIsInitializing(false)
            sessionStorage.setItem('pace_splash_seen', 'true') // จำไว้ว่าโชว์แล้ว
          }, 1500) // หน่วงเวลาขั้นต่ำไว้ 1.5 วินาทีตามต้องการ
        }
      }
    }
    checkSession()
    
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push('/board')
      }
    })

    return () => authListener.subscription.unsubscribe()
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    // 🌟 ยิงคำสั่งส่ง Magic Link โครงสร้างเดิมไม่เปลี่ยนแปลง
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/board`,
      },
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('ส่งลิงก์เข้าสู่ระบบไปที่อีเมลของคุณแล้ว กรุณาตรวจสอบ Inbox ของคุณ')
      setEmail('')
    }
    setLoading(false)
  }

  // 🌟 ช่วงจังหวะการ Hold Splash Screen
  if (isInitializing) {
    // ถ้ามี Session ค้างอยู่ มันจะ return null (หน้าจอขาวนิ่งๆ เสี้ยววิ) แล้ววาร์ปเข้าบอร์ดไปเลย ไม่ซ้อนกันแน่นอน!
    if (!showSplash) return null 

    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-white transition-opacity duration-700 animate-in fade-in zoom-in-95">
        <h1 className={`${anton.className} text-[80px] md:text-[120px] text-neutral-900 tracking-[0.3em] pl-[0.3em]`}>
          PACE
        </h1>
        <p className="text-[11px] md:text-xs font-bold text-neutral-400 uppercase tracking-[0.2em] mt-2">
          Team Operating System
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-neutral-50 text-neutral-900 p-4">
      <div className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-[0_20px_60px_rgb(0,0,0,0.05)] border border-neutral-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <div className="text-center mb-8">
          <h1 className={`${anton.className} text-5xl text-neutral-900 tracking-[0.2em] pl-[0.2em] mb-2`}>PACE</h1>
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Team Operating System</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider pl-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none transition-all focus:border-neutral-900 focus:bg-white shadow-sm"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-xl bg-neutral-900 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-neutral-800 disabled:bg-neutral-300 shadow-sm mt-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue'}
          </button>
        </form>

        {message && (
          <p className="mt-6 text-center text-xs font-medium text-neutral-600 bg-neutral-50 p-3 rounded-xl border border-neutral-100 leading-relaxed">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}