import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export async function sendChatMessage(message: string): Promise<void> {
  await invoke('send_chat_message', { message });
}

export async function loadChatHistory(): Promise<ChatMessageData[]> {
  return await invoke<ChatMessageData[]>('load_chat_history');
}

export interface ChatMessageData {
  role: string;
  content: string;
}

export interface StreamTokenEvent {
  token: string;
}

export interface StreamDoneEvent {
  full_response: string;
}

export function onStreamToken(callback: (token: string) => void): Promise<UnlistenFn> {
  return listen<StreamTokenEvent>('chat-stream-token', (event) => {
    callback(event.payload.token);
  });
}

export function onStreamDone(callback: (response: string) => void): Promise<UnlistenFn> {
  return listen<StreamDoneEvent>('chat-stream-done', (event) => {
    callback(event.payload.full_response);
  });
}
