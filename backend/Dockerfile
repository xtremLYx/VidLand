FROM node:20-slim

# Install system dependencies & Cloudflare WARP
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    lsb-release \
    ffmpeg \
    python3 \
    netcat-openbsd \
    && curl -fsSL https://pkg.cloudflareclient.com/pubkey.gpg | gpg --yes --dearmor --output /usr/share/keyrings/cloudflare-warp-archive-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/cloudflare-warp-archive-keyring.gpg] https://pkg.cloudflareclient.com/ bookworm main" | tee /etc/apt/sources.list.d/cloudflare-client.list \
    && apt-get update && apt-get install -y cloudflare-warp \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Copy backend source
COPY . .

EXPOSE 8000

# Launch WARP service, register proxy on port 4001, connect, and start Node server
CMD warp-svc & \
    sleep 3 && \
    (warp-cli --accept-tos registration new || true) && \
    warp-cli --accept-tos mode proxy && \
    warp-cli --accept-tos proxy port 4001 && \
    warp-cli --accept-tos connect && \
    npm start
