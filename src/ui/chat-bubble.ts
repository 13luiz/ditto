import { invoke } from '@tauri-apps/api/core';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export class ChatBubble {
  private container: HTMLDivElement;
  private messageList: HTMLDivElement;
  private input: HTMLInputElement;
  private sendBtn: HTMLButtonElement;
  private typingIndicator: HTMLDivElement;
  private messages: ChatMessage[] = [];
  private isOpen: boolean = false;
  private onSendMessage?: (message: string) => void;

  constructor(onSendMessage?: (message: string) => void) {
    this.onSendMessage = onSendMessage;
    this.container = document.createElement('div');
    this.container.id = 'chat-bubble';
    this.container.className = 'chat-bubble hidden';

    this.messageList = document.createElement('div');
    this.messageList.className = 'chat-messages';

    this.typingIndicator = document.createElement('div');
    this.typingIndicator.className = 'typing-indicator';
    this.typingIndicator.innerHTML = '<span></span><span></span><span></span>';
    this.typingIndicator.style.display = 'none';

    const inputRow = document.createElement('div');
    inputRow.className = 'chat-input-row';

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.placeholder = 'Say something...';
    this.input.className = 'chat-input';

    this.sendBtn = document.createElement('button');
    this.sendBtn.textContent = 'Send';
    this.sendBtn.className = 'chat-send-btn';

    inputRow.appendChild(this.input);
    inputRow.appendChild(this.sendBtn);

    this.container.appendChild(this.messageList);
    this.container.appendChild(this.typingIndicator);
    this.container.appendChild(inputRow);

    this.bindEvents();
  }

  private bindEvents(): void {
    this.sendBtn.addEventListener('click', () => this.send());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.send();
      }
    });
  }

  private send(): void {
    const text = this.input.value.trim();
    if (!text) return;

    this.input.value = '';
    this.addMessage('user', text);

    if (this.onSendMessage) {
      this.onSendMessage(text);
    }
  }

  addMessage(role: 'user' | 'assistant', content: string): void {
    const msg: ChatMessage = {
      role,
      content,
      timestamp: Date.now(),
    };
    this.messages.push(msg);
    this.renderMessage(msg);
    this.scrollToBottom();
  }

  private renderMessage(msg: ChatMessage): void {
    const el = document.createElement('div');
    el.className = `chat-message ${msg.role}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = msg.content;

    el.appendChild(bubble);
    this.messageList.appendChild(el);
  }

  showTypingIndicator(): void {
    this.typingIndicator.style.display = 'flex';
    this.scrollToBottom();
  }

  hideTypingIndicator(): void {
    this.typingIndicator.style.display = 'none';
  }

  streamToken(token: string): void {
    const lastMsg = this.messageList.querySelector('.chat-message.assistant:last-child .message-bubble');
    if (lastMsg) {
      lastMsg.textContent += token;
    } else {
      this.addMessage('assistant', token);
    }
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    this.messageList.scrollTop = this.messageList.scrollHeight;
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    this.isOpen = true;
    this.container.classList.remove('hidden');
    this.input.focus();
  }

  close(): void {
    this.isOpen = false;
    this.container.classList.add('hidden');
  }

  get isVisible(): boolean {
    return this.isOpen;
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.container);
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  clearMessages(): void {
    this.messages = [];
    this.messageList.innerHTML = '';
  }
}

export function createChatStyles(): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = `
    .chat-bubble {
      position: absolute;
      top: -260px;
      left: -40px;
      width: 280px;
      height: 260px;
      background: rgba(30, 30, 40, 0.92);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      flex-direction: column;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: #e0e0e0;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      overflow: hidden;
    }

    .chat-bubble.hidden {
      display: none;
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .chat-messages::-webkit-scrollbar {
      width: 4px;
    }

    .chat-messages::-webkit-scrollbar-track {
      background: transparent;
    }

    .chat-messages::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
    }

    .chat-message {
      display: flex;
      max-width: 90%;
    }

    .chat-message.user {
      align-self: flex-end;
    }

    .chat-message.assistant {
      align-self: flex-start;
    }

    .message-bubble {
      padding: 6px 10px;
      border-radius: 10px;
      font-size: 12px;
      line-height: 1.4;
      word-wrap: break-word;
    }

    .chat-message.user .message-bubble {
      background: rgba(80, 140, 255, 0.85);
      color: white;
      border-bottom-right-radius: 3px;
    }

    .chat-message.assistant .message-bubble {
      background: rgba(255, 255, 255, 0.12);
      color: #e0e0e0;
      border-bottom-left-radius: 3px;
    }

    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 4px 12px 8px;
      align-items: center;
    }

    .typing-indicator span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.5);
      animation: typing-dot 1.4s infinite;
    }

    .typing-indicator span:nth-child(2) {
      animation-delay: 0.2s;
    }

    .typing-indicator span:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes typing-dot {
      0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
      30% { opacity: 1; transform: scale(1); }
    }

    .chat-input-row {
      display: flex;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(0, 0, 0, 0.2);
    }

    .chat-input {
      flex: 1;
      background: transparent;
      border: none;
      color: #e0e0e0;
      padding: 8px 10px;
      font-size: 12px;
      outline: none;
      font-family: inherit;
    }

    .chat-input::placeholder {
      color: rgba(255, 255, 255, 0.4);
    }

    .chat-send-btn {
      background: rgba(80, 140, 255, 0.8);
      border: none;
      color: white;
      padding: 8px 14px;
      cursor: pointer;
      font-size: 11px;
      font-family: inherit;
      border-radius: 0 0 10px 0;
      transition: background 0.15s;
    }

    .chat-send-btn:hover {
      background: rgba(80, 140, 255, 1);
    }
  `;
  return style;
}
