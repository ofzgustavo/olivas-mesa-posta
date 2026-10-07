export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 bg-black/5 rounded-lg mb-2" />
      <div className="h-4 w-72 bg-black/5 rounded-lg mb-8" />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="cartao">
            <div className="h-3 w-24 bg-black/5 rounded mb-3" />
            <div className="h-7 w-32 bg-black/10 rounded" />
          </div>
        ))}
      </div>
      <div className="cartao space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-black/[0.03] rounded-lg" />
        ))}
      </div>
    </div>
  );
}
