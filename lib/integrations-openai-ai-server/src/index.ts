// `isOpenAiConfigured` was exported from ./client but never from this barrel,
// so every route importing the package root could reach the client and not the
// flag telling it whether the client works. That is a large part of why the
// "every AI route must check isOpenAiConfigured" instruction went unfollowed:
// from where the routes stand, it did not exist.
export { openai, isOpenAiConfigured } from "./client";
export { generateImageBuffer, editImages } from "./image";
export { batchProcess, batchProcessWithSSE, isRateLimitError, type BatchOptions } from "./batch";
