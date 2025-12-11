import React, { useEffect, useState, useRef, useMemo } from "react";
import { Download, Loader2, AlertCircle, MapPin, CalendarDays as Calendar, FileText, Bell, CheckCircle, X, Map, Filter, Search, SlidersHorizontal, Tag, Clock, ArrowUpDown, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
// Import jsPDF directly - no dynamic imports
import { jsPDF } from "jspdf";
import { motion, AnimatePresence } from "framer-motion";

const Report = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [entries, setEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingIndex, setDownloadingIndex] = useState(null);
  const [reviewingId, setReviewingId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState("");
  const [activeTab, setActiveTab] = useState("View Reports");
  const [highlightedEntryId, setHighlightedEntryId] = useState(null);
  const highlightedEntryRef = useRef(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "timestamp", direction: "desc" });
  const [filters, setFilters] = useState({
    severity: [],
    status: [],
    damageType: [],
    dateRange: {
      start: null,
      end: null
    }
  });
  const [reviewForm, setReviewForm] = useState({
    status: 'approved',
    severity: 'moderate',
    damageType: ['pothole'], // Changed to array for multiple selections
    notes: '',
    recommendedAction: ''
  });
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ open: false, entryId: null, entryName: null });
  const [deleting, setDeleting] = useState(false);
  
  // Get user info from localStorage on component mount
  useEffect(() => {
    const storedUserId = localStorage.getItem('roadVisionUserId');
    const storedUserName = localStorage.getItem('roadVisionUserName');
    
    if (storedUserId) {
      setUserId(storedUserId);
    }
    
    if (storedUserName) {
      setUserName(storedUserName);
    }
  }, []);

  // Check for highlighted entry from URL query parameter
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const highlightId = queryParams.get('highlight');
    if (highlightId) {
      setHighlightedEntryId(highlightId);
    }
  }, [location.search]);

  // Scroll to highlighted entry when it's available
  useEffect(() => {
    if (highlightedEntryId && highlightedEntryRef.current) {
      highlightedEntryRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      
      // Add a temporary highlight effect
      highlightedEntryRef.current.classList.add('bg-yellow-100');
      setTimeout(() => {
        if (highlightedEntryRef.current) {
          highlightedEntryRef.current.classList.remove('bg-yellow-100');
          highlightedEntryRef.current.classList.add('bg-yellow-50');
        }
      }, 1500);
    }
  }, [highlightedEntryId, loading]);

  // Extract unique damage types from entries
  const uniqueDamageTypes = useMemo(() => {
    const types = new Set();
    
    entries.forEach(entry => {
      if (Array.isArray(entry.damageType)) {
        entry.damageType.forEach(type => types.add(type));
      } else if (entry.damageType) {
        types.add(entry.damageType);
      }
    });
    
    return Array.from(types);
  }, [entries]);
  
  // Extract unique statuses from entries
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set();
    
    entries.forEach(entry => {
      if (entry.status) {
        statuses.add(entry.status);
      }
      if (entry.reviewStatus) {
        statuses.add(entry.reviewStatus);
      }
    });
    
    return Array.from(statuses);
  }, [entries]);
  
  // Format damage type for display
  const formatDamageType = (type) => {
    if (!type) return 'Unknown';
    return type.replace(/_/g, ' ').split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };
  
  // Apply filters and search
  useEffect(() => {
    if (entries.length === 0) return;
    
    let result = [...entries];
    
    // Apply search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(entry => 
        (entry.address && entry.address.toLowerCase().includes(term)) ||
        (entry._id && entry._id.toLowerCase().includes(term)) ||
        (entry.damageType && (
          Array.isArray(entry.damageType) 
            ? entry.damageType.some(type => type.toLowerCase().includes(term))
            : entry.damageType.toLowerCase().includes(term)
        ))
      );
    }
    
    // Apply severity filter
    if (filters.severity.length > 0) {
      result = result.filter(entry => filters.severity.includes(entry.severity));
    }
    
    // Apply status filter
    if (filters.status.length > 0) {
      result = result.filter(entry => 
        filters.status.includes(entry.status) || 
        filters.status.includes(entry.reviewStatus)
      );
    }
    
    // Apply damage type filter
    if (filters.damageType.length > 0) {
      result = result.filter(entry => {
        if (Array.isArray(entry.damageType)) {
          return entry.damageType.some(type => filters.damageType.includes(type));
        } else {
          return filters.damageType.includes(entry.damageType);
        }
      });
    }
    
    // Apply date range filter
    if (filters.dateRange.start || filters.dateRange.end) {
      result = result.filter(entry => {
        const entryDate = new Date(entry.timestamp);
        
        if (filters.dateRange.start && filters.dateRange.end) {
          return entryDate >= new Date(filters.dateRange.start) && 
                 entryDate <= new Date(filters.dateRange.end);
        } else if (filters.dateRange.start) {
          return entryDate >= new Date(filters.dateRange.start);
        } else if (filters.dateRange.end) {
          return entryDate <= new Date(filters.dateRange.end);
        }
        
        return true;
      });
    }
    
    // Apply sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        if (!a[sortConfig.key] && !b[sortConfig.key]) return 0;
        if (!a[sortConfig.key]) return 1;
        if (!b[sortConfig.key]) return -1;
        
        const aValue = sortConfig.key === 'timestamp' 
          ? new Date(a[sortConfig.key]).getTime() 
          : a[sortConfig.key];
        const bValue = sortConfig.key === 'timestamp' 
          ? new Date(b[sortConfig.key]).getTime() 
          : b[sortConfig.key];
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    setFilteredEntries(result);
  }, [entries, searchTerm, filters, sortConfig]);
  
  // Toggle sort direction
  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };
  
  // Toggle filter for severity, damage type, or status
  const toggleFilter = (type, value) => {
    setFilters(prev => {
      const current = [...prev[type]];
      const index = current.indexOf(value);
      
      if (index === -1) {
        current.push(value);
      } else {
        current.splice(index, 1);
      }
      
      return {
        ...prev,
        [type]: current
      };
    });
  };
  
  // Set date range
  const setDateRange = (start, end) => {
    setFilters(prev => ({
      ...prev,
      dateRange: { start, end }
    }));
  };
  
  // Reset all filters
  const resetFilters = () => {
    setFilters({
      severity: [],
      status: [],
      damageType: [],
      dateRange: {
        start: null,
        end: null
      }
    });
    setSearchTerm("");
  };

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Using fetch instead of axios for modern browsers
        console.log("Fetching road entries...");
        const response = await fetch("http://localhost:5000/api/road-entries");
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status} ${response.statusText}`);
        }
        
        // Check content type to ensure we're getting JSON
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Received non-JSON response from server");
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data)) {
          throw new Error("Expected an array of entries but received: " + typeof data);
        }
        
        console.log(`Fetched ${data.length} road entries`);
        setEntries(data);
        setFilteredEntries(data);
      } catch (error) {
        setError("Failed to fetch road entries. Please try again.");
        console.error("Error fetching road entries:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, []);

  // Navigate to map view with the selected entry
  const handleViewOnMap = (entry) => {
    if (entry.latitude && entry.longitude) {
      navigate(`/map?highlight=${entry._id}`);
    } else {
      alert("This entry doesn't have location coordinates to display on the map.");
    }
  };
  
  // Open delete confirmation modal
  const handleDeleteClick = (entry) => {
    setDeleteModal({
      open: true,
      entryId: entry._id,
      entryName: entry.address || `Report ${entry._id.substring(0, 8)}`
    });
  };
  
  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteModal.entryId || deleting) return;
    
    try {
      setDeleting(true);
      
      // Make API call to delete the entry
      const response = await fetch(`http://localhost:5000/api/road-entries/${deleteModal.entryId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete entry: ${response.status} ${response.statusText}`);
      }
      
      // Remove the entry from the state
      setEntries(prevEntries => prevEntries.filter(entry => entry._id !== deleteModal.entryId));
      
      // Close the modal
      setDeleteModal({ open: false, entryId: null, entryName: null });
      
      // Show success message (you could add a toast notification here)
      console.log(`Successfully deleted entry ${deleteModal.entryId}`);
      
    } catch (error) {
      console.error("Error deleting entry:", error);
      alert(`Failed to delete entry: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async (entry, index) => {
    const { imagePath, latitude, longitude, address, timestamp, severity, status, damageType } = entry;
    
    setDownloadingIndex(index);
    
    try {
      console.log("Starting PDF generation process...");
      
      // Check if jsPDF is available
      if (typeof jsPDF !== 'function') {
        throw new Error("jsPDF library is not available. Please refresh the page and try again.");
      }
      
      // Check if imagePath is valid
      if (!imagePath) {
        throw new Error("Image path is missing or invalid");
      }
      
      // Fetch the logo for watermark
      const logoResponse = await fetch('/logo.png');
      if (!logoResponse.ok) {
        console.warn("Could not fetch logo for watermark, continuing without it");
      }
      
      let logoBase64 = null;
      if (logoResponse.ok) {
        const logoBlob = await logoResponse.blob();
        const logoReader = new FileReader();
        logoBase64 = await new Promise((resolve) => {
          logoReader.onloadend = () => resolve(logoReader.result);
          logoReader.readAsDataURL(logoBlob);
        });
      }
      
      // Fetch the road image
      console.log("Fetching image from:", `http://localhost:5000/${imagePath}`);
      const response = await fetch(`http://localhost:5000/${imagePath}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log("Image blob received, size:", blob.size);
      
      if (!blob || blob.size === 0) {
        throw new Error("Received empty image data");
      }

      const reader = new FileReader();
      
      reader.onerror = (error) => {
        console.error("FileReader error:", error);
        alert("Error reading image file. Please try again.");
        setDownloadingIndex(null);
      };
      
      reader.onloadend = () => {
        try {
          console.log("Image loaded as base64");
          const base64Image = reader.result;
          
          console.log("Creating PDF document...");
          // Create new jsPDF instance with proper orientation
          const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
          });
          
          // Add watermark if logo is available
          if (logoBase64) {
            // Add logo as watermark (faded in background)
            doc.saveGraphicsState();
            
            // Add the logo multiple times as a pattern across the page with slightly increased opacity
            doc.setGState(new doc.GState({ opacity: 0.12 }));
            for (let y = 40; y < 280; y += 100) {
              for (let x = 2; x < 180; x += 100) {
                doc.addImage(logoBase64, 'PNG', x, y, 60, 60);
              }
            }
            
            // Add a larger centered watermark with slightly increased opacity
            doc.setGState(new doc.GState({ opacity: 0.08 }));
            doc.addImage(logoBase64, 'PNG', 55, 110, 100, 100);
            
            // Add a very subtle full-page watermark
            doc.setGState(new doc.GState({ opacity: 0.03 }));
            doc.addImage(logoBase64, 'PNG', 0, 0, 210, 297);
            
            doc.restoreGraphicsState();
          }
  
          // Document border with gradient effect
          const borderColors = [
            [41, 128, 185], // Blue
            [39, 174, 96],  // Green
            [41, 128, 185]  // Blue
          ];
          
          // Top border with gradient
          for (let i = 0; i < 200; i++) {
            const colorIndex = Math.floor((i / 200) * (borderColors.length - 1));
            const nextColorIndex = Math.min(colorIndex + 1, borderColors.length - 1);
            const progress = (i / 200) * (borderColors.length - 1) - colorIndex;
            
            const r = Math.round(borderColors[colorIndex][0] * (1 - progress) + borderColors[nextColorIndex][0] * progress);
            const g = Math.round(borderColors[colorIndex][1] * (1 - progress) + borderColors[nextColorIndex][1] * progress);
            const b = Math.round(borderColors[colorIndex][2] * (1 - progress) + borderColors[nextColorIndex][2] * progress);
            
            doc.setDrawColor(r, g, b);
            doc.setLineWidth(0.5);
            doc.line(5 + i, 5, 5 + i + 1, 5);
          }
          
          // Draw the rest of the border
          doc.setDrawColor(44, 62, 80);
          doc.setLineWidth(0.5);
          doc.line(5, 5, 5, 292);         // Left border
          doc.line(205, 5, 205, 292);     // Right border
          doc.line(5, 292, 205, 292);     // Bottom border
          
          // Add decorative corner elements
          doc.setFillColor(41, 128, 185);
          doc.circle(5, 5, 2, 'F');       // Top-left corner
          doc.circle(205, 5, 2, 'F');     // Top-right corner
          doc.circle(5, 292, 2, 'F');     // Bottom-left corner
          doc.circle(205, 292, 2, 'F');   // Bottom-right corner
          
          // Styled PDF content - Header with logo
          if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', 10, 10, 20, 20);
          }
          
          // Title and company name with enhanced styling
          doc.setFontSize(24);
          doc.setTextColor(41, 128, 185); // Blue color
          doc.setFont(undefined, 'bold');
          doc.text("INSPECTIFY", 35, 20);
          
          // Subtitle with gradient-like effect
          doc.setFontSize(16);
          doc.setFont(undefined, 'normal');
          doc.setTextColor(39, 174, 96); // Green color
          doc.text("Road Condition Assessment Report", 35, 28);
          
          // Decorative horizontal line with gradient effect
          for (let i = 0; i < 190; i++) {
            const colorIndex = Math.floor((i / 190) * (borderColors.length - 1));
            const nextColorIndex = Math.min(colorIndex + 1, borderColors.length - 1);
            const progress = (i / 190) * (borderColors.length - 1) - colorIndex;
            
            const r = Math.round(borderColors[colorIndex][0] * (1 - progress) + borderColors[nextColorIndex][0] * progress);
            const g = Math.round(borderColors[colorIndex][1] * (1 - progress) + borderColors[nextColorIndex][1] * progress);
            const b = Math.round(borderColors[colorIndex][2] * (1 - progress) + borderColors[nextColorIndex][2] * progress);
            
            doc.setDrawColor(r, g, b);
            doc.setLineWidth(1);
            doc.line(10 + i, 35, 10 + i + 1, 35);
          }
          
          // Report metadata
          doc.setFontSize(10);
          doc.setTextColor(100, 100, 100);
          doc.text(`Report ID: ${entry._id || 'N/A'}`, 10, 42);
          doc.text(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 10, 48);
          doc.text(`Reported: ${new Date(timestamp || Date.now()).toLocaleDateString()} at ${new Date(timestamp || Date.now()).toLocaleTimeString()}`, 10, 54);
          
          // Severity and status badges
          const severityColor = 
            severity === 'severe' ? [231, 76, 60] : 
            severity === 'high' ? [230, 126, 34] : 
            severity === 'moderate' ? [241, 196, 15] : 
            severity === 'low' ? [46, 204, 113] : [149, 165, 166];
          
          const statusColor = 
            status === 'Resolved' ? [46, 204, 113] : 
            status === 'Critical' ? [231, 76, 60] : 
            status === 'Pending' ? [52, 152, 219] : [149, 165, 166];
          
          // Severity badge
          doc.setFillColor(...severityColor);
          doc.roundedRect(150, 40, 40, 8, 2, 2, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(10);
          doc.setFont(undefined, 'bold');
          doc.text(severity?.toUpperCase() || 'UNKNOWN', 170, 45, { align: 'center' });
          
          // Status badge
          doc.setFillColor(...statusColor);
          doc.roundedRect(150, 50, 40, 8, 2, 2, 'F');
          doc.setTextColor(255, 255, 255);
          doc.text(status?.toUpperCase() || 'PENDING', 170, 55, { align: 'center' });
          
          // Location section - removed background fill to show watermark
          // Add subtle divider line instead of box
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.2);
          doc.line(10, 65, 200, 65);
          
          // Enhanced section header with gradient-like effect
          const gradientColors = [
            [41, 128, 185], // Blue
            [39, 174, 96]   // Green
          ];
          
          // Draw a small colored indicator before the header
          doc.setFillColor(...gradientColors[0]);
          doc.rect(10, 72, 3, 8, 'F');
          
          doc.setTextColor(44, 62, 80);
          doc.setFontSize(14);
          doc.setFont(undefined, 'bold');
          doc.text("Location Details", 18, 75);
          doc.setFont(undefined, 'normal');
          doc.setFontSize(10);
          
          // Address with icon
          doc.setTextColor(52, 73, 94);
          doc.text("Address:", 15, 85);
          const wrappedAddress = doc.splitTextToSize(`${address || 'Unknown location'}`, 160);
          doc.text(wrappedAddress, 40, 85);
          
          // Coordinates with icon
          doc.text("Coordinates:", 15, 95);
          doc.text(`${latitude || 'N/A'}, ${longitude || 'N/A'}`, 40, 95);
          
          // Damage assessment section - removed background fill to show watermark
          // Add subtle divider line instead of box
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.2);
          doc.line(10, 105, 200, 105);
          
          // Enhanced section header with gradient-like effect
          doc.setFillColor(...gradientColors[1]); // Use green for this section
          doc.rect(10, 112, 3, 8, 'F');
          
          doc.setTextColor(44, 62, 80);
          doc.setFontSize(14);
          doc.setFont(undefined, 'bold');
          doc.text("Damage Assessment", 18, 115);
          doc.setFont(undefined, 'normal');
          doc.setFontSize(10);
          
          // Format damage types if available
          let damageTypesText = "Not specified";
          if (damageType && Array.isArray(damageType) && damageType.length > 0) {
            damageTypesText = damageType.map(type => 
              type.replace(/_/g, ' ').split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
              ).join(' ')
            ).join(', ');
          } else if (damageType && typeof damageType === 'string') {
            damageTypesText = damageType.replace(/_/g, ' ').split(' ').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
          }
          
          doc.setTextColor(52, 73, 94);
          doc.text("Damage Type:", 15, 125);
          doc.text(damageTypesText, 40, 125);
          
          doc.text("Severity Level:", 15, 135);
          doc.text(severity?.charAt(0).toUpperCase() + severity?.slice(1) || 'Unknown', 40, 135);
          
          // Image section - removed background fill to show watermark
          // Add subtle divider line instead of box
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.2);
          doc.line(10, 150, 200, 150);
          
          // Enhanced section header with gradient-like effect
          doc.setFillColor(...gradientColors[1]); // Green for this section
          doc.rect(10, 157, 3, 8, 'F');
          
          doc.setTextColor(44, 62, 80);
          doc.setFontSize(14);
          doc.setFont(undefined, 'bold');
          doc.text("Visual Evidence", 18, 160);
          
          console.log("Adding image to PDF with enhanced styling...");
          try {
            // Create a clipping mask for rounded corners
            doc.saveGraphicsState();
            
            // Define the rounded rectangle for clipping - adjusted position and size
            const x = 20;
            const y = 165; // Adjusted y position
            const w = 170;
            const h = 100; // Increased height for better aspect ratio
            const r = 10; // corner radius for rounded look
            
            // Add a shadow effect (simulate by drawing multiple rectangles with decreasing opacity)
            for (let i = 3; i > 0; i--) {
              doc.setFillColor(100, 100, 100);
              doc.setGState(new doc.GState({ opacity: 0.03 }));
              doc.roundedRect(x + i, y + i, w, h, r, r, 'F');
            }
            
            // Draw rounded rectangle path for clipping
            doc.setGState(new doc.GState({ opacity: 1 }));
            doc.roundedRect(x, y, w, h, r, r, 'S');
            doc.clip();
            
            // Add the image within the clipping path with proper aspect ratio
            // Create a temporary image to get dimensions
            const tempImg = new Image();
            tempImg.src = base64Image;
            
            // Calculate dimensions that maintain aspect ratio
            let imgWidth = w;
            let imgHeight = h;
            let imgX = x;
            let imgY = y;
            
            // If we have access to the image dimensions, calculate proper sizing
            if (tempImg.width && tempImg.height) {
              const imgRatio = tempImg.width / tempImg.height;
              const boxRatio = w / h;
              
              if (imgRatio > boxRatio) {
                // Image is wider than the box ratio
                imgHeight = w / imgRatio;
                imgY = y + (h - imgHeight) / 2;
              } else {
                // Image is taller than the box ratio
                imgWidth = h * imgRatio;
                imgX = x + (w - imgWidth) / 2;
              }
            }
            
            // Add the image with calculated dimensions
            doc.addImage(base64Image, "JPEG", imgX, imgY, imgWidth, imgHeight, null, 'FAST', 0);
            
            // Restore graphics state to remove clipping
            doc.restoreGraphicsState();
            
            // Add decorative border around the image
            // First, add a thicker white border
            doc.setDrawColor(255, 255, 255);
            doc.setLineWidth(2);
            doc.roundedRect(x, y, w, h, r, r, 'S');
            
            // Then add a colored border with gradient-like effect
            const borderColors = [
              [41, 128, 185], // Blue
              [39, 174, 96],  // Green
              [41, 128, 185]  // Blue
            ];
            
            // Top border
            for (let i = 0; i < w; i++) {
              const colorIndex = Math.floor((i / w) * (borderColors.length - 1));
              const nextColorIndex = Math.min(colorIndex + 1, borderColors.length - 1);
              const progress = (i / w) * (borderColors.length - 1) - colorIndex;
              
              const r = Math.round(borderColors[colorIndex][0] * (1 - progress) + borderColors[nextColorIndex][0] * progress);
              const g = Math.round(borderColors[colorIndex][1] * (1 - progress) + borderColors[nextColorIndex][1] * progress);
              const b = Math.round(borderColors[colorIndex][2] * (1 - progress) + borderColors[nextColorIndex][2] * progress);
              
              doc.setDrawColor(r, g, b);
              doc.setLineWidth(0.75);
              
              // Only draw on the straight parts, not the rounded corners
              if (i > r && i < w - r) {
                doc.line(x + i, y, x + i + 0.5, y);
                doc.line(x + i, y + h, x + i + 0.5, y + h);
              }
            }
            
            // Left and right borders
            for (let i = 0; i < h; i++) {
              const colorIndex = Math.floor((i / h) * (borderColors.length - 1));
              const nextColorIndex = Math.min(colorIndex + 1, borderColors.length - 1);
              const progress = (i / h) * (borderColors.length - 1) - colorIndex;
              
              const r = Math.round(borderColors[colorIndex][0] * (1 - progress) + borderColors[nextColorIndex][0] * progress);
              const g = Math.round(borderColors[colorIndex][1] * (1 - progress) + borderColors[nextColorIndex][1] * progress);
              const b = Math.round(borderColors[colorIndex][2] * (1 - progress) + borderColors[nextColorIndex][2] * progress);
              
              doc.setDrawColor(r, g, b);
              
              // Only draw on the straight parts, not the rounded corners
              if (i > r && i < h - r) {
                doc.line(x, y + i, x, y + i + 0.5);
                doc.line(x + w, y + i, x + w, y + i + 0.5);
              }
            }
            
            // Add a caption below the image
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.setFont(undefined, 'italic');
            doc.text("Road condition captured on " + new Date(timestamp || Date.now()).toLocaleDateString(), 105, y + h + 8, { align: 'center' });
            
          } catch (imgError) {
            console.error("Error adding image to PDF:", imgError);
            doc.text("Image could not be added to PDF. Please check the console for details.", 20, 180);
          }
          
          // Footer
          doc.setDrawColor(44, 62, 80);
          doc.setLineWidth(0.5);
          doc.line(10, 280, 200, 280);
          
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text("© Inspectify Road Assessment System", 105, 285, { align: 'center' });
          doc.text(`Page 1 of 1`, 190, 285, { align: 'right' });
  
          console.log("Saving PDF...");
          doc.save(`Inspectify_Road_Report_${entry._id ? entry._id.substring(0, 8) : index}_${new Date().toISOString().slice(0, 10)}.pdf`);
          console.log("PDF generated successfully");
          alert("PDF generated successfully!");
        } catch (pdfError) {
          console.error("Error generating PDF content:", pdfError);
          alert("Failed to generate PDF. Please try again.");
        } finally {
          setDownloadingIndex(null);
        }
      };

      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert(`Failed to generate PDF: ${error.message}`);
      setDownloadingIndex(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
          <p className="text-lg font-medium text-gray-600">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="flex items-center justify-center mb-4">
            <AlertCircle className="h-12 w-12 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-center text-gray-800 mb-2">Error Loading Reports</h2>
          <p className="text-gray-600 text-center">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 w-full bg-blue-500 hover:bg-blue-600 text-black font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (entries.length === 0 && !loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">No Reports Found</h2>
          <p className="text-gray-600">No road detection entries are currently available.</p>
        </div>
      </div>
    );
  }
  
  // Filter Panel Component
  const FilterPanel = () => {
    return (
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-lg shadow-md border border-gray-200 mb-6 overflow-hidden"
          >
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Severity Filter */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Severity</h3>
                  <div className="space-y-2">
                    {['low', 'moderate', 'high', 'severe'].map(sev => (
                      <label key={sev} className="flex items-center">
                        <input
                          type="checkbox"
                          className="rounded text-green-500 focus:ring-green-500 mr-2"
                          checked={filters.severity.includes(sev)}
                          onChange={() => toggleFilter('severity', sev)}
                        />
                        <span className="text-sm text-gray-700 capitalize flex items-center">
                          <span 
                            className="inline-block w-3 h-3 rounded-full mr-2"
                            style={{ 
                              backgroundColor: 
                                sev === 'low' ? '#3498db' : 
                                sev === 'moderate' ? '#f39c12' : 
                                sev === 'high' ? '#e67e22' : 
                                sev === 'severe' ? '#e74c3c' : '#95a5a6'
                            }}
                          ></span>
                          {sev}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* Status Filter */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Status</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {uniqueStatuses.map(status => (
                      <label key={status} className="flex items-center">
                        <input
                          type="checkbox"
                          className="rounded text-green-500 focus:ring-green-500 mr-2"
                          checked={filters.status.includes(status)}
                          onChange={() => toggleFilter('status', status)}
                        />
                        <span className="text-sm text-gray-700 capitalize">{status}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* Damage Type Filter */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Damage Type</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {uniqueDamageTypes.map(type => (
                      <label key={type} className="flex items-center">
                        <input
                          type="checkbox"
                          className="rounded text-green-500 focus:ring-green-500 mr-2"
                          checked={filters.damageType.includes(type)}
                          onChange={() => toggleFilter('damageType', type)}
                        />
                        <span className="text-sm text-gray-700">{formatDamageType(type)}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* Date Range Filter */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Date Range</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">From</label>
                      <input
                        type="date"
                        className="w-full rounded border-gray-300 text-sm focus:ring-green-500 focus:border-green-500"
                        value={filters.dateRange.start || ''}
                        onChange={(e) => setDateRange(e.target.value, filters.dateRange.end)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">To</label>
                      <input
                        type="date"
                        className="w-full rounded border-gray-300 text-sm focus:ring-green-500 focus:border-green-500"
                        value={filters.dateRange.end || ''}
                        onChange={(e) => setDateRange(filters.dateRange.start, e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Filter Actions */}
              <div className="flex justify-between mt-4 pt-3 border-t border-gray-200">
                <button
                  onClick={resetFilters}
                  className="text-sm text-gray-600 hover:text-gray-800 flex items-center"
                >
                  <X size={14} className="mr-1" />
                  Reset Filters
                </button>
                <div className="text-sm text-gray-600">
                  Showing <span className="font-medium">{filteredEntries.length}</span> of <span className="font-medium">{entries.length}</span> reports
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  // Handle review submission
  const handleReviewSubmit = async () => {
    if (!userId) {
      setError("User ID not available. Please log in again.");
      return;
    }
    
    if (!reviewingId) {
      setError("No image selected for review.");
      return;
    }
    
    try {
      // Create the request body
      const requestBody = {
        imageId: reviewingId,
        reviewStatus: reviewForm.status,
        reviewNotes: reviewForm.notes,
        severity: reviewForm.severity,
        damageType: reviewForm.damageType,
        recommendedAction: reviewForm.recommendedAction,
        reviewerId: userId // Include the reviewer's user ID
      };
      
      console.log("Submitting review:", requestBody);
      console.log("Review notes:", reviewForm.notes);
      
      const response = await fetch('http://localhost:5000/api/review-image-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Check for non-JSON responses
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const errorText = await response.text();
        throw new Error(`Server returned non-JSON response: ${errorText}`);
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit review');
      }

      const responseData = await response.json();
      console.log("Review submitted successfully:", responseData);

      // Update the entry in the local state
      const updatedEntries = entries.map(entry => {
        if (entry._id === reviewingId) {
          return {
            ...entry,
            reviewed: true,
            reviewStatus: reviewForm.status,
            reviewNotes: reviewForm.notes,
            severity: reviewForm.severity,
            damageType: reviewForm.damageType,
            recommendedAction: reviewForm.recommendedAction,
            reviewDate: new Date()
          };
        }
        return entry;
      });

      setEntries(updatedEntries);
      setShowReviewModal(false);
      setReviewingId(null);
      setReviewForm({
        status: 'approved',
        severity: 'moderate',
        damageType: ['pothole'],
        notes: '',
        recommendedAction: ''
      });
      
      // Show success message
      alert("Review submitted successfully!");
    } catch (error) {
      console.error('Error submitting review:', error);
      alert(`Failed to submit review: ${error.message}`);
    }
  };

  // Review Modal Component
  const ReviewModal = () => {
    if (!showReviewModal) return null;
    
    // Find the entry with the matching ID
    const entry = entries.find(e => e && e._id === reviewingId);
    
    // If no entry is found, show an error message
    if (!entry) {
      console.error(`No entry found with ID: ${reviewingId}`);
      return (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-red-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                Error
              </h3>
              <button 
                onClick={() => setShowReviewModal(false)}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-red-50 rounded-lg p-4 mb-4">
              <p className="text-gray-700">The selected report could not be found. It may have been deleted or moved.</p>
            </div>
            <button
              onClick={() => setShowReviewModal(false)}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg text-white font-medium shadow-sm hover:shadow transition-all"
            >
              Close
            </button>
          </div>
        </div>
      );
    }
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-blue-100">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Review Road Issue
              </h3>
              <button 
                onClick={() => setShowReviewModal(false)}
                className="text-gray-400 hover:text-black-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="md:w-1/2">
                <div className="relative overflow-hidden rounded-xl shadow-md group">
                  {entry.imagePath ? (
                    <img 
                      src={`http://localhost:5000/${entry.imagePath}`} 
                      alt="Road issue" 
                      className="w-full h-56 object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        console.error("Error loading image:", entry.imagePath);
                        e.target.src = "https://via.placeholder.com/400x300?text=Image+Not+Available";
                        e.target.alt = "Image not available";
                      }}
                    />
                  ) : (
                    <div className="w-full h-56 bg-gray-200 rounded-lg flex items-center justify-center">
                      <p className="text-gray-500">No image available</p>
                    </div>
                  )}
                  
                  {/* Overlay with image info */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-black">
                    <p className="text-sm font-medium">ID: {entry._id?.substring(0, 8) || 'N/A'}</p>
                  </div>
                </div>
                
                <div className="mt-4 space-y-2">
                  <div className="bg-gray-50 p-3 rounded-lg flex items-start">
                    <MapPin className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="ml-2">
                      <p className="text-sm font-medium text-gray-900">Location</p>
                      <p className="text-sm text-gray-800">{entry.address || 'Address not available'}</p>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-lg flex items-start">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    <div className="ml-2">
                      <p className="text-sm font-medium text-gray-900">Coordinates</p>
                      <p className="text-sm text-gray-800 font-mono">{entry.latitude || 'N/A'}, {entry.longitude || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-lg flex items-start">
                    <Calendar className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="ml-2">
                      <p className="text-sm font-medium text-gray-900">Detected</p>
                      <p className="text-sm text-gray-800">{new Date(entry.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="md:w-1/2 space-y-5">
                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-1 text-blue-600" />
                    Review Information
                  </h4>
                  <p className="text-sm text-gray-800 font-medium">
                    Please review this road issue and provide your assessment. This information will be used to prioritize repairs.
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Review Status
                  </label>
                  <select
                    value={reviewForm.status}
                    onChange={(e) => setReviewForm({...reviewForm, status: e.target.value})}
                    className="w-full rounded-lg border border-gray-300 py-2.5 px-3 bg-white text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  >
                    <option value="approved">Approved - Issue Confirmed</option>
                    <option value="rejected">Rejected - Not a Valid Issue</option>
                    <option value="in-progress">In Progress - Under Repair</option>
                    <option value="pending">Pending - Further Review Needed</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Damage Types (Select Multiple)
                  </label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {[
                      { value: 'pothole', label: 'Pothole' },
                      { value: 'alligator_crack', label: 'Alligator Crack' },
                      { value: 'lateral_crack', label: 'Lateral Crack' },
                      { value: 'longitudinal_crack', label: 'Longitudinal Crack' },
                      { value: 'edge_crack', label: 'Edge Crack' },
                      { value: 'rutting', label: 'Rutting' },
                      { value: 'raveling', label: 'Raveling' },
                      { value: 'other', label: 'Other' }
                    ].map(option => (
                      <div key={option.value} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`damage-${option.value}`}
                          checked={reviewForm.damageType.includes(option.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setReviewForm({
                                ...reviewForm, 
                                damageType: [...reviewForm.damageType, option.value]
                              });
                            } else {
                              setReviewForm({
                                ...reviewForm, 
                                damageType: reviewForm.damageType.filter(type => type !== option.value)
                              });
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`damage-${option.value}`} className="ml-2 block text-sm text-gray-700">
                          {option.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Show AI detection visualization if available */}
                {entry.boundingBoxImage && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      AI Detection Visualization
                    </label>
                    <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                      <img 
                        src={entry.boundingBoxImage} 
                        alt="AI detection visualization" 
                        className="w-full h-auto"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      This visualization shows the AI-detected damage areas on the road surface.
                    </p>
                  </div>
                )}
                
                {/* Show detection metadata if available */}
                {entry.analysisResult?.detections && entry.analysisResult.detections.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Detection Metrics
                    </label>
                    <div className="bg-gray-50 rounded-lg p-3 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="font-medium text-gray-700">Detections:</span>
                          <span className="ml-1 text-gray-600">{entry.analysisResult.detections.length}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Confidence:</span>
                          <span className="ml-1 text-gray-600">
                            {Math.round(entry.analysisResult.detections.reduce((sum, det) => sum + (det.confidence || 0), 0) / 
                              entry.analysisResult.detections.length * 100)}%
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-900">Processing:</span>
                          <span className="ml-1 text-gray-800">
                            {entry.analysisResult.processing_time || entry.analysisResult.clientProcessingTime || 'N/A'} sec
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-900">Model:</span>
                          <span className="ml-1 text-gray-800">YOLOv8</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Severity Level
                  </label>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {['low', 'moderate', 'high', 'severe'].map((severity) => (
                      <button
                        key={severity}
                        type="button"
                        onClick={() => setReviewForm({...reviewForm, severity})}
                        className={`py-2 px-3 rounded-md text-xs font-medium transition-colors ${
                          reviewForm.severity === severity 
                            ? severity === 'low' ? 'bg-green-100 text-green-800 border-2 border-green-300' :
                              severity === 'moderate' ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300' :
                              severity === 'high' ? 'bg-orange-100 text-orange-800 border-2 border-orange-300' :
                              'bg-red-100 text-red-800 border-2 border-red-300'
                            : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        {severity.charAt(0).toUpperCase() + severity.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                    </svg>
                    Recommended Action
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={reviewForm.recommendedAction}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setReviewForm(prevState => ({
                          ...prevState,
                          recommendedAction: newValue
                        }));
                      }}
                      className="w-full rounded-lg border border-gray-300 py-2.5 px-3 pl-9 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                      placeholder="e.g., Patch pothole, Resurface road section"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <button 
                      type="button" 
                      onClick={() => {
                        setReviewForm(prevState => ({
                          ...prevState,
                          recommendedAction: "Schedule repair within 1 week"
                        }));
                      }}
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 px-2 rounded-md transition-colors"
                    >
                      Repair in 1 week
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        setReviewForm(prevState => ({
                          ...prevState,
                          recommendedAction: "Immediate repair needed"
                        }));
                      }}
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 px-2 rounded-md transition-colors"
                    >
                      Immediate repair
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        setReviewForm(prevState => ({
                          ...prevState,
                          recommendedAction: "Monitor condition"
                        }));
                      }}
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 px-2 rounded-md transition-colors"
                    >
                      Monitor condition
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Review Notes
                  </label>
                  <div className="relative">
                    <textarea
                      value={reviewForm.notes || ""}
                      onChange={(e) => {
                        console.log("Updating notes:", e.target.value);
                        // Direct state update for better reliability
                        setReviewForm({
                          ...reviewForm,
                          notes: e.target.value
                        });
                      }}
                      onBlur={(e) => {
                        // Additional handler to ensure state is updated when focus leaves the textarea
                        console.log("Notes field blur event, value:", e.target.value);
                        setReviewForm({
                          ...reviewForm,
                          notes: e.target.value
                        });
                      }}
                      rows={4}
                      placeholder="Add any additional notes about this road issue..."
                      className="w-full rounded-lg border border-gray-300 py-2.5 px-3 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                      id="review-notes"
                      name="review-notes"
                      style={{ resize: 'vertical', minHeight: '100px' }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between items-center">
                    <p className="text-xs text-gray-500">
                      These notes will be visible to maintenance crews and other reviewers.
                    </p>
                    <div className="text-xs text-gray-500">
                      {reviewForm.notes ? reviewForm.notes.length : 0} characters
                    </div>
                  </div>
                  
                  {/* Quick note templates */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    <button 
                      type="button" 
                      onClick={() => {
                        const template = "Requires immediate attention due to safety concerns.";
                        setReviewForm({
                          ...reviewForm,
                          notes: template
                        });
                      }}
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 px-2 rounded-md transition-colors"
                    >
                      Safety concern
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        const template = "Minor damage, should be monitored for deterioration.";
                        setReviewForm({
                          ...reviewForm,
                          notes: template
                        });
                      }}
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 px-2 rounded-md transition-colors"
                    >
                      Minor damage
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-6 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-end gap-3">
            <button
              onClick={() => setShowReviewModal(false)}
              className="px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-gray-700 font-medium shadow-sm transition-all flex items-center justify-center"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </button>
            <button
              onClick={handleReviewSubmit}
              className="px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-lg text-white font-medium shadow-sm hover:shadow transition-all flex items-center justify-center"
            >
              <CheckCircle className="h-4 w-4 mr-2 text-white" />
              Submit Review & Notify
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Delete Confirmation Modal
  const DeleteConfirmationModal = () => {
    if (!deleteModal.open) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Confirm Deletion</h3>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to delete this report? <br />
              <span className="font-medium text-gray-700">{deleteModal.entryName}</span><br />
              This action cannot be undone.
            </p>
          </div>
          
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteModal({ open: false, entryId: null, entryName: null })}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center"
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  try {
    return (
      <div className="flex bg-gray-50 min-h-screen">
        {/* Delete Confirmation Modal */}
        <DeleteConfirmationModal />
        
        {/* Sidebar Component */}
        <Sidebar activeTab={activeTab} userName={userName} userId={userId} />
        
        {/* Main content with left margin to account for fixed sidebar */}
        <div className="flex-1 p-8 ml-64">
          <ReviewModal />
          <div className="max-w-7xl mx-auto">
            <header className="py-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">
                    Road Condition Reports
                  </h1>
                  <p className="mt-2 text-gray-600 flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-blue-500" />
                    <span className="font-medium text-blue-700">{filteredEntries.length}</span> 
                    <span className="ml-1">of <span className="font-medium text-blue-700">{entries.length}</span> road {entries.length === 1 ? "issue" : "issues"} shown</span>
                  </p>
                </div>
                <div className="mt-4 md:mt-0 flex items-center space-x-3">
                  <div className="inline-flex items-center px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm font-medium text-blue-700">
                    <Calendar className="h-4 w-4 mr-2" />
                    Last updated: {new Date().toLocaleDateString()}
                  </div>
                  <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className={`inline-flex items-center px-4 py-2 ${showFilters ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-700 border-gray-200'} border rounded-full text-sm font-medium transition-colors`}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    {showFilters ? 'Hide Filters' : 'Show Filters'}
                    {showFilters ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                  </button>
                </div>
              </div>
              
              {/* Search and Sort Controls */}
              <div className="mt-6 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-grow">
                  <input
                    type="text"
                    placeholder="Search by location, damage type, or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                  />
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSort('timestamp')}
                    className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                  >
                    <Clock className="h-4 w-4 mr-2 text-gray-500" />
                    Date
                    {sortConfig.key === 'timestamp' && (
                      sortConfig.direction === 'asc' ? 
                        <ChevronUp className="h-4 w-4 ml-1 text-blue-500" /> : 
                        <ChevronDown className="h-4 w-4 ml-1 text-blue-500" />
                    )}
                  </button>
                  
                  <button
                    onClick={() => handleSort('severity')}
                    className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                  >
                    <AlertCircle className="h-4 w-4 mr-2 text-gray-500" />
                    Severity
                    {sortConfig.key === 'severity' && (
                      sortConfig.direction === 'asc' ? 
                        <ChevronUp className="h-4 w-4 ml-1 text-blue-500" /> : 
                        <ChevronDown className="h-4 w-4 ml-1 text-blue-500" />
                    )}
                  </button>
                </div>
              </div>
              
              {/* Filter Panel */}
              <FilterPanel />
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEntries && filteredEntries.length > 0 ? filteredEntries.map((entry, index) => {
                if (!entry) {
                  console.error(`Entry at index ${index} is undefined or null`);
                  return null;
                }
                
                return (
                  <div 
                    key={index} 
                    ref={entry._id === highlightedEntryId ? highlightedEntryRef : null}
                    className={`bg-white rounded-xl shadow-md overflow-hidden transition-all hover:shadow-lg hover:translate-y-[-4px] duration-300 border ${entry._id === highlightedEntryId ? 'border-yellow-400 ring-2 ring-yellow-300' : 'border-gray-100'}`}
                  >
                    <div className="relative">
                      <img
                        src={`http://localhost:5000/${entry.imagePath}`}
                        alt={`Detected road issue ${index + 1}`}
                        className="w-full h-56 object-cover"
                        loading="lazy"
                        onError={(e) => {
                          console.error("Error loading image:", entry.imagePath);
                          e.target.src = "https://via.placeholder.com/400x300?text=Image+Not+Available";
                          e.target.alt = "Image not available";
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60"></div>
                      
                      {/* Status badge */}
                      <div className="absolute top-3 right-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          entry.reviewStatus === 'approved' ? 'bg-green-100 text-green-800' :
                          entry.reviewStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {entry.reviewStatus === 'approved' ? 'Approved' :
                           entry.reviewStatus === 'rejected' ? 'Rejected' :
                           'Pending Review'}
                        </span>
                      </div>
                      
                      {/* Severity indicator */}
                      <div className="absolute bottom-3 left-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          entry.severity === 'severe' || entry.severity === 'high' ? 'bg-red-100 text-red-800' :
                          entry.severity === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                          entry.severity === 'low' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {entry.severity || 'Unknown'} Severity
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-5">
                      <div className="mb-4">
                        <div className="flex justify-between items-start">
                          <h2 className="text-lg font-bold text-gray-900 flex items-center">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mr-2">
                              {index + 1}
                            </span>
                            Road Issue
                          </h2>
                          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                            ID: {entry._id?.substring(0, 8) || 'N/A'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1 flex items-center">
                          <Calendar className="h-3.5 w-3.5 mr-1 text-blue-500" />
                          {new Date(entry.timestamp).toLocaleDateString()} at {new Date(entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                      
                      <div className="space-y-3 mb-4">
                        <div className="flex items-start bg-gray-50 p-2 rounded-lg">
                          <MapPin className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                          <div className="ml-2">
                            <p className="text-sm font-medium text-gray-900">Location</p>
                            <p className="text-sm text-gray-800 break-words">{entry.address || 'Address not available'}</p>
                          </div>
                        </div>
                  
                        <div className="flex items-start bg-gray-50 p-2 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                          <div className="ml-2">
                            <p className="text-sm font-medium text-gray-900">Coordinates</p>
                            <p className="text-sm text-gray-800 font-mono">
                              {entry.latitude || 'N/A'}, {entry.longitude || 'N/A'}
                            </p>
                          </div>
                        </div>
                        
                        {entry.damageType && (
                          <div className="flex items-start bg-gray-50 p-2 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div className="ml-2">
                              <p className="text-sm font-medium text-gray-700">Damage Types</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {Array.isArray(entry.damageType) 
                                  ? entry.damageType.map(type => (
                                      <span key={type} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full capitalize">
                                        {type.replace(/_/g, ' ')}
                                      </span>
                                    ))
                                  : (
                                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full capitalize">
                                        {entry.damageType.replace(/_/g, ' ')}
                                      </span>
                                    )
                                }
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-3 mb-4">
                  <p className="text-sm font-medium text-blue-800 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    AI Analysis Results
                  </p>
                  
                  <div className="mt-2 space-y-2">
                    {/* Severity indicator */}
                    {entry.severityLevel && (
                      <div className="flex items-center">
                        <span className="text-xs font-medium text-gray-700 w-24">Severity:</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          entry.severityLevel === 'severe' || entry.severityLevel === 'high' ? 'bg-red-100 text-red-800' :
                          entry.severityLevel === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                          entry.severityLevel === 'low' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {entry.severityLevel.charAt(0).toUpperCase() + entry.severityLevel.slice(1)}
                        </span>
                      </div>
                    )}
                    
                    {/* Damage types */}
                    {entry.damageType && (
                      <div className="flex items-start">
                        <span className="text-xs font-medium text-gray-700 w-24 mt-1">Damage Types:</span>
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(entry.damageType) 
                            ? entry.damageType.map(type => (
                                <span key={type} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                  {type.replace(/_/g, ' ').split(' ').map(word => 
                                    word.charAt(0).toUpperCase() + word.slice(1)
                                  ).join(' ')}
                                </span>
                              ))
                            : (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                  {entry.damageType.replace(/_/g, ' ').split(' ').map(word => 
                                    word.charAt(0).toUpperCase() + word.slice(1)
                                  ).join(' ')}
                                </span>
                              )
                          }
                        </div>
                      </div>
                    )}
                    
                    {/* Processing time */}
                    {entry.analysisResult?.clientProcessingTime && (
                      <div className="flex items-center">
                        <span className="text-xs font-medium text-gray-700 w-24">Processing:</span>
                        <span className="text-xs text-gray-600">
                          {entry.analysisResult.clientProcessingTime} seconds
                        </span>
                      </div>
                    )}
                    
                    {/* Detection count */}
                    {entry.analysisResult?.detections && (
                      <div className="flex items-center">
                        <span className="text-xs font-medium text-gray-700 w-24">Detections:</span>
                        <span className="text-xs text-gray-600">
                          {entry.analysisResult.detections.length} issues found
                        </span>
                      </div>
                    )}
                    
                    {/* Review notes */}
                    {entry.reviewNotes && (
                      <div className="mt-2 pt-2 border-t border-blue-200">
                        <span className="text-xs font-medium text-gray-700 block mb-1">Review Notes:</span>
                        <p className="text-xs text-blue-700 bg-white p-2 rounded border border-blue-100">
                          {entry.reviewNotes}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Bounding box image if available */}
                  {entry.boundingBoxImage && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <p className="text-xs font-medium text-gray-700 mb-1">AI Detection Visualization:</p>
                      <div className="relative rounded-lg overflow-hidden border border-blue-200">
                        <img 
                          src={entry.boundingBoxImage} 
                          alt="AI detection visualization" 
                          className="w-full h-auto"
                          onError={(e) => {
                            console.error("Error loading bounding box image");
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {/* First row of buttons */}
                  <button
                    onClick={() => handleDownload(entry, index)}
                    disabled={downloadingIndex === index}
                    className={`flex items-center justify-center px-4 py-2.5 rounded-lg font-medium transition-all shadow-sm ${
                      downloadingIndex === index 
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed" 
                        : "bg-blue-600 hover:bg-blue-700 text-white hover:shadow"
                    }`}
                  >
                    {downloadingIndex === index ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2 text-white" />
                        Download
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => handleViewOnMap(entry)}
                    className="flex items-center justify-center px-4 py-2.5 rounded-lg font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm hover:shadow"
                  >
                    <Map className="h-4 w-4 mr-2 text-white" />
                    View on Map
                  </button>
                  
                  {/* Second row of buttons */}
                  <button
                    onClick={() => handleDeleteClick(entry)}
                    className="flex items-center justify-center px-4 py-2.5 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-all shadow-sm"
                  >
                    <Trash2 className="h-4 w-4 mr-2 text-white" />
                    Delete
                  </button>
                
                  <button
                    onClick={() => {
                      setReviewingId(entry._id);
                      setShowReviewModal(true);
                    }}
                    className="flex items-center justify-center px-4 py-2.5 rounded-lg font-medium bg-green-600 hover:bg-green-700 text-white transition-all shadow-sm hover:shadow"
                  >
                    <Bell className="h-4 w-4 mr-2 text-white" />
                    Review
                  </button>
                </div>
              </div>
            </div>
          );
              }) : (
                <div className="col-span-full text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">No matching reports found</h3>
                  {entries.length > 0 ? (
                    <div>
                      <p className="mt-2 text-gray-500">No reports match your current filters.</p>
                      <button 
                        onClick={resetFilters}
                        className="mt-4 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium transition-colors inline-flex items-center"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Reset Filters
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-gray-500">No road condition reports are currently available.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  } catch (renderError) {
    console.error("Error rendering Report component:", renderError);
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="flex items-center justify-center mb-4">
            <AlertCircle className="h-12 w-12 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-center text-gray-800 mb-2">Error Rendering Reports</h2>
          <p className="text-gray-600 text-center">
            There was an error displaying the reports. Please try refreshing the page.
          </p>
          <pre className="mt-4 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-40">
            {renderError.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 w-full bg-blue-500 hover:bg-blue-600 text-black font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }
};

export default Report;