import { useState, useEffect } from 'react';
import { getOrders, getOrder, createOrder, completeOrder, allocateOrder, getProducts } from '../api/services';

function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await getOrders();
      setSummary(response.data);
      setOrders(response.data.orders);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (id) => {
    try {
      const response = await getOrder(id);
      setViewingOrder(response.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to load order details');
    }
  };

  const handleComplete = async (id) => {
    try {
      await completeOrder(id);
      loadOrders();
      alert('Order completed successfully!');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to complete order');
    }
  };

  const handleAllocate = async (id) => {
    try {
      await allocateOrder(id);
      loadOrders();
      alert('Order allocated successfully!');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to allocate order');
    }
  };

  const isFormOpen = showCreateForm || viewingOrder;

  if (loading) return <div className="loading">Loading orders...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Orders</h2>
        <p>Create and manage production orders</p>
      </div>

      {error && <div className="error">{error}</div>}

      {summary && !isFormOpen && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
            <h4 style={{ color: '#7f8c8d', marginBottom: '0.5rem' }}>Total Orders</h4>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50' }}>{summary.total_orders}</p>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#fff9e6' }}>
            <h4 style={{ color: '#f39c12', marginBottom: '0.5rem' }}>Pending</h4>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f39c12' }}>{summary.pending}</p>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#e6f7ff' }}>
            <h4 style={{ color: '#3498db', marginBottom: '0.5rem' }}>In Progress</h4>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3498db' }}>{summary.in_progress}</p>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#e8f5e9' }}>
            <h4 style={{ color: '#27ae60', marginBottom: '0.5rem' }}>Completed</h4>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#27ae60' }}>{summary.completed}</p>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3>All Orders</h3>
          {!isFormOpen && (
            <button className="button button-primary" onClick={() => setShowCreateForm(true)}>
              + Create Order
            </button>
          )}
        </div>

        {showCreateForm && (
          <CreateOrderForm
            onClose={() => setShowCreateForm(false)}
            onSave={() => {
              setShowCreateForm(false);
              loadOrders();
            }}
          />
        )}

        {viewingOrder && (
          <OrderDetails
            order={viewingOrder}
            onClose={() => setViewingOrder(null)}
          />
        )}

        {!isFormOpen && (
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td><strong>#{order.id}</strong></td>
                  <td>{order.product_name}</td>
                  <td>{order.quantity}</td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td>{new Date(order.created_at).toLocaleString()}</td>
                  <td>
                    <button
                      className="button button-primary"
                      style={{ marginRight: '0.5rem', padding: '0.5rem 1rem' }}
                      onClick={() => handleViewDetails(order.id)}
                    >
                      View Details
                    </button>
                    {order.status === 'pending' && (
                      <button
                        className="button button-success"
                        style={{ marginRight: '0.5rem', padding: '0.5rem 1rem' }}
                        onClick={() => handleAllocate(order.id)}
                      >
                        Allocate
                      </button>
                    )}
                    {order.status === 'in_progress' && (
                      <button
                        className="button button-success"
                        style={{ padding: '0.5rem 1rem' }}
                        onClick={() => handleComplete(order.id)}
                      >
                        Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!isFormOpen && orders.length === 0 && (
          <p style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
            No orders yet. Click "Create Order" to get started.
          </p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    pending: { backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeaa7' },
    in_progress: { backgroundColor: '#cce5ff', color: '#004085', border: '1px solid #b8daff' },
    completed: { backgroundColor: '#d4edda', color: '#155724', border: '1px solid #c3e6cb' },
  };

  return (
    <span style={{
      padding: '0.25rem 0.75rem',
      borderRadius: '12px',
      fontSize: '0.85rem',
      fontWeight: '600',
      ...styles[status]
    }}>
      {status.replace('_', ' ').toUpperCase()}
    </span>
  );
}

function CreateOrderForm({ onClose, onSave }) {
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState({
    product_id: '',
    quantity: 1,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await getProducts();
      setProducts(response.data);
    } catch (err) {
      setError('Failed to load products');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await createOrder(formData);
      
      if (response.data.status === 'pending') {
        setSuccessMessage('Order created but is PENDING - insufficient inventory. Please procure components and allocate.');
      } else {
        setSuccessMessage('Order created and allocated successfully!');
      }
      
      setTimeout(() => {
        onSave();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ backgroundColor: '#f9f9f9', marginBottom: '1rem' }}>
      <h4>Create Order</h4>
      {error && <div className="error">{error}</div>}
      {successMessage && <div className="success">{successMessage}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
            Product
          </label>
          <select
            value={formData.product_id}
            onChange={(e) => setFormData({ ...formData, product_id: parseInt(e.target.value) })}
            required
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            <option value="">Select Product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
            Quantity
          </label>
          <input
            type="number"
            min="1"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
            required
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="submit" className="button button-success" disabled={saving}>
            {saving ? 'Creating...' : 'Create Order'}
          </button>
          <button type="button" className="button" onClick={onClose} style={{ backgroundColor: '#95a5a6', color: 'white' }}>
            Back
          </button>
        </div>
      </form>
    </div>
  );
}

function OrderDetails({ order, onClose }) {
  return (
    <div className="card" style={{ backgroundColor: '#f0f8ff', marginBottom: '1rem' }}>
      <h4>Order #{order.id} - Details</h4>

      <div style={{ marginBottom: '1.5rem' }}>
        <p><strong>Product:</strong> {order.product_name}</p>
        <p><strong>Quantity:</strong> {order.quantity} units</p>
        <p><strong>Status:</strong> <StatusBadge status={order.status} /></p>
        <p><strong>Created:</strong> {new Date(order.created_at).toLocaleString()}</p>
        {order.completed_at && (
          <p><strong>Completed:</strong> {new Date(order.completed_at).toLocaleString()}</p>
        )}
      </div>

      <h4 style={{ marginBottom: '1rem' }}>Component Allocations</h4>
      
      {order.allocations.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Component</th>
              <th>Quantity Allocated</th>
            </tr>
          </thead>
          <tbody>
            {order.allocations.map((allocation) => (
              <tr key={allocation.id}>
                <td><strong>{allocation.component_name}</strong></td>
                <td>{allocation.quantity_allocated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ color: '#999', fontStyle: 'italic' }}>
          No allocations yet (order is pending)
        </p>
      )}

      <button
        className="button"
        onClick={onClose}
        style={{ marginTop: '1rem', backgroundColor: '#95a5a6', color: 'white' }}
      >
        Back
      </button>
    </div>
  );
}

export default OrdersPage;