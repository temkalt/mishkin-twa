FROM node:20-alpine
WORKDIR /app

# Install dependencies first
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Make entrypoint script executable
RUN chmod +x entrypoint.sh

EXPOSE 3000

CMD ["./entrypoint.sh"]
