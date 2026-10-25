#!/bin/bash
# PI Project Context - Setup Script
# Run this to install PI globally

set -e

echo "Installing PI Project Context..."

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "Error: npm not found. Please install Node.js 18+ first."
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Error: Node.js 18+ required. Current version: $(node -v)"
    exit 1
fi

# Install dependencies and build
echo "Building PI..."
cd "$SCRIPT_DIR"
npm install
npm run build

# Create global link
echo "Creating global link..."
npm link

echo ""
echo "✓ PI installed successfully!"
echo ""
echo "Usage:"
echo "  pi init              # Initialize a project"
echo "  pi context           # Get project context"
echo "  pi status            # Show project status"
echo "  pi agent start       # Start background agent"
echo ""
echo "Run 'pi help' for more commands."