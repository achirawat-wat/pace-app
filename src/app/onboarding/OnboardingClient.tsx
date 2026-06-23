'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import {
  User,
  Smile,
  Coffee,
  Gamepad2,
  Code,
  Zap,
  Loader2,
} from 'lucide-react'

const BG_COLORS = [
  '#f3f4f6',
  '#fce7f3',
  '#dbeafe',
  '#dcfce7',
  '#fef08a',
  '#e0e7ff',
]

const ICON_COLORS = [
  '#171717',
  '#be185d',
  '#1d4ed8',
  '#15803d',
  '#a16207',
  '#4338ca',
]

const ICONS = [
  { name: 'user', icon: User },
  { name: 'smile', icon: Smile },
  { name: 'coffee', icon: Coffee },
  { name: 'gamepad', icon: Gamepad2 },
  { name: 'code', icon: Code },
  { name: 'zap', icon: Zap },
]

export default function OnboardingClient() {
  const router = useRouter()

  const searchParams = useSearchParams()
  const inviteCode = searchParams?.get('code')

  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState('')
  const [selectedBg, setSelectedBg] = useState(BG_COLORS[0])
  const [selectedIconColor, setSelectedIconColor] = useState(
    ICON_COLORS[0]
  )
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0].name)

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/')
        return
      }

      setUserId(user.id)
    }

    checkUser()
  }, [router])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!displayName.trim() || !userId) return

    setLoading(true)

    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: userId,
          display_name: displayName,
          icon_name: selectedIcon,
          bg_color: selectedBg,
          icon_color: selectedIconColor,
        },
      ])

    if (profileError) {
      console.error(profileError)
      alert('เกิดข้อผิดพลาดในการบันทึกโปรไฟล์ กรุณาลองใหม่')
      setLoading(false)
      return
    }

    if (inviteCode) {
      const { data: project } = await supabase
        .from('projects')
        .select('id')
        .eq('invite_code', inviteCode)
        .single()

      if (project) {
        await supabase.from('project_members').insert([
          {
            project_id: project.id,
            user_id: userId,
            role: 'member',
          },
        ])
      }
    }

    router.push('/board')
  }

  const ActiveIcon =
    ICONS.find((i) => i.name === selectedIcon)?.icon || User

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Set up your profile
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            How should your team call you?
          </p>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-8">
          <div className="flex flex-col items-center gap-4">
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full transition-colors duration-300"
              style={{ backgroundColor: selectedBg }}
            >
              <ActiveIcon
                size={40}
                style={{ color: selectedIconColor }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700">
              Display Name
            </label>

            <input
              type="text"
              required
              maxLength={20}
              placeholder="enter your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-neutral-900 focus:bg-white"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-neutral-700">
              Choose Icon
            </label>

            <div className="flex gap-3">
              {ICONS.map((item) => {
                const IconComponent = item.icon
                const isSelected = selectedIcon === item.name

                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setSelectedIcon(item.name)}
                    className={`flex h-12 w-12 items-center justify-center rounded-lg border transition-all ${
                      isSelected
                        ? 'border-neutral-900 bg-neutral-100'
                        : 'border-neutral-200 hover:bg-neutral-50'
                    }`}
                  >
                    <IconComponent
                      size={20}
                      className={
                        isSelected
                          ? 'text-neutral-900'
                          : 'text-neutral-500'
                      }
                    />
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-neutral-700">
                Background
              </label>

              <div className="flex flex-wrap gap-2">
                {BG_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedBg(color)}
                    className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      selectedBg === color
                        ? 'border-neutral-900'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-neutral-700">
                Icon Color
              </label>

              <div className="flex flex-wrap gap-2">
                {ICON_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedIconColor(color)}
                    className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      selectedIconColor === color
                        ? 'border-neutral-400'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !displayName}
            className="flex w-full items-center justify-center rounded-lg bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:bg-neutral-300"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Complete Profile'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}