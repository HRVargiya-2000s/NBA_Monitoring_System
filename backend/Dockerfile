# Backend Dockerfile with Node.js and Python (for Excel report generation)
FROM node:20-alpine

# Install Python 3 and openpyxl
RUN apk add --no-cache python3 py3-pip && \
    python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir openpyxl

ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHON_PATH="/opt/venv/bin/python3"
ENV NODE_ENV=production

WORKDIR /app

# Copy package descriptors and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source code
COPY . .

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "src/index.js"]
