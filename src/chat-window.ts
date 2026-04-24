import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const messagesEl = document.getElementById('messages')!;
const inputEl = document.getElementById('input') as HTMLInputElement;
const sendBtn = document.getElementById('send')!;
const typingEl = document.getElementById('typing')!;

function addMessage(role: 'user' | 'assistant', content: string) {
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = content;
  el.appendChild(bubble);
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function send() {
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';
  addMessage('user', text);
  typingEl.style.display = 'flex';
  try {
    await invoke('send_chat_message', { message: text });
  } catch (e) {
    typingEl.style.display = 'none';
    addMessage('assistant', `Error: ${e}`);
  }
}

sendBtn.addEventListener('click', send);
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); send(); }
});

document.getElementById('close-btn')!.addEventListener('click', () => {
  import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
    getCurrentWindow().destroy();
  });
});

listen<{ token: string }>('chat-stream-token', (event) => {
  typingEl.style.display = 'none';
  const last = messagesEl.querySelector('.msg.assistant:last-child .msg-bubble');
  if (last) {
    last.textContent += event.payload.token;
  } else {
    addMessage('assistant', event.payload.token);
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
});

listen<{ full_response: string }>('chat-stream-done', () => {
  typingEl.style.display = 'none';
});

// Load history on start
invoke<{ role: string; content: string }[]>('load_chat_history').then((msgs) => {
  for (const m of msgs) {
    addMessage(m.role as 'user' | 'assistant', m.content);
  }
}).catch(() => {});
