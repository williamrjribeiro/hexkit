import type { GeneratedFile } from "@hexkit/plugin-api";
import { renderHttpControllersFile } from "@hexkit/shared";

import type { NextHttpModel } from "../artifact.ts";
import { CONTROLLERS_FILE_PATH } from "../model/derive.ts";

export function renderControllersFile(model: NextHttpModel): GeneratedFile {
  return renderHttpControllersFile({
    filePath: CONTROLLERS_FILE_PATH,
    operations: model.routes.flatMap((route) => route.methods),
    hasAuthenticator: model.authenticator !== undefined,
  });
}
