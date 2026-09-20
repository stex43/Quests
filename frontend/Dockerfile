FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM deps AS dev

COPY . .

# Declared only so BuildKit does not warn when compose passes this build arg to the dev
# target; the dev server reads VITE_BACKEND_PORT from the environment at startup instead.
ARG VITE_BACKEND_PORT

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]

FROM deps AS build

COPY . .

ARG VITE_BACKEND_PORT=8000
ENV VITE_BACKEND_PORT=$VITE_BACKEND_PORT

RUN npm run build

FROM nginx:alpine AS prod

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 5173
