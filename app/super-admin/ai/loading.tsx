export default function SmartAiLoading() {
  return (
    <div className="page page-shell smart-ai-page" aria-busy="true" aria-label="Loading Smart AI">
      <div className="smart-ai-loading-heading"><span /><span /></div>
      <div className="smart-ai-loading-runtime" />
      <div className="smart-ai-loading-compose" />
    </div>
  );
}
