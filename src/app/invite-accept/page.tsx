'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { Loader2 } from 'lucide-react'

export default function InviteAcceptPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = searchParams.get('code') // ดึงรหัสห้องจาก URL
  const [statusMessage, setStatusMessage] = useState('กำลังตรวจสอบคำเชิญของคุณ...')

  useEffect(() => {
    const processInvitation = async () => {
      if (!code) {
        setStatusMessage('❌ ลิงก์คำเชิญไม่ถูกต้อง')
        return
      }

      // 1. เช็กสิทธิ์ว่าผู้ใช้เข้าสู่ระบบเรียบร้อยหรือยัง (Supabase แกะ Token จาก URL อัตโนมัติ)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      // 2. ตรวจสอบว่าผู้ใช้คนนี้เคยตั้งค่าโปรไฟล์ (มีแอคเคาท์สมบูรณ์) หรือยัง
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!profile) {
        // 👉 [กรณีไม่มีบัญชี] เตะไปหน้า Onboarding พร้อมส่งรหัสห้องไปลงทะเบียนต่อ
        router.push(`/onboarding?code=${code}`)
        return
      }

      // 3. 👉 [กรณีมีบัญชีอยู่แล้ว] ดึงไอดีโปรเจกต์จากรหัสห้อง
      const { data: project } = await supabase
        .from('projects')
        .select('id')
        .eq('invite_code', code)
        .single()

      if (!project) {
        setStatusMessage('❌ ไม่พบโปรเจกต์ที่ตรงกับรหัสคำเชิญนี้')
        return
      }

      // 4. บันทึกผู้ใช้เข้าทีม (แอดลงตาราง project_members)
      // ใช้ upset หรือดักคว่ำ error เผื่อเขาอยู่ในโปรเจกต์นั้นอยู่แล้ว
      await supabase
        .from('project_members')
        .insert([{ project_id: project.id, user_id: user.id, role: 'member' }])

      setStatusMessage('✅ เข้าร่วมโปรเจกต์สำเร็จ! กำลังพาท่านไปหน้ากระดานงาน...')
      
      // พาเข้าหน้าบอร์ดหลักทันที
      setTimeout(() => {
        router.push('/board')
      }, 1500)
    }

    processInvitation()
  }, [code, router])

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-white text-neutral-900">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
        <p className="text-sm font-medium text-neutral-600">{statusMessage}</p>
      </div>
    </div>
  )
}