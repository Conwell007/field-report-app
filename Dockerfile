FROM node:22-alpine

WORKDIR /app

# Copy package definition and code
COPY package.json ./
COPY db.js ./
COPY schema.sql ./
COPY server.js ./
COPY public ./public

# Create data directory for persistent SQLite database volume
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
