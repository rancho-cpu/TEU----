export function PageSkeleton() {
  return (
    <div className="p-6 max-w-5xl mx-auto animate-pulse">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="h-7 w-48 bg-gray-200 rounded-lg mb-2" />
        <div className="h-4 w-72 bg-gray-100 rounded" />
      </div>

      {/* 카드 그리드 */}
      <div className="grid grid-cols-1 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-gray-200 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
