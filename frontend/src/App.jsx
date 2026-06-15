import HomePage from './pages/HomePage';
import Icon from './components/common/Icon';

function App() {
  return (
    <div className="relative min-h-screen text-ink">
      <div className="app-ambient" />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Barre d'application (wordmark + statut) */}
        <header className="sticky top-0 z-30 border-b border-line/80 bg-base/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 lg:px-8">
            <div className="flex items-center gap-3">
              <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-brand/40 bg-brand/10">
                <Icon name="search" className="h-5 w-5 text-brand-soft" strokeWidth={2.4} />
              </span>
              <div className="leading-tight">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-extrabold tracking-tight text-ink">FactLens</span>
                  <span className="hidden rounded-md border border-line bg-elevated/60 px-1.5 py-0.5 font-mono text-[10px] text-faint sm:inline">
                    v1.0
                  </span>
                </div>
                <span className="text-xs text-faint">Content veracity analysis</span>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-line bg-elevated/50 px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-live opacity-60 animate-pulse-soft" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
              </span>
              <span className="text-xs font-medium text-muted">Operational</span>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 lg:px-8">
          <HomePage />
        </main>

        <footer className="border-t border-line/70 py-6">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-xs text-faint sm:flex-row lg:px-8">
            <p>FactLens — from link to verdict: transcription, extraction, validation, verification.</p>
            <p className="font-mono">Crafted by SOPAI</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
