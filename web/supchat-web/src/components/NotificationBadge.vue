<template>
  <span v-if="count > 0" class="notification-badge" :class="{ 'mention': hasMention }">
    {{ count > 99 ? '99+' : count }}
  </span>
</template>

<script>
export default {
  name: 'NotificationBadge',
  props: {
    count: {
      type: Number,
      default: 0
    },
    hasMention: {
      type: Boolean,
      default: false
    }
  }
}
</script>

<style scoped>
.notification-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background-color: #ff5252;
  color: white;
  font-size: 12px;
  font-weight: bold;
  position: absolute;
  top: -5px;
  right: -5px;
  z-index: 2;
}

.notification-badge.mention {
  background-color: #2196f3;
}
</style>
