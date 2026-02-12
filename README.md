# Stock Management System

A production-ready web application for managing stock, production, and orders with support for multi-level Bill of Materials (BOMs), inventory tracking, and procurement management.

## Check it out
Try the web-app out for yourself at this link: https://inventory-manager-frontend-5bhs.onrender.com

## Features

- **Component Management**: Track raw materials with spillage coefficients
- **Product Management**: Define products with multi-level BOMs (products can contain other products)
- **Inventory Tracking**: Monitor stock levels across three states (In Stock, In Progress, Shipped)
- **Order Management**: Create orders with automatic inventory allocation
- **Procurement**: Calculate component reordering needs for pending orders
- **Production Capacity**: Calculate maximum producible units based on current inventory

## Tech Stack

**Backend:**
- Python 3.11
- FastAPI
- SQLAlchemy
- MySQL 8.0

**Frontend:**
- React
- Vite
- Axios

## Prerequisites

- Python 3.11 or higher
- Node.js 16 or higher
- MySQL 8.0 or higher

## Local Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/stock-management-system.git
cd stock-management-system
```

### 2. Database Setup

#### Create MySQL Database

Open MySQL Workbench or command line and run:
```sql
CREATE DATABASE stock_management;
```

#### Import Schema

**Using Command Line**
```bash
mysql -u root -p stock_management < schema.sql
```

**Verify the tables were created in MySQL cmd client:**
```sql
USE stock_management;
SHOW TABLES;
-- Should see: bill_of_materials, components, order_allocations, orders, product_bom, products
```

### 3. Backend Setup

#### Create Virtual Environment
```bash
cd backend
python -m venv venv
```

#### Activate Virtual Environment

**Windows:**
```bash
.venv\Scripts\activate
```

**Mac/Linux:**
```bash
source venv/bin/activate
```

#### Install Dependencies
```bash
pip install -r requirements.txt
```

#### Configure Environment Variables

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and update with your MySQL credentials:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=stock_management

API_HOST=0.0.0.0
API_PORT=8000
```

#### Run Backend Server
```bash
python main.py
```

The backend should now be running at **http://localhost:8000**

#### Verify Backend

Visit http://localhost:8000/docs to see the interactive API documentation (Swagger UI).

Try the `/health` endpoint to verify database connection.

### 4. Frontend Setup

Open a new terminal window (keep backend running).

#### Navigate to Frontend Directory
```bash
cd frontend
```

#### Install Dependencies
```bash
npm install
```

#### Run Frontend Development Server
```bash
npm run dev
```

The frontend should now be running at **http://localhost:5173**

#### Access the Application

Open your browser and go to **http://localhost:5173**

You should see the Stock Management System with navigation to:
- Dashboard
- Components
- Products
- Inventory
- Orders
- Procurement

## Default Seed Data

The schema includes sample data for testing:

**Components:**
- Wheels (10% spillage, 5000 in stock)
- Body Panel (5% spillage, 1000 in stock)
- Axle (2% spillage, 2000 in stock)
- Windshield (15% spillage, 800 in stock)

**Products:**
- Toy Car (4 wheels, 1 body panel, 2 axles, 1 windshield)
- Toy Truck (6 wheels, 2 body panels, 3 axles)

## Troubleshooting

### Backend won't start

**Issue:** `ModuleNotFoundError`
- **Solution:** Make sure you activated the virtual environment and ran `pip install -r requirements.txt`

**Issue:** `Access denied for user 'root'@'localhost'`
- **Solution:** Check your MySQL password in `.env` file

**Issue:** `Can't connect to MySQL server`
- **Solution:** Ensure MySQL is running and accessible on port 3306

### Frontend won't start

**Issue:** `Cannot find module`
- **Solution:** Run `npm install` in the frontend directory

**Issue:** API errors in browser console
- **Solution:** Ensure backend is running on http://localhost:8000

### Database errors

**Issue:** `Unknown database 'stock_management'`
- **Solution:** Create the database first: `CREATE DATABASE stock_management;`

**Issue:** `Table doesn't exist`
- **Solution:** Run the `schema.sql` script to create all tables

## Project Structure
```
stock-management-system/
├── backend/
│   ├── main.py              # FastAPI application entry point
│   ├── models.py            # SQLAlchemy database models
│   ├── schemas.py           # Pydantic schemas for validation
│   ├── database.py          # Database connection
│   ├── crud_components.py   # Component operations
│   ├── crud_products.py     # Product operations
│   ├── crud_orders.py       # Order operations
│   ├── crud_procurement.py  # Procurement calculations
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Environment variables template
├── frontend/
│   ├── src/
│   │   ├── api/            # API client and services
│   │   ├── pages/          # React page components
│   │   ├── App.jsx         # Main application component
│   │   └── main.jsx        # Application entry point
│   ├── package.json        # Node dependencies
│   └── .env.production     # Production environment variables
├── schema.sql              # Database schema and seed data
├── License                 # Custom non-commercial license
└── README.md               # This file
```

## API Documentation

Once the backend is running, visit http://localhost:8000/docs for complete interactive API documentation.

## License

This project is licensed under a **Custom Non-Commercial License**.

You may use, study, and modify this project for personal or educational purposes.
Commercial use, resale, or distribution is **not permitted** without prior
written permission from the author.

## Contributing

By submitting a contribution, you grant the project owner the right to use,
modify, and relicense your contribution as part of this project, including
for future commercial licensing, while the project remains non-commercial
for the public
