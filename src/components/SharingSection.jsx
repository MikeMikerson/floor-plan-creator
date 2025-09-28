function SharingSection({ layoutState }) {
  const isReadyToShare = Boolean(layoutState.floorPlan && layoutState.scale)

  return (
    <section className="panel" aria-labelledby="sharing-title">
      <div className="panel-header">
        <div>
          <h2 id="sharing-title">Export & Sharing</h2>
          <p className="panel-subtitle">
            Generate social-ready exports of the finished layout to drive organic reach.
          </p>
        </div>
      </div>

      <div className="sharing-body">
        <p>
          Sharing flows will connect to the layout designer once the interactive canvas is ready. The export button
          below shows the intended trigger point.
        </p>

        <button type="button" className="button primary" disabled={!isReadyToShare}>
          {isReadyToShare ? 'Export current layout' : 'Upload floor plan & scale to enable export'}
        </button>

        <div className="todo-callout">
          <p>
            Upcoming work: capture a clean canvas image, attach promotional copy, and open the device share sheet using
            the native bridge.
          </p>
        </div>
      </div>
    </section>
  )
}

export default SharingSection
