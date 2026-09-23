# Stage 1: Build API Jar
FROM docker.1ms.run/library/eclipse-temurin:23-jdk-alpine AS api-builder

WORKDIR /workspace
COPY VERSION .
COPY api ./api
WORKDIR /workspace/api
RUN chmod +x ./gradlew && \
    ./gradlew shadowJar --no-daemon && \
    jdeps --print-module-deps --ignore-missing-deps build/libs/telegram-files.jar > dependencies.txt

# Stage 2: Build Web Static Assets
FROM docker.1ms.run/library/node:22-alpine AS web-builder

ENV NO_PROXY=localhost,127.0.0.1,mirrors.aliyun.com,registry.npmmirror.com,maven.aliyun.com \
    no_proxy=localhost,127.0.0.1,mirrors.aliyun.com,registry.npmmirror.com,maven.aliyun.com \
    NEXT_PUBLIC_API_URL=/api \
    NEXT_PUBLIC_WS_URL=/ws \
    NEXT_TELEMETRY_DISABLED=1 \
    SKIP_ENV_VALIDATION=1

WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com && npm ci
COPY web/ ./
RUN npm run build

# Stage 3: Build Custom Minimal JRE
FROM docker.1ms.run/library/eclipse-temurin:23-jdk-alpine AS runtime-builder

ENV NO_PROXY=localhost,127.0.0.1,mirrors.aliyun.com,registry.npmmirror.com,maven.aliyun.com \
    no_proxy=localhost,127.0.0.1,mirrors.aliyun.com,registry.npmmirror.com,maven.aliyun.com

WORKDIR /custom-jre

COPY --from=api-builder /workspace/api/dependencies.txt .
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories && \
    apk add --no-cache binutils && \
    jlink \
        --add-modules $(cat dependencies.txt) \
        --output jre \
        --strip-debug \
        --no-man-pages \
        --no-header-files \
        --compress=2 && \
    apk del binutils

# Stage 4: Final Image
FROM docker.1ms.run/library/alpine:3.18.12 AS final

ENV NO_PROXY=localhost,127.0.0.1,mirrors.aliyun.com,registry.npmmirror.com,maven.aliyun.com \
    no_proxy=localhost,127.0.0.1,mirrors.aliyun.com,registry.npmmirror.com,maven.aliyun.com \
    JAVA_HOME=/jre \
    PATH="/jre/bin:$PATH" \
    LANG=C.UTF-8 \
    NGINX_PORT=80

WORKDIR /app

ARG TARGETARCH

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories && \
    addgroup -S tf && \
    adduser -S -G tf tf && \
    apk add --no-cache nginx wget curl unzip tini su-exec gettext openssl3 libstdc++ gcompat libc6-compat && \
    rm -rf /tmp/* /var/tmp/* && \
    touch /run/nginx.pid && \
    chown -R tf:tf /app /etc/nginx /var/lib/nginx /var/log/nginx /run/nginx.pid && \
    printf '#!/bin/sh\njava -Djava.library.path=/app/tdlib -cp /app/api.jar telegram.files.Maintain "$@"\n' > /usr/bin/tfm && \
    chmod +x /usr/bin/tfm

COPY --from=runtime-builder --chown=tf:tf /custom-jre/jre /jre
COPY --from=api-builder --chown=tf:tf /workspace/api/build/libs/telegram-files.jar /app/api.jar
COPY --from=web-builder --chown=tf:tf /app/web/out/ /app/web/

COPY --chown=tf:tf ./tdlib/linux_$TARGETARCH /app/tdlib
COPY --chown=tf:tf ./entrypoint.sh .
COPY --chown=tf:tf ./nginx.conf.template /etc/nginx/nginx.conf.template

EXPOSE $NGINX_PORT

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/bin/sh", "./entrypoint.sh"]
