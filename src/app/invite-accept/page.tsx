import { Suspense } from 'react'
import InviteAcceptClient from './InviteAcceptClient'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <InviteAcceptClient />
    </Suspense>
  )
}