<template>
  <div class="circle-my scroll">
    <!-- 朋友圈列表 -->
    <div class="circle-item" v-for="circleItem in circlesList" :key="circleItem.SnsId || circleItem.PostId">
      <!-- 文本 -->
      <div v-if="circleItem.Content" class="circle-text" v-text="circleItem.Content"></div>
      <!-- 图片 -->
      <div v-if="circleItem.Images && circleItem.Images.length" class="circle-img">
        <div
          v-for="(img, index2) in circleItem.Images"
          :key="index2"
          class="img-div"
          @click="img.ThumbImg ? '' : pullCircleDetailTask(circleItem)"
        >
          <img class="img-item" v-if="img.ThumbImg" :src="img.ThumbImg" alt="图片地址错误" />
          <i v-else class="el-icon-picture-outline" style="font-size: 50px" title="点击获取缩略图"></i>
        </div>
      </div>
      <!-- 视频：有 Url 可播；无 Url 时优先展示 ThumbImg 预览，点击刷新拉详情 -->
      <div v-else-if="hasVideo(circleItem)" class="circle-video">
        <video
          v-if="circleItem.Video.Url"
          class="video-player"
          controls
          preload="metadata"
          :poster="circleItem.Video.ThumbImg || undefined"
          :src="circleItem.Video.Url"
        />
        <div
          v-else
          class="video-wrap"
          title="点击获取视频"
          @click="pullCircleDetailTask(circleItem)"
        >
          <img
            v-if="circleItem.Video.ThumbImg"
            class="video-thumb"
            :src="circleItem.Video.ThumbImg"
            alt="视频预览"
          />
          <i v-else class="el-icon-video-camera" style="font-size: 50px"></i>
          <span class="video-tip">点击加载视频</span>
        </div>
      </div>
      <!-- 链接 -->
      <div v-if="circleItem.Link" class="circle-link" title="点击打开链接" @click="openLink(circleItem)">
        <img v-if="circleItem.Link.ThumbImg" :src="circleItem.Link.ThumbImg" alt="这是link" />
        <span v-else class="circle-link-description" v-text="'无效链接'"></span>
        <span class="circle-link-description" v-text="circleItem.Link.Desc"></span>
      </div>
      <!-- 点赞、评论、删除 -->
      <div class="time-operation">
        <!-- 时间 -->
        <span v-text="$filters.timeFilter(circleItem.Time)"></span>
        <!-- 操作 -->
        <div>
          <el-button type="warning "  icon="el-icon-delete" @click="deleteSNSNewsTask(circleItem)">
            删除
          </el-button>
          <el-button type="primary"  icon="el-icon-star-off" @click="likeCircle(circleItem)">
            点赞
          </el-button>
          <el-button
            type="primary"
            disabled

            icon="el-icon-edit"
            @click="circleCommentReplyTask(circleItem)"
          >
            评论
          </el-button>
          <el-button type="primary"  icon="el-icon-refresh" @click="pullCircleDetailTask(circleItem)">
            刷新
          </el-button>
        </div>
      </div>
      <!-- 显示好友点赞 -->
      <div v-if="circleItem.Likes" class="likes-box">
        <i class="fa fa-heart-o" aria-hidden="true"></i>
        <div>
          <div v-for="(like, index3) in circleItem.Likes" :key="index3">
            <img :src="computedAvatar(like.FriendId)" />
          </div>
        </div>
      </div>
      <!-- 显示好友评论 -->
      <div v-if="circleItem.Comments" class="comment-box">
        <div v-for="(comment, index4) in circleItem.Comments" :key="index4" class="every-comment">
          <img :src="computedAvatar(comment.FriendId)" />

          <div class="comment-info">
            <div class="name-time">
              <!-- <span
                class="ellipsis"
                v-text="
                  contactsMap[comment.FromWeChatId]
                    ? contactsMap[comment.FromWeChatId].FriendNick
                    : comment.FromWeChatId
                "
              ></span> -->
              <span v-text="$filters.timeFilter(comment.Time)"></span>
            </div>

            <div class="reply-1">
              <div class="reply-to-friend" :title="comment.Content">
                <span v-if="comment.ToWeChatId">
                  回复
                  <span
                    class="reply-friend-name"
                    v-text="
                      contactsMap[comment.ToWeChatId] ? contactsMap[comment.ToWeChatId].FriendNick : comment.ToWeChatId
                    "
                  ></span>
                  :
                </span>
                <span class="comment-content" v-text="comment.Content"></span>
              </div>
              <!-- <i
                v-if="comment.FromWeChatId === circleItem.Author"
                class="fa fa-trash"
                aria-hidden="true"
                title="删除"
                @click="circleCommentDeleteTask(circleItem, comment)"
              ></i>
              <i
                v-else
                class="fa fa-reply"
                aria-hidden="true"
                title="回复"
                @click="circleCommentReplyTask(circleItem, comment)"
              ></i> -->
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="li-loading">
      <i class="el-icon-loading"></i>
      加载中...
    </div>

    <!-- 加载更多 -->
    <el-row style="padding: 10px" type="flex" align="center" justify="center" v-if="this.currentWeChatId">
      <el-button
        :disabled="pullFriendCircle || circles.NextSeq === '-1'"

        :type="circles.NextSeq === '-1' ? 'info' : 'primary'"
        v-text="circles.NextSeq === '-1' ? '没有更多数据' : '获取更多'"
        @click="getMore"
      ></el-button>
    </el-row>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { pullMySnsListTask, getSnsDataTask, delSnsTask, snsLikeTask } from '@/api/webSocketApi'

export default {
  name: 'FriendCircleMy',
  data() {
    return {
      loading: false,
      count: 5, // 默认显示几行
      pullFriendCircle: false
    }
  },
  computed: {
    ...mapGetters({
      circles: 'circle/circles',
      contactsMap: 'conversation/contactsMap',
      currentWeChatId: 'conversation/currentWeChatId'
    }),
    circlesList() {
      return this.circles.SnsList
    }
  },
  watch: {
    currentWeChatId(newId) {
      if (newId) {
        let gct = setTimeout(() => {
          this.getCircles()
          clearTimeout(gct)
          gct = null
        }, 50)
      }
    }
  },
  created() {
    if (this.currentWeChatId) {
      this.getCircles()
    }
  },
  methods: {
    // 通过remoteId获取头像
    computedAvatar(remoteId) {
      if (this.contactsMap[remoteId]) {
        return this.contactsMap[remoteId].Avatar
      }
    },
    /** 是否有视频媒体 */
    hasVideo(circleItem) {
      return !!(circleItem && circleItem.Video)
    },
    // 获取初始的朋友圈（整表替换，避免切 tab 重入时 concat 出重复）
    getCircles() {
      this.$store.commit('circle/RESET_CIRCLES')
      this.$store.commit('circle/SET_PULL_MODE', 'replace')
      pullMySnsListTask(this.currentWeChatId, -1)
    },
    // 获取更多的朋友圈
    getMore() {
      if (!this.currentWeChatId) {
        this.$alert('请选择微信！', '提示', { type: 'marning' })
        return
      }
      const seq = this.circles.NextSeq
      // NextSeq 初始为 ''，空串会导致服务端 JsonFormat 解码失败弹「解码失败」
      if (seq === '' || seq === null || seq === undefined) {
        this.getCircles()
        return
      }
      this.$store.commit('circle/SET_PULL_MODE', 'append')
      pullMySnsListTask(this.currentWeChatId, seq)
    },
    // 获取缩略图 / 视频详情
    pullCircleDetailTask(circle) {
      this.$message.info('正在获取媒体详情…')
      getSnsDataTask(this.currentWeChatId, circle.SnsId, circle.PostId, circle.SnsId)
    },
    // 删除指定朋友圈 ok
    deleteSNSNewsTask(circle) {
      this.$confirm('确认删除该朋友圈 ?', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
        .then(() => {
          delSnsTask(this.currentWeChatId, circle.SnsId, circle.PostId, circle.SnsId)
        })
        .catch(() => {})
    },
    // 点赞 ok
    likeCircle(circle) {
      snsLikeTask(this.currentWeChatId, circle.SnsId, circle.PostId, circle.SnsId)
    },

    // 删除评论 ok
    circleCommentDeleteTask(circle, comment) {
      circle.currentComment = comment
      this.$confirm('确认删除该评论 ?', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
        .then(() => {
          this.$message.info('已提交任务')
          this.$store.dispatch('websocket/CircleCommentDeleteTask', circle)
        })
        .catch(() => {
          this.$message.info('已取消删除')
        })
    },
    // 评论 ok
    circleCommentReplyTask(circle, comment) {
      if (comment) {
        circle.currentComment = comment
      }
      this.$prompt('请输入评论内容', '评论', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPattern: /\S{1,500}/,
        inputErrorMessage: '评论字数1-500'
      })
        .then(({ value }) => {
          this.$message.info('任务已经下发！')
          circle.value = value
          this.$store.dispatch('websocket/CircleCommentReplyTask', circle)
        })
        .catch(() => {
          this.$message.info('取消任务！')
        })
    },
    // 朋友圈连接 ok
    openLink(circle) {
      const url = circle.Link.Url
      const a = document.createElement('a')
      a.setAttribute('href', url)
      a.setAttribute('target', '_blank')
      a.setAttribute('id', 'js_a')
      // 防止反复添加
      if (document.getElementById('js_a')) {
        document.body.removeChild(document.getElementById('js_a'))
      }
      document.body.appendChild(a)
      a.click()
    }
  }
}
</script>

<style lang="scss" scoped>
.circle-my {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: auto;

  .circle-item {
    margin-bottom: 10px;
    border-bottom: #dcdfe6 solid 1px;

    & > div {
      width: 98%;
      margin-left: 1%;
      font-size: 16px;
    }

    .circle-text {
      line-height: 30px;
    }

    .circle-img {
      display: flex;
      flex-wrap: wrap;

      .img-div {
        width: 200px;
        height: 200px;
        margin: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba($color: #000000, $alpha: 0.3);
        cursor: pointer;
        .img-item {
          object-fit: cover;
          width: 100%;
        }
      }
    }

    .circle-video {
      display: flex;
      .video-player {
        max-width: 300px;
        max-height: 400px;
        margin: 10px;
        background: #000;
      }
      .video-wrap {
        position: relative;
        width: 200px;
        height: 200px;
        margin: 10px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: rgba($color: #000000, $alpha: 0.3);
        overflow: hidden;
        .video-thumb {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .video-tip {
          position: relative;
          z-index: 1;
          margin-top: 8px;
          padding: 2px 8px;
          font-size: 12px;
          color: #fff;
          background: rgba(0, 0, 0, 0.55);
          border-radius: 2px;
        }
        .el-icon-video-camera {
          position: relative;
          z-index: 1;
          color: #fff;
        }
      }
    }

    .circle-link {
      display: flex;
      align-items: center;
      cursor: pointer;
      img {
        width: 100px;
        height: 100px;
      }
      .circle-link-description {
        height: 30px;
        line-height: 30px;
        font-size: 16px;
        font-weight: 900;
        margin-left: 10px;
        margin-right: 10px;
        display: inline-block;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
    }

    .time-operation {
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .likes-box {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      background: white;
      position: relative;
      height: 40px;
      line-height: 40px;
      margin-bottom: 10px;
      i {
        font-size: 20px;
        color: red;
        margin-right: 5px;
        margin-left: 5px;
      }
      & > div {
        flex: 1 1 auto;
        display: flex;
        align-items: center;
        div {
          display: flex;
          flex-wrap: wrap;
          span {
            font-size: 14px;
            line-height: 30px;
          }
          img {
            height: 30px;
            width: 30px;
            margin: 5px 5px;
            transition: all 0.6s;
            cursor: pointer;
            &:hover {
              transform: scale(2);
            }
          }
        }
      }
      &::before {
        content: '';
        border: 8px solid transparent;
        border-bottom: 8px solid white;
        position: absolute;
        top: -16px;
        left: 16px;
      }
    }

    .comment-box {
      margin-bottom: 10px;
      display: flex;
      flex-direction: column;
      margin-left: 20px;
      .every-comment {
        background: white;
        width: 100%;
        display: flex;
        align-items: center;
        margin-bottom: 1px;
        img {
          height: 30px;
          width: 30px;
          margin: 5px 5px;
          text-align: center;
          cursor: pointer;
          transition: all 0.6s;

          &:hover {
            transform: scale(3);
          }
        }
        .comment-info {
          flex: 1 1 auto;
          overflow: hidden;
          .name-time {
            display: flex;
            justify-content: space-between;
            span:nth-child(1) {
              font-size: 12px;
              width: 80%;
              display: inline-block;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              color: #5c6f98;
            }
            span:nth-child(2) {
              font-size: 12px;
              width: 20%;
              text-align: center;
              color: gray;
            }
          }
          .reply-1 {
            flex: auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            .reply-to-friend {
              display: flex;
              cursor: pointer;
              width: 90%;
              overflow: hidden;
              font-size: 13px;
              line-height: 20px;
              .comment-content {
                // flex: auto;
                // display: inline-block;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
              }
              .reply-friend-name {
                color: #4bbcfb;
              }
            }
            i {
              width: 10%;
              text-align: center;
              color: gray;
              font-size: 16px;
              cursor: pointer;
              &:hover {
                color: #4bbcfb;
              }
            }
          }
        }
      }
    }
  }

  .li-loading {
    width: 100%;
    height: 30px;
    line-height: 30px;
    text-align: center;
    color: #409eff;
  }
  .li-btn {
    width: 100%;
    height: 60px;
    line-height: 60px;
    text-align: center;
  }
}
</style>
