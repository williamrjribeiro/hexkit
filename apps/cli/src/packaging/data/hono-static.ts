export const SERVER_FILE_PATH = "src/runtime/server.ts";

export const honoTsconfig = {
  compilerOptions: {
    target: "esnext",
    lib: ["es2023"],
    moduleDetection: "force",
    module: "nodenext",
    moduleResolution: "nodenext",
    types: ["node"],
    strict: true,
    noEmit: true,
    allowImportingTsExtensions: true,
    isolatedModules: true,
    verbatimModuleSyntax: true,
    skipLibCheck: true,
  },
  include: ["src"],
};

export const honoDockerfile = `FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache postgresql-client \\
  && corepack enable \\
  && corepack prepare pnpm@11.24.0 --activate

COPY package.json ./
RUN pnpm install --prod

COPY . .
RUN chmod +x scripts/start.sh

EXPOSE 3000

CMD ["./scripts/start.sh"]
`;

export const dockerignore = `node_modules
dist
.next
.git
`;
