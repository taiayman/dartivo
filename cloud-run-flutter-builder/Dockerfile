# Use a pre-built Flutter image. This image also includes Node.js.
FROM ghcr.io/cirruslabs/flutter:stable

# Set the working directory
WORKDIR /app

# Install Node.js (which includes npm) and other dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    ca-certificates \
    apt-transport-https \
    # Install Node.js 20.x
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    # Install Google Cloud SDK
    && curl -sS https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee /etc/apt/sources.list.d/google-cloud-sdk.list \
    && apt-get update \
    && apt-get install -y google-cloud-cli \
    && rm -rf /var/lib/apt/lists/*

# Set PUB_CACHE environment variable. Flutter commands in index.js might use this.
# The cirruslabs image might set FLUTTER_HOME and PATH correctly already.
ENV PUB_CACHE /opt/.pub-cache

# Copy the package.json for the Node.js server
COPY package*.json ./

# Install Node.js dependencies for the build server (Express, ShellJS, etc.)
RUN npm install

# Copy the rest of the application code (index.js)
COPY index.js .

# Make port 8080 available to the world outside this container
EXPOSE 8080

# Define environment variable
ENV PORT 8080

# Run index.js when the container launches
CMD ["node", "index.js"]
