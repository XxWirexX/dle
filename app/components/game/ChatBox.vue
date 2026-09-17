<script setup lang="ts">
import type { ChatMessage } from '#shared/types/multiplayer'

const props = defineProps<{
  messages: ChatMessage[]
  mySocketId: string | null
}>()

const emit = defineEmits<{ send: [text: string] }>()

const open = ref(false)
const text = ref('')
const seenCount = ref(0)
const messagesEl = useTemplateRef('messagesEl')

const unread = computed(() => (open.value ? 0 : props.messages.length - seenCount.value))

watch(open, (isOpen) => { if (isOpen) seenCount.value = props.messages.length })

watch(() => props.messages.length, async () => {
  if (open.value) {
    seenCount.value = props.messages.length
    await nextTick()
    messagesEl.value?.scrollTo({ top: messagesEl.value.scrollHeight })
  }
})

function submit() {
  if (!text.value.trim()) return
  emit('send', text.value)
  text.value = ''
}
</script>

<template>
  <div class="chat-box" :class="{ open }">
    <button class="chat-toggle" @click="open = !open">
      💬 Chat
      <span v-if="unread > 0" class="badge">{{ unread }}</span>
    </button>

    <div v-if="open" class="chat-content">
      <div ref="messagesEl" class="messages">
        <p v-if="messages.length === 0" class="empty">Aucun message</p>
        <div
          v-for="m in messages"
          :key="m.id"
          class="message"
          :class="m.socketId === mySocketId ? 'mine' : 'theirs'"
        >
          <span class="sender">{{ m.username }}</span>
          <span class="text">{{ m.text }}</span>
        </div>
      </div>
      <form class="input-form" @submit.prevent="submit">
        <input v-model="text" placeholder="Message..." maxlength="200">
        <button type="submit" :disabled="!text.trim()">↵</button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.chat-box {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 500;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  overflow: hidden;
  background: rgba(8, 8, 18, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}

.chat-box.open { width: 300px; height: 380px; }

.chat-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #fff;
  border: none;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
  font-family: inherit;
}

.badge {
  background: #ef4444;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 10px;
}

.chat-content { display: flex; flex-direction: column; flex: 1; overflow: hidden; }

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.empty { color: var(--text-3); font-size: 0.8rem; text-align: center; padding: 20px; }

.message {
  display: flex;
  flex-direction: column;
  max-width: 85%;
  padding: 7px 11px;
  border-radius: 12px;
  font-size: 0.82rem;
  line-height: 1.4;
}

.message.mine { align-self: flex-end; background: linear-gradient(135deg, #059669, #047857); color: #fff; }
.message.theirs { align-self: flex-start; background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.9); }
.sender { font-size: 0.65rem; font-weight: 600; opacity: 0.7; }

.input-form {
  display: flex;
  padding: 8px;
  gap: 6px;
  border-top: 1px solid var(--border);
}

.input-form input {
  flex: 1;
  padding: 7px 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: #fff;
  font-size: 0.82rem;
  outline: none;
  font-family: inherit;
}

.input-form button {
  padding: 7px 12px;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.input-form button:disabled { opacity: 0.4; cursor: not-allowed; }

@media (max-width: 480px) {
  .chat-box.open { width: 260px; height: 320px; }
  .chat-box { bottom: 10px; right: 10px; }
}
</style>
