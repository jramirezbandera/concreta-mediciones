/* Barrel del núcleo del asistente de IA (F-A1 transporte + F-A2 chat de dudas). */
export * from './types';
export * from './models';
export * from './sharedKey';
export * from './chatHistory';
export * from './imagePrep';
export * from './settingsStore';
export * from './ops';
export * from './schema';
export * from './validate';
export * from './snapshot';
export * from './prompt';
export * from './executor';
export { runChatTurn } from './chat';
export { chatRaw } from './providers/gemini';
