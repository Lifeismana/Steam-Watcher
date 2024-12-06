FROM node:22-alpine3.20 AS builder
WORKDIR /build-stage
COPY package*.json ./
RUN npm ci
# Copy the the files you need
COPY src/* ./

FROM alpine:3.21
# Create app directory
WORKDIR /usr/src/app
# Add required binaries
RUN apk add --no-cache libstdc++ dumb-init \
  && addgroup -g 1000 node && adduser -u 1000 -G node -s /bin/sh -D node \
  && chown node:node ./
COPY --from=builder /usr/local/bin/node /usr/local/bin/
COPY --from=builder /usr/local/bin/docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
USER node
# Update the following COPY lines based on your codebase
COPY --from=builder /build-stage/ ./
# Run with dumb-init to not start node with PID=1, since Node.js was not designed to run as PID 1
CMD ["dumb-init", "node", "bot.mjs"]