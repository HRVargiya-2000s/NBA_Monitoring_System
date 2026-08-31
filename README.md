# NBA Monitoring System (Course-to-Curriculum Portal)

An automated National Board of Accreditation (NBA) monitoring and attainment calculation system for educational institutions. This platform facilitates Course Outcome (CO), Program Outcome (PO), and Program Specific Outcome (PSO) mappings, student marks and attendance tracking, and automated generation of multi-sheet NBA attainment Excel reports.

---

## 🚀 Features

- **Automated NBA Attainment Reports**: Generates comprehensive 14-sheet NBA calculation workbooks using Python and OpenPyXL templates.
- **Role-Based Portals**: Customized dashboards and permissions for **Admin**, **HOD**, and **Faculty** members.
- **CO-PO-PSO Strength Mapping**: Interactive target mapping, strength evaluations, and justifications.
- **Marks & Exam Management**: Tracks Mid-Sem, Internal, External, and Viva marks against specific Course Outcomes.
- **Lecture & Attendance Tracking**: Monitors subject offerings, student rosters, and lecture planning.
- **Docker-Ready Architecture**: Full containerization for PostgreSQL database, Redis session/caching, Express Node backend, and Nginx React frontend.

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 19 (Vite)
- **Styling**: TailwindCSS & DaisyUI
- **State & Routing**: React Router v7, Axios, React Hook Form, Zod

### Backend
- **Core Server**: Node.js & Express v5
- **Database**: PostgreSQL (pg driver) with schema migrations (`up.sql`)
- **Caching & Sessions**: Redis client
- **Report Engine**: Python 3 & OpenPyXL for dynamic Excel workbook rendering
- **Security**: JWT authentication, bcrypt password hashing, CORS, HTTP-only cookies

### Infrastructure & Deployment
- Docker & Docker Compose
- Nginx (Static asset server for frontend)

---

## 📁 Repository Structure

```
.
├── Frontend/                 # React frontend application (Vite)
│   ├── src/                  # Components, Pages, Utilities
│   ├── public/               # Public assets
│   ├── Dockerfile            # Multi-stage Nginx build for Frontend
│   └── package.json
├── backend/                  # Node.js backend application
│   ├── src/
│   │   ├── config/           # DB & Redis connection scripts, SQL migrations
│   │   ├── controllers/      # Admin, Attainment, Marks, HOD, Subject logic
│   │   ├── middleware/       # Auth & Rate Limiter middleware
│   │   ├── routes/           # Express API endpoints
│   │   └── services/         # Excel generator bridge & Python generator
│   ├── templates/            # Embedded CO-PO Excel workbook template
│   ├── Dockerfile            # Node 20 + Python 3 openpyxl backend container
│   └── package.json
├── docker-compose.yml        # Orchestration (Postgres, Redis, Backend, Frontend)
├── .dockerignore             # Docker build ignores
├── .gitignore                # Git ignores
└── README.md                 # Project documentation
```

---

## ⚙️ Environment Variables

Create `.env` files in both root/backend and frontend as needed:

### Backend `.env`
```env
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=c2c_db
DATABASE_URL=postgres://postgres:postgres@localhost:5432/c2c_db
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
JWT_SECRET=your_secret_key_here
```

---

## 📦 Local Quick Start

### 1. Prerequisites
- Node.js (v18+)
- Python 3.10+ (with `openpyxl` installed: `pip install openpyxl`)
- PostgreSQL & Redis running locally

### 2. Install Dependencies & Run

#### Backend
```bash
cd backend
npm install
npm run dev
```

#### Frontend
```bash
cd Frontend
npm install
npm run dev
```

---

## 🐳 Docker Deployment (Recommended)

To launch the full system including PostgreSQL database, Redis, Node Backend, and Nginx Frontend:

```bash
docker compose up --build -d
```

Access the applications:
- **Frontend App**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:3000](http://localhost:3000)

---

## 📜 License

This repository is maintained for NBA monitoring and curriculum management.
