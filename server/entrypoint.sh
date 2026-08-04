#!/bin/sh
set -e

# Apply migrations / sync schema
echo "Syncing database schema..."
npx prisma db push --accept-data-loss

# Seed the database
echo "Seeding database..."
npx tsx prisma/seed.ts

# Start the application
echo "Starting backend server..."
exec npx tsx src/index.ts
