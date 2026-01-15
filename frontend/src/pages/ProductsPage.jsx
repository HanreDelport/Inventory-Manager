import { useState, useEffect } from 'react';
import { getProducts, getProduct, createProduct, updateProduct, deleteProduct, getComponents } from '../api/services';

function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [viewingProduct, setViewingProduct] = useState(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await getProducts();
      setProducts(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleView = async (id) => {
    try {
      const response = await getProduct(id);
      setViewingProduct(response.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to load product details');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete product "${name}"?`)) return;

    try {
      await deleteProduct(id);
      loadProducts();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete product');
    }
  };

  if (loading) return <div className="loading">Loading products...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Products</h2>
        <p>Manage finished goods and their BOMs</p>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3>All Products</h3>
          <button className="button button-primary" onClick={() => setShowCreateForm(true)}>
            + Add Product
          </button>
        </div>

        {showCreateForm && (
          <ProductForm
            onClose={() => setShowCreateForm(false)}
            onSave={() => {
              setShowCreateForm(false);
              loadProducts();
            }}
          />
        )}

        {viewingProduct && (
          <ProductDetails
            product={viewingProduct}
            onClose={() => setViewingProduct(null)}
          />
        )}

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>In Progress</th>
              <th>Shipped</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td><strong>{product.name}</strong></td>
                <td>{product.in_progress}</td>
                <td>{product.shipped}</td>
                <td>
                  <button
                    className="button button-primary"
                    style={{ marginRight: '0.5rem', padding: '0.5rem 1rem' }}
                    onClick={() => handleView(product.id)}
                  >
                    View BOM
                  </button>
                  <button
                    className="button button-danger"
                    style={{ padding: '0.5rem 1rem' }}
                    onClick={() => handleDelete(product.id, product.name)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {products.length === 0 && (
          <p style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
            No products yet. Click "Add Product" to create one.
          </p>
        )}
      </div>
    </div>
  );
}

function ProductForm({ onClose, onSave }) {
  const [components, setComponents] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    bom: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadComponents();
  }, []);

  const loadComponents = async () => {
    try {
      const response = await getComponents();
      setComponents(response.data);
    } catch (err) {
      setError('Failed to load components');
    }
  };

  const addBOMItem = () => {
    setFormData({
      ...formData,
      bom: [...formData.bom, { component_id: '', quantity_required: 1 }],
    });
  };

  const removeBOMItem = (index) => {
    setFormData({
      ...formData,
      bom: formData.bom.filter((_, i) => i !== index),
    });
  };

  const updateBOMItem = (index, field, value) => {
    const newBom = [...formData.bom];
    newBom[index][field] = field === 'component_id' ? parseInt(value) : parseInt(value);
    setFormData({ ...formData, bom: newBom });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.bom.length === 0) {
      setError('Product must have at least one component in BOM');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createProduct(formData);
      onSave();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ backgroundColor: '#f9f9f9', marginBottom: '1rem' }}>
      <h4>Create Product</h4>
      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
            Product Name
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{ fontWeight: '600' }}>Bill of Materials</label>
            <button type="button" className="button button-success" onClick={addBOMItem} style={{ padding: '0.5rem 1rem' }}>
              + Add Component
            </button>
          </div>

          {formData.bom.map((item, index) => (
            <div key={index} style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', alignItems: 'center' }}>
              <select
                value={item.component_id}
                onChange={(e) => updateBOMItem(index, 'component_id', e.target.value)}
                required
                style={{ flex: 2, padding: '0.5rem', fontSize: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="">Select Component</option>
                {components.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={item.quantity_required}
                onChange={(e) => updateBOMItem(index, 'quantity_required', e.target.value)}
                placeholder="Quantity"
                required
                style={{ flex: 1, padding: '0.5rem', fontSize: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              <button
                type="button"
                className="button button-danger"
                onClick={() => removeBOMItem(index)}
                style={{ padding: '0.5rem 1rem' }}
              >
                Remove
              </button>
            </div>
          ))}

          {formData.bom.length === 0 && (
            <p style={{ color: '#999', fontStyle: 'italic' }}>No components added yet</p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="submit" className="button button-success" disabled={saving}>
            {saving ? 'Creating...' : 'Create Product'}
          </button>
          <button type="button" className="button" onClick={onClose} style={{ backgroundColor: '#95a5a6', color: 'white' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function ProductDetails({ product, onClose }) {
  return (
    <div className="card" style={{ backgroundColor: '#f0f8ff', marginBottom: '1rem' }}>
      <h4>{product.name} - Bill of Materials</h4>

      <table style={{ marginTop: '1rem' }}>
        <thead>
          <tr>
            <th>Component</th>
            <th>Base Quantity</th>
            <th>Spillage %</th>
            <th>Quantity with Spillage</th>
          </tr>
        </thead>
        <tbody>
          {product.bom.map((item) => (
            <tr key={item.id}>
              <td><strong>{item.component_name}</strong></td>
              <td>{item.quantity_required}</td>
              <td>{(parseFloat(item.spillage_coefficient) * 100).toFixed(2)}%</td>
              <td>{parseFloat(item.quantity_with_spillage).toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        className="button"
        onClick={onClose}
        style={{ marginTop: '1rem', backgroundColor: '#95a5a6', color: 'white' }}
      >
        Close
      </button>
    </div>
  );
}

export default ProductsPage;