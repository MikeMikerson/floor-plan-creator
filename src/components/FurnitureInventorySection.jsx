import { useMemo, useState } from 'react'

const roomOptions = ['Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Office', 'Outdoor', 'Miscellaneous']

const emptyForm = {
  name: '',
  width: '',
  length: '',
  room: roomOptions[0],
}

function FurnitureInventorySection({ items, onAddItem, onDeleteItem, onUpdateItem }) {
  const [formState, setFormState] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)

  const groupedItems = useMemo(() => {
    return items.reduce((groups, item) => {
      const key = item.room || 'Unassigned'
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(item)
      return groups
    }, {})
  }, [items])

  const isEditing = Boolean(editingId)

  function resetForm() {
    setFormState(emptyForm)
    setEditingId(null)
  }

  function handleSubmit(event) {
    event.preventDefault()
    const { name, width, length, room } = formState

    if (!name.trim() || !width || !length) {
      return
    }

    const payload = {
      name: name.trim(),
      width: Number(width),
      length: Number(length),
      room,
    }

    if (isEditing) {
      onUpdateItem(editingId, payload)
    } else {
      onAddItem(payload)
    }

    resetForm()
  }

  function handleEdit(item) {
    setEditingId(item.id)
    setFormState({
      name: item.name,
      width: String(item.width),
      length: String(item.length),
      room: item.room,
    })
  }

  return (
    <section className="panel" aria-labelledby="inventory-title">
      <div className="panel-header">
        <div>
          <h2 id="inventory-title">Furniture Inventory</h2>
          <p className="panel-subtitle">
            Capture measurements so everything fits when you design the layout.
          </p>
        </div>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-field" htmlFor="inventory-name-input">
            <span>Item name</span>
            <input
              id="inventory-name-input"
              type="text"
              placeholder="Sofa"
              value={formState.name}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, name: event.target.value }))
              }
              required
            />
          </label>

          <label className="form-field" htmlFor="inventory-width-input">
            <span>Width (in)</span>
            <input
              id="inventory-width-input"
              type="number"
              min="1"
              value={formState.width}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, width: event.target.value }))
              }
              required
            />
          </label>

          <label className="form-field" htmlFor="inventory-length-input">
            <span>Length (in)</span>
            <input
              id="inventory-length-input"
              type="number"
              min="1"
              value={formState.length}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, length: event.target.value }))
              }
              required
            />
          </label>
        </div>

        <label className="form-field" htmlFor="inventory-room-input">
          <span>Room category</span>
          <select
            id="inventory-room-input"
            value={formState.room}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, room: event.target.value }))
            }
          >
            {roomOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="form-actions">
          {isEditing && (
            <button type="button" className="button ghost" onClick={resetForm}>
              Cancel edit
            </button>
          )}
          <button type="submit" className="button primary">
            {isEditing ? 'Save item' : 'Add to inventory'}
          </button>
        </div>
      </form>

      <div className="list">
        {items.length === 0 ? (
          <p className="empty-state">No furniture recorded yet. Add your first item above.</p>
        ) : (
          Object.entries(groupedItems).map(([room, roomItems]) => (
            <details className="inventory-group" key={room} open>
              <summary>{room}</summary>
              <ul className="inventory-items">
                {roomItems.map((item) => (
                  <li className="inventory-item" key={item.id}>
                    <div>
                      <p className="inventory-item-name">{item.name}</p>
                      <p className="inventory-item-meta">
                        {item.width}" W × {item.length}" L
                      </p>
                    </div>
                    <div className="inventory-actions">
                      <button
                        type="button"
                        className="button ghost"
                        onClick={() => handleEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="button warning"
                        onClick={() => onDeleteItem(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          ))
        )}
      </div>
    </section>
  )
}

export default FurnitureInventorySection
