import { useState, useEffect } from 'react';
import { getProcurementNeeds, adjustStock } from '../api/services';

function ProcurementPage() {
  const [procurementData, setProcurementData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [orderingComponent, setOrderingComponent] = useState(null);

  useEffect(() => {
    loadProcurementNeeds();
  }, []);

  const loadProcurementNeeds = async () => {
    try {
      setLoading(true);
      const response = await getProcurementNeeds();
      setProcurementData(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load procurement needs');
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveComponents = async (componentId, quantity) => {
    try {
      await adjustStock(componentId, quantity);
      setSuccessMessage(`Successfully added ${quantity} units to stock!`);
      setTimeout(() => setSuccessMessage(null), 5000);
      setOrderingComponent(null);
      loadProcurementNeeds();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to adjust stock');
      setTimeout(() => setError(null), 5000);
    }
  };

  if (loading) return <div className="loading">Loading procurement needs...</div>;

  const componentsToOrder = procurementData?.components_to_order || [];
  const totalItems = procurementData?.total_items || 0;

  return (
    <div>
      <div className="page-header">
        <h2>Procurement</h2>
        <p>Component reordering and inventory management</p>
      </div>

      {error && <div className="error">{error}</div>}
      {successMessage && <div className="success">{successMessage}</div>}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          <div style={{ padding: '1.5rem', backgroundColor: totalItems > 0 ? '#ffe6e6' : '#e8f5e9', borderRadius: '8px', textAlign: 'center' }}>
            <h4 style={{ color: totalItems > 0 ? '#e74c3c' : '#27ae60', marginBottom: '0.5rem' }}>
              Components to Order
            </h4>
            <p style={{ fontSize: '3rem', fontWeight: 'bold', color: totalItems > 0 ? '#e74c3c' : '#27ae60' }}>
              {totalItems}
            </p>
          </div>
          <div style={{ padding: '1.5rem', backgroundColor: '#e3f2fd', borderRadius: '8px', textAlign: 'center' }}>
            <h4 style={{ color: '#3498db', marginBottom: '0.5rem' }}>
              Total Orders Affected
            </h4>
            <p style={{ fontSize: '3rem', fontWeight: 'bold', color: '#3498db' }}>
              {componentsToOrder.length > 0 ? Math.max(...componentsToOrder.map(item => item.orders_affected))  : 0}
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Reorder Requirements</h3>

        {orderingComponent && (
          <ReceiveComponentsForm
            component={orderingComponent}
            onConfirm={handleReceiveComponents}
            onCancel={() => setOrderingComponent(null)}
          />
        )}

        {!orderingComponent && componentsToOrder.length > 0 ? (
          <>
            <p style={{ marginBottom: '1rem', color: '#666' }}>
              The following components are needed to fulfill pending orders:
            </p>

            <table>
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Current Stock</th>
                  <th>Total Needed</th>
                  <th>Shortage</th>
                  <th>Orders Affected</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {componentsToOrder.map((item) => (
                  <tr key={item.component_id}>
                    <td><strong>{item.component_name}</strong></td>
                    <td style={{ color: '#e74c3c', fontWeight: '600' }}>{item.in_stock}</td>
                    <td>{item.total_needed}</td>
                    <td>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: '#ffe6e6',
                        color: '#e74c3c',
                        borderRadius: '12px',
                        fontWeight: '600'
                      }}>
                        {item.shortage}
                      </span>
                    </td>
                    <td>{item.orders_affected}</td>
                    <td>
                      <button
                        className="button button-success"
                        style={{ padding: '0.5rem 1rem' }}
                        onClick={() => setOrderingComponent(item)}
                      >
                        Receive Stock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              backgroundColor: '#fff3e0',
              borderRadius: '4px',
              borderLeft: '4px solid #f39c12'
            }}>
              <h4 style={{ color: '#f39c12', marginBottom: '0.5rem' }}>💡 Procurement Tips</h4>
              <ul style={{ marginLeft: '1.5rem', fontSize: '0.9rem', color: '#666' }}>
                <li>Order the "Shortage" amount to fulfill pending orders</li>
                <li>Consider ordering extra stock to prevent future shortages</li>
                <li>Click "Receive Stock" when components arrive from suppliers</li>
                <li>After receiving, go to Orders page to allocate pending orders</li>
              </ul>
            </div>
          </>
        ) : !orderingComponent ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#27ae60' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✓</div>
            <h3 style={{ color: '#27ae60', marginBottom: '0.5rem' }}>All Good!</h3>
            <p style={{ color: '#666' }}>
              You have sufficient inventory to fulfill all pending orders.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReceiveComponentsForm({ component, onConfirm, onCancel }) {
  const [quantity, setQuantity] = useState(component.shortage);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (quantity <= 0) {
      alert('Quantity must be greater than zero');
      return;
    }
    
    setSaving(true);
    await onConfirm(component.component_id, quantity);
    setSaving(false);
  };

  const newStock = component.in_stock + quantity;

  return (
    <div className="card" style={{ backgroundColor: '#e8f5e9', marginBottom: '1rem', border: '2px solid #27ae60' }}>
      <h4>📦 Receive Components: {component.component_name}</h4>

      <div style={{ marginBottom: '1rem' }}>
        <p><strong>Current Stock:</strong> {component.in_stock}</p>
        <p><strong>Total Needed:</strong> {component.total_needed}</p>
        <p><strong>Shortage:</strong> <span style={{ color: '#e74c3c', fontWeight: '600' }}>{component.shortage}</span></p>
        <p><strong>Orders Affected:</strong> {component.orders_affected}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
            Quantity Received
          </label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}
            autoFocus
          />
          <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
            Suggested: {component.shortage} (minimum to cover shortage)
          </p>
        </div>

        <div style={{
          padding: '1rem',
          backgroundColor: '#fff',
          borderRadius: '4px',
          marginBottom: '1rem',
          border: '1px solid #ddd'
        }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
            <strong>New Stock After Receiving:</strong>
          </p>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#27ae60' }}>
            {newStock}
          </p>
          {newStock >= component.total_needed ? (
            <p style={{ color: '#27ae60', marginTop: '0.5rem' }}>
              ✓ Sufficient to fulfill pending orders
            </p>
          ) : (
            <p style={{ color: '#f39c12', marginTop: '0.5rem' }}>
              ⚠️ Still short by {component.total_needed - newStock} units
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            type="submit"
            className="button button-success"
            disabled={saving || quantity <= 0}
          >
            {saving ? 'Receiving...' : 'Confirm Receipt'}
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

export default ProcurementPage;