FROM ubuntu:22.04

# Install Node.js, Python, and pip
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    python3-pip \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Map python3 to python (since server.js calls 'python')
RUN ln -s /usr/bin/python3 /usr/bin/python

# Create working directory
WORKDIR /app

# Copy the requirements and install python dependencies
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy package.json and install node dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy the rest of the application
COPY . .

# Hugging Face spaces use port 7860 by default
ENV PORT=7860
EXPOSE 7860

# Start the server
CMD ["node", "backend/server.js"]
