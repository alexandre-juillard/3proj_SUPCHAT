<template>
  <v-menu
    v-model="menu"
    :close-on-content-click="false"
    :nudge-width="300"
    offset-y
  >
    <template v-slot:activator="{ on, attrs }">
      <v-btn
        icon
        v-bind="attrs"
        v-on="on"
        class="notification-btn"
      >
        <v-badge
          :content="totalMessagesNonLus > 99 ? '99+' : totalMessagesNonLus"
          :value="totalMessagesNonLus > 0"
          color="error"
          overlap
        >
          <v-icon>mdi-bell</v-icon>
        </v-badge>
      </v-btn>
    </template>
    
    <v-card max-width="400" max-height="500" class="notification-card">
      <v-card-title class="notification-header">
        Notifications
        <v-spacer></v-spacer>
        <v-btn icon small @click="toggleSonNotifications" title="Activer/désactiver les sons">
          <v-icon>{{ sonActive ? 'mdi-volume-high' : 'mdi-volume-off' }}</v-icon>
        </v-btn>
        <v-btn icon small @click="toggleNotifications" title="Activer/désactiver les notifications">
          <v-icon>{{ notificationsEnabled ? 'mdi-bell' : 'mdi-bell-off' }}</v-icon>
        </v-btn>
        <v-btn icon small @click="openSettings" title="Paramètres de notification">
          <v-icon>mdi-cog</v-icon>
        </v-btn>
      </v-card-title>
      
      <v-divider></v-divider>
      
      <v-card-text class="notification-content pa-0">
        <v-list two-line dense>
          <template v-if="notifications.length > 0">
            <v-list-item
              v-for="notification in notifications"
              :key="notification._id"
              @click="handleNotificationClick(notification)"
              :class="{ 'notification-read': notification.lu, 'notification-mention': isMention(notification) }"
            >
              <v-list-item-avatar>
                <v-icon :color="getNotificationIconColor(notification)">
                  {{ getNotificationIcon(notification) }}
                </v-icon>
              </v-list-item-avatar>
              
              <v-list-item-content>
                <v-list-item-title>{{ getNotificationTitle(notification) }}</v-list-item-title>
                <v-list-item-subtitle>{{ getNotificationContent(notification) }}</v-list-item-subtitle>
                <div class="notification-time">{{ formatDate(notification.createdAt) }}</div>
              </v-list-item-content>
              
              <v-list-item-action>
                <v-btn
                  icon
                  small
                  @click.stop="markAsRead(notification._id)"
                  v-if="!notification.lu"
                >
                  <v-icon small>mdi-check</v-icon>
                </v-btn>
              </v-list-item-action>
            </v-list-item>
            <v-divider></v-divider>
          </template>
          
          <v-list-item v-if="notifications.length === 0">
            <v-list-item-content class="text-center">
              <v-list-item-title>Aucune notification</v-list-item-title>
              <v-list-item-subtitle>Vous n'avez pas de nouvelles notifications</v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-card-text>
      
      <v-divider></v-divider>
      
      <v-card-actions>
        <v-btn
          text
          block
          color="primary"
          @click="markAllAsRead"
          :disabled="notifications.length === 0"
        >
          Tout marquer comme lu
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
  
  <!-- Boîte de dialogue des paramètres de notification -->
  <v-dialog v-model="showSettings" max-width="500">
    <v-card>
      <v-card-title>Paramètres de notification</v-card-title>
      <v-card-text>
        <v-switch
          v-model="notificationSettings.desktopEnabled"
          label="Notifications sur le bureau"
          hint="Afficher des notifications sur le bureau lorsque vous recevez de nouveaux messages"
          persistent-hint
        ></v-switch>
        
        <v-switch
          v-model="notificationSettings.soundEnabled"
          label="Sons de notification"
          hint="Jouer un son lorsque vous recevez de nouveaux messages"
          persistent-hint
        ></v-switch>
        
        <v-switch
          v-model="notificationSettings.mentionsOnly"
          label="Uniquement pour les mentions"
          hint="Ne recevoir des notifications que lorsque vous êtes mentionné"
          persistent-hint
        ></v-switch>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn text @click="showSettings = false">Annuler</v-btn>
        <v-btn color="primary" @click="saveSettings">Enregistrer</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { mapState, mapGetters, mapActions } from 'vuex';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default {
  name: 'NotificationList',
  
  data() {
    return {
      menu: false,
      showSettings: false,
      notificationSettings: {
        mentionsOnly: false,
        desktopEnabled: true,
        soundEnabled: true
      }
    };
  },
  
  computed: {
    ...mapState('notification', ['notifications', 'loading', 'error', 'sonActive', 'preferences']),
    ...mapGetters('notification', ['totalMessagesNonLus', 'mentionsOnly', 'soundEnabled', 'desktopEnabled']),
    
    notificationsEnabled() {
      return this.desktopEnabled;
    }
  },
  
  methods: {
    ...mapActions('notification', [
      'fetchNotifications',
      'marquerNotificationLue',
      'marquerToutesNotificationsLues',
      'toggleSonNotifications',
      'fetchPreferences',
      'updatePreferences',
      'toggleMentionsOnly',
      'toggleSoundEnabled',
      'toggleDesktopEnabled'
    ]),
    
    // Activer/désactiver les notifications
    toggleNotifications() {
      this.toggleDesktopEnabled();
    },
    
    // Ouvrir les paramètres de notification
    openSettings() {
      // Initialiser les paramètres avec les valeurs actuelles
      this.notificationSettings = {
        mentionsOnly: this.mentionsOnly,
        desktopEnabled: this.desktopEnabled,
        soundEnabled: this.soundEnabled
      };
      this.showSettings = true;
    },
    
    // Sauvegarder les paramètres de notification
    saveSettings() {
      // Mettre à jour les préférences via l'API
      this.updatePreferences({
        mentionsOnly: this.notificationSettings.mentionsOnly,
        soundEnabled: this.notificationSettings.soundEnabled,
        desktopEnabled: this.notificationSettings.desktopEnabled
      });
      
      this.showSettings = false;
    },
    
    handleNotificationClick(notification) {
      // Marquer la notification comme lue
      this.marquerNotificationLue(notification._id);
      
      // Naviguer vers la ressource correspondante
      if (notification.type === 'canal' && notification.reference) {
        this.$router.push({ name: 'Canal', params: { id: notification.reference } });
      } else if ((notification.type === 'conversation' || notification.type === 'message-prive') && notification.reference) {
        this.$router.push({ name: 'MessagePrivate', params: { id: notification.reference } });
      }
      
      // Fermer le menu
      this.menu = false;
    },
    
    markAsRead(notificationId) {
      this.marquerNotificationLue(notificationId);
    },
    
    markAllAsRead() {
      this.marquerToutesNotificationsLues();
    },
    
    isMention(notification) {
      return notification.estMention;
    },
    
    getNotificationIcon(notification) {
      if (notification.type === 'canal') {
        return 'mdi-pound';
      } else if (notification.type === 'conversation' || notification.type === 'message-prive') {
        return 'mdi-message-text';
      } else if (notification.estMention) {
        return 'mdi-at';
      }
      return 'mdi-bell';
    },
    
    getNotificationIconColor(notification) {
      if (notification.lu) {
        return 'grey';
      } else if (notification.estMention) {
        return 'blue';
      } else if (notification.type === 'canal') {
        return 'green';
      } else if (notification.type === 'conversation' || notification.type === 'message-prive') {
        return 'purple';
      }
      return 'primary';
    },
    
    getNotificationTitle(notification) {
      if (notification.type === 'canal') {
        return `Nouveau message dans #${notification.canalNom || 'canal'}`;
      } else if (notification.type === 'conversation') {
        return 'Nouveau message dans une conversation';
      } else if (notification.type === 'message-prive') {
        return 'Nouveau message privé';
      }
      return 'Nouvelle notification';
    },
    
    getNotificationContent(notification) {
      return notification.contenu || '';
    },
    
    formatDate(date) {
      if (!date) return '';
      
      const now = new Date();
      const notifDate = new Date(date);
      
      // Si c'est aujourd'hui, afficher l'heure
      if (now.toDateString() === notifDate.toDateString()) {
        return format(notifDate, 'HH:mm');
      }
      
      // Si c'est cette semaine, afficher le jour
      const diffDays = Math.floor((now - notifDate) / (1000 * 60 * 60 * 24));
      if (diffDays < 7) {
        return format(notifDate, 'EEEE', { locale: fr });
      }
      
      // Sinon, afficher la date complète
      return format(notifDate, 'dd/MM/yyyy');
    }
  },
  
  created() {
    // Ne rien faire ici, les notifications seront chargées dans mounted
  },
  
  mounted() {
    // Vérifier si nous sommes sur une route qui nécessite une authentification
    // et si l'utilisateur est connecté
    const nonAuthRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];
    const currentPath = this.$route.path;
    
    // Ne pas charger les notifications sur les routes non authentifiées
    if (nonAuthRoutes.some(route => currentPath.startsWith(route))) {
      return;
    }
    
    // Charger les notifications et les préférences seulement si l'utilisateur est connecté
    if (localStorage.getItem('token')) {
      this.fetchNotifications();
      this.fetchPreferences();
    }
  }
};
</script>

<style scoped>
.notification-card {
  overflow: hidden;
}

.notification-header {
  background-color: #f5f5f5;
  padding: 8px 16px;
}

.notification-content {
  max-height: 400px;
  overflow-y: auto;
}

.notification-read {
  opacity: 0.7;
  background-color: #f9f9f9;
}

.notification-mention {
  background-color: rgba(33, 150, 243, 0.1);
}

.notification-time {
  font-size: 12px;
  color: #757575;
  margin-top: 4px;
}

.notification-btn {
  position: relative;
}
</style>
