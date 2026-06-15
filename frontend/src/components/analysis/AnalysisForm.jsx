import { useState } from 'react';
import LoadingSpinner from '../common/LoadingSpinner';
import Icon from '../common/Icon';

// The technical dependency (audio extraction from a media link) is unchanged:
// the engine stays the same, only the visible copy is generic.
const VIDEO_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;

function AnalysisForm({ onSubmit, isLoading, runValidation, setRunValidation, runFactChecking, setRunFactChecking }) {
  const [url, setUrl] = useState('');
  const [provider, setProvider] = useState('MOCK_PROVIDER');
  const [formError, setFormError] = useState('');

  const handleUrlChange = (e) => {
    setUrl(e.target.value);
    if (formError) setFormError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.trim()) {
      setFormError('Please paste a link to analyze.');
      return;
    }
    if (!VIDEO_URL_REGEX.test(url)) {
      setFormError("This link doesn't look valid. Paste a link to analyze.");
      return;
    }
    setFormError('');
    onSubmit(url, provider, runValidation, runFactChecking);
  };

  const modes = [
    { value: 'MOCK_PROVIDER', label: 'Instant' },
    { value: 'ASSEMBLY_AI', label: 'Full AI' },
  ];

  return (
    <div className="panel animate-rise p-6 sm:p-7">
      <form onSubmit={handleSubmit} className="space-y-7">
        {/* Main field */}
        <div>
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <label htmlFor="content-url" className="eyebrow">
              Link to analyze
            </label>

            {/* Discreet mode switch (reads as a product feature) */}
            <div className="inline-flex items-center rounded-lg border border-line bg-base/40 p-0.5">
              {modes.map((m) => {
                const active = provider === m.value;
                return (
                  <button
                    type="button"
                    key={m.value}
                    onClick={() => setProvider(m.value)}
                    aria-pressed={active}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
                      active ? 'bg-elevated text-ink shadow-sm' : 'text-faint hover:text-muted'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-grow">
              <Icon name="link" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-faint" />
              <input
                id="content-url"
                type="text"
                value={url}
                onChange={handleUrlChange}
                placeholder="Paste any link — video, post, article…"
                className={`field !pl-12 text-base ${formError ? '!border-rose-500/60' : ''}`}
                required
              />
            </div>
            <button type="submit" disabled={isLoading} className="btn-accent shrink-0 px-7 text-base">
              {isLoading ? (
                <>
                  <LoadingSpinner />
                  <span>Analyzing…</span>
                </>
              ) : (
                <>
                  <Icon name="search" className="h-5 w-5" strokeWidth={2.4} />
                  <span>Analyze</span>
                </>
              )}
            </button>
          </div>
          {formError && (
            <p className="mt-2.5 flex items-center gap-1.5 text-sm font-medium text-rose-300 animate-fade-in">
              <Icon name="alert" className="h-4 w-4" />
              {formError}
            </p>
          )}
        </div>

        {/* Advanced options */}
        <div className="space-y-3 rounded-xl border border-line bg-base/30 p-4">
          <Toggle
            id="validation-toggle"
            checked={runValidation}
            onChange={() => {
              const next = !runValidation;
              setRunValidation(next);
              if (!next && runFactChecking) setRunFactChecking(false);
            }}
            label="Claim validation"
            hint="Checks each claim's fidelity to the source."
            slow
          />
          <div className="h-px bg-line/70" />
          <Toggle
            id="factcheck-toggle"
            checked={runFactChecking && runValidation}
            disabled={!runValidation}
            onChange={() => setRunFactChecking(!runFactChecking)}
            label="Fact-checking"
            hint="Verifies accuracy via Google Fact Check + web search."
            slow
          />

          {runFactChecking && runValidation && (
            <div className="flex items-start gap-2.5 rounded-lg border border-brand/30 bg-brand/10 p-3 animate-fade-in">
              <Icon name="sparkle" className="mt-0.5 h-4 w-4 shrink-0 text-brand-soft" />
              <p className="text-xs leading-relaxed text-muted">
                <span className="font-semibold text-brand-soft">Fact-checking enabled.</span> Validated
                claims will be verified via Google Fact Check and web search. This step can take a few minutes.
              </p>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

// Reusable styled switch
function Toggle({ id, checked, onChange, disabled = false, label, hint, slow = false }) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-center gap-3.5 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <span className="relative inline-flex shrink-0">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={onChange} />
        <span className="block h-6 w-11 rounded-full bg-raised transition-colors duration-200 peer-checked:bg-brand/70" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="font-medium text-ink">{label}</span>
          {slow && <Icon name="clock" className="h-3.5 w-3.5 text-faint" title="Takes a bit longer" />}
        </span>
        <span className="mt-0.5 block text-xs text-faint">{hint}</span>
      </span>
    </label>
  );
}

export default AnalysisForm;
