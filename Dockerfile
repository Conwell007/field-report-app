FROM node:22-alpine

WORKDIR /app

# Copy all project files from repository
COPY . .

# Ensure data directory exists for database
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
