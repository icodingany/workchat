<template>
  <div class="show-chats-wrapper">
    <!-- :key 强制切会话时整表卸载，避免 MsgId 跨会话撞 key 导致 Vue 错复用 v-html 节点卡死 -->
    <div
      id="show-chat"
      class="show-chats scroll"
      :key="showChatsSessionKey"
      @scroll="getMoreMessages"
    >
      <ChatItem
        v-for="(chat, index) in chats"
        :key="chat.MsgRemoteId || chat.MsgId || chat.TaskId || index"
        :chat="chat"
        :index="index"
        :ctx="chatItemCtx"
      />
      <div v-if="!chats.length" class="chat-no"></div>
    </div>

    <!-- 多选底栏 -->
    <div v-if="selectMode" class="msg-select-bar">
      <span>已选 {{ selectedMsgs.length }}</span>
      <el-button size="small" @click="exitSelectMode">取消</el-button>
      <el-button size="small" type="primary" :disabled="!selectedMsgs.length" @click="onSelectBarForward"
        >转发</el-button
      >
    </div>

    <!-- 转发选人 -->
    <el-dialog
      v-if="forwardDialogVisible"
      append-to-body
      class="transport-message-dialog"
      title="选择转发对象"
      width="560px"
      :model-value="forwardDialogVisible"
      :close-on-click-modal="false"
      @update:model-value="(v) => { if (!v) closeForwardDialog() }"
    >
      <el-tabs v-model="forwardActiveTab">
        <el-tab-pane label="最近聊天" name="chat">
          <div class="search-box">
            <el-input v-model="forwardSearchText" placeholder="搜索昵称或摘要" clearable />
          </div>
          <ForwardTargetList
            :items="filteredForwardRecentConvs"
            :selected="forwardSelectionByTab.chat"
            title-prop="ShowName"
            subtitle-prop="Digest"
            @toggle="toggleForwardTarget('chat', $event)"
          />
        </el-tab-pane>
        <el-tab-pane label="好友" name="friends">
          <div class="search-box">
            <el-input v-model="forwardSearchText" placeholder="搜索昵称或备注" clearable />
          </div>
          <ForwardTargetList
            :items="filteredForwardPrivateFriends"
            :selected="forwardSelectionByTab.friends"
            title-prop="Name"
            subtitle-prop="Memo"
            @toggle="toggleForwardTarget('friends', $event)"
          />
        </el-tab-pane>
        <el-tab-pane label="群聊" name="chatrooms">
          <div class="search-box">
            <el-input v-model="forwardSearchText" placeholder="搜索群名" clearable />
          </div>
          <ForwardTargetList
            :items="filteredForwardGroupConvs"
            :selected="forwardSelectionByTab.chatrooms"
            title-prop="ShowName"
            subtitle-prop="Digest"
            @toggle="toggleForwardTarget('chatrooms', $event)"
          />
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <span class="forward-dialog-tip">已选 {{ forwardSelectedCount }} 人</span>
        <el-button @click="closeForwardDialog">取 消</el-button>
        <el-button type="primary" :disabled="!forwardSelectedCount" @click="confirmForwardTargets">确 定</el-button>
      </template>
    </el-dialog>

    <!-- 消息右键菜单 -->
    <ul
      v-show="msgContextMenuVisible"
      class="msg-context-menu"
      :style="{ left: msgContextMenuX + 'px', top: msgContextMenuY + 'px' }"
    >
      <li
        v-for="(item, idx) in msgContextMenuItems"
        :key="idx"
        @click="onMsgContextMenuSelect(item)"
      >
        {{ item.label }}
      </li>
    </ul>

    <!-- 大图预览：直挂 el-image-viewer（替代旧版隐藏 el-image + 程序化 click 的 hack：
         在 element-plus 2.14 中 click 监听绑在内部 <img> 上、id 却透传到根 div，父元素 click() 不会触发 viewer） -->
    <el-image-viewer
      v-if="bigImagePreviewVisible"
      :key="bigImagePreviewKey"
      :url-list="[bigImageUrl]"
      :z-index="3000"
      :initial-index="0"
      :infinite="false"
      :show-progress="true"
      hide-on-click-modal
      teleported
      @close="closeBigImagePreview"
    />

    <!-- 红包/转账操作弹窗 -->
    <el-dialog
      class="hb-action-dialog"
      :class="{ 'hb-action-dialog-transfer': hb2detail._hbType === 'transfer' }"
      v-model="hbActionDialogVisible"
      append-to-body
      :width="hb2detail._hbType === 'transfer' ? '360px' : '320px'"
      :show-close="hb2detail._hbType === 'transfer'"
      :close-on-click-modal="true"
      @closed="hb2detail = {}"
    >
      <div class="hb-action-dialog-wrap">
        <div v-if="hb2detail._hbType === 'transfer'" class="hb-transfer-card">
          <template v-if="isTransferClaimed(hb2detail, hb2detail._jContent)">
            <div class="hb-transfer-received-status">
              <el-icon class="hb-transfer-success-icon"><SuccessFilled /></el-icon>
              <p class="hb-transfer-received-text">{{ hbSenderName }} 已收款</p>
            </div>
            <div class="hb-transfer-amount">¥ {{ formatTransferAmount(hb2detail._jContent && hb2detail._jContent.Feedesc) }}</div>
            <div class="hb-transfer-time">
              <span class="hb-transfer-time-label">转账时间</span>
              <span class="hb-transfer-time-value">{{ formatTransferTime(hb2detail.CreateTime) }}</span>
            </div>
            <div class="hb-transfer-time">
              <span class="hb-transfer-time-label">收款时间</span>
              <span class="hb-transfer-time-value">{{ formatTransferTime(getTransferRecTime(hb2detail)) }}</span>
            </div>
          </template>
          <template v-else-if="isTransferRefunded(hb2detail, hb2detail._jContent)">
            <div class="hb-transfer-refunded-status">
              <el-icon class="hb-transfer-refund-icon"><RefreshLeft /></el-icon>
              <p class="hb-transfer-refunded-text">已退还</p>
            </div>
            <div class="hb-transfer-amount">¥ {{ formatTransferAmount(hb2detail._jContent && hb2detail._jContent.Feedesc) }}</div>
            <div class="hb-transfer-time">
              <span class="hb-transfer-time-label">转账时间</span>
              <span class="hb-transfer-time-value">{{ formatTransferTime(hb2detail.CreateTime) }}</span>
            </div>
          </template>
          <template v-else>
            <div class="hb-transfer-status">
              <el-icon class="hb-transfer-clock"><Clock /></el-icon>
              <p class="hb-transfer-status-text">待你收款</p>
            </div>
            <div class="hb-transfer-amount">¥ {{ formatTransferAmount(hb2detail._jContent && hb2detail._jContent.Feedesc) }}</div>
            <div class="hb-transfer-time">
              <span class="hb-transfer-time-label">转账时间</span>
              <span class="hb-transfer-time-value">{{ formatTransferTime(hb2detail.CreateTime) }}</span>
            </div>
            <el-button class="hb-transfer-accept-btn" type="primary" @click="doTakeLuckMoney(hb2detail, false)">收款</el-button>
            <div class="hb-transfer-refund">
              <span class="hb-transfer-refund-tip">1天内未确认，将退还给对方。</span>
              <a class="hb-transfer-refund-link" href="javascript:;" @click.prevent="doTakeLuckMoney(hb2detail, true)">退还</a>
            </div>
          </template>
        </div>
        <!-- 红包：红色渐变卡片 + 金色圆形「开」按钮（对齐 kelailaichatpc） -->
        <div v-else class="hb-action-content hb-action-redpacket">
          <div class="hb-action-header">
            <el-avatar :size="32" :src="hbSenderAvatar" shape="square" class="hb-action-avatar">
              <i class="fa fa-user"></i>
            </el-avatar>
            <span class="hb-action-sender-text">{{ hbSenderName }}发出的红包</span>
          </div>
          <div class="hb-action-body">
            <div class="hb-action-wish">{{ (hb2detail._jContent && hb2detail._jContent.Title) || '恭喜发财，大吉大利' }}</div>
          </div>
          <div class="hb-action-buttons">
            <el-button class="hb-btn-accept" size="default" @click="doTakeLuckMoney(hb2detail, false)">开</el-button>
          </div>
        </div>
        <div v-if="hb2detail._hbType !== 'transfer'" class="hb-action-close-wrap">
          <button type="button" class="hb-action-close-btn" @click="hbActionDialogVisible = false; hb2detail = {}">
            <el-icon><Close /></el-icon>
          </button>
        </div>
      </div>
    </el-dialog>

    <!-- 红包详情：已领取展示微信样式卡片，未领取展示完整详情 -->
    <el-dialog
      class="hb-details"
      :class="{ 'hb-details-claimed': isHbDetailAlreadyClaimed }"
      :title="isHbDetailAlreadyClaimed ? '' : '红包详情'"
      v-model="hbDetailVisible"
      :width="isHbDetailAlreadyClaimed ? '360px' : '500px'"
    >
      <div v-if="isHbDetailAlreadyClaimed" class="hb-claimed">
        <div class="hb-claimed-header">
          <el-avatar :size="40" :src="hbSenderAvatar" shape="square">
            <i class="fa fa-user"></i>
          </el-avatar>
          <span class="hb-claimed-sender">{{ hbSenderName }}发出的红包</span>
        </div>
        <div class="hb-claimed-wish">{{ (hb2detail._jContent && hb2detail._jContent.Title) || '恭喜发财，大吉大利' }}</div>
        <div class="hb-claimed-summary">{{ hbDetail.TotalNum || 1 }}个红包共{{ hbAmountYuan(hbDetail.TotalAmount) }}元</div>
        <div class="hb-claimed-records">
          <div v-for="(rec, idx) in (hbDetail.Records || [])" :key="idx" class="hb-claimed-record">
            <el-avatar :size="36" :src="getRecordAvatar(rec.UserName)" shape="square">
              <i class="fa fa-user"></i>
            </el-avatar>
            <div class="hb-claimed-record-info">
              <span class="hb-claimed-record-name">{{ hbRecordName(rec) }}</span>
              <span class="hb-claimed-record-time">{{ hbRecordTime(rec.Time) }}</span>
            </div>
            <span class="hb-claimed-record-amount">{{ hbAmountYuan(rec.Amount) }}元</span>
          </div>
        </div>
      </div>
      <ul v-else class="hb-detail">
        <li>当前微信：{{ hbDetail.WeChatId }}</li>
        <li>红包来源：{{ $filters.hbUrlFilter(hbDetail.HbUrl) }}</li>
        <li>红包总数：{{ hbDetail.TotalNum }}</li>
        <li>红包总金额：{{ hbDetail.TotalAmount }}</li>
        <li>已抢的数量：{{ hbDetail.RecNum }}</li>
        <li>已抢的金额：{{ hbDetail.RecAmount }}</li>
        <li>
          抢红包的好友列表
          <ul>
            <li v-for="(item, index) in hbDetail.Records" :key="index">
              <div>{{ item }}</div>
            </li>
          </ul>
        </li>
      </ul>
      <div v-if="!isHbDetailAlreadyClaimed" class="hb-btns">
        <el-button
          style="background-color: #fff; border: solid #eeeeee 1px; color: #999999"
          @click="hbDetailVisible = false"
        >
          取 消
        </el-button>
        <el-button
          style="background-color: #ff9f00; border: solid #ff9f00 1px"
          type="primary"
          @click="doTakeLuckMoney(hb2detail, false)"
        >
          打 开
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>
<script>
import { WarningFilled, SuccessFilled, RefreshLeft, Clock, Close } from '@element-plus/icons-vue'
import { ElImageViewer } from 'element-plus'
import ForwardTargetList from './ForwardTargetList.vue'
import ChatItem from './ChatItem.vue'
import { ShowChatsMixin } from './showChatsMixin/index.js'

export default {
  mixins: [ShowChatsMixin],
  components: { ChatItem, ForwardTargetList, WarningFilled, SuccessFilled, RefreshLeft, Clock, Close, ElImageViewer }
}
</script>

<style lang="scss" scoped>
.big-img-box {
  position: absolute;
  top: 0;
  right: -200px;
}

.show-chats-wrapper {
  flex: 1 1 0;
  min-height: 0;
  height: auto;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .show-chats {
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
    position: relative;
    overflow-x: hidden;
    overflow-y: auto;
  }

  :deep(.detail-dialog) {
    overflow: hidden;
    .el-dialog {
      overflow: hidden;
      height: 500px;
      min-width: 500px;
      display: flex;
      flex-direction: column;

      .el-dialog__body {
        overflow: hidden;
        margin: auto;
        flex: 1 1 auto;
        display: flex;
        align-items: center;
        justify-content: center;

        .detail-dialog-img {
          @include scroll;
          max-height: 100%;
          max-width: 100%;
          overflow: auto;
        }
        .detail-dialog-video {
          max-height: 100%;
          width: auto;
        }
      }
    }
  }
  .chat-no {
    width: 100%;
    height: 100%;
    background-image: url(~@/assets/images/kdd64.png);
    background-repeat: no-repeat;
    background-color: $bg-color-content-base;
    background-position: center;
  }
  // Element Plus：class 挂在 .el-dialog 面板上
  .member-detail {
    display: flex;
    flex-direction: column;
    &.el-dialog,
    :deep(.el-dialog) {
      width: 500px;
      .el-dialog__body {
        padding: 20px;
      }
    }
    .member-detail-info {
      display: flex;
      .member-detail-text {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        margin-left: 20px;
        overflow: hidden;
      }
    }
    .member-detail-btns {
      display: flex;
      justify-content: space-around;
      margin-top: 20px;
    }
  }
}

.msg-context-menu {
  position: fixed;
  z-index: 3000;
  min-width: 120px;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  li {
    padding: 8px 16px;
    font-size: 13px;
    color: #606266;
    cursor: pointer;
    &:hover {
      background: #f5f7fa;
      color: #409eff;
    }
  }
}
.msg-select-bar {
  position: sticky;
  bottom: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 12px;
  background: #fff;
  border-top: 1px solid #ebeef5;
}

:deep(.transport-message-dialog) {
  .el-dialog__body {
    padding: 0 20px 4px;
  }
  .search-box {
    margin-bottom: 8px;
  }
  .forward-dialog-tip {
    float: left;
    line-height: 32px;
    font-size: 13px;
    color: #909399;
  }
}

:deep(.fwd-check) {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  box-sizing: border-box;
  border: 2px solid #c5c5c5;
  background: transparent;
  display: inline-block;
  position: relative;
}
:deep(.fwd-check.is-on) {
  background: #07c160;
  border-color: #07c160;
}
:deep(.fwd-check.is-on::after) {
  content: '';
  position: absolute;
  left: 5px;
  top: 1px;
  width: 6px;
  height: 11px;
  border: 2px solid #fff;
  border-top: 0;
  border-left: 0;
  transform: rotate(45deg);
}
</style>

<!-- 图片预览器 teleported 到 body，需非 scoped 样式 -->
<style lang="scss">
.big-image-viewer-loading-tip {
  position: fixed;
  left: 50%;
  bottom: 72px;
  transform: translateX(-50%);
  z-index: 2050;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 14px;
  pointer-events: none;

  .el-icon-loading {
    font-size: 16px;
  }
}

/* 大图预览限制最大尺寸，避免超大图占满全屏；勿用 width/height !important 以免干扰 viewer 缩放 */
.el-image-viewer__canvas img,
.el-image-viewer__img {
  max-width: 90vw !important;
  max-height: 90vh !important;
  object-fit: contain;
}

.show-chats-wrapper :deep(.highlighted-message) {
  animation: quote-highlight 2s ease-out;
}

@keyframes quote-highlight {
  0% {
    background-color: rgba(100, 100, 100, 0.3);
  }
  100% {
    background-color: transparent;
  }
}

.show-chats-wrapper :deep(.chat-quote-msg) {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 100%;
}

.show-chats-wrapper :deep(.chat-quote-reply) {
  font-size: 14px;
  line-height: 1.5;
  color: #1a1a1a;
  word-break: break-word;
  white-space: pre-wrap !important;
}

.show-chats-wrapper :deep(.chat-quote-ref) {
  display: flex;
  align-items: stretch;
  padding: 6px 8px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.05);
  cursor: pointer;
  max-width: 100%;
}

.show-chats-wrapper :deep(.triangle-send .chat-quote-ref) {
  background: rgba(255, 255, 255, 0.55);
}

.show-chats-wrapper :deep(.chat-quote-ref-bar) {
  flex: 0 0 3px;
  width: 3px;
  margin-right: 8px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.18);
}

.show-chats-wrapper :deep(.chat-quote-ref-name) {
  font-size: 12px;
  color: #888;
  font-weight: 500;
}

.show-chats-wrapper :deep(.chat-quote-ref-text) {
  display: block;
  font-size: 12px;
  color: #888;
  word-break: break-word;
  white-space: pre-wrap !important;
}
</style>
