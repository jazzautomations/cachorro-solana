import Navbar from '@/components/Navbar'
import ScanView from '@/components/ScanView'
import { ID_RE } from '@/lib/cachorro'

export const dynamic = 'force-dynamic'

export default async function ScanPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <main className="min-h-screen bg-black">
      <Navbar />
      <section className="px-3 sm:px-4 py-6 sm:py-10">
        <div className="max-w-4xl mx-auto">
          {!ID_RE.test(id) ? (
            <div className="border border-neon-red bg-dark-900 p-4 text-[11px] font-mono text-neon-red">
              ✗ invalid job id
            </div>
          ) : (
            <ScanView id={id} />
          )}
        </div>
      </section>
    </main>
  )
}
