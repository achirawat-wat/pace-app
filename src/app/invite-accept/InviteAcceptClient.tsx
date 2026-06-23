'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { Loader2 } from 'lucide-react'

export default function InviteAcceptClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = searchParams.get('code')

  const [statusMessage, setStatusMessage] = useState(
    'กำลังตรวจสอบคำเชิญของคุณ...'
  )

  useEffect(() => {
    const processInvitation = async () => {
      if (!code) {
        setStatusMessage('❌ ลิงก์คำเชิญไม่ถูกต้อง')
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!profile) {
        router.push(`/onboarding?code=${code}`)
        return
      }

      const { data: project } = await supabase
        .from('projects')
        .select('id')
        .eq('invite_code', code)
        .single()

      if (!project) {
        setStatusMessage('❌ ไม่พบโปรเจกต์ที่ตรงกับรหัสคำเชิญนี้')
        return
      }

      await supabase.from('project_members').insert([
        {
          project_id: project.id,
          user_id: user.id,
          role: 'member',
        },
      ])

      setStatusMessage(
        '✅ เข้าร่วมโปรเจกต์สำเร็จ! กำลังพาท่านไปหน้ากระดานงาน...'
      )

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
        <p className="text-sm font-medium text-neutral-600">
          {statusMessage}
        </p>
      </div>
    </div>
  )
}