import { useState, useEffect } from 'react';
import { getComponents, createComponent, updateComponent, deleteComponent, adjustStock } from '../api/services';

function ComponentsPage() {
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingComponent, setEditingComponent] = useState(null);

  useEffect(() => {
    loadComponents();
  }, []);

  const loadComponents = async () => {
    try {
      setLoading(true);
      const response = await getComponents();
      setComponents(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load components');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete component "${name}"?`)) return;

    try {
      await deleteComponent(id);
      loadComponents();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete component');
    }
  };

  const handleAdjustStock = async (id, name, currentStock) => {
    const adjustment = prompt(`Adjust stock for "${name}" (current: ${currentStock}).\nEnter amount (+100 or -50):`);
    if (!adjustment) return;

    const amount = parseInt(adjustment);
    if (isNaN(amount)) {
      alert('Invalid number');
      return;
    }

    try {
      await adjustStock(id, amount);
      loadComponents();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to adjust stock');
    }
  };

  if (loading) return <div className="loading">Loading components...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Components</h2>
        <p>Manage raw materials and components</p>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3>All Components</h3>
          <button className="button button-primary" onClick={() => setShowCreateForm(true)}>
            + Add Component
          </button>
        </div>

        {showCreateForm && (
          <ComponentForm
            onClose={() => setShowCreateForm(false)}
            onSave={() => {
              setShowCreateForm(false);
              loadComponents();
            }}
          />
        )}

        {editingComponent && (
          <ComponentForm
            component={editingComponent}
            onClose={() => setEditingComponent(null)}
            onSave={() => {
              setEditingComponent(null);
              loadComponents();
            }}
          />
        )}

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Spillage %</th>
              <th>In Stock</th>
              <th>In Progress</th>
              <th>Shipped</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {components.map((comp) => (
              <tr key={comp.id}>
                <td><strong>{comp.name}</strong></td>
                <td>{(parseFloat(comp.spillage_coefficient) * 100).toFixed(2)}%</td>
                <td>{comp.in_stock}</td>
                <td>{comp.in_progress}</td>
                <td>{comp.shipped}</td>
                <td>
                  <button
                    className="button button-primary"
                    style={{ marginRight: '0.5rem', padding: '0.5rem 1rem' }}
                    onClick={() => setEditingComponent(comp)}
                  >
                    Edit
                  </button>
                  <button
                    className="button button-success"
                    style={{ marginRight: '0.5rem', padding: '0.5rem 1rem' }}
                    onClick={() => handleAdjustStock(comp.id, comp.name, comp.in_stock)}
                  >
                    Adjust Stock
                  </button>
                  <button
                    className="button button-danger"
                    style={{ padding: '0.5rem 1rem' }}
                    onClick={() => handleDelete(comp.id, comp.name)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {components.length === 0 && (
          <p style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
            No components yet. Click "Add Component" to create one.
          </p>
        )}
      </div>
    </div>
  );
}

function ComponentForm({ component, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: component?.name || '',
    spillage_coefficient: component ? parseFloat(component.spillage_coefficient) : 0,
    in_stock: component?.in_stock || 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (component) {
        await updateComponent(component.id, {
          name: formData.name,
          spillage_coefficient: formData.spillage_coefficient,
        });
      } else {
        await createComponent(formData);
      }
      onSave();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save component');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ backgroundColor: '#f9f9f9', marginBottom: '1rem' }}>
      <h4>{component ? 'Edit Component' : 'Create Component'}</h4>
      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
            Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
            Spillage Coefficient (0.10 = 10%)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="9.99"
            value={formData.spillage_coefficient}
            onChange={(e) => setFormData({ ...formData, spillage_coefficient: parseFloat(e.target.value) })}
            required
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>

        {!component && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
              Initial Stock
            </label>
            <input
              type="number"
              min="0"
              value={formData.in_stock}
              onChange={(e) => setFormData({ ...formData, in_stock: parseInt(e.target.value) })}
              required
              style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="submit" className="button button-success" disabled={saving}>
            {saving ? 'Saving...' : component ? 'Update' : 'Create'}
          </button>
          <button type="button" className="button" onClick={onClose} style={{ backgroundColor: '#95a5a6', color: 'white' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default ComponentsPage;