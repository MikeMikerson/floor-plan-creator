import { useMemo, useState } from 'react'

const emptyForm = {
  title: '',
  date: '',
  notes: '',
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

function formatDate(value) {
  try {
    if (!value) return 'No date set'
    return dateFormatter.format(new Date(value))
  } catch {
    return value
  }
}

function TimelineSection({ events, onAddEvent, onDeleteEvent, onUpdateEvent }) {
  const [formState, setFormState] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [events])

  const isEditing = Boolean(editingId)

  function resetForm() {
    setFormState(emptyForm)
    setEditingId(null)
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (!formState.title.trim() || !formState.date) {
      return
    }

    if (isEditing) {
      onUpdateEvent(editingId, formState)
    } else {
      onAddEvent(formState)
    }

    resetForm()
  }

  function handleEditRequest(item) {
    setFormState({
      title: item.title,
      date: item.date,
      notes: item.notes ?? '',
    })
    setEditingId(item.id)
  }

  return (
    <section className="panel" aria-labelledby="timeline-title">
      <div className="panel-header">
        <div>
          <h2 id="timeline-title">My Move Timeline</h2>
          <p className="panel-subtitle">
            Track critical deadlines and milestones leading up to moving day.
          </p>
        </div>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-field" htmlFor="timeline-title-input">
            <span>Event name</span>
            <input
              id="timeline-title-input"
              type="text"
              placeholder="Schedule movers"
              value={formState.title}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, title: event.target.value }))
              }
              required
            />
          </label>

          <label className="form-field" htmlFor="timeline-date-input">
            <span>Due date</span>
            <input
              id="timeline-date-input"
              type="date"
              value={formState.date}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, date: event.target.value }))
              }
              required
            />
          </label>
        </div>

        <label className="form-field" htmlFor="timeline-notes-input">
          <span>Notes (optional)</span>
          <textarea
            id="timeline-notes-input"
            rows={2}
            placeholder="Confirm elevator reservation with building management"
            value={formState.notes}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, notes: event.target.value }))
            }
          />
        </label>

        <div className="form-actions">
          {isEditing && (
            <button type="button" className="button ghost" onClick={resetForm}>
              Cancel edit
            </button>
          )}
          <button type="submit" className="button primary">
            {isEditing ? 'Save changes' : 'Add event'}
          </button>
        </div>
      </form>

      <div className="list">
        {sortedEvents.length === 0 ? (
          <p className="empty-state">No events yet. Start by adding one above.</p>
        ) : (
          sortedEvents.map((item) => (
            <article className="timeline-item" key={item.id}>
              <div className="timeline-item-content">
                <p className="timeline-item-date">{formatDate(item.date)}</p>
                <h3>{item.title}</h3>
                {item.notes && <p className="timeline-item-notes">{item.notes}</p>}
              </div>
              <div className="timeline-item-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => handleEditRequest(item)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="button warning"
                  onClick={() => onDeleteEvent(item.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

export default TimelineSection
