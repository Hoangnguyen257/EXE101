import { Skeleton } from '@/components/ui/skeleton'

export default function ShipmentsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-full rounded-md sm:w-80" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-muted/40 p-4">
          <div className="grid grid-cols-6 gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        </div>
        <div className="divide-y p-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="grid grid-cols-6 items-center gap-4 p-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ml-auto h-8 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

