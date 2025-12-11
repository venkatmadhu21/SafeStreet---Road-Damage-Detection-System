# Import YOLO from ultralytics - a state-of-the-art object detection model
from ultralytics import YOLO 
# Import PyTorch - the deep learning framework used for neural network operations
import torch
# Import neural network modules from PyTorch - provides building blocks for neural networks
import torch.nn as nn
# Import image transformation utilities from torchvision - for preprocessing images
from torchvision import transforms
# Import PIL (Python Imaging Library) - for loading and manipulating images
from PIL import Image
# Import sys module - provides access to command-line arguments and system parameters
import sys
# Import os module - provides functions for interacting with the operating system
import os
# Import json module - for encoding and decoding JSON data
import json
# Import MongoClient from pymongo - for connecting to MongoDB database
from pymongo import MongoClient
# Import datetime - for handling date and time operations
from datetime import datetime
# Import timm (PyTorch Image Models) - provides pre-trained vision models
import timm
# Import time module - for measuring execution time
import time

# Enable performance optimizations for CPU operations
# Set the number of threads for parallel processing to 4 - a good balance for most systems
torch.set_num_threads(4)
# Enable cuDNN benchmark mode - finds the best algorithm for the hardware
# This can significantly speed up operations on CUDA-enabled GPUs
torch.backends.cudnn.benchmark = True

# Start timing the model loading process
# This helps track performance and identify bottlenecks
start_time = time.time()

# ======= Load YOLO model =======
# Define the path to the pre-trained YOLO model weights
model_path = r'C:\Users\USER\tailwindsample\BACKEND\models\best.pt'
# Load the YOLO model with the specified weights
yolo_model = YOLO(model_path)
# Use half-precision (FP16) if GPU is available, otherwise use full precision (FP32)
# Half precision significantly speeds up inference on compatible GPUs
yolo_model.model.half() if torch.cuda.is_available() else yolo_model.model.float()

# ======= Load ViT (Vision Transformer) model =======
# Set up the device for computation - use GPU if available, otherwise CPU
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
# Print which device is being used for transparency
print(f"Using device: {device}")

# Create a Vision Transformer model using the timm library
# 'deit_tiny_patch16_224' is a small, efficient ViT variant that works well for this task
vit_model = timm.create_model('deit_tiny_patch16_224', pretrained=False)
# Replace the classification head with a custom head for multi-label classification
# - Takes the original input features from the ViT
# - Outputs 4 values (one for each damage type)
# - Uses Sigmoid activation for multi-label prediction (each output between 0-1)
vit_model.head = nn.Sequential(
    nn.Linear(vit_model.head.in_features, 4),
    nn.Sigmoid()
)
# Load the pre-trained weights for our custom ViT model
# map_location ensures the model loads correctly regardless of training device
vit_model.load_state_dict(torch.load(r'C:\Users\USER\tailwindsample\BACKEND\models\best_vit_multi_label.pth', map_location=device))
# Move the model to the appropriate device (GPU/CPU)
vit_model.to(device)
# Set the model to evaluation mode - disables dropout and uses running stats for batch norm
vit_model.eval()

# Use half-precision (FP16) for the ViT model if GPU is available
# This matches the precision used for the YOLO model
if torch.cuda.is_available():
    vit_model = vit_model.half()

# Define the image transformation pipeline for the ViT model
# These transformations prepare the input image for the ViT model
vit_transform = transforms.Compose([
    # Resize to 224x224 pixels - the standard input size for ViT models
    transforms.Resize((224, 224)),
    # Convert PIL Image to PyTorch tensor with values in range [0,1]
    transforms.ToTensor(),
    # Normalize pixel values using mean and std of 0.5 for all channels
    # This centers the data around 0 with a range of [-1,1]
    transforms.Normalize(mean=[0.5]*3, std=[0.5]*3)
])

# Print how long it took to load both models
# This helps identify if model loading is a bottleneck
print(f"Models loaded in {time.time() - start_time:.2f} seconds")

# Define the labels for the ViT model's multi-label classification
# These are the four types of road damage the model can detect
vit_labels = ["pothole", "longitudinal_crack", "lateral_crack", "alligator_crack"]

# Define custom confidence thresholds for each damage type
# These thresholds were determined through validation testing
# Lower thresholds (like 0.01) make the model more sensitive to certain damage types
best_thresholds = {
    "pothole": 0.01,               # Very sensitive detection for potholes
    "longitudinal_crack": 0.4,     # Higher threshold to reduce false positives
    "lateral_crack": 0.4,          # Higher threshold to reduce false positives
    "alligator_crack": 0.01        # Very sensitive detection for alligator cracks
}

def get_class_color(cls_name):
    """
    Assigns a specific color to each damage type for visualization.
    
    Args:
        cls_name (str): The class name of the detected damage
        
    Returns:
        list: RGB color values [R, G, B] for the damage type
    """
    # Normalize the class name to handle different formats (spaces vs underscores)
    normalized_name = cls_name.replace("_", " ").lower()
    
    # Assign specific colors to each damage type for consistent visualization
    if "pothole" in normalized_name:
        return [255, 0, 0]  # Red for potholes - most severe/visible damage
    elif "longitudinal" in normalized_name:
        return [0, 0, 255]  # Blue for longitudinal cracks
    elif "lateral" in normalized_name:
        return [255, 165, 0]  # Orange for lateral cracks
    elif "alligator" in normalized_name:
        return [128, 0, 128]  # Purple for alligator cracks
    
    # Default color for any unrecognized damage type
    return [0, 255, 0]  # Green

def get_severity(bboxes, img_width, img_height):
    """
    Calculate the overall severity of road damage based on multiple factors.
    
    Args:
        bboxes (list): List of bounding box dictionaries with damage information
        img_width (int): Width of the image in pixels
        img_height (int): Height of the image in pixels
        
    Returns:
        tuple: (severity_level, count_score, area_score, type_score)
            - severity_level: String rating ("low", "moderate", "high", "severe")
            - count_score: Number of damage instances
            - area_score: Sum of relative areas of all damages
            - type_score: Number of unique damage types
    """
    # Count the number of damage instances detected
    count_score = len(bboxes)
    # Calculate the total relative area of all damages (as percentage of image)
    area_score = sum([box['rel_area'] for box in bboxes])
    # Count the number of unique damage types
    type_score = len(set([box['class'] for box in bboxes]))

    # Determine severity level based on thresholds for each score
    # Start with the lowest severity
    severity = "low"
    # Upgrade to moderate if any score exceeds its threshold
    if count_score > 5 or area_score > 15 or type_score > 2:
        severity = "moderate"
    # Upgrade to high if count or area scores are higher
    if count_score > 10 or area_score > 30:
        severity = "high"
    # Upgrade to severe if count or area scores are very high
    if count_score > 15 or area_score > 50:
        severity = "severe"
    
    # Return all scores along with the severity level
    return severity, count_score, area_score, type_score

def run_vit_prediction(image):
    """
    Run the Vision Transformer model to predict damage types in an image.
    
    This function is optimized for speed and accepts an already loaded image.
    
    Args:
        image (PIL.Image): The loaded image to analyze
        
    Returns:
        list: Names of detected damage types
    """
    # Convert image to RGB if it's not already (e.g., grayscale or RGBA)
    if image.mode != "RGB":
        image = image.convert("RGB")
    
    # Preprocess the image:
    # 1. Apply transformations (resize, convert to tensor, normalize)
    # 2. Add batch dimension with unsqueeze(0)
    # 3. Move to the appropriate device (GPU/CPU)
    input_tensor = vit_transform(image).unsqueeze(0).to(device)
    
    # Use half precision if on GPU for faster inference
    if torch.cuda.is_available():
        input_tensor = input_tensor.half()

    # Run inference with optimizations:
    # - torch.no_grad() disables gradient calculation for inference
    # - squeeze() removes the batch dimension from the output
    with torch.no_grad():
        output = vit_model(input_tensor).squeeze()

    # Process results:
    # 1. Create a tensor of thresholds for each label
    # 2. Compare model outputs to thresholds
    # 3. Convert to integers (0 or 1) and move to CPU as numpy array
    thresholds = torch.tensor([best_thresholds[label] for label in vit_labels], device=device)
    predicted = (output > thresholds).int().cpu().numpy()

    # Create a list of labels that were detected (where prediction is 1)
    predictions = [label for i, label in enumerate(vit_labels) if predicted[i]]
    return predictions

def calculate_iou(box1, box2):
    """
    Calculate Intersection over Union (IoU) between two bounding boxes.
    
    IoU measures the overlap between two boxes and is used for merging similar detections.
    
    Args:
        box1 (list): First box coordinates [x1, y1, x2, y2]
        box2 (list): Second box coordinates [x1, y1, x2, y2]
        
    Returns:
        float: IoU value between 0 (no overlap) and 1 (perfect overlap)
    """
    # Find coordinates of the intersection rectangle
    # Take the maximum of left edges and minimum of right edges
    x1 = max(box1[0], box2[0])  # Left edge of intersection
    y1 = max(box1[1], box2[1])  # Top edge of intersection
    x2 = min(box1[2], box2[2])  # Right edge of intersection
    y2 = min(box1[3], box2[3])  # Bottom edge of intersection

    # Calculate area of intersection rectangle
    # If boxes don't overlap, max(0, x2-x1) ensures we get 0
    inter_area = max(0, x2 - x1) * max(0, y2 - y1)
    
    # Calculate areas of both bounding boxes
    box1_area = (box1[2] - box1[0]) * (box1[3] - box1[1])
    box2_area = (box2[2] - box2[0]) * (box2[3] - box2[1])
    
    # Calculate union area: sum of both areas minus intersection
    union_area = box1_area + box2_area - inter_area

    # Avoid division by zero
    if union_area == 0:
        return 0
        
    # Return IoU: intersection area divided by union area
    return inter_area / union_area

def merge_boxes(bboxes, iou_threshold=0.5):
    """
    Merge overlapping bounding boxes of the same class.
    
    This reduces duplicate detections of the same damage instance.
    
    Args:
        bboxes (list): List of bounding box dictionaries
        iou_threshold (float): Minimum IoU for boxes to be merged (default: 0.5)
        
    Returns:
        list: Merged bounding boxes
    """
    # Initialize empty list for merged boxes and tracking array
    merged = []
    used = [False] * len(bboxes)  # Track which boxes have been processed

    # Iterate through all bounding boxes
    for i in range(len(bboxes)):
        # Skip if this box has already been merged
        if used[i]:
            continue
            
        # Get the current box and mark it as used
        box_a = bboxes[i]
        group = [box_a]  # Start a new group with this box
        used[i] = True

        # Compare with all remaining boxes
        for j in range(i + 1, len(bboxes)):
            # Skip if this comparison box has already been merged
            if used[j]:
                continue
                
            box_b = bboxes[j]
            
            # Only merge boxes of the same class (damage type)
            if box_a["class"] == box_b["class"]:
                # Calculate overlap between boxes
                iou = calculate_iou(box_a["bbox"], box_b["bbox"])
                
                # If overlap is sufficient, add to the group and mark as used
                if iou >= iou_threshold:
                    group.append(box_b)
                    used[j] = True

        # Create a merged box that encompasses all boxes in the group
        # Find the minimum and maximum coordinates to create a bounding box around all boxes
        x1 = min([b["bbox"][0] for b in group])  # Leftmost edge
        y1 = min([b["bbox"][1] for b in group])  # Topmost edge
        x2 = max([b["bbox"][2] for b in group])  # Rightmost edge
        y2 = max([b["bbox"][3] for b in group])  # Bottommost edge
        
        # Use the highest confidence from the group
        conf = max([b["conf"] for b in group])
        
        # Keep the class name and color from the first box
        cls_name = box_a["class"]
        color = box_a["color"]

        # Add the merged box to the results
        merged.append({
            "bbox": [x1, y1, x2, y2],
            "class": cls_name,
            "conf": round(conf, 2),  # Round confidence to 2 decimal places
            "color": color
        })

    # Return the list of merged boxes
    return merged

def run_detection(image_path, location=None):
    """
    Main function to run road damage detection on an image.
    
    This function:
    1. Loads the image
    2. Runs YOLO object detection
    3. Processes the detections
    4. Runs ViT classification
    5. Calculates severity
    6. Returns comprehensive results
    
    Args:
        image_path (str): Path to the image file
        location (dict, optional): Dictionary with latitude and longitude
        
    Returns:
        dict: Complete detection results with all metadata
    """
    # Start timing the detection process
    detection_start = time.time()
    
    try:
        # Load the image once and reuse it for both models
        image = Image.open(image_path)
    except Exception as e:
        # Return error information if image loading fails
        return {"error": f"Error loading image: {e}"}

    # Get image dimensions for area calculations
    img_width, img_height = image.size
    
    # Run YOLO detection with optimized parameters
    yolo_start = time.time()
    results = yolo_model.predict(
        source=image_path,           # Path to the image
        save=False,                  # Don't save detection results to disk
        verbose=False,               # Don't print verbose output
        conf=0.5,                    # Confidence threshold (0.5 is balanced)
        iou=0.45,                    # NMS IoU threshold (0.45 is standard)
        max_det=50,                  # Maximum detections per image
        half=torch.cuda.is_available(),  # Use half precision if GPU available
        device=0 if torch.cuda.is_available() else 'cpu',  # Use GPU if available
        imgsz=640                    # Standard input size for YOLO
    )
    # Print timing information for YOLO inference
    print(f"YOLO inference completed in {time.time() - yolo_start:.2f} seconds")

    # Process YOLO detections efficiently
    result = results[0]  # Get the first (and only) result
    bboxes = [  ]          # Initialize empty list for bounding boxes
    
    # Process detected boxes if any were found
    if len(result.boxes) > 0:
        # Get all confidence values at once for efficiency
        confs = [float(box.conf[0].item()) for box in result.boxes]
        
        # Filter boxes by confidence threshold (0.01 is very permissive)
        # This allows low-confidence detections that might still be useful
        valid_indices = [i for i, conf in enumerate(confs) if conf >= 0.01]
        
        # Process each valid detection
        for i in valid_indices:
            box = result.boxes[i]
            
            # Extract bounding box coordinates [x1, y1, x2, y2]
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            
            # Get class ID and name from the result
            cls_id = int(box.cls[0].item())
            cls_name = result.names[cls_id]

            # Calculate area metrics for severity assessment
            width = x2 - x1   # Box width in pixels
            height = y2 - y1  # Box height in pixels
            area = width * height  # Absolute area in pixels
            
            # Calculate relative area as percentage of image area
            # This normalizes for different image sizes
            rel_area = area / (img_width * img_height) * 100

            # Create a dictionary with all box information
            bboxes.append({
                "bbox": [x1, y1, x2, y2],  # Coordinates
                "class": cls_name,          # Damage type
                "conf": round(confs[i], 2), # Confidence (rounded)
                "area": round(area, 1),     # Absolute area (rounded)
                "rel_area": round(rel_area, 2),  # Relative area (rounded)
                "color": get_class_color(cls_name)  # Color for visualization
            })

    # Calculate overall severity based on all detections
    severity, count_score, area_score, type_score = get_severity(bboxes, img_width, img_height)
    
    # Run ViT prediction for additional damage classification
    vit_start = time.time()
    vit_predictions = run_vit_prediction(image)
    print(f"ViT inference completed in {time.time() - vit_start:.2f} seconds")

    # Prepare comprehensive result JSON with all detection information
    result_json = {
        "detections": bboxes,  # List of all detected damages with details
        "severity": {          # Overall severity assessment
            "level": severity,       # Textual severity level
            "count_score": count_score,  # Number of damages
            "area_score": area_score,    # Total area score
            "type_score": type_score     # Number of unique damage types
        },
        "vit_predictions": vit_predictions,  # Additional damage types from ViT
        "image_dimensions": [img_width, img_height],  # Original image size
        "latitude": location.get("latitude") if location else None,  # Location data
        "longitude": location.get("longitude") if location else None,
        "processing_time": round(time.time() - detection_start, 2)  # Processing time
    }

    # Print total detection time for performance monitoring
    print(f"Total detection completed in {time.time() - detection_start:.2f} seconds")
    return result_json

def save_to_mongodb(data, image_path):
    """
    Save detection results to MongoDB.
    
    This function is designed to run in a background thread to avoid blocking.
    Currently disabled for performance reasons - data is saved by the Node.js server instead.
    
    Args:
        data (dict): Detection results to save
        image_path (str): Path to the analyzed image
    """
    try:
        # This function is intentionally disabled for performance
        # The Node.js server will handle database operations instead
        print("Skipping MongoDB save from Python for performance")
        return
    except Exception as e:
        # Log any errors but don't crash the program
        print(f"MongoDB error (non-critical): {e}")

# ======= Script Entry Point =======
if __name__ == "__main__":
    # Start timing the entire script execution
    script_start = time.time()
    
    # Check if required command-line arguments are provided
    if len(sys.argv) < 2:
        # Print usage instructions as JSON for the calling process
        print(json.dumps({"error": "Usage: python detect.py <image_path> [latitude] [longitude]"}))
        sys.exit(1)  # Exit with error code

    # Extract command-line arguments
    image_path = sys.argv[1]  # First argument is the image path
    
    # Parse latitude if provided (convert to float)
    latitude = float(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2] else None
    
    # Parse longitude if provided (convert to float)
    longitude = float(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3] else None

    # Verify that the image file exists
    if not os.path.exists(image_path):
        # Return error as JSON if file not found
        print(json.dumps({"error": f"Image file {image_path} not found."}))
        sys.exit(1)  # Exit with error code

    # Create location dictionary from latitude and longitude
    location = {"latitude": latitude, "longitude": longitude}
    
    # Run the main detection function
    result = run_detection(image_path, location=location)
    
    # Save results to MongoDB in a background thread if no errors occurred
    if "error" not in result:
        try:
            # Import threading here to avoid unnecessary import if not used
            import threading
            # Start MongoDB save in a separate thread to avoid blocking
            threading.Thread(target=save_to_mongodb, args=(result, image_path)).start()
        except:
            # If threading fails, try to save directly but don't block on errors
            try:
                save_to_mongodb(result, image_path)
            except:
                pass  # Silently ignore any errors in the fallback
    
    # Add total script execution time to the results
    result["total_script_time"] = round(time.time() - script_start, 2)
    print(f"Total script execution time: {result['total_script_time']} seconds")
    
    # Return the complete results as JSON
    # This output will be captured by the Node.js server that called this script
    print(json.dumps(result))