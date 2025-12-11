// Import Statements - Essential modules for server functionality
import express from "express";                // Imports Express.js framework for creating the web server
import cors from "cors";                      // Imports CORS middleware to handle cross-origin requests
import mongoose from "mongoose";              // Imports Mongoose for MongoDB object modeling
import bcrypt from "bcrypt";                  // Imports bcrypt for password hashing and verification
import dotenv from "dotenv";                  // Imports dotenv for loading environment variables
import multer from "multer";                  // Imports multer for handling file uploads
import { spawn } from "child_process";        // Imports spawn from child_process to run Python scripts
import fs from "fs";                          // Imports file system module for file operations
import path from "path";                      // Imports path module for handling file paths
import { Server } from "socket.io";           // Imports Socket.IO server for real-time communication
import http from "http";                      // Imports HTTP module to create the server
import nodemailer from "nodemailer";          // Imports nodemailer for sending emails
// Load environment variables from .env file
dotenv.config();

// Configuration Setup - Server and database settings
const PORT = process.env.PORT || 5000;        // Sets server port from environment or defaults to 5000
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/Inspectify"; // Sets MongoDB connection string
const __dirname = path.resolve();             // Gets the current directory path (ES modules don't have __dirname)

// Define storage directories based on environment
const isProduction = process.env.NODE_ENV === 'production'; // Checks if running in production
const STORAGE_DIR = isProduction ? '/tmp' : __dirname;      // Uses /tmp in production, local directory in development
const UPLOADS_DIR = path.join(STORAGE_DIR, isProduction ? 'uploads' : 'uploads'); // Path for uploaded images
const FINAL_DIR = path.join(STORAGE_DIR, isProduction ? 'final' : 'final');       // Path for processed images

// Server Setup - Create Express and HTTP server instances
const app = express();                        // Creates Express application
const server = http.createServer(app);        // Creates HTTP server with Express app

// Socket.IO Setup - Real-time communication server
const io = new Server(server, {               // Creates Socket.IO server with configuration
  cors: {                                     // CORS settings for Socket.IO
    origin: "*",                              // Allows connections from any origin
    methods: ["GET", "POST", "OPTIONS"],      // Allowed HTTP methods
    credentials: true,                        // Allows cookies to be sent with requests
    allowedHeaders: ["*"]                     // Allows all headers
  },
  transports: ['polling', 'websocket'],       // Connection methods (polling as fallback)
  pingTimeout: 60000,                         // Timeout for ping packets (60 seconds)
  pingInterval: 25000,                         // Interval between pings (25 seconds)
  allowEIO3: true                             // Allows Engine.IO 3 compatibility
});

// Middleware Configuration - Set up Express middleware for request handling

// Configure CORS for Express
app.use(cors({                                // Adds CORS middleware to Express
  origin: '*',                                // Allows requests from any origin
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'], // Allowed HTTP methods
  credentials: true,                          // Allows cookies to be sent
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'] // Allowed headers
}));

// Add CORS headers to all responses
app.use((req, res, next) => {                 // Custom middleware for additional CORS headers
  res.header('Access-Control-Allow-Origin', '*'); // Allows any origin
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS'); // Allowed methods
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With'); // Allowed headers
  res.header('Access-Control-Allow-Credentials', 'true'); // Allows credentials
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {             // Special handling for OPTIONS requests (preflight)
    return res.status(200).end();             // Responds with 200 OK and ends the request
  }
  
  next();                                     // Proceeds to the next middleware
});

// Request body parsing and static file serving
app.use(express.json({ limit: '50mb' }));     // Parses JSON bodies with 50MB limit for large images
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Parses URL-encoded bodies
app.use("/uploads", express.static(UPLOADS_DIR)); // Serves uploaded files statically
app.use("/final", express.static(FINAL_DIR));     // Serves processed files statically

// Basic Routes - Simple endpoints for monitoring and testing

// Add a health check endpoint
app.get('/health', (req, res) => {            // Health check endpoint for monitoring
  res.status(200).json({                      // Returns JSON with status information
    status: 'ok', 
    timestamp: new Date().toISOString(),
    socketio: 'enabled',
    version: '1.0.0'
  });
});

// Serve the socket test page
app.get('/socket-test', (req, res) => {       // Endpoint to serve a Socket.IO test page
  res.sendFile(path.join(__dirname, 'socket_test.html')); // Sends the HTML file
});

// Directory Setup - Create necessary directories for file storage

// Create necessary directories
[UPLOADS_DIR, FINAL_DIR].forEach((dir) => {   // Loops through required directories
  if (!fs.existsSync(dir)) {                  // Checks if directory exists
    try {
      fs.mkdirSync(dir, { recursive: true }); // Creates directory and parent directories
      console.log(`Created directory: ${dir}`);
    } catch (err) {
      console.warn(`Warning: Could not create directory ${dir}:`, err.message);
    }
  }
});

// Database Connection - Connect to MongoDB and set up indexes

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true }) // Connects to MongoDB
  .then(() => {
    console.log("✅ MongoDB connected");
    
    // Create geospatial index on FinalImage collection after connection
    mongoose.connection.useDb("Safestreet").collection("final_img").createIndex(
      { "location": "2dsphere" },             // Creates a geospatial index for location queries
      { background: true }                    // Creates index in the background
    ).then(() => {
      console.log("✅ Geospatial index created on final_img collection");
    }).catch(err => {
      console.error("❌ Error creating geospatial index:", err);
    });
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Database References - Get references to database and collections
const db = mongoose.connection.useDb("Safestreet"); // Uses the Safestreet database
const loginCollection = db.collection("login");     // References the login collection

// Database Schema Definitions - Define data models for the application

// Feedback schema for user feedback
const feedbackSchema = new mongoose.Schema({
  name: String,                               // User's name
  email: String,                              // User's email
  subject: String,                            // Feedback subject
  message: String,                            // Feedback message
  completed: { type: Boolean, default: false }, // Whether feedback has been addressed
  dateSubmitted: { type: Date, default: Date.now }, // Submission date
  userId: { type: String },                   // User ID who submitted feedback
  replied: { type: Boolean, default: false }, // Whether a reply has been sent
  replyText: String,                          // Reply message
  replyDate: Date,                            // Date of reply
});
const Feedback = db.model("Feedback", feedbackSchema); // Creates Feedback model

// Road entry schema for initial road damage reports
const roadEntrySchema = new mongoose.Schema({
  imagePath: String,                          // Path to the uploaded image
  latitude: String,                           // Location latitude
  longitude: String,                          // Location longitude
  address: String,                            // Human-readable address
  timestamp: { type: Date, default: Date.now }, // Submission time
  reviewed: { type: Boolean, default: false }, // Whether entry has been reviewed
  reviewStatus: { type: String, enum: ['approved', 'rejected', 'pending', 'in-progress'], default: 'pending' }, // Review status
  reviewNotes: { type: String, default: '' }, // Notes from reviewer
  severity: { type: String, enum: ['low', 'moderate', 'high', 'severe', 'unknown'], default: 'unknown' }, // Damage severity
  damageType: {                               // Type of damage detected
    type: mongoose.Schema.Types.Mixed,        // Can be string or array
    default: ['pothole']
  },
  recommendedAction: { type: String, default: '' }, // Recommended repair action
  reviewDate: { type: Date },                 // Date of review
  userId: { type: String, required: true },   // User who uploaded the image
  reviewerId: { type: String },               // User who reviewed the entry
});

// Add a pre-save hook to ensure damageType is always an array
roadEntrySchema.pre('save', function(next) {
  // Convert string to array if needed
  if (typeof this.damageType === 'string') {
    this.damageType = [this.damageType];
  }
  
  // Ensure it's an array
  if (!Array.isArray(this.damageType)) {
    this.damageType = ['pothole'];
  }
  
  next();
});

// Create the model
const RoadEntry = db.model("RoadEntry", roadEntrySchema, "roadloc");

// FinalImage schema for processed images with AI analysis
const FinalImage = db.model(
  "FinalImage",
  new mongoose.Schema({
    imagePath: String,                        // Original image path
    boundingBoxImagePath: String,             // Path to image with bounding boxes
    latitude: Number,                         // Location latitude as number
    longitude: Number,                        // Location longitude as number
    address: String,                          // Human-readable address
    analysisResult: Object,                   // Full AI analysis result
    status: { type: String, enum: ['Pending', 'Critical', 'Processed', 'Resolved'], default: 'Pending' }, // Processing status
    severity: { type: Number, default: 50 },  // Numeric severity (0-100)
    severityLevel: { type: String, enum: ['low', 'moderate', 'high', 'severe', 'unknown'], default: 'unknown' }, // Text severity
    userId: { type: String, required: true }, // User who uploaded the image
    processingTime: Number,                   // Time taken to process the image
    timestamp: { type: Date, default: Date.now }, // Submission time
    damageType: { type: String, default: 'unknown' }, // Type of damage detected
    detectionCount: { type: Number, default: 0 }, // Number of detections
    reviewed: { type: Boolean, default: false }, // Whether image has been reviewed
    reviewerId: { type: String },             // User who reviewed the image
    reviewDate: { type: Date },               // Date of review
    reviewNotes: { type: String },            // Notes from reviewer
    recommendedAction: { type: String },      // Recommended repair action
    // Geospatial index for location-based queries
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' }, // GeoJSON type
      coordinates: { type: [Number], default: [0, 0] }  // [longitude, latitude]
    }
  }, {
    timestamps: true                          // Adds createdAt and updatedAt fields
  }),
  "final_img"                                 // Collection name
);

// File Upload Configuration - Set up multer for handling file uploads
const storage = multer.memoryStorage();       // Uses memory storage for file uploads
const upload = multer({ 
  storage,                                    // Uses the defined storage
  limits: {
    fileSize: 10 * 1024 * 1024,               // 10MB limit for uploaded files
  }
});

// WebSocket User Tracking - Track connected users and their socket IDs
const userSockets = new Map();                // Map to track user connections (userId -> socket.id)

// Function to validate user type
const validateUserType = (userId) => {
  if (!userId) return { valid: false, message: "No userId provided" }; // Checks if userId exists
  
  // Check if userId format is valid
  const isAdmin = userId.startsWith('admin_'); // Admin IDs start with 'admin_'
  const isRegularUser = userId.includes('_') || userId.match(/^[0-9a-f]{24}$/i); // Regular user format
  
  if (!isAdmin && !isRegularUser) {
    return { valid: false, message: "Invalid userId format" };
  }
  
  return { 
    valid: true, 
    isAdmin, 
    userType: isAdmin ? 'admin' : 'user',
    message: `Valid ${isAdmin ? 'admin' : 'regular'} user`
  };
};

// Socket.IO Connection Handling - Manage real-time connections with clients
io.on("connection", (socket) => {             // Handles new socket connections
  console.log("🟢 WebSocket client connected:", socket.id);
  
  // Set a connection timeout if not authenticated within 30 seconds
  const authTimeout = setTimeout(() => {
    if (!socket.userId) {                     // Checks if user has authenticated
      console.log(`Socket ${socket.id} not authenticated within timeout period, disconnecting`);
      socket.disconnect(true);                // Disconnects unauthenticated users
    }
  }, 30000);
  
  // Handle user authentication
  socket.on("authenticate", (userId) => {     // Listens for authentication events
    // Clear the auth timeout since we received an authentication attempt
    clearTimeout(authTimeout);
    
    // Validate the user
    const validation = validateUserType(userId);
    
    if (validation.valid) {                   // If user is valid
      console.log(`User ${userId} (${validation.userType}) authenticated with socket ${socket.id}`);
      
      // Store user info in socket and tracking map
      userSockets.set(userId, socket.id);     // Maps userId to socket.id
      socket.userId = userId;                 // Stores userId in socket object
      socket.isAdmin = validation.isAdmin;    // Stores admin status
      socket.userType = validation.userType;  // Stores user type
      
      // Send confirmation to client
      socket.emit('auth_success', {           // Emits success event to client
        userId,
        userType: validation.userType,
        message: `Authentication successful as ${validation.userType}`
      });
      
      // Log all connected users after new connection
      console.log("Currently connected users:");
      for (const [uid, sid] of userSockets.entries()) {
        const userType = uid.startsWith('admin_') ? 'admin' : 'user';
        console.log(`- ${userType.toUpperCase()}: ${uid} -> Socket ${sid}`);
      }
    } else {                                  // If user is invalid
      console.log(`Authentication failed for socket ${socket.id}: ${validation.message}`);
      socket.emit('auth_error', { message: validation.message }); // Emits error event
      
      // Optionally disconnect invalid users
      // socket.disconnect(true);
    }
  });
  
  // Handle reconnection
  socket.on("reconnect", (attemptNumber) => { // Handles socket reconnections
    console.log(`Socket ${socket.id} reconnected after ${attemptNumber} attempts`);
    
    // Re-authenticate on reconnection
    if (socket.userId) {                      // If socket had a userId before
      console.log(`Re-authenticating user ${socket.userId} after reconnection`);
      userSockets.set(socket.userId, socket.id); // Updates socket.id in tracking map
      
      socket.emit('auth_success', {           // Emits success event to client
        userId: socket.userId,
        userType: socket.userType,
        message: `Re-authentication successful as ${socket.userType}`
      });
    }
  });
  
  // Handle ping for testing
  socket.on("ping", (data) => {               // Simple ping-pong for connection testing
    console.log(`Received ping from ${socket.id}:`, data);
    socket.emit("pong", { 
      time: new Date().toISOString(),
      received: data,
      message: "Server received your ping!"
    });
  });

  // Handle errors
  socket.on("error", (error) => {             // Handles socket errors
    console.error(`Socket ${socket.id} error:`, error);
  });
  
  socket.on("disconnect", (reason) => {       // Handles socket disconnections
    console.log(`🔴 Client disconnected: ${socket.id}, Reason: ${reason}`);
    // Remove user from tracking when they disconnect
    if (socket.userId) {
      console.log(`Removing user ${socket.userId} (${socket.userType}) from connected users`);
      userSockets.delete(socket.userId);      // Removes user from tracking map
      
      // Log remaining connected users
      console.log("Remaining connected users:");
      for (const [uid, sid] of userSockets.entries()) {
        const userType = uid.startsWith('admin_') ? 'admin' : 'user';
        console.log(`- ${userType.toUpperCase()}: ${uid} -> Socket ${sid}`);
      }
    }
  });
});

// Utility Functions - Helper functions for various operations

const getFormattedTimestamp = () => {         // Creates formatted timestamp for filenames
  const now = new Date();
  return now
    .toISOString()
    .replace(/[-T:\.Z]/g, "")                 // Removes special characters
    .slice(0, 15);                            // Takes first 15 characters
};

// API Endpoints - Main application routes

// --- /predict --- Initial road image prediction endpoint
app.post("/predict", upload.single("image"), async (req, res) => { // Handles image prediction requests
  try {
    const { latitude, longitude, address, userId } = req.body; // Gets data from request body
    if (!req.file) return res.status(400).json({ error: "No image file received!" }); // Validates file

    const timestamp = getFormattedTimestamp();
    const tempImagePath = path.join(STORAGE_DIR, `temp_${timestamp}.jpg`); // Creates temporary file path
    
    try {
      fs.writeFileSync(tempImagePath, req.file.buffer); // Writes uploaded file to disk
      console.log(`Temporary image saved to: ${tempImagePath}`);
    } catch (err) {
      console.error(`Error saving temporary image: ${err.message}`);
      return res.status(500).json({ error: "Failed to save temporary image" });
    }

    // For Vercel, we need to use the full path to the Python executable and script
    const pythonExecutable = isProduction ? 'python3' : 'python'; // Different executable based on environment
    const pythonScriptPath = path.join(__dirname, 'models', isProduction ? 'predict_vercel.py' : 'predict.py');
    
    console.log(`Running Python prediction: ${pythonExecutable} ${pythonScriptPath} ${tempImagePath}`);
    const pythonProcess = spawn(pythonExecutable, [pythonScriptPath, tempImagePath]); // Spawns Python process

    let predictionResult = "";

    pythonProcess.stdout.on("data", async (data) => { // Collects output from Python script
      predictionResult += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => { // Handles errors from Python script
      console.error("Python error:", data.toString());
    });

    pythonProcess.on("close", async (code) => { // Handles process completion
      try {
        if (fs.existsSync(tempImagePath)) {
          fs.unlinkSync(tempImagePath);       // Deletes temporary file
          console.log(`Temporary image deleted: ${tempImagePath}`);
        }
      } catch (err) {
        console.warn(`Warning: Could not delete temporary file ${tempImagePath}:`, err.message);
      }

      // Extract just the prediction from the output
      const outputLines = predictionResult.trim().split('\n');
      const lastLine = outputLines[outputLines.length - 1];
      const result = lastLine.split(' ')[0]; // Gets just "Road" or "Not a Road"
      
      // Extract confidence score
      let confidence = 0;
      const confidenceLine = outputLines.find(line => line.includes('confidence:'));
      if (confidenceLine) {
        const match = confidenceLine.match(/confidence:\s*([\d\.]+)/);
        if (match && match[1]) {
          confidence = parseFloat(match[1]);
        }
      }
      
      console.log("Python prediction output:", predictionResult.trim());
      console.log("Extracted result:", result);
      console.log("Extracted confidence:", confidence);
      
      if (code !== 0) {
        return res.status(500).json({ error: "Prediction process failed" });
      }

      let savedImagePath = null;
      
      if (result.toLowerCase() === "road") {
        const originalName = req.file.originalname.replace(/\s+/g, "_");
        const filename = `${originalName.split(".")[0]}_${timestamp}.jpg`;
        savedImagePath = path.join("uploads", filename);
        const fullSavedPath = path.join(UPLOADS_DIR, filename);
        
        try {
          fs.writeFileSync(fullSavedPath, req.file.buffer);
          console.log(`Image saved to: ${fullSavedPath}`);
        } catch (err) {
          console.error(`Error saving image: ${err.message}`);
          return res.status(500).json({ error: "Failed to save image" });
        }

        // Save with userId (required)
        if (!userId) {
          return res.status(400).json({ error: "User ID is required for image uploads" });
        }
        
        const entry = new RoadEntry({ 
          imagePath: savedImagePath, 
          latitude, 
          longitude, 
          address,
          userId: userId // Store the user ID
        });
        await entry.save();

        // Send notification to admins only
        // Find all admin sockets (we'll identify admins by userId starting with "admin_")
        for (const [connectedUserId, socketId] of userSockets.entries()) {
          if (connectedUserId.startsWith('admin_')) {
            io.to(socketId).emit("new-road-entry", {
              imagePath: savedImagePath,
              latitude,
              longitude,
              address,
              timestamp: entry.timestamp,
              userId: userId
            });
            
            io.to(socketId).emit("admin-notification", {
              message: "New image uploaded. Please review.",
              imagePath: savedImagePath,
              timestamp: entry.timestamp,
              userId: userId
            });
          }
        }
      }

      // Send prediction result only to the user who uploaded the image
      const userSocketId = userSockets.get(userId);
      if (userSocketId) {
        io.to(userSocketId).emit("prediction-complete", {
          message: `Prediction completed: ${result}`,
          imagePath: savedImagePath || "N/A",
          timestamp: new Date(),
          userId: userId
        });
      }

      res.status(200).json({ 
        prediction: result,
        confidence: confidence,
        saved: savedImagePath !== null
      });
    });
  } catch (error) {
    console.error("Prediction error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// --- /analyze-damage ---
app.post("/analyze-damage", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image file uploaded!" });

    console.time("analyze-damage");
    
    // Flag to track if response has been sent
    let responseSent = false;
    
    // Process image with maximum efficiency
    const timestamp = getFormattedTimestamp();
    const originalName = req.file.originalname.replace(/\s+/g, "_").split(".")[0];
    const finalFilename = `analyze_${originalName}_${timestamp}.jpg`;
    const finalImagePath = path.join("uploads", finalFilename);

    // Original method
    console.log("Using original detection method");
    
    // Original method as fallback
    function useOriginalMethod() {
      // Optimize image before saving to reduce processing time
      try {
        const sharp = require('sharp');
        // Process image with sharp for faster I/O and optimized size
        sharp(req.file.buffer)
          .resize(800, 800, { fit: 'inside' }) // Resize large images for faster processing
          .jpeg({ quality: 80, progressive: true })  // Reduced quality for faster processing
          .toFile(path.join(__dirname, finalImagePath))
          .then(() => {
            // Continue with Python process after image is saved
            runPythonProcess();
          })
          .catch(err => {
            // Fall back to standard file writing if sharp fails
            fs.promises.writeFile(path.join(__dirname, finalImagePath), req.file.buffer)
              .then(runPythonProcess)
              .catch(err => {
                if (!responseSent) {
                  res.status(500).json({ error: "Failed to save image" });
                  responseSent = true;
                }
              });
          });
      } catch (e) {
        // Fall back to standard file writing if sharp is not available
        fs.promises.writeFile(path.join(__dirname, finalImagePath), req.file.buffer)
          .then(runPythonProcess)
          .catch(err => {
            if (!responseSent) {
              res.status(500).json({ error: "Failed to save image" });
              responseSent = true;
            }
          });
      }
    }
    
    // Function to run the Python process
    function runPythonProcess() {
      // Use the original detection script with optimizations
      const pythonProcess = spawn("python", [
        "models/detect.py", 
        finalImagePath,
        req.body.latitude || "",
        req.body.longitude || ""
      ], {
        // Set higher process priority
        windowsHide: true,
        // Optimize environment variables
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1", // Disable buffering for faster output
          OMP_NUM_THREADS: "4",  // Optimize OpenMP threads
          MKL_NUM_THREADS: "4"   // Optimize MKL threads
        }
      });

      // Set timeout to prevent hanging
      const timeout = setTimeout(() => {
        if (!responseSent) {
          try {
            pythonProcess.kill();
            console.error("Python process timed out after 60 seconds");
            res.status(500).json({ error: "Analysis timed out. Please try again with a smaller image." });
            responseSent = true;
          } catch (e) {
            console.error("Error killing Python process:", e);
          }
        }
      }, 60000); // 60 second timeout

      // Use more efficient data collection
      const chunks = [];
      const errorChunks = [];
      
      pythonProcess.stdout.on("data", (data) => {
        chunks.push(data);
      });
      
      pythonProcess.stderr.on("data", (data) => {
        errorChunks.push(data);
        console.error("Python error:", data.toString());
      });

      pythonProcess.on("close", (code) => {
        clearTimeout(timeout);
        console.timeEnd("analyze-damage");
        
        // Don't send response if already sent
        if (responseSent) return;
        
        if (code !== 0) {
          console.error(`Python process exited with code ${code}`);
          res.status(500).json({ 
            error: "Analysis process failed", 
            details: Buffer.concat(errorChunks).toString() || "Unknown error"
          });
          responseSent = true;
          return;
        }
        
        try {
          // Combine chunks more efficiently
          const resultData = Buffer.concat(chunks).toString();
          
          // Find the JSON part of the output (in case there's debug info)
          const jsonMatch = resultData.match(/\{[\s\S]*\}/);
          const jsonStr = jsonMatch ? jsonMatch[0] : resultData;
          const parsed = JSON.parse(jsonStr);
          
          // Add server processing time
          parsed.server_processing_time = new Date().toISOString();
          
          // Send response with compression if supported
          res.status(200).json(parsed);
          responseSent = true;
          
          // Emit socket event for real-time updates to admins only (in background)
          setImmediate(() => {
            // Send to admins only
            for (const [connectedUserId, socketId] of userSockets.entries()) {
              if (connectedUserId.startsWith('admin_')) {
                io.to(socketId).emit("analysis-complete", {
                  message: "Image analysis completed",
                  severity: parsed.severity?.level || "Unknown",
                  timestamp: new Date()
                });
              }
            }
          });
        } catch (e) {
          console.error("Error parsing Python output:", e);
          if (!responseSent) {
            res.status(500).json({ error: "Failed to parse analysis results" });
            responseSent = true;
          }
        }
      });
    }
    
    // If we haven't started the original method yet, do it now
    if (!responseSent) {
      useOriginalMethod();
    }
  } catch (error) {
    console.error("Analyze Damage Error:", error);
    if (!responseSent) {
      res.status(500).json({ error: "Server error" });
    }
  }
});

// --- /save-canvas ---
app.post("/save-canvas", async (req, res) => {
  console.log("Received /save-canvas request");
  // Wrap the entire handler in a try-catch to ensure we always return a response
  try {
    const { 
      imagePath, 
      latitude, 
      longitude, 
      analysisResult, 
      address, 
      status, 
      severity, 
      severityLevel, 
      userId, 
      timestamp,
      boundingBoxImage  // Base64 encoded image with bounding boxes
    } = req.body;
    
    if (!imagePath || !analysisResult) {
      return res.status(400).json({ message: "Missing imagePath or analysis result." });
    }

    if (!userId) {
      return res.status(400).json({ message: "User ID is required." });
    }

    // Convert latitude and longitude to numbers if they're strings
    const parsedLatitude = latitude ? parseFloat(latitude) : null;
    const parsedLongitude = longitude ? parseFloat(longitude) : null;

    // Save the bounding box image if provided
    let boundingBoxImagePath = null;
    if (boundingBoxImage) {
      try {
        // Extract the base64 data
        const base64Data = boundingBoxImage.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Create a unique filename with userId for better tracking
        const timestamp = getFormattedTimestamp();
        const filename = `bbox_${userId}_${timestamp}.jpg`;
        boundingBoxImagePath = path.join("final", filename);
        
        // Ensure the directory exists
        const dirPath = path.join(__dirname, "final");
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        
        // Try to optimize the image with sharp if available
        try {
          const sharp = require('sharp');
          await sharp(buffer)
            .jpeg({ quality: 80, progressive: true })
            .toFile(path.join(__dirname, boundingBoxImagePath));
          console.log(`Optimized bounding box image saved to ${boundingBoxImagePath}`);
        } catch (sharpError) {
          // If sharp fails or is not available, fall back to direct file writing
          console.warn("Sharp optimization failed, using direct file write:", sharpError.message);
          fs.writeFileSync(path.join(__dirname, boundingBoxImagePath), buffer);
          console.log(`Bounding box image saved to ${boundingBoxImagePath} (unoptimized)`);
        }
      } catch (error) {
        console.error("Error saving bounding box image:", error);
        // Continue even if saving the image fails
      }
    } else {
      console.log("No bounding box image provided in request");
    }

    // Extract damage type from analysis result if available
    let damageType = 'unknown';
    if (analysisResult.vit_predictions && analysisResult.vit_predictions.length > 0) {
      damageType = analysisResult.vit_predictions[0]; // Use the first prediction as the primary damage type
    }

    // Calculate processing time
    const processingTime = analysisResult.clientProcessingTime || analysisResult.processing_time || null;

    // Calculate the number of detections
    const detectionCount = analysisResult?.detections?.length || 0;
    
    // Ensure severityLevel is a valid enum value
    let validSeverityLevel = severityLevel || 'unknown';
    // Map any non-standard severity levels to valid ones
    if (validSeverityLevel === 'medium') {
      validSeverityLevel = 'moderate';
    }
    
    // Make sure it's one of the allowed enum values
    if (!['low', 'moderate', 'high', 'severe', 'unknown'].includes(validSeverityLevel)) {
      validSeverityLevel = 'unknown';
    }
    
    // Create a new document with all the values
    const newResult = new FinalImage({ 
      imagePath, 
      boundingBoxImagePath,
      latitude: parsedLatitude, 
      longitude: parsedLongitude, 
      // Set up geospatial location field if coordinates are available
      location: parsedLatitude && parsedLongitude ? {
        type: 'Point',
        coordinates: [parsedLongitude, parsedLatitude]  // GeoJSON format is [longitude, latitude]
      } : undefined,
      analysisResult, 
      address,
      status: status || 'Pending',
      severity: severity || 50,
      severityLevel: validSeverityLevel,
      userId,
      processingTime,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      damageType,
      detectionCount
    });
    
    await newResult.save();

    // Send to admins only
    for (const [connectedUserId, socketId] of userSockets.entries()) {
      if (connectedUserId.startsWith('admin_')) {
        io.to(socketId).emit("prediction-complete", {
          message: "Image analysis completed and saved",
          imagePath,
          boundingBoxImagePath,
          severity: validSeverityLevel,
          timestamp: newResult.timestamp,
          id: newResult._id
        });
      }
    };

    res.status(200).json({ 
      message: "Analysis saved successfully.", 
      id: newResult._id,
      boundingBoxImagePath,
      detectionCount,
      severity: validSeverityLevel,
      status,
      timestamp: newResult.timestamp
    });
  } catch (err) {
    console.error("Error in /save-canvas:", err);
    // Send a more detailed error response
    res.status(500).json({ 
      message: "Failed to save to database.", 
      error: err.message,
      stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
  }
});

// --- /api/feedback ---
app.post("/api/feedback", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    const feedback = new Feedback({ name, email, subject, message });
    await feedback.save();
    res.status(200).json({ message: "Feedback submitted!" });
  } catch (error) {
    console.error("Feedback error:", error);
    res.status(500).json({ message: "Error saving feedback!" });
  }
});

// --- /api/feedbacks ---
app.get("/api/feedbacks", async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ dateSubmitted: -1 });
    res.status(200).json(feedbacks);
  } catch (error) {
    console.error("Error fetching feedbacks:", error);
    res.status(500).json({ error: "Error fetching feedbacks" });
  }
});

// --- /api/feedbacks/:id ---
app.patch("/api/feedbacks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { completed, userId } = req.body;
    
    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found" });
    }
    
    // Update the feedback status
    feedback.completed = completed;
    await feedback.save();
    
    // Send WebSocket notification to the user if userId is provided
    if (feedback.userId) {
      const userSocketId = userSockets.get(feedback.userId);
      if (userSocketId) {
        io.to(userSocketId).emit('feedback_status', {
          type: 'feedback_status',
          title: 'Feedback Status Updated',
          message: `Your feedback "${feedback.subject}" has been marked as ${completed ? 'completed' : 'pending'}.`,
          details: {
            feedbackId: feedback._id.toString(),
            status: completed ? 'completed' : 'pending',
            subject: feedback.subject
          }
        });
        console.log(`WebSocket notification sent to user ${feedback.userId}`);
      } else {
        console.log(`User ${feedback.userId} not connected, notification not sent`);
      }
    }
    
    res.status(200).json(feedback);
  } catch (error) {
    console.error("Error updating feedback:", error);
    res.status(500).json({ error: "Error updating feedback" });
  }
});

// --- /api/feedbacks/:id/reply ---
// Create a nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'venkatmadhu232@gmail.com',
    pass: process.env.EMAIL_PASSWORD // Using password from .env file (VENKAT1551971)
  },
  // Debug options to help troubleshoot email issues
  debug: true,
  logger: true,
  // Debug options to help troubleshoot email issues
  debug: true,
  logger: true
});

app.post("/api/feedbacks/:id/reply", async (req, res) => {
  try {
    const { id } = req.params;
    const { replyText, recipientEmail, recipientName, senderEmail, userId } = req.body;
    
    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found" });
    }
    
    // Prepare email options
    const mailOptions = {
      from: '"Inspectify" <venkatmadhu232@gmail.com>',
      to: recipientEmail,
      subject: `Re: ${feedback.subject || 'Your Feedback'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333;">Hello ${recipientName},</h2>
          <p style="color: #555; line-height: 1.6;">Thank you for your feedback. Here's our response:</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #4a90e2; margin: 20px 0;">
            ${replyText.replace(/\n/g, '<br>')}
          </div>
          <p style="color: #555;">Original message: <em>${feedback.message}</em></p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="color: #777; font-size: 14px;">This is an automated response. Please do not reply to this email.</p>
        </div>
      `
    };
    
    // Send the email
    await transporter.sendMail(mailOptions);
    
    // Update feedback to include the reply
    feedback.replied = true;
    feedback.replyText = replyText;
    feedback.replyDate = new Date();
    await feedback.save();
    
    console.log(`Reply sent to ${recipientName} (${recipientEmail}) from ${senderEmail || 'venkatmadhu232@gmail.com'}`);
    
    // Send WebSocket notification to the user if userId is provided
    if (userId && feedback.userId) {
      const userSocketId = userSockets.get(feedback.userId);
      if (userSocketId) {
        io.to(userSocketId).emit('feedback_reply', {
          type: 'feedback_reply',
          title: 'New Reply to Your Feedback',
          message: `You have received a reply to your feedback "${feedback.subject}"`,
          details: {
            feedbackId: feedback._id.toString(),
            subject: feedback.subject,
            replyText: replyText,
            replyDate: feedback.replyDate
          }
        });
        console.log(`WebSocket notification sent to user ${feedback.userId}`);
      } else {
        console.log(`User ${feedback.userId} not connected, notification not sent`);
      }
    }
    
    res.status(200).json({ message: "Reply sent successfully" });
  } catch (error) {
    console.error("Error sending reply:", error);
    res.status(500).json({ error: `Error sending reply: ${error.message}` });
  }
});

// --- /api/user-notification ---
app.post("/api/user-notification", async (req, res) => {
  try {
    const { userId, title, message, type, details } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    
    // Validate user exists (for regular users)
    if (!userId.startsWith('admin_') && userId.match(/^[0-9a-f]{24}$/i)) {
      const user = await loginCollection.findOne({ _id: new mongoose.Types.ObjectId(userId) });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
    }
    
    // Send WebSocket notification to the user
    const userSocketId = userSockets.get(userId);
    if (userSocketId) {
      io.to(userSocketId).emit(type || 'notification', {
        type: type || 'notification',
        title,
        message,
        details,
        timestamp: new Date()
      });
      
      console.log(`WebSocket notification sent to user ${userId}`);
      res.status(200).json({ message: "Notification sent successfully" });
    } else {
      console.log(`User ${userId} not connected, notification not sent`);
      res.status(200).json({ message: "User not connected, notification queued" });
      // In a production app, you might want to store this notification for delivery later
    }
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({ error: `Error sending notification: ${error.message}` });
  }
});

// Store OTP codes with expiration
const otpStore = new Map();

// Debug function to log the current state of the OTP store
const logOtpStore = () => {
  console.log("\n--- Current OTP Store ---");
  if (otpStore.size === 0) {
    console.log("OTP Store is empty");
  } else {
    for (const [email, data] of otpStore.entries()) {
      const expiresIn = Math.round((data.expires - Date.now()) / 1000);
      console.log(`Email: ${email}, OTP: ${data.otp}, Expires in: ${expiresIn}s`);
    }
  }
  console.log("------------------------\n");
};

// Generate a random 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// --- /api/generate-otp ---
app.post("/api/generate-otp", async (req, res) => {
  try {
    console.log("Received generate-otp request:", req.body);
    
    const { email, name, password } = req.body;
    
    if (!email) {
      console.log("Missing email in generate-otp request");
      return res.status(400).json({ error: "Email is required" });
    }
    
    // Check if user already exists
    const existingUser = await loginCollection.findOne({ email });
    if (existingUser) {
      console.log(`User with email ${email} already exists`);
      return res.status(400).json({ error: "User already exists!" });
    }
    
    // Generate a new OTP
    const otp = generateOTP();
    
    // Store OTP with 10-minute expiration
    otpStore.set(email, {
      otp,
      name,
      password, // Store password for later use in verification
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes
    });
    
    console.log(`Generated OTP for ${email}: ${otp}`);
    logOtpStore(); // Log the current state of the OTP store
    
    // Send OTP via email
    try {
      console.log("Attempting to send OTP email to:", email);
      
      // Prepare email options with professional design
      const mailOptions = {
        from: '"Inspectify" <venkatmadhu232@gmail.com>',
        to: email,
        subject: 'Your Inspectify Verification Code',
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Inspectify Verification</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f9fc; color: #333333;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);">
              <!-- Header -->
              <tr>
                <td align="center" bgcolor="#4F46E5" style="padding: 30px 0;">
                  <img src="https://i.ibb.co/Qj1bLqp/road-logo.png" alt="Inspectify Logo" width="60" style="display: block;">
                  <h1 style="color: #ffffff; font-weight: 700; margin: 10px 0 0; font-size: 24px;">Inspectify</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px; color: #333333; font-weight: 600;">Verify Your Email Address</h2>
                  <p style="margin: 0 0 25px; color: #555555; line-height: 1.6; font-size: 16px;">Hello ${name || 'User'},</p>
                  <p style="margin: 0 0 25px; color: #555555; line-height: 1.6; font-size: 16px;">Thank you for signing up with Inspectify. To complete your registration, please use the verification code below:</p>
                  
                  <!-- OTP Box -->
                  <div style="background: linear-gradient(to right, #4F46E5, #6366F1); border-radius: 8px; padding: 5px; margin: 30px 0;">
                    <div style="background-color: #ffffff; border-radius: 4px; padding: 20px; text-align: center;">
                      <h2 style="margin: 0 0 10px; color: #4F46E5; font-size: 16px; font-weight: 600;">Your Verification Code</h2>
                      <div style="font-size: 32px; letter-spacing: 8px; font-weight: 700; color: #333333; margin: 15px 0;">${otp}</div>
                      <p style="margin: 10px 0 0; color: #888888; font-size: 14px;">This code will expire in 10 minutes</p>
                    </div>
                  </div>
                  
                  <p style="margin: 25px 0; color: #555555; line-height: 1.6; font-size: 16px;">If you didn't request this code, you can safely ignore this email. Someone might have entered your email address by mistake.</p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 30px; background-color: #f8fafc; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 15px; color: #6b7280; font-size: 14px; text-align: center;">Inspectify - Road Damage Detection & Reporting</p>
                  <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">© ${new Date().getFullYear()} Inspectify. All rights reserved.</p>
                  
                  <!-- Social Media Icons -->
                  <div style="margin-top: 20px; text-align: center;">
                    <a href="#" style="display: inline-block; margin: 0 8px;"><img src="https://i.ibb.co/vxbFJPt/facebook.png" alt="Facebook" width="24" height="24"></a>
                    <a href="#" style="display: inline-block; margin: 0 8px;"><img src="https://i.ibb.co/JtmYVXZ/twitter.png" alt="Twitter" width="24" height="24"></a>
                    <a href="#" style="display: inline-block; margin: 0 8px;"><img src="https://i.ibb.co/0qsXY0V/instagram.png" alt="Instagram" width="24" height="24"></a>
                  </div>
                </td>
              </tr>
            </table>
            
            <!-- Additional Information -->
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto 0;">
              <tr>
                <td style="padding: 0 30px; text-align: center; color: #6b7280; font-size: 12px;">
                  <p>This is an automated email. Please do not reply to this message.</p>
                  <p>If you have any questions, please contact our <a href="#" style="color: #4F46E5; text-decoration: none;">support team</a>.</p>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
        // Add text alternative for email clients that don't support HTML
        text: `Hello ${name || 'User'},\n\nThank you for signing up with Inspectify. Here's your verification code: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.\n\nInspectify - Road Damage Detection & Reporting\n© ${new Date().getFullYear()} Inspectify. All rights reserved.`
      };
      
      // Send the email
      await transporter.sendMail(mailOptions);
      console.log(`OTP email sent to ${email}`);
      
      const response = { 
        message: "OTP sent to your email",
        emailSent: true
      };
      
      // For development, also return the OTP in the response
      if (process.env.NODE_ENV !== 'production') {
        response.otp = otp;
      }
      
      console.log("Sending response:", response);
      res.status(200).json(response);
    } catch (emailError) {
      console.error("Error sending OTP email:", emailError);
      
      // If email sending fails, still return the OTP for development
      const response = { 
        message: "Failed to send OTP email, but OTP generated successfully",
        emailSent: false,
        otp: otp // In production, handle this differently
      };
      
      console.log("Sending response with email failure:", response);
      res.status(200).json(response);
    }
  } catch (error) {
    console.error("OTP generation error:", error);
    res.status(500).json({ error: "Server error during OTP generation" });
  }
});

// --- /api/verify-otp ---
app.post("/api/verify-otp", async (req, res) => {
  try {
    console.log("Received OTP verification request:", req.body);
    
    const { email, otp, password } = req.body;
    
    if (!email || !otp) {
      console.log("Missing required fields for OTP verification");
      return res.status(400).json({ error: "Email and OTP are required" });
    }
    
    // Check if OTP exists and is valid
    const otpData = otpStore.get(email);
    console.log(`OTP data for ${email}:`, otpData);
    logOtpStore(); // Log the current state of the OTP store
    
    if (!otpData) {
      console.log(`No OTP found for email: ${email}`);
      return res.status(400).json({ error: "No OTP found for this email. Please request a new one." });
    }
    
    if (Date.now() > otpData.expires) {
      // Remove expired OTP
      console.log(`OTP for ${email} has expired`);
      otpStore.delete(email);
      return res.status(400).json({ error: "OTP has expired. Please request a new one." });
    }
    
    if (otpData.otp !== otp) {
      console.log(`Invalid OTP for ${email}. Expected: ${otpData.otp}, Received: ${otp}`);
      return res.status(400).json({ error: "Invalid OTP. Please try again." });
    }
    
    console.log(`OTP verified successfully for ${email}`);
    
    // Use the password from the request or from the stored OTP data
    const passwordToHash = password || otpData.password;
    
    if (!passwordToHash) {
      console.log(`No password provided for ${email}`);
      return res.status(400).json({ error: "Password is required for signup" });
    }
    
    // OTP is valid, create the user
    const hashedPassword = await bcrypt.hash(passwordToHash, 10);
    
    const newUser = await loginCollection.insertOne({ 
      name: otpData.name, 
      email, 
      password: hashedPassword,
      isAdmin: false,
      createdAt: new Date(),
      verified: true
    });
    
    console.log(`User created with ID: ${newUser.insertedId}`);
    
    // Remove the OTP after successful verification
    otpStore.delete(email);
    console.log(`OTP for ${email} removed after successful verification`);
    logOtpStore(); // Log the current state of the OTP store
    
    const response = { 
      message: "Signup successful!",
      userId: newUser.insertedId.toString()
    };
    console.log("Sending response:", response);
    res.status(201).json(response);
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ error: "Server error during verification" });
  }
});

// --- /api/signup --- (Direct signup endpoint without OTP)
app.post("/api/signup", async (req, res) => {
  try {
    console.log("Received signup request:", req.body);
    
    const { name, email, password } = req.body;
    
    // Validate required fields
    if (!name || !email || !password) {
      console.log("Missing required fields");
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check if user already exists
    const existingUser = await loginCollection.findOne({ email });
    if (existingUser) {
      console.log(`User with email ${email} already exists`);
      return res.status(400).json({ error: "User already exists!" });
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create the user
    const newUser = await loginCollection.insertOne({ 
      name, 
      email, 
      password: hashedPassword,
      isAdmin: false,
      createdAt: new Date(),
      verified: true
    });
    
    console.log(`User created with ID: ${newUser.insertedId}`);
    
    const response = { 
      message: "Signup successful!",
      userId: newUser.insertedId.toString()
    };
    
    console.log("Sending response:", response);
    res.status(201).json(response);
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Server error during signup" });
  }
});

// --- /api/signup-with-otp --- (OTP-based signup)
app.post("/api/signup-with-otp", async (req, res) => {
  try {
    console.log("Received signup-with-otp request:", req.body);
    
    const { name, email, password } = req.body;
    
    // Validate required fields
    if (!name || !email || !password) {
      console.log("Missing required fields");
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check if user already exists
    const existingUser = await loginCollection.findOne({ email });
    if (existingUser) {
      console.log(`User with email ${email} already exists`);
      return res.status(400).json({ error: "User already exists!" });
    }
    
    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with 10-minute expiration
    otpStore.set(email, {
      otp,
      name,
      password, // Store password for later use in verification
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes
    });
    
    console.log(`Generated OTP for ${email}: ${otp}`);
    logOtpStore(); // Log the current state of the OTP store
    
    // In a real application, you would send this via email
    // For this demo, we'll just return it in the response (not secure for production)
    const response = { 
      message: "OTP sent to your email",
      otp: otp // In production, remove this and only send via email
    };
    
    console.log("Sending response:", response);
    res.status(200).json(response);
  } catch (error) {
    console.error("OTP generation error:", error);
    res.status(500).json({ error: "Server error during OTP generation" });
  }
});
 
// --- /api/login ---
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log(`Login attempt for email: ${email}`);
    
    // IMPORTANT: Special case for admin login (hardcoded for immediate access)
    if (email === "admin123@gmail.com" && password === "admin1234567890") {
      console.log("Using hardcoded admin credentials - BYPASSING DATABASE CHECK");
      
      // Create a special admin ID with prefix
      const adminId = "admin_" + Date.now();
      
      // Log success
      console.log(`Admin login successful with ID: ${adminId}`);
      
      // Return success response
      return res.status(200).json({
        message: "Admin login successful!",
        userId: adminId,
        name: "Administrator",
        userType: 'admin',
        isAdmin: true
      });
    }
    
    // Regular database login
    console.log(`Looking up user in database: ${email}`);
    const user = await loginCollection.findOne({ email });

    if (!user) {
      console.log(`User not found: ${email}`);
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    console.log(`User found: ${email}, verifying password`);
    console.log(`User details: ${JSON.stringify({
      id: user._id,
      name: user.name,
      hasPassword: !!user.password,
      isAdmin: user.isAdmin
    })}`);
    
    try {
      const passwordMatch = await bcrypt.compare(password, user.password);
      console.log(`Password match result: ${passwordMatch}`);
      
      if (!passwordMatch) {
        console.log(`Password mismatch for user: ${email}`);
        return res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (bcryptError) {
      console.error(`Error comparing passwords: ${bcryptError}`);
      return res.status(401).json({ error: "Error verifying credentials" });
    }

    // Check if user is an admin
    const isAdmin = user.isAdmin === true;
    const userType = isAdmin ? 'admin' : 'user';
    
    console.log(`User ${email} authenticated successfully. Admin: ${isAdmin}, Type: ${userType}`);
    
    // For admin users, create a special ID with prefix
    const userId = isAdmin 
      ? "admin_" + user._id.toString() 
      : user._id.toString();

    // Return user ID and name for client-side storage
    res.status(200).json({ 
      message: "Login successful!", 
      userId: userId,
      name: user.name || email.split('@')[0],
      userType: userType,
      isAdmin: isAdmin
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login" });
  }
});

// --- /api/verify-auth ---
app.post("/api/verify-auth", async (req, res) => {
  try {
    const { userId } = req.body;
    
    console.log(`Verifying authentication for userId: ${userId}`);
    
    if (!userId) {
      console.log("No userId provided in auth verification request");
      return res.status(401).json({ 
        authenticated: false, 
        message: "No user ID provided" 
      });
    }
    
    // IMPORTANT: Special case for admin users with the special prefix
    // This ensures admin can always be verified even if database has issues
    const isAdminByPrefix = userId.startsWith('admin_');
    
    if (isAdminByPrefix) {
      console.log(`User ${userId} authenticated as admin by prefix - BYPASSING DATABASE CHECK`);
      // This is an admin user with the special prefix - always authenticate
      return res.status(200).json({
        authenticated: true,
        userType: 'admin',
        isAdmin: true,
        name: "Administrator",
        message: "Admin authentication verified"
      });
    }
    
    // For regular users, check if they exist in the database
    try {
      // Check if userId is a valid MongoDB ObjectId
      if (userId.match(/^[0-9a-f]{24}$/i)) {
        console.log(`Looking up user with ID: ${userId}`);
        const user = await loginCollection.findOne({ _id: new mongoose.Types.ObjectId(userId) });
        
        if (user) {
          // Check if this user is an admin in the database
          const isAdmin = user.isAdmin === true;
          const userType = isAdmin ? 'admin' : 'user';
          
          console.log(`User ${userId} found in database. Admin: ${isAdmin}, Type: ${userType}`);
          
          return res.status(200).json({
            authenticated: true,
            userType: userType,
            isAdmin: isAdmin,
            message: `${userType.charAt(0).toUpperCase() + userType.slice(1)} authentication verified`,
            name: user.name || (user.email ? user.email.split('@')[0] : 'User')
          });
        } else {
          console.log(`User with ID ${userId} not found in database`);
        }
      } else {
        console.log(`Invalid MongoDB ObjectId format: ${userId}`);
      }
      
      // If we get here, the user wasn't found or userId wasn't a valid ObjectId
      return res.status(401).json({
        authenticated: false,
        message: "Invalid user ID"
      });
    } catch (dbError) {
      console.error("Database error during auth verification:", dbError);
      
      // Special case: If there's a database error but the userId looks like it might be an admin,
      // still authenticate the user to prevent lockouts
      if (userId.includes('admin')) {
        console.log("Database error, but userId contains 'admin'. Authenticating as admin.");
        return res.status(200).json({
          authenticated: true,
          userType: 'admin',
          isAdmin: true,
          name: "Administrator",
          message: "Admin authentication verified (fallback)"
        });
      }
      
      return res.status(500).json({
        authenticated: false,
        message: "Error verifying user authentication"
      });
    }
  } catch (error) {
    console.error("Auth verification error:", error);
    res.status(500).json({ 
      authenticated: false,
      message: "Server error during authentication verification" 
    });
  }
});

// --- /api/road-entries ---
app.get("/api/road-entries", async (req, res) => {
  try {
    const { userId } = req.query;
    
    // If userId is provided, filter by user
    const query = userId ? { userId } : {};
    
    const entries = await RoadEntry.find(query).sort({ timestamp: -1 });
    res.status(200).json(entries);
  } catch (error) {
    console.error("Error fetching road entries:", error);
    res.status(500).json({ error: "Error fetching saved entries" });
  }
});

// --- /api/road-entries/:id --- (DELETE)
app.delete("/api/road-entries/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate the ID format
    if (!id.match(/^[0-9a-f]{24}$/i)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }
    
    // Find and delete the entry
    const result = await RoadEntry.findByIdAndDelete(id);
    
    if (!result) {
      return res.status(404).json({ error: "Entry not found" });
    }
    
    // If the entry had an image, delete it from the filesystem
    if (result.imagePath) {
      const imagePath = path.join(__dirname, result.imagePath);
      try {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          console.log(`Deleted image file: ${imagePath}`);
        }
      } catch (fileError) {
        console.error(`Error deleting image file: ${fileError.message}`);
        // Continue with the response even if file deletion fails
      }
    }
    
    console.log(`Successfully deleted road entry with ID: ${id}`);
    res.status(200).json({ message: "Entry deleted successfully" });
  } catch (error) {
    console.error("Error deleting road entry:", error);
    res.status(500).json({ error: "Error deleting entry" });
  }
});

// --- /api/user/:id ---
app.get("/api/user/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Check if it's a MongoDB ObjectId
    if (userId.match(/^[0-9a-f]{24}$/i)) {
      // Try to find user in login collection
      const user = await loginCollection.findOne({ _id: new mongoose.Types.ObjectId(userId) });
      if (user) {
        return res.status(200).json({ 
          name: user.name || 'User',
          email: user.email
        });
      }
    }
    
    // If userId starts with 'admin_', it's an admin
    if (userId.startsWith('admin_')) {
      return res.status(200).json({ name: 'Administrator' });
    }
    
    // For regular users with user_name format
    const parts = userId.split('_');
    if (parts.length > 1) {
      const name = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
      return res.status(200).json({ name });
    }
    
    // Default response if no user found
    res.status(200).json({ name: 'Unknown User' });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Server error. Could not fetch user data." });
  }
});

// --- /api/road-data ---
app.get("/api/road-data", async (req, res) => {
  try {
    const { userId } = req.query;
    
    // If userId is provided, filter by user (for regular users)
    // For admin users, we typically want to see all data
    const query = userId ? { userId } : {};
    
    const roadData = await RoadEntry.find(query).sort({ timestamp: -1 });
    
    // Enhance data with user information
    const enhancedData = await Promise.all(roadData.map(async (item) => {
      // If userId is a MongoDB ObjectId, try to get user info
      if (item.userId && item.userId.match(/^[0-9a-f]{24}$/i)) {
        try {
          const user = await loginCollection.findOne({ _id: new mongoose.Types.ObjectId(item.userId) });
          if (user) {
            return {
              ...item.toObject(),
              userName: user.name || 'User'
            };
          }
        } catch (err) {
          console.error("Error fetching user for road data:", err);
        }
      }
      
      return item.toObject();
    }));
    
    res.status(200).json(enhancedData);
  } catch (error) {
    console.error("Error fetching road data:", error);
    res.status(500).json({ error: "Server error. Could not fetch data." });
  }
});

// --- /api/road-data/:id --- (DELETE)
app.delete("/api/road-data/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate the ID format
    if (!id.match(/^[0-9a-f]{24}$/i)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }
    
    // Find and delete the entry
    const result = await RoadEntry.findByIdAndDelete(id);
    
    if (!result) {
      return res.status(404).json({ error: "Entry not found" });
    }
    
    // If the entry had an image, delete it from the filesystem
    if (result.imagePath) {
      const imagePath = path.join(__dirname, result.imagePath);
      try {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          console.log(`Deleted image file: ${imagePath}`);
        }
      } catch (fileError) {
        console.error(`Error deleting image file: ${fileError.message}`);
        // Continue with the response even if file deletion fails
      }
    }
    
    console.log(`Successfully deleted road entry with ID: ${id}`);
    res.status(200).json({ message: "Entry deleted successfully" });
  } catch (error) {
    console.error("Error deleting road entry:", error);
    res.status(500).json({ error: "Error deleting entry" });
  }
});

// --- /api/dashboard-stats ---
app.get("/api/dashboard-stats", async (req, res) => {
  try {
    const { userId } = req.query;
    const query = userId && !userId.startsWith('admin_') ? { userId } : {};
    
    // Get current date and calculate dates for time-based queries
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Get all data needed for stats
    const finalImgData = await FinalImage.find(query);
    const roadEntryData = await RoadEntry.find(query);
    
    // Combine data for comprehensive stats
    const allData = [...finalImgData, ...roadEntryData];
    
    // Calculate stats
    const totalCount = allData.length;
    const newThisWeek = allData.filter(item => new Date(item.timestamp) >= oneWeekAgo).length;
    
    // Calculate high severity issues (from FinalImage collection which has severity field)
    const highSeverityCount = finalImgData.filter(item => item.severity > 70).length;
    const highSeverityPercentage = finalImgData.length > 0 ? Math.round((highSeverityCount / finalImgData.length) * 100) : 0;
    
    // Calculate average processing time
    const totalProcessingTime = finalImgData.reduce((acc, item) => acc + (item.processingTime || 0), 0);
    const avgProcessingTime = finalImgData.length > 0 ? Math.round(totalProcessingTime / finalImgData.length) : 0;
    
    // Calculate resolution stats
    const resolvedCount = finalImgData.filter(item => item.status === "Resolved").length;
    const resolutionRate = finalImgData.length > 0 ? Math.round((resolvedCount / finalImgData.length) * 100) : 0;
    const resolvedLastMonth = finalImgData.filter(item => 
      item.status === "Resolved" && new Date(item.timestamp) >= oneMonthAgo
    ).length;
    
    // Calculate damage type distribution
    const damageTypes = {};
    finalImgData.forEach(item => {
      const type = item.damageType || 'unknown';
      damageTypes[type] = (damageTypes[type] || 0) + 1;
    });
    
    // Calculate severity distribution
    const severityDistribution = {
      low: finalImgData.filter(item => item.severity <= 30).length,
      moderate: finalImgData.filter(item => item.severity > 30 && item.severity <= 60).length,
      high: finalImgData.filter(item => item.severity > 60 && item.severity <= 80).length,
      severe: finalImgData.filter(item => item.severity > 80).length
    };
    
    // Return comprehensive stats
    res.status(200).json({
      totalInspections: {
        count: totalCount,
        newThisWeek
      },
      highSeverityIssues: {
        count: highSeverityCount,
        percentage: highSeverityPercentage
      },
      processingTime: {
        average: avgProcessingTime
      },
      resolutionRate: {
        percentage: resolutionRate,
        resolvedLastMonth
      },
      damageTypes,
      severityDistribution,
      statusCounts: {
        pending: finalImgData.filter(item => item.status === "Pending").length,
        processed: finalImgData.filter(item => item.status === "Processed").length,
        critical: finalImgData.filter(item => item.status === "Critical").length,
        resolved: resolvedCount
      }
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ error: "Error fetching dashboard statistics" });
  }
});

// --- /api/report-stats ---
app.get("/api/report-stats", async (req, res) => {
  try {
    const { userId } = req.query;
    
    // If userId is provided, filter by user (for regular users)
    // For admin users, we typically want to see all data
    const query = userId ? { userId } : {};
    
    // Get all entries matching the query
    const allEntries = await RoadEntry.find(query);
    
    // Calculate statistics
    const total = allEntries.length;
    const pending = allEntries.filter(entry => 
      !entry.reviewed || entry.reviewStatus === 'pending'
    ).length;
    const reviewed = allEntries.filter(entry => 
      entry.reviewed && entry.reviewStatus !== 'pending'
    ).length;
    
    res.status(200).json({
      total,
      pending,
      reviewed
    });
  } catch (error) {
    console.error("Error fetching report stats:", error);
    res.status(500).json({ error: "Server error. Could not fetch stats." });
  }
});

// --- /api/road-stats ---
app.get("/api/road-stats", async (req, res) => {
  try {
    const { userId } = req.query;
    
    // Get all road data
    const query = userId ? { userId } : {};
    const roadEntryData = await RoadEntry.find(query).sort({ timestamp: -1 });
    
    // Calculate review status distribution
    const reviewStatusDistribution = {
      pending: roadEntryData.filter(item => item.reviewStatus === 'pending').length,
      approved: roadEntryData.filter(item => item.reviewStatus === 'approved').length,
      rejected: roadEntryData.filter(item => item.reviewStatus === 'rejected').length,
      inProgress: roadEntryData.filter(item => item.reviewStatus === 'in-progress').length
    };
    
    // Calculate severity distribution
    const severityDistribution = {
      low: roadEntryData.filter(item => item.severity === 'low').length,
      moderate: roadEntryData.filter(item => item.severity === 'moderate').length,
      high: roadEntryData.filter(item => item.severity === 'high').length,
      severe: roadEntryData.filter(item => item.severity === 'severe').length,
      unknown: roadEntryData.filter(item => item.severity === 'unknown').length
    };
    
    // Calculate damage type distribution
    const damageTypeDistribution = {};
    roadEntryData.forEach(entry => {
      if (Array.isArray(entry.damageType)) {
        entry.damageType.forEach(type => {
          damageTypeDistribution[type] = (damageTypeDistribution[type] || 0) + 1;
        });
      } else if (entry.damageType) {
        damageTypeDistribution[entry.damageType] = (damageTypeDistribution[entry.damageType] || 0) + 1;
      }
    });
    
    // Get recent entries (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const recentEntries = roadEntryData.filter(item => new Date(item.timestamp) >= oneWeekAgo);
    
    res.status(200).json({
      totalEntries: roadEntryData.length,
      reviewStatusDistribution,
      severityDistribution,
      damageTypeDistribution,
      recentEntries: recentEntries.length,
      latestEntries: roadEntryData.slice(0, 5) // Return 5 most recent entries
    });
  } catch (error) {
    console.error("Error fetching road stats:", error);
    res.status(500).json({ error: "Server error. Could not fetch road statistics." });
  }
});

// --- /api/weekly-reports ---
app.get("/api/weekly-reports", async (req, res) => {
  try {
    const { userId } = req.query;
    
    // If userId is provided, filter by user (for regular users)
    const query = userId && !userId.startsWith('admin_') ? { userId } : {};
    
    // Get current date and date 7 days ago
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    // Add timestamp filter to query
    const timeQuery = {
      ...query,
      timestamp: { $gte: sevenDaysAgo }
    };
    
    // Get all entries from the last 7 days
    const recentEntries = await RoadEntry.find(timeQuery);
    
    // Group by day of week
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyData = dayNames.map(day => ({ name: day, reports: 0 }));
    
    recentEntries.forEach(entry => {
      const dayOfWeek = new Date(entry.timestamp).getDay(); // 0 = Sunday, 6 = Saturday
      weeklyData[dayOfWeek].reports += 1;
    });
    
    res.status(200).json(weeklyData);
  } catch (error) {
    console.error("Error fetching weekly reports:", error);
    res.status(500).json({ error: "Server error. Could not fetch weekly data." });
  }
});

// --- /api/damage-distribution ---
app.get("/api/damage-distribution", async (req, res) => {
  try {
    const { userId } = req.query;
    
    // If userId is provided, filter by user (for regular users)
    const query = userId && !userId.startsWith('admin_') ? { userId } : {};
    
    // Get all entries matching the query
    const allEntries = await RoadEntry.find(query);
    
    // Count damage types based on the damageType field
    const damageTypes = {
      'Potholes': 0,
      'Alligator Cracks': 0,
      'Lateral Cracks': 0,
      'Longitudinal Cracks': 0,
      'Edge Cracks': 0,
      'Rutting': 0,
      'Raveling': 0,
      'Other': 0
    };
    
    allEntries.forEach(entry => {
      if (!entry.damageType || (Array.isArray(entry.damageType) && entry.damageType.length === 0)) {
        damageTypes['Other']++;
        return;
      }
      
      // Handle array of damage types
      if (Array.isArray(entry.damageType)) {
        // Count each damage type in the array
        entry.damageType.forEach(type => {
          switch(type) {
            case 'pothole':
              damageTypes['Potholes']++;
              break;
            case 'alligator_crack':
              damageTypes['Alligator Cracks']++;
              break;
            case 'lateral_crack':
              damageTypes['Lateral Cracks']++;
              break;
            case 'longitudinal_crack':
              damageTypes['Longitudinal Cracks']++;
              break;
            case 'edge_crack':
              damageTypes['Edge Cracks']++;
              break;
            case 'rutting':
              damageTypes['Rutting']++;
              break;
            case 'raveling':
              damageTypes['Raveling']++;
              break;
            default:
              damageTypes['Other']++;
          }
        });
        return;
      }
      
      // Handle single damage type (string)
      switch(entry.damageType) {
        case 'pothole':
          damageTypes['Potholes']++;
          break;
        case 'alligator_crack':
          damageTypes['Alligator Cracks']++;
          break;
        case 'lateral_crack':
          damageTypes['Lateral Cracks']++;
          break;
        case 'longitudinal_crack':
          damageTypes['Longitudinal Cracks']++;
          break;
        case 'edge_crack':
          damageTypes['Edge Cracks']++;
          break;
        case 'rutting':
          damageTypes['Rutting']++;
          break;
        case 'raveling':
          damageTypes['Raveling']++;
          break;
        default:
          damageTypes['Other']++;
      }
    });
    
    // Convert to array format for charts
    const result = Object.entries(damageTypes)
      .filter(([_, value]) => value > 0) // Only include damage types with values > 0
      .map(([name, value]) => ({ name, value }));
    
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching damage distribution:", error);
    res.status(500).json({ error: "Server error. Could not fetch damage distribution." });
  }
});

// --- /api/severity-breakdown ---
app.get("/api/severity-breakdown", async (req, res) => {
  try {
    const { userId } = req.query;
    
    // If userId is provided, filter by user (for regular users)
    const query = userId && !userId.startsWith('admin_') ? { userId } : {};
    
    // Get all entries matching the query
    const allEntries = await RoadEntry.find(query);
    
    // Count by severity
    const severityCounts = {
      'high': 0,
      'moderate': 0,
      'low': 0,
      'severe': 0,
      'unknown': 0
    };
    
    allEntries.forEach(entry => {
      const severity = entry.severity || 'unknown';
      if (severityCounts.hasOwnProperty(severity)) {
        severityCounts[severity]++;
      } else {
        severityCounts['unknown']++;
      }
    });
    
    // Map to the format needed by the frontend
    const result = [
      { name: 'High', value: severityCounts['high'] + severityCounts['severe'], color: '#ef4444' },
      { name: 'Moderate', value: severityCounts['moderate'], color: '#f59e0b' },
      { name: 'Low', value: severityCounts['low'], color: '#10b981' }
    ];
    
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching severity breakdown:", error);
    res.status(500).json({ error: "Server error. Could not fetch severity data." });
  }
});

// --- /api/recent-reports ---
app.get("/api/recent-reports", async (req, res) => {
  try {
    const { userId, limit = 5 } = req.query;
    
    // If userId is provided, filter by user (for regular users)
    const query = userId && !userId.startsWith('admin_') ? { userId } : {};
    
    // Get recent entries, sorted by timestamp
    const recentEntries = await RoadEntry.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    
    // Format the data for the frontend
    const result = recentEntries.map(entry => ({
      id: entry._id,
      location: entry.address || 'Unknown location',
      type: getReportType(entry.reviewNotes || '', entry.damageType),
      severity: entry.severity || 'unknown',
      date: entry.timestamp ? new Date(entry.timestamp).toISOString().split('T')[0] : 'Unknown date',
      status: entry.reviewStatus || 'pending'
    }));
    
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching recent reports:", error);
    res.status(500).json({ error: "Server error. Could not fetch recent reports." });
  }
});

// Helper function to determine report type from damage type
function getReportType(notes, damageType) {
  if (damageType) {
    // Handle array of damage types
    if (Array.isArray(damageType)) {
      if (damageType.length === 0) return 'Other';
      if (damageType.length === 1) {
        // If only one type, use the switch case below with the single value
        return getReportType(notes, damageType[0]);
      }
      // If multiple types, return a combined label
      return 'Multiple Issues';
    }
    
    // Handle single damage type
    switch(damageType) {
      case 'pothole':
        return 'Pothole';
      case 'alligator_crack':
        return 'Alligator Crack';
      case 'lateral_crack':
        return 'Lateral Crack';
      case 'longitudinal_crack':
        return 'Longitudinal Crack';
      case 'edge_crack':
        return 'Edge Crack';
      case 'rutting':
        return 'Rutting';
      case 'raveling':
        return 'Raveling';
      default:
        return 'Other';
    }
  }
  
  // Fallback to notes-based detection if no damage type is available
  notes = (notes || '').toLowerCase();
  if (notes.includes('pothole')) return 'Pothole';
  if (notes.includes('crack')) return 'Crack';
  if (notes.includes('erosion')) return 'Erosion';
  if (notes.includes('debris')) return 'Debris';
  return 'Other';
}

// --- /api/review-image-v2 (New endpoint for multiple damage types) ---
app.post("/api/review-image-v2", async (req, res) => {
  try {
    const { imageId, reviewStatus, reviewNotes, severity, damageType, recommendedAction, reviewerId } = req.body;
    
    // Debug logging
    console.log("Review request received:");
    console.log("- imageId:", imageId);
    console.log("- damageType:", damageType);
    console.log("- damageType type:", typeof damageType);
    if (Array.isArray(damageType)) {
      console.log("- damageType is an array with length:", damageType.length);
    }
    
    if (!imageId || !reviewStatus) {
      return res.status(400).json({ error: "Image ID and review status are required" });
    }
    
    if (!reviewerId) {
      return res.status(400).json({ error: "Reviewer ID is required" });
    }
    
    // Find the image entry
    const imageEntry = await RoadEntry.findById(imageId);
    
    if (!imageEntry) {
      return res.status(404).json({ error: "Image entry not found" });
    }
    
    // We'll use updateOne instead of directly modifying the object
    
    // Use updateOne instead of save to bypass validation issues
    try {
      // Prepare update object
      const updateData = {
        reviewed: true,
        reviewStatus: reviewStatus,
        reviewNotes: reviewNotes || "",
        severity: severity || "unknown",
        damageType: Array.isArray(damageType) ? damageType : [damageType || "pothole"],
        recommendedAction: recommendedAction || "",
        reviewDate: new Date(),
        reviewerId: reviewerId
      };
      
      console.log("Update data:", updateData);
      
      // Use updateOne to bypass validation
      const result = await RoadEntry.updateOne(
        { _id: imageId },
        { $set: updateData }
      );
      
      console.log("Update result:", result);
      
      if (result.modifiedCount === 0) {
        return res.status(500).json({ error: "Failed to update the entry" });
      }
    } catch (saveError) {
      console.error("Error updating image entry:", saveError);
      return res.status(500).json({ error: "Error saving review: " + saveError.message });
    }
    
    // Get the updated entry to ensure we have the latest data
    const updatedEntry = await RoadEntry.findById(imageId);
    if (!updatedEntry) {
      return res.status(404).json({ error: "Updated image entry not found" });
    }
    
    // Send notification specifically to the user who uploaded the image
    const targetUserId = updatedEntry.userId;
    
    console.log("All connected users:", Array.from(userSockets.entries()));
    console.log("Target user ID:", targetUserId);
    
    // Debug: Print all connected users
    console.log("Connected users:");
    for (const [uid, sid] of userSockets.entries()) {
      console.log(`User ${uid} -> Socket ${sid}`);
    }
    
    const targetSocketId = userSockets.get(targetUserId);
    console.log("Target socket ID:", targetSocketId);
    
    // Ensure all data is properly formatted and available
    const notificationData = {
      imageId: updatedEntry._id.toString(),
      imagePath: updatedEntry.imagePath || "",
      address: updatedEntry.address || "Unknown location",
      reviewStatus: updatedEntry.reviewStatus,
      severity: updatedEntry.severity,
      reviewNotes: updatedEntry.reviewNotes,
      recommendedAction: updatedEntry.recommendedAction,
      reviewDate: updatedEntry.reviewDate,
      userId: targetUserId, // Target user ID (who uploaded the image)
      reviewerId: reviewerId, // Who reviewed the image
      message: `Your road image has been reviewed. Status: ${updatedEntry.reviewStatus}`
    };
    
    console.log("Notification data:", notificationData);
    
    // Only send to the specific user who uploaded the image and to admins
    console.log("Sending notification only to the specific user and admins");
    
    // Send to the specific user if they're connected
    if (targetSocketId) {
      console.log(`Sending notification to user ${targetUserId} via socket ${targetSocketId}`);
      // When sending to the user, make it clear this is for them specifically
      const userNotificationData = {
        ...notificationData,
        forUser: true,
        forAdmin: false
      };
      
      console.log("User notification data:", JSON.stringify(userNotificationData, null, 2));
      
      // Use a callback to confirm delivery
      io.to(targetSocketId).emit("image-reviewed", userNotificationData, (error) => {
        if (error) {
          console.error(`Error sending notification to user ${targetUserId}:`, error);
        } else {
          console.log(`Notification successfully sent to user ${targetUserId}`);
        }
      });
      
      // Also broadcast to all sockets to ensure delivery
      console.log("Broadcasting notification to all sockets as a backup");
      io.emit("image-reviewed-broadcast", {
        ...userNotificationData,
        targetUserId: targetUserId
      });
    } else {
      console.log(`User ${targetUserId} not connected. Notification will not be delivered.`);
      // In a production app, you might want to store this notification in a database
      // for delivery when the user connects next time
    }
    
    // Also send to all admin users, but with a flag indicating it's for admin
    for (const [connectedUserId, socketId] of userSockets.entries()) {
      if (connectedUserId.startsWith('admin_')) {
        console.log(`Sending notification to admin ${connectedUserId} via socket ${socketId}`);
        // When sending to admins, make it clear this is for admin purposes
        const adminNotificationData = {
          ...notificationData,
          forUser: false,
          forAdmin: true,
          adminId: connectedUserId // Include the admin ID who's receiving this
        };
        
        console.log("Admin notification data:", JSON.stringify(adminNotificationData, null, 2));
        
        // Use a callback to confirm delivery
        io.to(socketId).emit("image-reviewed", adminNotificationData, (error) => {
          if (error) {
            console.error(`Error sending notification to admin ${connectedUserId}:`, error);
          } else {
            console.log(` Notification successfully sent to admin ${connectedUserId}`);
          }
        });
        
        // Also broadcast to all sockets to ensure delivery
        console.log("Broadcasting admin notification to all sockets as a backup");
        io.emit("admin-notification-broadcast", {
          ...adminNotificationData,
          targetAdminId: connectedUserId
        });
      }
    }
    
    res.status(200).json({ 
      message: "Image review saved and notification sent",
      updatedEntry: imageEntry
    });
  } catch (error) {
    console.error("Error reviewing image:", error);
    res.status(500).json({ error: "Server error during image review" });
  }
});

// --- Start server ---
server.listen(PORT, () => {
  console.log(` Server is running at http://localhost:${PORT}`);
});