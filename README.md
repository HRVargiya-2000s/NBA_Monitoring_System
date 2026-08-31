# 🎓 LDCE Academic System (LAS)

**A Comprehensive Academic Management Platform for Educational Institutions**

[![Node.js](https://img.shields.io/badge/Node.js-22.11.0-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.2.0-blue.svg)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Features](#-features) • [Tech Stack](#-tech-stack) • [Installation](#-installation) • [Usage](#-usage) • [API Docs](#-api-documentation) • [Contributing](#-contributing)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Architecture](#-project-architecture)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Running the Application](#-running-the-application)
- [API Documentation](#-api-documentation)
- [User Roles](#-user-roles)
- [Screenshots](#-screenshots)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Overview

**LDCE Academic System (LAS)** is a full-stack web application designed to streamline academic operations for educational institutions. It provides comprehensive tools for course management, attendance tracking, assessment evaluation, CO-PO attainment analysis, and report generation.

The system serves three main user roles:
- **Faculty** - Manage courses, track attendance, enter assessments, and generate reports
- **HOD (Head of Department)** - Monitor department performance, manage faculty, and control access
- **Admin** - System-wide configuration and user management

---

## ✨ Features

### 👨‍🏫 Faculty Features
- **Course Management**
  - Create and manage multiple courses
  - Define course syllabus and outcomes (COs)
  - Map COs to curriculum units
  - Enroll and manage students

- **Attendance System**
  - Mark attendance manually or via QR codes
  - View attendance statistics and trends
  - Generate attendance reports
  - Track defaulters

- **Assessment Management**
  - Enter assessment marks (CO-wise mapping)
  - Support for multiple assessment types (Quiz, Assignment, Midterm, Final)
  - Calculate statistics and averages
  - View student performance analytics

- **CO-PO Attainment**
  - Calculate Course Outcome (CO) attainment
  - Map COs to Program Outcomes (POs)
  - Generate attainment matrices
  - Compare attainment across courses

- **Report Generation**
  - Generate PDF and Excel reports
  - Multiple report types (Course, Assessment, Attendance, Attainment)
  - Export and download capabilities
  - Automated report scheduling

### 👔 HOD Features
- **Department Dashboard**
  - Real-time department analytics
  - Performance monitoring
  - Attendance trends visualization
  - Quick access statistics

- **Access Control Management**
  - Grant/revoke inter-department access
  - Manage faculty permissions
  - Audit access logs

- **Faculty Mapping**
  - Assign courses to faculty
  - View faculty workload
  - Manage faculty profiles

- **Performance Analytics**
  - Department-wide performance metrics
  - Comparative analysis
  - Trend visualization with charts
  - Data-driven insights

### 🔐 Security & Authentication
- Google OAuth integration
- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- Password encryption with bcrypt
- Session management
- Rate limiting and request throttling

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.2.0 | UI Framework |
| **Vite** | 7.3.0 | Build Tool & Dev Server |
| **React Router** | - | Client-side routing |
| **Recharts** | 3.6.0 | Data visualization |
| **Font Awesome** | 7.1.0 | Icons |
| **Lucide React** | Latest | Modern icons |
| **Google OAuth** | 0.12.2 | Authentication |
| **JWT Decode** | 4.0.0 | Token management |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 22.11.0 | Runtime Environment |
| **Express.js** | 4.21.2 | Web Framework |
| **MongoDB** | Atlas | Database |
| **Mongoose** | 8.9.5 | ODM |
| **JWT** | 9.0.2 | Authentication |
| **Bcrypt** | 5.1.1 | Password Hashing |
| **Nodemailer** | 6.9.16 | Email Service |
| **Winston** | 3.17.0 | Logging |
| **Multer** | 1.4.5-lts.1 | File Upload |
| **PDFKit** | 0.15.1 | PDF Generation |
| **ExcelJS** | 4.4.0 | Excel Reports |
| **Helmet** | 8.0.0 | Security |
| **Express Validator** | 7.2.1 | Input Validation |

---

## 🏗️ Project Architecture

```
C2C-108/
├── 📁 frontend/
│   ├── 📁 src/
│   │   ├── 📁 components/      # Reusable UI components
│   │   ├── 📁 pages/           # Page components
│   │   ├── 📁 styles/          # CSS stylesheets
│   │   ├── 📁 utils/           # Helper functions
│   │   ├── App.jsx             # Main app component
│   │   └── main.jsx            # Entry point
│   ├── 📁 public/              # Static assets
│   ├── index.html              # HTML template
│   ├── package.json            # Frontend dependencies
│   └── vite.config.js          # Vite configuration
│
└── 📁 backend/
    ├── 📁 src/
    │   ├── 📁 config/          # Configuration files
    │   ├── 📁 controllers/     # Business logic
    │   ├── 📁 models/          # Database models
    │   ├── 📁 routes/          # API routes (auto-discovered)
    │   ├── 📁 middleware/      # Custom middleware
    │   ├── 📁 services/        # Email, PDF, Excel services
    │   ├── 📁 utils/           # Helper utilities
    │   └── server.js           # Entry point
    ├── 📁 uploads/             # File uploads
    ├── 📁 logs/                # Application logs
    ├── .env                    # Environment variables
    ├── package.json            # Backend dependencies
    └── 📚 Documentation files
```

### Key Architecture Highlights

#### 🔥 Dynamic API Routing
- Automatic route discovery and registration
- No manual route imports needed
- Just create `*Routes.js` files in `src/routes/`
- Routes are automatically available at `/api/<name>`

#### 🔒 Security Layers
- Helmet for HTTP headers
- Rate limiting (100 req/15min)
- CORS protection
- MongoDB injection prevention
- XSS protection
- Input validation on all endpoints

#### 📊 Database Schema
- **8 MongoDB Collections**: Users, Courses, Students, Attendance, Assessments, Attainment, Reports, AccessControl
- Optimized indexes for performance
- Relationship management with Mongoose

---

## 🚀 Installation

### Prerequisites
- **Node.js** >= 22.11.0
- **MongoDB Atlas** account (or local MongoDB)
- **npm** or **yarn**
- **Git**

### Clone the Repository
```bash
git clone https://github.com/yourusername/C2C-108.git
cd C2C-108
```

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration (see [Configuration](#-configuration))

4. **Test database connection**
   ```bash
   node test-db-connection.js
   ```

### Frontend Setup

1. **Navigate to root directory**
   ```bash
   cd ..
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

---
### Google OAuth Setup (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs
6. Update `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`

---

## 🎯 Running the Application

### Development Mode

**Terminal 1: Start Backend Server**
```bash
cd backend
npm run dev
```
Server runs at: `http://localhost:5000`

**Terminal 2: Start Frontend Development Server**
```bash
npm run dev
```
Frontend runs at: `http://localhost:5173`

### Production Mode

**Build Frontend**
```bash
npm run build
npm run preview
```

**Run Backend with PM2**
```bash
cd backend
npm install -g pm2
pm2 start src/server.js --name ldce-api
pm2 save
pm2 startup
```

---

## 📡 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login with credentials |
| GET | `/auth/me` | Get current user profile |
| POST | `/auth/logout` | Logout user |
| POST | `/auth/refresh-token` | Refresh access token |
| PUT | `/auth/update-password` | Update password |
| POST | `/auth/google` | Google OAuth login |

### Course Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/courses` | Get all courses |
| POST | `/courses` | Create new course |
| GET | `/courses/:id` | Get course by ID |
| PUT | `/courses/:id` | Update course |
| DELETE | `/courses/:id` | Delete course |
| POST | `/courses/:id/syllabus` | Add/update syllabus |
| POST | `/courses/:id/outcomes` | Add course outcomes |
| POST | `/courses/:id/co-unit-mapping` | Map COs to units |
| POST | `/courses/:id/students` | Enroll students |

### Attendance Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/attendance/mark` | Mark attendance |
| GET | `/attendance/course/:courseId` | Get attendance by course |
| GET | `/attendance/student/:studentId` | Get student attendance |
| GET | `/attendance/statistics/:courseId` | Get attendance statistics |
| POST | `/attendance/qr-generate` | Generate QR code |

### Assessment Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/assessments` | Create assessment |
| GET | `/assessments/course/:courseId` | Get course assessments |
| POST | `/assessments/:id/marks` | Enter marks |
| GET | `/assessments/:id/statistics` | Get statistics |
| PUT | `/assessments/:id` | Update assessment |
| DELETE | `/assessments/:id` | Delete assessment |

### Attainment Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/attainment/calculate` | Calculate CO-PO attainment |
| GET | `/attainment/course/:courseId` | Get course attainment |
| GET | `/attainment/compare` | Compare attainments |

### Report Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/reports/generate` | Generate report |
| GET | `/reports` | Get all reports |
| GET | `/reports/:id` | Get report by ID |
| GET | `/reports/:id/download` | Download report |
| DELETE | `/reports/:id` | Delete report |

### Access Control Endpoints (HOD Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/access-control/grant` | Grant access |
| POST | `/access-control/revoke` | Revoke access |
| GET | `/access-control` | Get all access permissions |
| GET | `/access-control/faculty/:id` | Get faculty access |

**📚 Complete API Documentation:** See [backend/API_DOCUMENTATION.md](backend/API_DOCUMENTATION.md)

---

## 👥 User Roles

### Faculty
- Default role for teaching staff
- Access to course management, attendance, assessments
- Can generate reports for their courses
- View CO-PO attainment

### HOD (Head of Department)
- All faculty permissions
- Department-wide analytics dashboard
- Access control management
- Faculty mapping and workload distribution
- Performance monitoring

### Admin
- System-wide access
- User management
- Configuration settings
- Audit logs

---

## 📸 Screenshots

### Login Page
<img src="docs/screenshots/login.png" alt="Login Page" width="600"/>

### Faculty Dashboard
<img src="docs/screenshots/faculty-dashboard.png" alt="Faculty Dashboard" width="600"/>

### HOD Dashboard
<img src="docs/screenshots/hod-dashboard.png" alt="HOD Dashboard" width="600"/>

### Course Overview
<img src="docs/screenshots/course-overview.png" alt="Course Overview" width="600"/>

### Attendance Tracking
<img src="docs/screenshots/attendance.png" alt="Attendance" width="600"/>

### CO-PO Attainment View
<img src="docs/screenshots/co-po-attainment.png" alt="CO-PO Attainment" width="600"/>

---

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
npm test
```

### API Testing with Postman
Import the Postman collection from `docs/postman/LAS-API.postman_collection.json`

---

## 📦 Deployment

### Deploy to Heroku

**Backend:**
```bash
cd backend
heroku create ldce-api
heroku addons:create mongolab
git push heroku main
```

**Frontend:**
```bash
npm run build
# Deploy to Netlify, Vercel, or GitHub Pages
```

### Deploy with Docker

```bash
docker-compose up --build
```

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```
4. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**

### Code Style Guidelines
- Follow ESLint configuration
- Use meaningful variable names
- Add comments for complex logic
- Write unit tests for new features
- Update documentation

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Authors

**LDCE Development Team**
- Project Lead: [Your Name]
- Backend Developer: [Name]
- Frontend Developer: [Name]
- UI/UX Designer: [Name]

---

## 🙏 Acknowledgments

- L.D. College of Engineering for project sponsorship
- MongoDB Atlas for database hosting
- React and Node.js communities
- All contributors and testers

---

## 📞 Support

For support and queries:
- 📧 Email: support@ldce.ac.in
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/C2C-108/issues)
- 📖 Documentation: [Wiki](https://github.com/yourusername/C2C-108/wiki)

---

## 🗺️ Roadmap

- [x] Core authentication system
- [x] Course management
- [x] Attendance tracking
- [x] Assessment management
- [x] CO-PO attainment calculation
- [x] Report generation
- [ ] Mobile app (React Native)
- [ ] Real-time notifications
- [ ] Video lecture integration
- [ ] AI-powered analytics
- [ ] Student portal
- [ ] Parent portal

---

<div align="center">

**Made with ❤️ by LDCE Development Team**

⭐ Star this repo if you find it helpful!

</div>
