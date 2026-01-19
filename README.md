📦 Stock Management System

A full-stack Stock Management System built with:

Backend: FastAPI + SQLAlchemy + MySQL

Frontend: React (Vite)

Database: MySQL

This README explains how to run the application locally.

🧱 Project Structure
Inventory Manager/
│
├── backend/
│   ├── main.py
│   ├── models.py
│   ├── crud/
│   ├── schemas/
│   ├── database.py
│   ├── requirements.txt
│   ├── .env.example
│   └── venv/
│
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
│
└── schema.sql

✅ Prerequisites

Make sure you have the following installed:

Python 3.10+

Node.js 18+

MySQL Server

Git

1️⃣ Clone the Repository
git clone https://github.com/your-username/your-repo-name.git
cd Inventory\ Manager

2️⃣ Create the MySQL Database

Open MySQL Workbench or MySQL CLI

Create a database:

CREATE DATABASE stock_management;


Import the schema:

mysql -u your_user -p stock_management < schema.sql


This will create all required tables.

3️⃣ Backend Setup (FastAPI)
📁 Navigate to backend folder
cd backend

🐍 Create & activate virtual environment

Windows (PowerShell):

python -m venv venv
./venv/Scripts/activate


macOS / Linux:

python3 -m venv venv
source venv/bin/activate

📦 Install Python dependencies
pip install -r requirements.txt

🔐 Configure environment variables

Rename .env.example → .env

Open .env and fill in your MySQL credentials:

DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=stock_management

▶️ Run the backend server
python main.py


Backend will run at:

http://localhost:8000


API documentation (Swagger UI):

http://localhost:8000/docs


✅ If you see the Swagger UI, the backend is running correctly.

4️⃣ Frontend Setup (React + Vite)
📁 Navigate to frontend folder
cd ../frontend

📦 Install dependencies
npm install

▶️ Run the frontend dev server
npm run dev


Frontend will run at:

http://localhost:5173

5️⃣ Connect Frontend to Backend

Ensure the API base URL is correct:

📄 frontend/src/api/client.js

const API_BASE_URL = 'http://localhost:8000';

🎉 You're Done!

Frontend: http://localhost:5173
Backend API: http://localhost:8000
API Docs: http://localhost:8000/docs

Backend API: http://localhost:8000

API Docs: http://localhost:8000/docs
