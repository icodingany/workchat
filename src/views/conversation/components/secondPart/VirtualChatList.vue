<template>
  <!-- 对齐 kelailaichatpc VirtualChatList：外层不滚，DynamicScroller 管滚动与视口渲染 -->
  <div class="virtual-chat-list-host">
    <DynamicScroller
      v-if="messages.length > 0"
      :key="'scroller-' + sessionKey"
      id="show-chat"
      ref="virtualList"
      class="show-chats scroll scroller"
      :items="scrollerItems"
      key-field="id"
      :min-item-size="80"
      :shift="true"
    >
      <template #default="{ item, index, active }">
        <DynamicScrollerItem
          :item="item"
          :active="active"
          :data-index="index"
          :size-dependencies="[
            item && item.source && item.source.Content,
            item && item.source && item.source.ContentType
          ]"
        >
          <slot :chat="item.source" :index="index" :active="active" />
        </DynamicScrollerItem>
      </template>
    </DynamicScroller>

    <div
      v-else
      :key="'empty-' + sessionKey"
      id="show-chat"
      class="show-chats scroll chat-empty"
    >
      <slot name="empty" />
    </div>
  </div>
</template>

<script>
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { chatUniqKey } from '@/utils/chatMerge'

const _scrollerItemCache = new WeakMap()

function fallbackKey(chat, index) {
  const t = Number((chat && chat.CreateTime) || 0)
  const c = String((chat && chat.Content) || '').slice(0, 40)
  return `i${index}_${t}_${c}`
}

export default {
  name: 'VirtualChatList',
  components: { DynamicScroller, DynamicScrollerItem },
  props: {
    messages: {
      type: Array,
      default: () => []
    },
    sessionKey: {
      type: String,
      default: 'empty'
    }
  },
  computed: {
    scrollerItems() {
      const list = this.messages || []
      return list.map((source, index) => {
        const id = chatUniqKey(source) || fallbackKey(source, index)
        let cached = _scrollerItemCache.get(source)
        if (!cached || cached.id !== id) {
          cached = { id, source }
          try {
            _scrollerItemCache.set(source, cached)
          } catch (e) {
            /* Proxy / frozen：忽略缓存 */
          }
        }
        return cached
      })
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.applyScrollStyles()
      this.bindScrollListener()
    })
  },
  beforeUnmount() {
    this.unbindScrollListener()
  },
  watch: {
    messages(newMsgs, oldMsgs) {
      const wasEmpty = !(oldMsgs && oldMsgs.length)
      const hasMsgs = !!(newMsgs && newMsgs.length)
      if (wasEmpty && hasMsgs) {
        this.$nextTick(() => {
          this.applyScrollStyles()
          this.bindScrollListener()
        })
      }
    }
  },
  methods: {
    getScrollRoot() {
      const vl = this.$refs.virtualList
      if (!vl) return document.getElementById('show-chat')
      return vl.$el || null
    },
    applyScrollStyles() {
      const el = this.getScrollRoot()
      if (!el || !el.style) return
      el.style.flex = '1 1 auto'
      el.style.minHeight = '0'
      el.style.height = '100%'
      el.style.overflowY = 'auto'
      el.style.overflowX = 'hidden'
      el.style.width = '100%'
    },
    bindScrollListener() {
      const el = this.getScrollRoot()
      if (!el || typeof el.addEventListener !== 'function') return
      if (this._scrollRootBound === el) return
      this.unbindScrollListener()
      el.addEventListener('scroll', this.onNativeScroll, { passive: true })
      this._scrollRootBound = el
    },
    unbindScrollListener() {
      const el = this._scrollRootBound
      if (el && typeof el.removeEventListener === 'function') {
        el.removeEventListener('scroll', this.onNativeScroll)
      }
      this._scrollRootBound = null
    },
    onNativeScroll(e) {
      this.$emit('scroll', e)
    },
    scrollToBottom() {
      this.flushScrollToBottom()
      this.$nextTick(() => this.flushScrollToBottom())
    },
    flushScrollToBottom() {
      const vl = this.$refs.virtualList
      if (vl && typeof vl.scrollToBottom === 'function') {
        vl.scrollToBottom()
        return
      }
      const el = this.getScrollRoot()
      if (el) el.scrollTop = el.scrollHeight
    }
  }
}
</script>

<style lang="scss" scoped>
.virtual-chat-list-host {
  flex: 1 1 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100%;

  .scroller,
  :deep(.vue-recycle-scroller) {
    flex: 1 1 auto;
    min-height: 0;
    height: 100% !important;
    width: 100%;
  }

  .chat-empty {
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
  }
}
</style>
