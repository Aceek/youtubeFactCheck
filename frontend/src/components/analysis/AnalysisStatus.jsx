import Icon from '../common/Icon';

// Barre de progression avec effet "shimmer"
const ProgressBar = ({ progress, label }) => {
  const pct = Math.max(0, Math.min(100, progress));
  return (
    <div className="mb-7">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-muted">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-live opacity-60 animate-pulse-soft" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
          </span>
          {label}
        </span>
        <span className="font-mono text-sm font-semibold text-brand-soft">{pct}%</span>
      </div>
      <div className="progress-track h-2.5 w-full rounded-full">
        <div className="progress-fill h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

function AnalysisStatus({ analysis, withValidation, withFactChecking }) {
  if (!analysis || !analysis.status) return null;

  const baseSteps = [
    { status: 'PENDING', label: 'Initializing analysis', icon: 'gauge' },
    { status: 'FETCHING_METADATA', label: 'Fetching content information', icon: 'film' },
    { status: 'TRANSCRIBING', label: 'Transcribing audio', icon: 'doc' },
    { status: 'EXTRACTING_CLAIMS', label: 'Extracting factual claims', icon: 'sparkle' },
  ];
  if (withValidation) baseSteps.push({ status: 'VALIDATING_CLAIMS', label: 'Validating claims', icon: 'shield' });
  if (withFactChecking) baseSteps.push({ status: 'FACT_CHECKING', label: 'Fact-checking', icon: 'search' });
  baseSteps.push({ status: 'COMPLETE', label: 'Analysis complete', icon: 'check' });

  const steps = baseSteps;

  let currentStepIndex = steps.findIndex((step) => step.status === analysis.status);

  if (analysis.status === 'PARTIALLY_COMPLETE') {
    if (analysis.claims && analysis.claims.length > 0) {
      if (withFactChecking && analysis.claims.some((claim) => claim.factCheckStatus)) {
        currentStepIndex = steps.findIndex((step) => step.status === 'FACT_CHECKING');
      } else if (withValidation) {
        currentStepIndex = steps.findIndex((step) => step.status === 'VALIDATING_CLAIMS');
      } else {
        currentStepIndex = steps.findIndex((step) => step.status === 'EXTRACTING_CLAIMS');
      }
    } else {
      currentStepIndex = steps.findIndex((step) => step.status === 'EXTRACTING_CLAIMS');
    }
  }

  const progress = analysis.progress || 0;

  const getProgressLabel = () => {
    if (
      analysis.status === 'EXTRACTING_CLAIMS' ||
      (analysis.status === 'PARTIALLY_COMPLETE' && (!analysis.claims || analysis.claims.length === 0))
    ) {
      return 'Extracting';
    } else if (analysis.status === 'VALIDATING_CLAIMS') {
      return 'Validating';
    } else if (analysis.status === 'FACT_CHECKING') {
      return 'Fact-checking';
    } else if (analysis.status === 'PARTIALLY_COMPLETE' && analysis.claims && analysis.claims.length > 0) {
      if (withFactChecking && analysis.claims.some((claim) => claim.factCheckStatus)) return 'Fact-checking';
      if (withValidation) return 'Validating';
      return 'Processing';
    }
    return 'Processing';
  };

  const showProgressBar =
    analysis.status === 'EXTRACTING_CLAIMS' ||
    analysis.status === 'VALIDATING_CLAIMS' ||
    analysis.status === 'FACT_CHECKING' ||
    analysis.status === 'PARTIALLY_COMPLETE';

  const claimsCount = analysis.claims?.length || 0;
  const verifiedCount = analysis.claims?.filter((c) => c.verdict).length || 0;

  return (
    <div className="panel animate-rise p-6 sm:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand/40 bg-brand/10">
            <span className="absolute inset-0 rounded-xl animate-pulse-ring" />
            <Icon name="gauge" className="h-5 w-5 text-brand-soft" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-ink">Analysis in progress</h2>
            <p className="text-xs text-faint">Real-time pipeline processing</p>
          </div>
        </div>
        {claimsCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-line bg-elevated/50 px-3 py-1.5">
            <Icon name="sparkle" className="h-4 w-4 text-brand-soft" />
            <span className="font-mono text-sm text-ink">{claimsCount}</span>
            <span className="text-xs text-faint">claim{claimsCount > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {showProgressBar && progress >= 0 && <ProgressBar progress={progress} label={getProgressLabel()} />}

      {/* Timeline des étapes */}
      <ol className="relative space-y-1">
        {steps.map((step, index) => {
          const state = index < currentStepIndex ? 'done' : index === currentStepIndex ? 'active' : 'pending';
          const isLast = index === steps.length - 1;

          return (
            <li key={step.status} className="relative flex gap-4 pb-1">
              {/* Connecteur vertical */}
              {!isLast && (
                <span
                  className={`absolute left-[18px] top-10 h-[calc(100%-1rem)] w-px ${
                    state === 'done' ? 'bg-brand/50' : 'bg-line'
                  }`}
                />
              )}

              {/* Pastille d'état */}
              <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center">
                {state === 'done' && (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/15 text-emerald-300">
                    <Icon name="check" className="h-5 w-5" strokeWidth={2.6} />
                  </span>
                )}
                {state === 'active' && (
                  <span className="relative flex h-9 w-9 items-center justify-center rounded-full border border-brand/50 bg-brand/15 text-brand-soft">
                    <span className="absolute inset-0 rounded-full animate-pulse-ring" />
                    <Icon name={step.icon} className="h-4 w-4" />
                  </span>
                )}
                {state === 'pending' && (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-elevated/40 text-faint">
                    <Icon name={step.icon} className="h-4 w-4" />
                  </span>
                )}
              </span>

              {/* Libellé */}
              <div className="flex min-h-9 flex-1 flex-col justify-center pb-3">
                <p
                  className={`text-[15px] transition-colors ${
                    state === 'done'
                      ? 'font-medium text-muted'
                      : state === 'active'
                      ? 'font-semibold text-ink'
                      : 'text-faint'
                  }`}
                >
                  {step.label}
                </p>
                {state === 'active' && progress > 0 && showProgressBar && (
                  <p className="mt-0.5 font-mono text-xs text-brand-soft/80">
                    {progress}%
                    {claimsCount > 0 &&
                      (analysis.status === 'FACT_CHECKING'
                        ? ` · ${verifiedCount}/${claimsCount} verified`
                        : ` · ${claimsCount} found`)}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {analysis.status === 'FAILED' && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-200">
          <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
          <div>
            <p className="font-semibold text-rose-100">Analysis failed</p>
            <p className="text-sm text-rose-200/90">
              {analysis.errorMessage || 'Please check the link and try again.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalysisStatus;
