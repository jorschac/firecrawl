FROM node:22.23.4-slim@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true

RUN corepack enable && corepack prepare pnpm@11.4.0 --activate

WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ENV PLAYWRIGHT_BROWSERS_PATH=/usr/local/share/playwright

RUN pnpm run build

# Chromium is only needed when BROWSER_ENGINE=chromium (Playwright launch).
# Obscura mode connects over CDP and can skip this ~300MB browser install.
ARG INSTALL_CHROMIUM=true
RUN if [ "$INSTALL_CHROMIUM" = "true" ]; then \
      pnpm exec playwright install chromium --with-deps && \
      chmod -R a+rX /usr/local/share/playwright; \
    else \
      echo "Skipping Playwright Chromium install (use BROWSER_ENGINE=obscura)"; \
    fi

RUN chown -R node:node /usr/src/app

ARG PORT
ENV PORT=${PORT}

EXPOSE ${PORT}

USER node

CMD [ "pnpm", "start" ]
