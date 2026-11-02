import { Skeleton } from '@/components/ui/skeleton'

export default function AuditLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-10 w-64 rounded-md" />
        <Skeleton className="h-10 w-44 rounded-md" />
        <Skeleton className="h-10 w-44 rounded-md" />
      </div>

      {/* Audit Log Table */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="divide-y p-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3.5">
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-64" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

