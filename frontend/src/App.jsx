import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import logo from './assets/logo.png';


// Page components (we'll create these next)
import Dashboard from './pages/Dashboard';
import ComponentsPage from './pages/ComponentsPage';
import ProductsPage from './pages/ProductsPage';
import InventoryPage from './pages/InventoryPage';
import OrdersPage from './pages/OrdersPage';
import ProcurementPage from './pages/ProcurementPage';

function App() {
  return (
    <Router>
      <div className="app">
        <nav className="navbar">
         <div className="nav-brand">
           <img
             src={logo}
             alt="Stock Management Logo"
             className="nav-logo"
           />
           <h1>Inventory Management System</h1>
         </div>
          <ul className="nav-links">
            <li><Link to="/">Dashboard</Link></li>
            <li><Link to="/components">Components</Link></li>
            <li><Link to="/products">Products</Link></li>
            <li><Link to="/inventory">Inventory</Link></li>
            <li><Link to="/orders">Orders</Link></li>
            <li><Link to="/procurement">Procurement</Link></li>
          </ul>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/components" element={<ComponentsPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/procurement" element={<ProcurementPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;