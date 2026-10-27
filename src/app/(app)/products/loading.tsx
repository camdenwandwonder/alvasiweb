export default function LoadingShop() {
  return (
    <div aria-busy="true" aria-label="Winkel laden" className="@container animate-pulse">
      <div className="mb-4 h-8 w-40 rounded-md bg-muted" />
      <div className="mb-6 h-9 w-full max-w-xl rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-3 @4xl:grid-cols-4 @6xl:grid-cols-5 sm:gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border">
            <div className="aspect-[4/5] bg-muted" />
            <div className="space-y-2 p-3">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
              <div className="h-9 w-full rounded-lg bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
