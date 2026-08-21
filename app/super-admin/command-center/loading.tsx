export default function CommandCenterLoading() {
  return (
    <div className="page page-shell super-admin-command-center" aria-busy="true" aria-live="polite">
      <div className="command-loading-heading"><span /><span /></div>
      <p className="sr-only">Loading Command Center</p>
      {[4, 4, 2].map((count, section) => <div className="command-loading-grid" key={section}>{Array.from({ length: count }, (_, index) => <span key={index} />)}</div>)}
    </div>
  );
}
