FROM python:3.10-slim

WORKDIR /app

# Install system dependencies (libgomp1 is required by FAISS)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install pre-requisite dependencies from fast PyPI index first
RUN pip install --no-cache-dir numpy Pillow

# Install PyTorch CPU build to keep image sizes small and CPU-friendly
RUN pip install --no-cache-dir --default-timeout=1000 torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Copy and install python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Expose port
EXPOSE 8000

# Run FastAPI server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
