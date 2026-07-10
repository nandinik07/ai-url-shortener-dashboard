FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies (including devDependencies for TypeScript compilation)
RUN npm install

# Copy source code
COPY . .

# Compile TypeScript
RUN npm run build

# Expose server port
EXPOSE 5000

# Start server in production mode
CMD ["npm", "start"]
