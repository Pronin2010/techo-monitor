import DashboardClient from '@/components/dashboard/dashboard-client'

// Client-side wrapper — data is fetched by DashboardClient on mount
export default function DashboardPage() {
  return <DashboardClient initialNodes={[]} initialChannels={[]} />
}
