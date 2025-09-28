import { useEffect, useMemo, useState } from 'react'

const referenceObjects = [
  { id: 'door', label: 'Standard Door', inches: 36 },
  { id: 'queen-bed', label: 'Queen Bed (width)', inches: 60 },
  { id: 'sofa', label: 'Full Sofa (length)', inches: 84 },
]

function LayoutDesignerSection({ inventory, layoutState, onLayoutChange }) {
  const [previewUrl, setPreviewUrl] = useState(null)
  const [scaleForm, setScaleForm] = useState({
    referenceId: layoutState.scale?.referenceId ?? referenceObjects[0].id,
    pixelMeasure: layoutState.scale?.pixelMeasure ? String(layoutState.scale.pixelMeasure) : '',
  })

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  useEffect(() => {
    if (!layoutState.floorPlan || !layoutState.floorPlan.file) {
      setPreviewUrl(null)
      return
    }

    const url = URL.createObjectURL(layoutState.floorPlan.file)
    setPreviewUrl(url)

    return () => URL.revokeObjectURL(url)
  }, [layoutState.floorPlan])

  const scaleDetails = useMemo(() => {
    const reference = referenceObjects.find((item) => item.id === layoutState.scale?.referenceId)
    if (!reference || !layoutState.scale) {
      return null
    }

    const inchesPerPixel = layoutState.scale.inchesPerPixel
    const pixelsPerInch = inchesPerPixel > 0 ? 1 / inchesPerPixel : null

    return {
      referenceLabel: reference.label,
      inchesPerPixel,
      pixelsPerInch,
    }
  }, [layoutState.scale])

  function handleFloorPlanChange(event) {
    const file = event.target.files?.[0]
    if (!file) {
      onLayoutChange({ floorPlan: null })
      return
    }

    onLayoutChange({
      floorPlan: {
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        file,
      },
    })
  }

  function handleScaleSubmit(event) {
    event.preventDefault()

    const reference = referenceObjects.find((item) => item.id === scaleForm.referenceId)
    const pixels = Number(scaleForm.pixelMeasure)

    if (!reference || Number.isNaN(pixels) || pixels <= 0) {
      return
    }

    const inchesPerPixel = reference.inches / pixels

    onLayoutChange({
      scale: {
        referenceId: reference.id,
        referenceInches: reference.inches,
        pixelMeasure: pixels,
        inchesPerPixel,
      },
    })
  }

  return (
    <section className="panel" aria-labelledby="layout-title">
      <div className="panel-header">
        <div>
          <h2 id="layout-title">Home Layout Designer</h2>
          <p className="panel-subtitle">
            Upload your floor plan and prepare the canvas for drag-and-drop furniture placement.
          </p>
        </div>
      </div>

      <div className="layout-grid">
        <div className="layout-column">
          <h3>1. Floor plan</h3>
          <label className="file-upload" htmlFor="floor-plan-input">
            <span>Upload image</span>
            <input
              id="floor-plan-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFloorPlanChange}
            />
          </label>

          {layoutState.floorPlan ? (
            <div className="floor-plan-meta">
              <p className="meta-title">Selected floor plan</p>
              <p>{layoutState.floorPlan.name}</p>
              <p>{Math.round(layoutState.floorPlan.size / 1024)} KB</p>
            </div>
          ) : (
            <p className="empty-state small">
              No file yet. The designer will display your floor plan preview here once uploaded.
            </p>
          )}

          {previewUrl && (
            <div className="floor-plan-preview">
              <img src={previewUrl} alt="Floor plan preview" />
            </div>
          )}
        </div>

        <div className="layout-column">
          <h3>2. Set the scale</h3>
          <form className="form" onSubmit={handleScaleSubmit}>
            <label className="form-field" htmlFor="reference-select">
              <span>Reference object</span>
              <select
                id="reference-select"
                value={scaleForm.referenceId}
                onChange={(event) =>
                  setScaleForm((prev) => ({ ...prev, referenceId: event.target.value }))
                }
              >
                {referenceObjects.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field" htmlFor="pixel-measure-input">
              <span>Measured size (pixels)</span>
              <input
                id="pixel-measure-input"
                type="number"
                min="1"
                value={scaleForm.pixelMeasure}
                onChange={(event) =>
                  setScaleForm((prev) => ({ ...prev, pixelMeasure: event.target.value }))
                }
                required
              />
            </label>

            <div className="form-actions">
              <button type="submit" className="button primary">
                Calculate scale
              </button>
            </div>
          </form>

          {scaleDetails ? (
            <div className="scale-meta">
              <p className="meta-title">Scale ready</p>
              <p>{scaleDetails.referenceLabel}</p>
              <p>
                {scaleDetails.pixelsPerInch?.toFixed(2)} px = 1 in ({scaleDetails.inchesPerPixel.toFixed(3)}
                in per px)
              </p>
            </div>
          ) : (
            <p className="empty-state small">
              Provide a pixel measurement above to establish canvas scale.
            </p>
          )}
        </div>

        <div className="layout-column">
          <h3>3. Plan placement</h3>
          <p className="panel-subtitle">
            Drag-and-drop interactions will live here. For now, review the furniture that will populate the canvas.
          </p>
          {inventory.length === 0 ? (
            <p className="empty-state small">Inventory is empty. Add furniture to get started.</p>
          ) : (
            <ul className="layout-inventory">
              {inventory.map((item) => (
                <li key={item.id}>
                  <span>{item.name}</span>
                  <span>
                    {item.width}" × {item.length}" · {item.room}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="todo-callout">
            <p>
              Upcoming work: build an interactive canvas that supports scaled furniture placement, rotation, room-based
              colors, and collision detection.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default LayoutDesignerSection
