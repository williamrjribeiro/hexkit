import type { GeneratedFile } from "@hexkit/plugin-api";
import { renderHttpControllersFile } from "@hexkit/shared";

import { CONTROLLERS_FILE_PATH, type HttpModel } from "../model/derive.ts";

export function renderControllersFile(model: HttpModel): GeneratedFile {
  return renderHttpControllersFile({
    filePath: CONTROLLERS_FILE_PATH,
    operations: model.operations,
    hasAuthenticator: model.authenticator !== undefined,
  });
}
