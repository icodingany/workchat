<template>
  <div class="expression-page">
    <el-popover placement="bottom-start" width="400" trigger="hover">
      <div class="scroll" style="height: 210px; overflow-y: scroll">
        <img class="qq-face" src="./qqface.png" usemap="#qqMap" />
        <map name="qqMap">
          <area
            v-for="(expression, index) in 105"
            :key="index"
            shape="rect"
            :coords="
              (index % 15) * 25 +
                ', ' +
                parseInt(index / 15) * 25 +
                ', ' +
                ((index % 15) + 1) * 25 +
                ', ' +
                (parseInt(index / 15) + 1) * 25
            "
            :title="qqFaceMap[index] || index"
            @click="selectExpression(index)"
          />
        </map>
        <img src="./emoji.png" usemap="#emojiMap" />
        <map name="emojiMap">
          <area
            v-for="(emoji, index) in 177"
            :key="index"
            shape="rect"
            :coords="
              (index % 15) * 25 +
                ', ' +
                parseInt(index / 15) * 25 +
                ', ' +
                ((index % 15) + 1) * 25 +
                ', ' +
                (parseInt(index / 15) + 1) * 25
            "
            :title="qqFaceMap[105 + index]"
            @click="selectExpression(105 + index)"
          />
        </map>
      </div>
      <template #reference>
        <div class="expression-icon" title="表情">
          <i class="fa fa-smile-o" aria-hidden="true"></i>
        </div>
      </template>
    </el-popover>
  </div>
</template>

<script>
import { expressionMap, emojiMap } from '@/utils/qqFaceMap'

export default {
  name: 'ErrorLog',
  computed: {
    // qq表情
    qqFaceMap() {
      return expressionMap || {}
    }
  },
  methods: {
    // 选择表情
    selectExpression(val) {
      if (this.contentType !== 'Text') {
        this.$store.commit('conversation/SET_CONTENT', '')
      }
      let rm = expressionMap[val]
      const qqList = [113, 114, 115, 116, 117, 118, 124, 125]
      // qq表情
      if (rm) {
        if (val < 105 || qqList.indexOf(val) >= 0) {
          rm = '[' + expressionMap[val] + ']'
        } else {
          rm = '<' + rm + '>'
          rm = emojiMap[rm]
          // let en = '😁'
          // let encode = en.codePointAt(0)
          const rmencode = parseInt(rm, 16)
          rm = String.fromCodePoint(rmencode)
        }
        this.$emit('expressionContent', rm)
      }
    }
  }
}
</script>

<style lang="scss"  scoped>
.expression-icon {
  cursor: pointer;
  font-size: 24px;
}
</style>
