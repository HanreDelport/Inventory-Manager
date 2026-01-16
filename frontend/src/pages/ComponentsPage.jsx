import { useState, useEffect } from 'react';
import { getComponents, createComponent, updateComponent, deleteComponent, adjustStock } from '../api/services';

function ComponentsPage() {
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingComponent, setEditingComponent] = useState(null);
  const [deletingComponent, setDeletingComponent] = useState(null);
  const [adjustingStock, setAdjustingStock] = useState(null);

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

  const confirmDelete = async () => {
    try {
      await deleteComponent(deletingComponent.id);
      setDeletingComponent(null);
      loadComponents();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete component');
    }
  };

  const handleStockAdjustment = async (adjustment) => {
    try {
      await adjustStock(adjustingStock.id, adjustment);
      setAdjustingStock(null);
      loadComponents();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to adjust stock');
    }
  };

  const isFormOpen = showCreateForm || editingComponent || deletingComponent || adjustingStock;

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
          {!isFormOpen && (
            <button className="button button-primary" onClick={() => setShowCreateForm(true)}>
              + Add Component
            </button>
          )}
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

        {deletingComponent && (
          <DeleteConfirmation
            item={deletingComponent}
            itemType="component"
            onConfirm={confirmDelete}
            onCancel={() => setDeletingComponent(null)}
          />
        )}

        {adjustingStock && (
          <StockAdjustmentForm
            component={adjustingStock}
            onConfirm={handleStockAdjustment}
            onCancel={() => setAdjustingStock(null)}
          />
        )}

        {!isFormOpen && (
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
                      onClick={() => setAdjustingStock(comp)}
                    >
                      Adjust Stock
                    </button>
                    <button
                      className="button button-danger"
                      style={{ padding: '0.5rem 1rem' }}
                      onClick={() => setDeletingComponent(comp)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!isFormOpen && components.length === 0 && (
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
            Back
          </button>
        </div>
      </form>
    </div>
  );
}

function DeleteConfirmation({ item, itemType, onConfirm, onCancel }) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    await onConfirm();
    setConfirming(false);
  };

  return (
    <div className="card" style={{ backgroundColor: '#ffe6e6', marginBottom: '1rem', border: '2px solid #e74c3c' }}>
      <h4>⚠️ Confirm Deletion</h4>
      <p style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>
        Are you sure you want to delete <strong>{itemType} "{item.name}"</strong>?
      </p>
      <p style={{ marginBottom: '1rem', color: '#666' }}>
        This action cannot be undone.
      </p>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          className="button button-danger"
          onClick={handleConfirm}
          disabled={confirming}
        >
          {confirming ? 'Deleting...' : 'Yes, Delete'}
        </button>
        <button
          className="button"
          onClick={onCancel}
          style={{ backgroundColor: '#95a5a6', color: 'white' }}
        >
          Back
        </button>
      </div>
    </div>
  );
}

function StockAdjustmentForm({ component, onConfirm, onCancel }) {
  const [adjustment, setAdjustment] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const adjustmentValue = parseInt(adjustment);
    
    if (isNaN(adjustmentValue) || adjustmentValue === 0) {
      alert('Adjustment cannot be zero or invalid');
      return;
    }
    
    setSaving(true);
    await onConfirm(adjustmentValue);
    setSaving(false);
  };

  const adjustmentValue = adjustment === '' ? 0 : parseInt(adjustment) || 0;
  const newStock = component.in_stock + adjustmentValue;

  return (
    <div className="card" style={{ backgroundColor: '#e6f7ff', marginBottom: '1rem', border: '2px solid #3498db' }}>
      <h4>Adjust Stock: {component.name}</h4>
      <p style={{ marginBottom: '1rem' }}>
        Current stock: <strong>{component.in_stock}</strong>
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
            Adjustment (+ to add, - to subtract)
          </label>
          <input
            type="number"
            value={adjustment}
            onChange={(e) => setAdjustment(e.target.value)}
            placeholder="Enter adjustment amount"
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}
            autoFocus
          />
        </div>

        <div style={{ 
          padding: '1rem', 
          backgroundColor: newStock < 0 ? '#ffe6e6' : '#e6ffe6', 
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          <p style={{ fontSize: '1.1rem' }}>
            New stock will be: <strong style={{ color: newStock < 0 ? '#e74c3c' : '#27ae60' }}>
              {newStock}
            </strong>
          </p>
          {newStock < 0 && (
            <p style={{ color: '#e74c3c', marginTop: '0.5rem' }}>
               Warning: Stock cannot be negative
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            type="submit"
            className="button button-success"
            disabled={saving || newStock < 0 || adjustment === '' || adjustmentValue === 0}
          >
            {saving ? 'Saving...' : 'Confirm Adjustment'}
          </button>
          <button
            type="button"
            className="button"
            onClick={onCancel}
            style={{ backgroundColor: '#95a5a6', color: 'white' }}
          >
            Back
          </button>
        </div>
      </form>
    </div>
  );
}

export default ComponentsPage;