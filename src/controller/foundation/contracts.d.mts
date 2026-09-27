export const VIEWPORT: Readonly<Record<string, unknown>>
export function validateViewport(value: unknown): true
export function validateScale(value: unknown): true
export function validateIntake(value: unknown): true
export function verifyIntakeBytes(index: unknown, bytesByPath: Record<string, Uint8Array>): Promise<true>
