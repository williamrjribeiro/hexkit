import type { ImportDeclaration } from "@hexkit/codegen";
import { renderSourceFile } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

import type { HttpModel } from "../model/derive.ts";
import { ROUTES_FILE_PATH } from "../model/derive.ts";
import { renderRouteRegistration } from "./routes/registrations.ts";
import { renderOnErrorHandler, renderStaticRuntimeStatements } from "./routes/static-runtime.ts";

export { renderRouteRegistration, renderSecurityMeta } from "./routes/registrations.ts";
export { renderOnErrorHandler } from "./routes/static-runtime.ts";

export function renderRoutesFile(model: HttpModel): GeneratedFile {
  const hasAuth = model.authenticator !== undefined;
  const imports: ImportDeclaration[] = [
    {
      from: "hono",
      names: ["Context"],
      typeOnly: true,
    },
    {
      from: "hono",
      names: ["Hono"],
    },
    ...(hasAuth
      ? [
          {
            from: "hono/factory",
            names: ["createMiddleware"],
          },
          {
            from: "../../core/domain/auth-principal.ts",
            names: ["Principal"],
            typeOnly: true,
          },
          {
            from: "../../core/ports/authenticator.ts",
            names: ["AuthCredentials", "Authenticator"],
            typeOnly: true,
          },
        ]
      : []),
    {
      from: "./controllers.ts",
      names: [
        "createHttpControllers",
        ...(hasAuth ? ["AuthenticationError"] : []),
        "RequestValidationError",
      ],
    },
    {
      from: "./controllers.ts",
      names: ["HttpControllers", "HttpUseCases"],
      typeOnly: true,
    },
  ];

  const routeRegistrations = model.operations.map(renderRouteRegistration).join("\n");

  const statements = [
    ...renderStaticRuntimeStatements({ hasAuth }),
    [
      hasAuth
        ? "export function registerJsonRoutes(app: Hono<AppBindings>, controllers: HttpControllers, authenticator: Authenticator): void {"
        : "export function registerJsonRoutes(app: Hono, controllers: HttpControllers): void {",
      routeRegistrations,
      "}",
    ].join("\n"),
    [
      hasAuth
        ? "export function createHonoApp(useCases: HttpUseCases, authenticator: Authenticator): Hono<AppBindings> {"
        : "export function createHonoApp(useCases: HttpUseCases): Hono {",
      hasAuth ? "  const app = new Hono<AppBindings>();" : "  const app = new Hono();",
      hasAuth
        ? "  registerJsonRoutes(app, createHttpControllers(useCases, authenticator), authenticator);"
        : "  registerJsonRoutes(app, createHttpControllers(useCases));",
      renderOnErrorHandler({ hasAuth }),
      "  return app;",
      "}",
    ].join("\n"),
  ];

  return {
    path: ROUTES_FILE_PATH,
    contents: renderSourceFile({ imports, statements }),
    ownership: "generated",
  };
}
