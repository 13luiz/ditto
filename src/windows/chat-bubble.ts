import { openPetManager } from './pet-manager';

export async function toggleChatWindow(): Promise<void> {
  await openPetManager('/chat');
}
