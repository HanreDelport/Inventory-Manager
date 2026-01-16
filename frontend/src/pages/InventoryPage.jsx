import { useState, useEffect } from 'react';
import { getComponents, getProductionCapacity } from '../api/services';

function InventoryPage() {
  const [view, setView] = useState('components'); // 'components' or 'products'
  const [components, setComponents] = useState([]);
  const [productCapacity, setProductCapacity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, [view]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (view === 'components') {
        const response = await getComponents();
        setComponents(response.data);
      } else {
        const response = await getProductionCapacity();
        setProductCapacity(response.data);
      }
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Inventory Overview</h2>
        <p>View component inventory and production capacity</p>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button
            className={`button ${view === 'components' ? 'button-primary' : ''}`}
            style={view !== 'components' ? { backgroundColor: '#ecf0f1', color: '#2c3e50' } : {}}
            onClick={() => setView('components')}
          >
            Component Inventory
          </button>
          <button
            className={`button ${view === 'products' ? 'button-primary' : ''}`}
            style={view !== 'products' ? { backgroundColor: '#ecf0f1', color: '#2c3e50' } : {}}
            onClick={() => setView('products')}
          >
            Production Capacity
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading...</div>
        ) : view === 'components' ? (
          <ComponentInventoryView components={components} />
        ) : (
          <ProductCapacityView capacity={productCapacity} />
        )}
      </div>
    </div>
  );
}

function ComponentInventoryView({ components }) {
  const totalInStock = components.reduce((sum, c) => sum + c.in_stock, 0);
  const totalInProgress = components.reduce((sum, c) => sum + c.in_progress, 0);
  const totalShipped = components.reduce((sum, c) => sum + c.shipped, 0);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '1rem', backgroundColor: '#e8f5e9', borderRadius: '8px', textAlign: 'center' }}>
          <h4 style={{ color: '#27ae60', marginBottom: '0.5rem' }}>Total In Stock</h4>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#27ae60' }}>{totalInStock}</p>
        </div>
        <div style={{ padding: '1rem', backgroundColor: '#fff3e0', borderRadius: '8px', textAlign: 'center' }}>
          <h4 style={{ color: '#f39c12', marginBottom: '0.5rem' }}>Total In Progress</h4>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f39c12' }}>{totalInProgress}</p>
        </div>
        <div style={{ padding: '1rem', backgroundColor: '#e3f2fd', borderRadius: '8px', textAlign: 'center' }}>
          <h4 style={{ color: '#3498db', marginBottom: '0.5rem' }}>Total Shipped</h4>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3498db' }}>{totalShipped}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Component</th>
            <th>Spillage %</th>
            <th>In Stock</th>
            <th>In Progress</th>
            <th>Shipped</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {components.map((comp) => {
            const total = comp.in_stock + comp.in_progress + comp.shipped;
            return (
              <tr key={comp.id}>
                <td><strong>{comp.name}</strong></td>
                <td>{(parseFloat(comp.spillage_coefficient) * 100).toFixed(2)}%</td>
                <td style={{ color: '#27ae60', fontWeight: '600' }}>{comp.in_stock}</td>
                <td style={{ color: '#f39c12', fontWeight: '600' }}>{comp.in_progress}</td>
                <td style={{ color: '#3498db', fontWeight: '600' }}>{comp.shipped}</td>
                <td><strong>{total}</strong></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function ProductCapacityView({ capacity }) {
  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <h3>Maximum Producible Units</h3>
        <p style={{ color: '#666' }}>Based on current component inventory and spillage</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>In Progress</th>
            <th>Shipped</th>
            <th>Max Producible</th>
            <th>Limiting Component</th>
          </tr>
        </thead>
        <tbody>
          {capacity.map((product) => (
            <tr key={product.id}>
              <td><strong>{product.name}</strong></td>
              <td style={{ color: '#f39c12' }}>{product.in_progress}</td>
              <td style={{ color: '#3498db' }}>{product.shipped}</td>
              <td>
                <span style={{
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  color: product.max_producible > 0 ? '#27ae60' : '#e74c3c'
                }}>
                  {product.max_producible}
                </span>
              </td>
              <td>
                <span style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: '#ecf0f1',
                  borderRadius: '4px',
                  fontSize: '0.9rem'
                }}>
                  {product.limiting_component}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {capacity.length === 0 && (
        <p style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
          No products available
        </p>
      )}
    </>
  );
}

export default InventoryPage;