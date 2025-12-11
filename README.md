# SafeStreet - AI-Powered Road Damage Detection System

<div align="center">
  <img src="https://img.shields.io/badge/React-19.0.0-blue?style=for-the-badge&logo=react" alt="React">
  <img src="https://img.shields.io/badge/Node.js-20.19.0-green?style=for-the-badge&logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/MongoDB-Latest-green?style=for-the-badge&logo=mongodb" alt="MongoDB">
  <img src="https://img.shields.io/badge/Python-3.8+-blue?style=for-the-badge&logo=python" alt="Python">
  <img src="https://img.shields.io/badge/AI-Vision%20Transformer-orange?style=for-the-badge" alt="AI">
</div>

## 🚧 Overview

SafeStreet is an intelligent road damage detection and management system that leverages cutting-edge AI technology to automate the identification, classification, and prioritization of road infrastructure issues. The system combines computer vision, machine learning, and real-time communication to provide municipalities and authorities with actionable insights for road maintenance.

### 🎯 Key Features

- **🤖 AI-Powered Analysis**: Advanced Vision Transformer (ViT) and YOLO models for accurate damage detection
- **📱 Multi-Platform Access**: Web-based interface with mobile-responsive design
- **🗺️ Interactive Mapping**: Real-time visualization of damage reports with geospatial indexing
- **⚡ Real-Time Updates**: WebSocket-based notifications for instant updates
- **👥 Multi-User Support**: Separate dashboards for citizens, administrators, and authorities
- **📊 Analytics Dashboard**: Comprehensive reporting and damage severity analytics
- **🔐 Secure Authentication**: JWT-based authentication with role-based access control
- **📧 Automated Notifications**: Email alerts and feedback system

## 🏗️ System Architecture

### Frontend (React + Vite)
- **Framework**: React 19.0.0 with Vite for fast development
- **Styling**: TailwindCSS 4.0 for modern, responsive design
- **Maps**: React Leaflet for interactive mapping
- **State Management**: React hooks and context
- **Real-time**: Socket.IO client for live updates

### Backend (Node.js + Express)
- **Runtime**: Node.js 20.19.0 with Express.js framework
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT tokens with bcrypt password hashing
- **File Upload**: Multer for image processing
- **Real-time**: Socket.IO server for WebSocket connections
- **Email**: Nodemailer for automated notifications

### AI/ML Pipeline (Python)
- **Object Detection**: YOLO v8 for damage localization
- **Classification**: Vision Transformer (ViT) for damage type identification
- **Road Classification**: Custom CNN for road surface analysis
- **Frameworks**: PyTorch, Ultralytics, Timm
- **Model Hosting**: Hugging Face Hub integration

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+
- MongoDB (local or cloud)
- Git

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/safestreet-road-damage-detection.git
   cd safestreet-road-damage-detection
   ```

2. **Install Frontend Dependencies**
   ```bash
   npm install
   ```

3. **Install Backend Dependencies**
   ```bash
   cd BACKEND
   npm install
   ```

4. **Install Python Dependencies**
   ```bash
   pip install -r BACKEND/requirements.txt
   ```

5. **Environment Configuration**
   
   Create `.env` file in the root directory:
   ```env
   # Database
   MONGO_URI=mongodb://localhost:27017/Safestreet
   
   # Server
   PORT=5000
   NODE_ENV=development
   
   # JWT
   JWT_SECRET=your-super-secret-jwt-key
   
   # Email Configuration
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   
   # Hugging Face (Optional)
   HF_TOKEN=your-huggingface-token
   ```

6. **Start the Application**
   
   **Development Mode (Recommended):**
   ```bash
   # Terminal 1: Start Frontend
   npm run dev
   
   # Terminal 2: Start Backend
   cd BACKEND
   npm start
   ```
   
   **Production Mode:**
   ```bash
   npm run build
   npm start
   ```

7. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000
   - Health Check: http://localhost:5000/health

## 📁 Project Structure

```
safestreet/
├── 📁 src/                          # Frontend React application
│   ├── 📁 components/               # Reusable UI components
│   │   ├── Navbar.jsx              # Navigation bar
│   │   ├── Hero.jsx                # Landing page hero section
│   │   ├── Features.jsx            # Features showcase
│   │   ├── Dashboard.jsx           # Admin dashboard
│   │   ├── MyMap.jsx               # Interactive map component
│   │   └── ...
│   ├── 📁 pages/                   # Page components
│   │   ├── Upload.jsx              # Image upload and analysis
│   │   ├── Admin.jsx               # Admin dashboard
│   │   ├── AuthorityPage.jsx       # Municipal authority interface
│   │   ├── MapView.jsx             # Map visualization
│   │   ├── LoginPage.jsx           # User authentication
│   │   └── ...
│   ├── 📁 utils/                   # Utility functions
│   │   ├── apiHelper.js            # API communication helpers
│   │   ├── apiConfig.js            # API configuration
│   │   └── ...
│   └── App.jsx                     # Main application component
├── 📁 BACKEND/                     # Backend Node.js application
│   ├── 📁 api/                     # API route handlers
│   ├── 📁 models/                  # Database models and AI scripts
│   │   ├── detect.py               # YOLO object detection
│   │   ├── predict.py              # ViT classification
│   │   ├── User.js                 # User model
│   │   └── ...
│   ├── server.js                   # Main server file
│   ├── huggingface_integration.py  # AI model integration
│   └── requirements.txt            # Python dependencies
├── 📁 temp_hf/                     # Hugging Face model cache
├── 📁 public/                      # Static assets
├── package.json                    # Frontend dependencies
└── README.md                       # This file
```

## 🔧 API Endpoints

### Authentication
- `POST /api/signup` - User registration
- `POST /api/login` - User login
- `POST /api/create-admin` - Create admin user

### Image Processing
- `POST /api/upload` - Upload and analyze road damage images
- `GET /api/final-images` - Retrieve processed images
- `GET /api/road-entries` - Get road damage entries

### Data Management
- `GET /api/dashboard-stats` - Dashboard analytics
- `POST /api/feedback` - Submit user feedback
- `GET /api/feedback` - Retrieve feedback (admin)

### Real-time Features
- WebSocket events for live notifications
- Real-time damage report updates

## 🤖 AI Models

### 1. YOLO v8 Object Detection
- **Purpose**: Localize and detect road damage in images
- **Model**: `venkatmadhu/safestreet-yolo`
- **Output**: Bounding boxes with confidence scores

### 2. Vision Transformer (ViT)
- **Purpose**: Classify damage types and assess severity
- **Model**: `venkatmadhu/safestreet-vit`
- **Classes**: Potholes, cracks, patches, and more

### 3. Road Surface Classifier
- **Purpose**: Identify road surface conditions
- **Model**: `venkatmadhu/safestreet-road-classifier`
- **Output**: Surface type and condition assessment

## 👥 User Roles

### 🏠 Citizens
- Upload road damage images
- View damage reports on map
- Track report status
- Provide feedback

### 👨‍💼 Administrators
- Review and approve damage reports
- Manage user accounts
- Access analytics dashboard
- Handle feedback and communications

### 🏛️ Municipal Authorities
- Prioritize repair work
- Generate reports
- Monitor damage trends
- Coordinate maintenance activities

## 🗺️ Features Deep Dive

### Image Upload & Analysis
1. **Capture/Upload**: Users can capture images directly or upload existing photos
2. **Location Detection**: Automatic GPS coordinate extraction
3. **AI Processing**: Multi-model analysis pipeline
4. **Results Display**: Visual feedback with bounding boxes and severity scores

### Interactive Mapping
- **Real-time Updates**: Live damage report visualization
- **Clustering**: Intelligent grouping of nearby reports
- **Filtering**: Filter by damage type, severity, and status
- **Geospatial Queries**: Efficient location-based searches

### Dashboard Analytics
- **Damage Statistics**: Comprehensive damage type and severity analytics
- **Trend Analysis**: Historical data visualization
- **Performance Metrics**: System usage and processing statistics
- **Export Capabilities**: PDF and Excel report generation

## 🔒 Security Features

- **Authentication**: JWT-based secure authentication
- **Authorization**: Role-based access control (RBAC)
- **Data Validation**: Input sanitization and validation
- **File Security**: Secure file upload with type validation
- **CORS Protection**: Configured cross-origin resource sharing

## 🚀 Deployment

### Development
```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
```

### Production Deployment

#### Using PM2 (Recommended)
```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start ecosystem.config.js

# Monitor
pm2 monit
```

#### Using Docker
```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

## 📊 Performance Optimization

- **Image Compression**: Automatic image optimization
- **Lazy Loading**: Component and image lazy loading
- **Caching**: Strategic caching for API responses
- **Database Indexing**: Optimized MongoDB indexes
- **CDN Integration**: Static asset delivery optimization

## 🧪 Testing

```bash
# Run frontend tests
npm test

# Run backend tests
cd BACKEND
npm test

# Run Python model tests
python -m pytest tests/
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow ESLint configuration
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## 📝 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Hugging Face** for model hosting and AI infrastructure
- **OpenStreetMap** for mapping data
- **MongoDB** for database services
- **Vercel/Netlify** for deployment platforms

## 📞 Support

For support, email support@safestreet.com or join our [Discord community](https://discord.gg/safestreet).

## 🔮 Roadmap

- [ ] Mobile app development (React Native)
- [ ] Advanced analytics with ML insights
- [ ] Integration with municipal systems
- [ ] Multi-language support
- [ ] Offline capability
- [ ] Advanced reporting features

---

<div align="center">
  <p>Made with ❤️ by the SafeStreet Team</p>
  <p>
    <a href="#top">Back to Top</a> •
    <a href="https://github.com/your-username/safestreet/issues">Report Bug</a> •
    <a href="https://github.com/your-username/safestreet/issues">Request Feature</a>
  </p>
</div>
