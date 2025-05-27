import { createStore } from 'vuex'
import auth from './modules/auth'
import workspace from './modules/workspace'
import canal from './modules/canal'
import message from './modules/message'
import user from './modules/user'
import messagePrivate from './modules/messagePrivate'
import notification from './modules/notification'

export default createStore({
  modules: {
    auth,
    workspace,
    canal,
    message,
    user,
    messagePrivate,
    notification
  }
})
