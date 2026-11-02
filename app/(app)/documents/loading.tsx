import { Skeleton } from '@/components/ui/skeleton'

export default function DocumentsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-full rounded-md sm:w-80" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* Documents Grid / Table */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="divide-y p-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="size-10 rounded-lg" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-52" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

