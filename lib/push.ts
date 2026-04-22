import webpush from 'web-push'
import { createServiceClient } from './supabase/server'

if (process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@tideinstitute.org',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY
  )
}

export async function sendPushToUsers(
  userIds: string[],
  title: string,
  body: string,
  url = '/'
) {
  if (!process.env.VAPID_PRIVATE_KEY || userIds.length === 0) return

  const supabase = createServiceClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .in('user_id', userIds)

  if (!subs?.length) return

  const payload = JSON.stringify({ title, body, url })
  await Promise.allSettled(
    subs.map(({ subscription }) =>
      webpush.sendNotification(subscription as webpush.PushSubscription, payload)
    )
  )
}
