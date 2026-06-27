// Utility functions for Pinboard Pin

// resolve the effective color scheme from the tri-state dark mode option
// (true = dark, false = light, null = follow the OS preference)
export function resolveTheme(dark: boolean | null): "dark" | "light" {
  return dark === true ||
    (dark !== false &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
    ? "dark"
    : "light";
}

// convert an unknown error to a string message
export function errorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object") {
    try {
      const json: string = JSON.stringify(error);
      if (typeof json === "string") {
        return json;
      }
    } catch {
      /* ignore */
    }
  }
  if (
    typeof error === "number" ||
    typeof error === "boolean" ||
    typeof error === "bigint" ||
    typeof error === "symbol"
  ) {
    return String(error);
  }
  return "Unknown error";
}

// log an unknown error to the console and return its string message
export function logError(error: unknown, context?: unknown): string {
  const base = errorMessage(error);
  const prefix = context !== undefined ? `${errorMessage(context)}: ` : "";
  const message = `${prefix}${base}`;
  console.error(message);
  return message;
}
