import * as z from 'zod';

export type UploadFileRequest = z.infer<typeof UploadFileRequest>;
/**
 * Request schema for uploadFile operation
 */
export const UploadFileRequest = z.instanceof(Blob);