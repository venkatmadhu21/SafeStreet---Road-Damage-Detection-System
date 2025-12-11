---
description: Repository Information Overview
alwaysApply: true
---

# SafeStreet - AI-Powered Road Damage Detection System

## Summary

SafeStreet is a full-stack application combining React frontend, Node.js/Express backend, and Python ML models for intelligent road damage detection. The system enables citizens to report road issues, administrators to manage reports, and municipal authorities to prioritize repairs using AI-powered Vision Transformer and YOLO models.

## Repository Structure

This is a monorepo containing two main applications:

- **Frontend**: React + Vite application serving as the web interface for citizens, admins, and authorities
- **Backend**: Node.js/Express server handling API requests, database operations, and AI model integration
- **ML Models**: Python scripts for YOLO detection and Vision Transformer classification

### Main Directories

- **`src/`**: Frontend React application with components, pages, and utilities
- **`BACKEND/`**: Backend Node.js server, database models, and Python AI scripts
- **`public/`**: Static assets and resources
- **`dist/`**: Production build output (Vite)
- **`temp_hf/`**: Hugging Face model cache directory

## Language & Runtime

**Frontend**:
- **Language**: JavaScript/JSX (React 19.0.0)
- **Runtime**: Node.js 20.19.0
- **Build Tool**: Vite 6.2.0
- **Styling**: TailwindCSS 4.0.15

**Backend**:
- **Language**: JavaScript (Node.js)
- **Framework**: Express.js 4.21.2
- **Database**: MongoDB with Mongoose 8.14.1
- **Authentication**: JWT with bcrypt 5.1.1

**ML/Python**:
- **Language**: Python 3.8+
- **Key Libraries**: PyTorch 2.0.1, Ultralytics YOLO 8.0.145, Timm 0.9.2

## Dependencies

### Frontend Main Dependencies

- **React & DOM**: React 19.0.0, React Router DOM 7.5.3
- **Styling & UI**: TailwindCSS 4.0.15, Styled Components 6.1.16, Tailwind Vite
- **Maps & Geospatial**: React Leaflet 5.0.0, Leaflet 1.9.4, React Google Maps 2.20.6
- **Data & Forms**: Axios 1.8.4, Form Data 4.0.2, EXIF-JS 2.3.0
- **Real-time**: Socket.IO Client 4.8.1, React Hot Toast 2.5.2
- **UI Components**: Lucide React, React Icons 5.5.0, React Spinners 0.17.0
- **Document Generation**: jsPDF 3.0.1, Docx 9.4.1, File Saver 2.0.5
- **Charts**: Recharts 2.15.2
- **Utilities**: Framer Motion 12.6.2, React Simple Typewriter 5.0.1, AOS 2.3.4

### Backend Main Dependencies

- **Framework**: Express 4.21.2, CORS 2.8.5, Body Parser 1.20.3
- **Database**: Mongoose 8.14.1, MongoDB 6.16.0
- **Authentication**: Bcrypt 5.1.1, JSONWebToken 9.0.2
- **File Handling**: Multer 1.4.5-lts.2, Sharp 0.33.5, Form Data 4.0.2
- **Real-time**: Socket.IO 4.8.1
- **Communication**: Nodemailer 6.10.1, Mailgun.js 12.0.1, Twilio 5.5.1, EmailJS 4.4.1
- **Utilities**: Axios 1.9.0, Dotenv 16.4.7, UUID 11.1.0, Python Shell 5.0.0
- **ML Runtime**: ONNX Runtime Node 1.21.0

### Python ML Dependencies

- PyTorch 2.0.1 with TorchVision 0.15.2
- Ultralytics YOLO 8.0.145
- Timm 0.9.2 (Vision Transformer models)
- Pillow 10.0.0 (image processing)
- PyMongo 4.5.0 (database)

## Build & Installation

**Install Frontend Dependencies**:
```bash
npm install
```

**Install Backend Dependencies**:
```bash
cd BACKEND
npm install
```

**Install Python Dependencies**:
```bash
pip install -r BACKEND/requirements.txt
```

## Build & Startup

**Development Mode**:
```bash
npm run dev              # Frontend (Vite dev server on port 5173)
npm run notifications   # Notification service
npm run dev:all        # Run frontend and notifications concurrently
```

**Backend Development**:
```bash
cd BACKEND
npm start               # Start Express server (default port 5000)
npm run start-model-api # Start Python ML model API
```

**Production Build**:
```bash
npm run build           # Build frontend for production
npm run preview         # Preview production build locally
```

## Configuration

**Environment Files** (.env):
```
MONGO_URI=mongodb://localhost:27017/Safestreet
PORT=5000
NODE_ENV=development
JWT_SECRET=your-secret-key
EMAIL_USER=your-email
EMAIL_PASS=your-app-password
HF_TOKEN=your-huggingface-token
```

**Vite Configuration**: `vite.config.js`
- React plugin enabled
- TailwindCSS Vite plugin for styling
- Allowed hosts configured for development

**ESLint Configuration**: `eslint.config.js`

## Main Files & Entry Points

**Frontend**:
- **Entry Point**: `src/main.jsx` - React app initialization with loading screen
- **App Component**: `src/App.jsx` - Main application router and layout
- **Pages**: `src/pages/` - User, Admin, Authority dashboards, Upload, Map, Login
- **Components**: `src/components/` - Reusable UI components (Navbar, Dashboard, Maps, etc.)
- **Utilities**: `src/utils/` - API helpers, configuration, image utilities

**Backend**:
- **Server**: `BACKEND/server.js` - Express server, Socket.IO, API routes, file uploads
- **Database Models**: `BACKEND/models/User.js`, `RoadEntry.js`, `Feedback.js`
- **Python Scripts**: `BACKEND/models/detect.py`, `predict.py` - YOLO detection and ViT classification

## Testing

No formal test configuration files found. Testing approach:
```bash
npm test                # Frontend tests (if configured)
cd BACKEND && npm test # Backend tests (if configured)
```

## Linting

**ESLint Configuration**: `eslint.config.js`

**Run Linter**:
```bash
npm run lint
```

**Linting Plugins**: ESLint JS, React Hooks, React Refresh

## Project Capabilities

**AI Models** (Hosted on Hugging Face):
- YOLO v8 for damage localization and bounding boxes
- Vision Transformer (ViT) for damage classification and severity assessment
- Road surface classifier for surface condition analysis

**Core Features**:
- JWT-based user authentication with role-based access control
- Image upload with GPS location extraction via EXIF
- Real-time WebSocket notifications
- Interactive map visualization with geospatial clustering
- Dashboard analytics with trend analysis and PDF/Excel export
- Multi-user support (Citizens, Admins, Authorities)
- Email notifications and feedback system

**Technology Stack Summary**:
- Frontend: React 19 + Vite + TailwindCSS
- Backend: Node.js + Express + MongoDB
- Real-time: Socket.IO
- ML: Python (PyTorch, YOLO, ViT)
- Deployment: Vercel-compatible (with build scripts)
