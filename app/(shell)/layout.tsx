import { TabBar } from '@/components/TabBar'

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <main className="pb-[68px]">{children}</main>
      <TabBar />
    </div>
  )
}
