import { useState, useEffect } from 'react';
import { getProducts, getProduct, createProduct, updateProduct, updateProductBOM, deleteProduct, getComponents } from '../api/services';

function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [viewingProduct, setViewingProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);

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

  const handleEdit = async (id) => {
    try {
      const response = await getProduct(id);
      setEditingProduct(response.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to load product details');
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteProduct(deletingProduct.id);
      setDeletingProduct(null);
      loadProducts();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete product');
      setTimeout(() => setError(null), 5000);
    }
  };

  const isFormOpen = showCreateForm || viewingProduct || deletingProduct ||editingProduct;

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
          {!isFormOpen && (
            <button className="button button-primary" onClick={() => setShowCreateForm(true)}>
              + Add Product
            </button>
          )}
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

        {editingProduct && (
          <ProductForm
            product={editingProduct}
            onClose={() => setEditingProduct(null)}
            onSave={() => {
              setEditingProduct(null);
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

        {deletingProduct && (
          <DeleteConfirmation
            item={deletingProduct}
            itemType="product"
            onConfirm={confirmDelete}
            onCancel={() => setDeletingProduct(null)}
          />
        )}

        {!isFormOpen && (
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
                      className="button button-primary"
                      style={{ marginRight: '0.5rem', padding: '0.5rem 1rem', backgroundColor: '#f39c12' }}
                      onClick={() => handleEdit(product.id)}
                    >
                      Edit
                    </button>
                    <button
                      className="button button-danger"
                      style={{ padding: '0.5rem 1rem' }}
                      onClick={() => setDeletingProduct(product)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!isFormOpen && products.length === 0 && (
          <p style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
            No products yet. Click "Add Product" to create one.
          </p>
        )}
      </div>
    </div>
  );
}

function ProductForm({ product, onClose, onSave }) {
  const [components, setComponents] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: product?.name || '',
    component_bom: product?.component_bom?.map(item => ({
      component_id: item.component_id,
      quantity_required: item.quantity_required
    })) || [],
    product_bom: product?.product_bom?.map(item => ({
      child_product_id: item.child_product_id,
      quantity_required: item.quantity_required
    })) || [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [componentsRes, productsRes] = await Promise.all([
        getComponents(),
        getProducts()
      ]);
      setComponents(componentsRes.data);
      setProducts(productsRes.data);
      setError(null);
    } catch (err) {
      setError('Failed to load components and products');
    } finally {
      setLoading(false);
    }
  };

  const addBOMItem = () => {
    setFormData({
      ...formData,
      component_bom: [...formData.component_bom, { component_id: '', quantity_required: 1 }],
    });
  };

  const removeBOMItem = (index) => {
    setFormData({
      ...formData,
      component_bom: formData.component_bom.filter((_, i) => i !== index),
    });
  };

  const updateBOMItem = (index, field, value) => {
    const newBom = [...formData.component_bom];
    newBom[index][field] = field === 'component_id' ? parseInt(value) : parseInt(value);
    setFormData({ ...formData, component_bom: newBom });
  };

  const getAvailableComponents = (currentIndex) => {
    const selectedIds = formData.component_bom
      .map((item, idx) => idx !== currentIndex ? item.component_id : null)
      .filter(id => id !== null && id !== '');
    
    return components.filter(comp => !selectedIds.includes(comp.id));
  };

  const addProductBOMItem = () => {
    setFormData({
      ...formData,
      product_bom: [...formData.product_bom, { child_product_id: '', quantity_required: 1 }],
    });
  };

  const removeProductBOMItem = (index) => {
    setFormData({
      ...formData,
      product_bom: formData.product_bom.filter((_, i) => i !== index),
    });
  };

  const updateProductBOMItem = (index, field, value) => {
    const newProductBom = [...formData.product_bom];
    newProductBom[index][field] = field === 'child_product_id' ? parseInt(value) : parseInt(value);
    setFormData({ ...formData, product_bom: newProductBom });
  };

  const getAvailableProducts = (currentIndex) => {
    const selectedIds = formData.product_bom
      .map((item, idx) => idx !== currentIndex ? item.child_product_id : null)
      .filter(id => id !== null && id !== '');
    
    const excludeIds = product ? [...selectedIds, product.id] : selectedIds;
    
    return products.filter(p => !excludeIds.includes(p.id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.component_bom.length === 0 && formData.product_bom.length === 0) {
      setError('Product must have at least one component or sub-product in BOM');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (product) {
        await updateProduct(product.id, { name: formData.name });
        await updateProductBOM(product.id, formData.component_bom, formData.product_bom);
      } else {
        await createProduct(formData);
      }
      onSave();
    } catch (err) {
      setError(err.response?.data?.detail || `Failed to ${product ? 'update' : 'create'} product`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ backgroundColor: '#f9f9f9', marginBottom: '1rem' }}>
      <h4>{product ? 'Edit Product' : 'Create Product'}</h4>
      {error && <div className="error">{error}</div>}

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          <p>Loading components and products...</p>
        </div>
      ) : (
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
              <label style={{ fontWeight: '600' }}>Component Bill of Materials</label>
              <button type="button" className="button button-success" onClick={addBOMItem} style={{ padding: '0.5rem 1rem' }}>
                + Add Component
              </button>
            </div>

            {formData.component_bom.map((item, index) => {
              const availableComponents = getAvailableComponents(index);
              
              return (
                <div key={index} style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <select
                    value={item.component_id}
                    onChange={(e) => updateBOMItem(index, 'component_id', e.target.value)}
                    required={formData.product_bom.length === 0}
                    style={{ flex: 2, padding: '0.5rem', fontSize: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}
                  >
                    <option value="">Select Component</option>
                    {item.component_id && !availableComponents.find(c => c.id === item.component_id) && (
                      <option value={item.component_id}>
                        {components.find(c => c.id === item.component_id)?.name}
                      </option>
                    )}
                    {availableComponents.map((comp) => (
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
              );
            })}

            {formData.component_bom.length === 0 && (
              <p style={{ color: '#999', fontStyle: 'italic' }}>No components added yet</p>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontWeight: '600' }}>
                Product Bill of Materials 
                <span style={{ fontSize: '0.85rem', color: '#666', marginLeft: '0.5rem' }}>
                  (Sub-products contained in this product)
                </span>
              </label>
              <button type="button" className="button button-success" onClick={addProductBOMItem} style={{ padding: '0.5rem 1rem' }}>
                + Add Product
              </button>
            </div>

            {formData.product_bom.map((item, index) => {
              const availableProducts = getAvailableProducts(index);
              
              return (
                <div key={index} style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <select
                    value={item.child_product_id}
                    onChange={(e) => updateProductBOMItem(index, 'child_product_id', e.target.value)}
                    required={formData.component_bom.length === 0}
                    style={{ flex: 2, padding: '0.5rem', fontSize: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}
                  >
                    <option value="">Select Product</option>
                    {item.child_product_id && !availableProducts.find(p => p.id === item.child_product_id) && (
                      <option value={item.child_product_id}>
                        {products.find(p => p.id === item.child_product_id)?.name}
                      </option>
                    )}
                    {availableProducts.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity_required}
                    onChange={(e) => updateProductBOMItem(index, 'quantity_required', e.target.value)}
                    placeholder="Quantity"
                    required
                    style={{ flex: 1, padding: '0.5rem', fontSize: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                  <button
                    type="button"
                    className="button button-danger"
                    onClick={() => removeProductBOMItem(index)}
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    Remove
                  </button>
                </div>
              );
            })}

            {formData.product_bom.length === 0 && (
              <p style={{ color: '#999', fontStyle: 'italic' }}>No sub-products added yet</p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="submit" className="button button-success" disabled={saving}>
              {saving ? (product ? 'Updating...' : 'Creating...') : (product ? 'Update Product' : 'Create Product')}
            </button>
            <button type="button" className="button" onClick={onClose} style={{ backgroundColor: '#95a5a6', color: 'white' }}>
              Back
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ProductDetails({ product, onClose }) {
  return (
    <div className="card" style={{ backgroundColor: '#f0f8ff', marginBottom: '1rem' }}>
      <h4>{product.name} - Bill of Materials</h4>

      {/* Component BOM Table */}
      {product.component_bom.length > 0 && (
        <>
          <h5 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>Components</h5>
          <table style={{ marginBottom: '1.5rem' }}>
            <thead>
              <tr>
                <th>Component</th>
                <th>Base Quantity</th>
                <th>Spillage %</th>
                <th>Quantity with Spillage</th>
              </tr>
            </thead>
            <tbody>
              {product.component_bom.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.component_name}</strong></td>
                  <td>{item.quantity_required}</td>
                  <td>{(parseFloat(item.spillage_coefficient) * 100).toFixed(2)}%</td>
                  <td>{parseFloat(item.quantity_with_spillage).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Product BOM Table */}
      {product.product_bom.length > 0 && (
        <>
          <h5 style={{ marginBottom: '0.5rem' }}>Sub-Products (Nested Products)</h5>
          <table style={{ marginBottom: '1.5rem' }}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity Required</th>
              </tr>
            </thead>
            <tbody>
              {product.product_bom.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.child_product_name}</strong>
                    <span style={{ 
                      marginLeft: '0.5rem',
                      fontSize: '0.85rem',
                      color: '#666',
                      fontStyle: 'italic'
                    }}>
                      (Product ID: {item.child_product_id})
                    </span>
                  </td>
                  <td>{item.quantity_required}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {product.component_bom.length === 0 && product.product_bom.length === 0 && (
        <p style={{ color: '#999', fontStyle: 'italic', marginTop: '1rem' }}>
          This product has no BOM defined
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

export default ProductsPage;