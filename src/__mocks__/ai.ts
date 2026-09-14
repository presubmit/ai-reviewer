// Manual mock for the 'ai' package (ESM-only, not loadable in Jest/CJS)
export const generateObject = jest.fn().mockResolvedValue({
  object: {},
  usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
});
export const generateText = jest.fn().mockResolvedValue({ text: '' });
export const streamText = jest.fn();
export const streamObject = jest.fn();
