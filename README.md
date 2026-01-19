# 📦 Stock Management System

A full-stack **Stock Management System** built with:

- **Backend:** FastAPI + SQLAlchemy  
- **Frontend:** React (Vite)  
- **Database:** MySQL  

This guide explains how to **run the application locally** from scratch.

---

## 🧱 Project Structure

Inventory Manager/
│
├── backend/
│ ├── main.py
│ ├── database.py
│ ├── requirements.txt
│ ├── .env.example
│ └── venv/
│
├── frontend/
│ ├── src/
│ ├── package.json
│ └── vite.config.js
│
└── schema.sql

yaml
Copy code

---

## ✅ Prerequisites

Make sure you have the following installed:

- **Python 3.10+**
- **Node.js 18+**
- **MySQL Server**
- **Git**

---

## 1️⃣ Clone the Repository

```bash
git clone https://github.com/your-username/your-repo-name.git
cd Inventory\ Manager
2️⃣ Create and Load the MySQL Database
Open MySQL Workbench or MySQL CLI

Create the database:

sql
Copy code
CREATE DATABASE stock_management;
Select the database and load the schema:

sql
Copy code
USE stock_management;
SOURCE path-to-the-.sql-file;
✅ This will create all required tables.

3️⃣ Backend Setup (FastAPI)
📁 Navigate to backend folder
bash
Copy code
cd backend
🐍 Activate the virtual environment
bash
Copy code
./backend/venv/Scripts/activate
⚠️ The virtual environment is already included in the project.

📦 Install Python dependencies
bash
Copy code
pip install -r requirements.txt
🔐 Configure environment variables
Rename .env.example to .env

Open .env and fill in your MySQL credentials:

env
Copy code
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=stock_management
▶️ Run the backend server
bash
Copy code
python main.py
Backend will run at:

arduino
Copy code
http://localhost:8000
API documentation (Swagger UI):

bash
Copy code
http://localhost:8000/docs
✅ If Swagger loads, the backend is working correctly.

4️⃣ Frontend Setup (React + Vite)
📁 Navigate to frontend folder
bash
Copy code
cd ../frontend
📦 Install dependencies
bash
Copy code
npm install
▶️ Run the frontend development server
bash
Copy code
npm run dev
Frontend will run at:

arduino
Copy code
http://localhost:5173
5️⃣ Verify the App
Frontend: http://localhost:5173

Backend API: http://localhost:8000

API Docs: http://localhost:8000/docs
