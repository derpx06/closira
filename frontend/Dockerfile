FROM node:18-alpine
WORKDIR /app

# Copy the local chatbot-package dependency first
COPY chatbot-package ./chatbot-package

# Copy frontend package definitions and install dependencies
COPY frontend/package.json frontend/package-lock.json* ./frontend/
WORKDIR /app/frontend
RUN npm install

# Copy frontend source code
COPY frontend/ ./

# Expose Vite dev server port
EXPOSE 5173

# Point the Vite proxy to the Docker backend container instead of 127.0.0.1
ENV VITE_DEV_PROXY_TARGET=http://backend:5001

# Start the Vite development server on all interfaces
CMD ["npm", "run", "dev", "--", "--host"]
