# Use Node.js v18 (LTS version)
FROM node:18-alpine

WORKDIR /app

# Copy package.json and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the entire application
COPY . .
RUN rm -rf public 

# Build the application
RUN npm run build

# Expose the app on port 3000
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
