import apiClient from './client';

// Components
export const getComponents = () => apiClient.get('/components');
export const getComponent = (id) => apiClient.get(`/components/${id}`);
export const createComponent = (data) => apiClient.post('/components', data);
export const updateComponent = (id, data) => apiClient.put(`/components/${id}`, data);
export const deleteComponent = (id) => apiClient.delete(`/components/${id}`);
export const adjustStock = (id, adjustment) => apiClient.patch(`/components/${id}/adjust-stock?adjustment=${adjustment}`);

// Products
export const getProducts = () => apiClient.get('/products');
export const getProduct = (id) => apiClient.get(`/products/${id}`);
export const createProduct = (data) => apiClient.post('/products', data);
export const updateProduct = (id, data) => apiClient.put(`/products/${id}`, data);
export const deleteProduct = (id) => apiClient.delete(`/products/${id}`);
export const updateProductBOM = (id, component_bom, product_bom) => 
  apiClient.put(`/products/${id}/bom`, { component_bom, product_bom });
export const getProductionCapacity = () => apiClient.get('/products/capacity/calculate');

// Orders
export const getOrders = () => apiClient.get('/orders');
export const getOrder = (id) => apiClient.get(`/orders/${id}`);
export const createOrder = (data) => apiClient.post('/orders', data);
export const completeOrder = (id) => apiClient.post(`/orders/${id}/complete`);
export const allocateOrder = (id) => apiClient.post(`/orders/${id}/allocate`);
export const getOrderRequirements = (id) => apiClient.get(`/orders/${id}/requirements`);

// Procurement
export const getProcurementNeeds = () => apiClient.get('/procurement/needs');