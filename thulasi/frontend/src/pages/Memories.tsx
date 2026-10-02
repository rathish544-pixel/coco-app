import { useCallback, useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'

import { deleteMemory, listMemories } from '../api/memories'
import { EmptyState, ErrorState, Loading } from '../components/Loading'
import { MemoryCard } from '../components/MemoryCard'
import { MemorySheet } from '../components/MemorySheet'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import type { Memory } from '../types'

export function Memories() {
  const { notify } = useToast()
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Memory | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Memory | null>(null)

  const load = useCallback(async (term?: string) => {
    setLoading(true)
    try {
      setMemories(await listMemories(term))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load our memories.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(search), search ? 320 : 0)
    return () => window.clearTimeout(timer)
  }, [search, load])

  async function confirmDelete() {
    if (!pendingDelete) return
    try {
      await deleteMemory(pendingDelete.id)
      setMemories((current) => current.filter((item) => item.id !== pendingDelete.id))
      notify('Memory removed.')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not delete that.', 'warn')
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" size={16} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search a memory…"
          className="w-full rounded-2xl border border-white/15 bg-white/5 py-3 pl-11 pr-4 text-cream outline-none transition placeholder:text-faint/70 focus:border-rose/60"
        />
      </div>

      {loading && memories.length === 0 ? (
        <Loading label="Gathering our moments…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load(search)} />
      ) : memories.length === 0 ? (
        <EmptyState
          title={search ? 'Nothing matches that' : 'No memories yet'}
          hint={
            search
              ? 'Try a different word, or add this one as a new memory.'
              : 'Add your first photo and the story that goes with it.'
          }
          action={
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="mt-2 rounded-full bg-rose px-6 py-2.5 text-sm font-medium text-night-deep transition hover:bg-blush"
            >
              Add a memory
            </button>
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {memories.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onEdit={setEditing}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        aria-label="Add a memory"
        className="fixed bottom-40 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-rose to-rose-deep text-night-deep shadow-[0_10px_30px_rgba(217,79,125,0.55)] transition hover:from-blush hover:to-rose active:scale-95"
      >
        <Plus size={24} />
      </button>

      <MemorySheet
        open={addOpen || editing !== null}
        memory={editing}
        onClose={() => {
          setAddOpen(false)
          setEditing(null)
        }}
        onSaved={() => void load(search)}
      />

      <Sheet
        open={pendingDelete !== null}
        title="Delete this memory?"
        subtitle={pendingDelete?.title}
        onClose={() => setPendingDelete(null)}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-mist">
            This removes it for good. The real memory stays with you either way.
          </p>
          <button
            type="button"
            onClick={confirmDelete}
            className="rounded-2xl bg-rose px-6 py-3.5 font-medium text-night-deep transition hover:bg-blush"
          >
            Yes, delete it
          </button>
          <button
            type="button"
            onClick={() => setPendingDelete(null)}
            className="rounded-2xl border border-white/15 px-6 py-3.5 text-mist transition hover:bg-white/5"
          >
            Keep it
          </button>
        </div>
      </Sheet>
    </div>
  )
}
