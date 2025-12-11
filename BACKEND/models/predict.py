# Import PyTorch - the deep learning framework used for our neural network model
import torch
# Import neural network modules from PyTorch
import torch.nn as nn
# Import image transformation utilities
import torchvision.transforms as transforms
# Import PIL (Python Imaging Library)
from PIL import Image
# Import sys and os for system operations
import sys
import os

# Define the new model architecture matching raaduu.pth
class RoadClassifierCNN(nn.Module):
    def __init__(self, in_features):
        super(RoadClassifierCNN, self).__init__()
        self.conv_layers = nn.Sequential(
            nn.Conv2d(3, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(128, 256, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2)
        )
        self.fc_layers = nn.Sequential(
            nn.Flatten(),
            nn.Linear(in_features, 512),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(512, 2)  # Output 2 classes: Not Road (0) and Road (1)
        )

    def forward(self, x):
        x = self.conv_layers(x)
        x = x.view(x.size(0), -1)
        x = self.fc_layers(x)
        return x

# Set up the device
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Helper function to calculate input features for the fully connected layer
def get_in_features():
    with torch.no_grad():
        dummy_input = torch.randn(1, 3, 128, 128)
        # Initialize with dummy in_features=1 since conv_layers doesn't use it
        model_temp = RoadClassifierCNN(1)
        conv_out = model_temp.conv_layers(dummy_input)
        return conv_out.view(1, -1).size(1)

# Construct the path to the saved model file
model_path = os.path.join(os.path.dirname(__file__), "road.pth")

# Initialize and load the model
try:
    # Calculate in_features dynamically
    in_features = get_in_features()
    
    # Initialize model
    model = RoadClassifierCNN(in_features).to(device)
    
    # Load weights
    if os.path.exists(model_path):
        model.load_state_dict(torch.load(model_path, map_location=device))
        model.eval()
    else:
        print(f"Error: Model file '{model_path}' not found!")
        sys.exit(1)
except Exception as e:
    print(f"Error loading model: {e}")
    sys.exit(1)

# Define the image transformation pipeline
# Matches the training preprocessing
transform = transforms.Compose([
    transforms.Resize((128, 128)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5])
])

def predict_image(image_path):
    try:
        # Load and preprocess image
        image = Image.open(image_path).convert("RGB")
        image = transform(image).unsqueeze(0).to(device)
        
        with torch.no_grad():
            output = model(image)
            # Apply softmax to get probabilities for both classes
            probs = torch.nn.functional.softmax(output, dim=1)
            
            # Get the predicted class index and its confidence
            # Index 0: Not Road
            # Index 1: Road
            confidence, predicted = torch.max(probs, 1)
            
            confidence_score = confidence.item()
            predicted_idx = predicted.item()
            
            # Map index to label
            # Assuming standard alphabetical sorting: 0=Not Road, 1=Road
            # If your training data had different labels, this might need adjustment
            prediction = "Road" if predicted_idx == 1 else "Not a Road"
            
            # Print formatted output for the server to parse
            print(f"{prediction} (confidence: {confidence_score:.4f})")
            
            return prediction
            
    except Exception as e:
        print(f"Error predicting image: {e}")
        return "Error"

if __name__ == "__main__":
    # Check command line arguments
    if len(sys.argv) < 2:
        print("Usage: python predict.py <image_path>")
        sys.exit(1)

    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(f"Error: Image file '{image_path}' not found!")
        sys.exit(1)

    # Run prediction
    result = predict_image(image_path)
    
    # Print final result for server capture (last line)
    print(result)
