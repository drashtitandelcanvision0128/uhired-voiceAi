export function ScorecardShareInvalid() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-16">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Interview scorecard</p>
        <h1 className="mt-3 text-xl font-bold text-[#203854]">This link is unavailable</h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          The link may be incorrect, expired, or revoked. Ask the sender for a new link if you still need access.
        </p>
      </div>
    </main>
  );
}
