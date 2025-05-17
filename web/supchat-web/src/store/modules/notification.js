import api from '@/plugins/axios';
import { notificationSound } from '@/assets/sounds/notification';
import notificationService from '@/services/notificationService';

const state = {
  notifications: [],
  messagesNonLusParCanal: {},
  messagesNonLusParConversation: {},
  messagesNonLusParWorkspace: {},
  totalMessagesNonLus: 0,
  loading: false,
  error: null,
  sonActive: localStorage.getItem('notification_son_active') !== 'false',
  preferences: {
    mentionsOnly: localStorage.getItem('notifications_mentions_only') === 'true',
    soundEnabled: localStorage.getItem('notification_son_active') !== 'false',
    desktopEnabled: localStorage.getItem('notifications_desktop_enabled') !== 'false'
  }
};

const getters = {
  // Récupérer le nombre de messages non lus pour un canal spécifique
  getMessagesNonLusPourCanal: (state) => (canalId) => {
    return state.messagesNonLusParCanal[canalId] || 0;
  },
  
  // Alias pour la compatibilité avec le code existant
  messagesNonLusPourCanal: (state) => (canalId) => {
    return state.messagesNonLusParCanal[canalId] || 0;
  },
  
  messagesNonLusPourConversation: (state) => (conversationId) => {
    return state.messagesNonLusParConversation[conversationId] || 0;
  },
  
  messagesNonLusPourWorkspace: (state) => (workspaceId) => {
    return state.messagesNonLusParWorkspace[workspaceId] || 0;
  },
  
  // Vérifier si une notification contient une mention pour un canal spécifique
  hasMentionPourCanal: (state) => (canalId) => {
    return state.notifications.some(n => 
      n.type === 'canal' && 
      n.reference === canalId && 
      n.contenuType === 'mention' && 
      !n.lu
    );
  },
  
  totalMessagesNonLus: (state) => {
    return state.totalMessagesNonLus;
  },
  
  sonActive: (state) => {
    return state.sonActive;
  },
  
  notificationPreferences: (state) => {
    return state.preferences;
  },
  
  mentionsOnly: (state) => {
    return state.preferences.mentionsOnly;
  },
  
  soundEnabled: (state) => {
    return state.preferences.soundEnabled;
  },
  
  desktopEnabled: (state) => {
    return state.preferences.desktopEnabled;
  }
};

const actions = {
  // Charger toutes les notifications non lues
  async fetchNotifications({ commit }) {
    commit('SET_LOADING', true);
    try {
      // Vérifier si l'utilisateur est connecté
      if (!localStorage.getItem('token')) {
        commit('SET_NOTIFICATIONS', []);
        return [];
      }
      
      const response = await api.get('/notifications');
      commit('SET_NOTIFICATIONS', response.data.data.notifications);
      commit('SET_ERROR', null);
      return response.data.data.notifications;
    } catch (error) {
      commit('SET_ERROR', error.message || 'Erreur lors du chargement des notifications');
      console.error('Erreur lors du chargement des notifications:', error);
      return [];
    } finally {
      commit('SET_LOADING', false);
    }
  },
  
  // Charger le nombre de messages non lus pour un canal
  async fetchMessagesNonLusPourCanal({ commit }, canalId) {
    try {
      const response = await api.get(`/notifications/canal/${canalId}/count`);
      commit('SET_MESSAGES_NON_LUS_POUR_CANAL', { canalId, count: response.data.data.count });
      return response.data.data.count;
    } catch (error) {
      console.error(`Erreur lors du chargement des messages non lus pour le canal ${canalId}:`, error);
      return 0;
    }
  },
  
  // Charger le nombre de messages non lus pour une conversation
  async fetchMessagesNonLusPourConversation({ commit }, conversationId) {
    try {
      const response = await api.get(`/notifications/conversation/${conversationId}/count`);
      commit('SET_MESSAGES_NON_LUS_POUR_CONVERSATION', { conversationId, count: response.data.data.count });
      return response.data.data.count;
    } catch (error) {
      console.error(`Erreur lors du chargement des messages non lus pour la conversation ${conversationId}:`, error);
      return 0;
    }
  },
  
  // Charger le nombre total de messages non lus
  async fetchTotalMessagesNonLus({ commit }) {
    try {
      const response = await api.get('/notifications/count');
      commit('SET_TOTAL_MESSAGES_NON_LUS', response.data.data.count);
      return response.data.data.count;
    } catch (error) {
      console.error('Erreur lors du chargement du nombre total de messages non lus:', error);
      return 0;
    }
  },
  
  // Charger les canaux avec des messages non lus pour un workspace
  async fetchCanauxAvecMessagesNonLus({ commit }, workspaceId) {
    try {
      const response = await api.get(`/notifications/workspace/${workspaceId}/count`);
      
      // Mettre à jour les compteurs pour chaque canal
      const canaux = response.data.data.canaux;
      canaux.forEach(canal => {
        if (canal.messagesNonLus && canal.messagesNonLus.length > 0) {
          const nonLus = canal.messagesNonLus.find(m => m.count > 0);
          if (nonLus) {
            commit('SET_MESSAGES_NON_LUS_POUR_CANAL', { canalId: canal._id, count: nonLus.count });
          }
        }
      });
      
      // Calculer le total pour le workspace
      const totalWorkspace = canaux.reduce((total, canal) => {
        if (canal.messagesNonLus && canal.messagesNonLus.length > 0) {
          const nonLus = canal.messagesNonLus.find(m => m.count > 0);
          return total + (nonLus ? nonLus.count : 0);
        }
        return total;
      }, 0);
      
      commit('SET_MESSAGES_NON_LUS_POUR_WORKSPACE', { workspaceId, count: totalWorkspace });
      
      return canaux;
    } catch (error) {
      console.error(`Erreur lors du chargement des canaux avec messages non lus pour le workspace ${workspaceId}:`, error);
      return [];
    }
  },
  
  // Marquer une notification comme lue
  async marquerNotificationLue({ commit }, notificationId) {
    try {
      await api.patch(`/notifications/${notificationId}/lue`);
      commit('MARQUER_NOTIFICATION_LUE', notificationId);
      return true;
    } catch (error) {
      console.error('Erreur lors du marquage de la notification comme lue:', error);
      return false;
    }
  },
  
  // Marquer toutes les notifications d'un canal comme lues
  async marquerToutesNotificationsLues({ commit }, canalId) {
    try {
      const response = await api.patch(`/notifications/canal/${canalId}/lues`);
      commit('RESET_MESSAGES_NON_LUS_POUR_CANAL', canalId);
      
      // Mettre à jour le total des messages non lus
      commit('DECREMENTER_TOTAL_MESSAGES_NON_LUS', response.data.data.count);
      
      return response.data.data.count;
    } catch (error) {
      console.error(`Erreur lors du marquage de toutes les notifications du canal ${canalId} comme lues:`, error);
      return 0;
    }
  },
  
  // Marquer toutes les notifications d'une conversation comme lues
  async marquerToutesNotificationsConversationLues({ commit }, conversationId) {
    try {
      const response = await api.patch(`/notifications/conversation/${conversationId}/lues`);
      commit('RESET_MESSAGES_NON_LUS_POUR_CONVERSATION', conversationId);
      
      // Mettre à jour le total des messages non lus
      commit('DECREMENTER_TOTAL_MESSAGES_NON_LUS', response.data.data.count);
      
      return response.data.data.count;
    } catch (error) {
      console.error(`Erreur lors du marquage de toutes les notifications de la conversation ${conversationId} comme lues:`, error);
      return 0;
    }
  },
  
  // Ajouter une notification (appelé par le socket)
  ajouterNotification({ commit, state }, notification) {
    commit('AJOUTER_NOTIFICATION', notification);
    
    // Vérifier si on doit traiter cette notification
    const mentionsOnly = localStorage.getItem('notifications_mentions_only') === 'true';
    if (mentionsOnly && !notification.estMention) {
      return;
    }
    
    // Jouer un son si activé et si ce n'est pas un message de l'utilisateur lui-même
    if (state.sonActive && notification.type !== 'message-envoye') {
      // Jouer un son différent pour les mentions
      if (notification.estMention) {
        notificationSound.playMention();
      } else {
        notificationSound.playNotification();
      }
    }
    
    // Afficher une notification sur le bureau
    notificationService.showNotification(notification);
  },
  
  // Incrémenter le compteur de messages non lus pour un canal
  incrementerMessagesNonLusCanal({ commit }, { canalId, workspaceId }) {
    commit('INCREMENTER_MESSAGES_NON_LUS_POUR_CANAL', canalId);
    commit('INCREMENTER_MESSAGES_NON_LUS_POUR_WORKSPACE', workspaceId);
    commit('INCREMENTER_TOTAL_MESSAGES_NON_LUS');
  },
  
  // Incrémenter le compteur de messages non lus pour une conversation
  incrementerMessagesNonLusConversation({ commit }, conversationId) {
    commit('INCREMENTER_MESSAGES_NON_LUS_POUR_CONVERSATION', conversationId);
    commit('INCREMENTER_TOTAL_MESSAGES_NON_LUS');
  },
  
  // Jouer le son de notification
  jouerSonNotification({ state }, { estMention = false }) {
    // Vérifier si le son est activé
    if (state.preferences.soundEnabled) {
      // Jouer un son différent pour les mentions
      if (estMention) {
        notificationSound.playMention();
      } else {
        notificationSound.playNotification();
      }
    }
  },
  
  // Activer/désactiver le son des notifications
  toggleSonNotifications({ commit, state }) {
    const newState = !state.sonActive;
    commit('SET_SON_ACTIVE', newState);
    
    // Mettre à jour l'état du son dans le gestionnaire de son
    if (newState) {
      notificationSound.unmute();
    } else {
      notificationSound.mute();
    }
    
    return newState;
  },
  
  // Récupérer les préférences de notification depuis l'API
  async fetchPreferences({ commit }) {
    try {
      // Vérifier si l'utilisateur est connecté
      if (!localStorage.getItem('token')) {
        // Utiliser les préférences par défaut
        const defaultPreferences = {
          mentionsOnly: localStorage.getItem('notifications_mentions_only') === 'true',
          soundEnabled: localStorage.getItem('notification_son_active') !== 'false',
          desktopEnabled: localStorage.getItem('notifications_desktop_enabled') !== 'false'
        };
        commit('SET_PREFERENCES', defaultPreferences);
        return defaultPreferences;
      }
      
      const response = await api.get('/notifications/preferences');
      commit('SET_PREFERENCES', response.data.data.preferences);
      return response.data.data.preferences;
    } catch (error) {
      console.error('Erreur lors de la récupération des préférences de notification:', error);
      return null;
    }
  },
  
  // Mettre à jour les préférences de notification
  async updatePreferences({ commit }, preferences) {
    try {
      const response = await api.patch('/notifications/preferences', preferences);
      commit('SET_PREFERENCES', response.data.data.preferences);
      return response.data.data.preferences;
    } catch (error) {
      console.error('Erreur lors de la mise à jour des préférences de notification:', error);
      return null;
    }
  },
  
  // Activer/désactiver les notifications pour les mentions uniquement
  toggleMentionsOnly({ dispatch, state }) {
    const newState = !state.preferences.mentionsOnly;
    return dispatch('updatePreferences', { mentionsOnly: newState });
  },
  
  // Activer/désactiver les notifications sonores
  toggleSoundEnabled({ dispatch, state }) {
    const newState = !state.preferences.soundEnabled;
    return dispatch('updatePreferences', { soundEnabled: newState });
  },
  
  // Activer/désactiver les notifications de bureau
  toggleDesktopEnabled({ dispatch, state }) {
    const newState = !state.preferences.desktopEnabled;
    return dispatch('updatePreferences', { desktopEnabled: newState });
  }
};

const mutations = {
  SET_NOTIFICATIONS(state, notifications) {
    state.notifications = notifications;
    
    // Initialiser les compteurs
    state.messagesNonLusParCanal = {};
    state.messagesNonLusParConversation = {};
    state.messagesNonLusParWorkspace = {};
    
    // Compter les messages non lus par canal et par conversation
    notifications.forEach(notification => {
      if (!notification.lu) {
        if (notification.type === 'canal') {
          if (!state.messagesNonLusParCanal[notification.reference]) {
            state.messagesNonLusParCanal[notification.reference] = 0;
          }
          state.messagesNonLusParCanal[notification.reference]++;
        } else if (notification.type === 'conversation') {
          if (!state.messagesNonLusParConversation[notification.reference]) {
            state.messagesNonLusParConversation[notification.reference] = 0;
          }
          state.messagesNonLusParConversation[notification.reference]++;
        }
      }
    });
    
    // Calculer le total des messages non lus
    state.totalMessagesNonLus = Object.values(state.messagesNonLusParCanal).reduce((a, b) => a + b, 0) +
                               Object.values(state.messagesNonLusParConversation).reduce((a, b) => a + b, 0);
  },
  
  AJOUTER_NOTIFICATION(state, notification) {
    state.notifications.unshift(notification);
  },
  
  MARQUER_NOTIFICATION_LUE(state, notificationId) {
    const index = state.notifications.findIndex(n => n._id === notificationId);
    if (index !== -1) {
      const notification = state.notifications[index];
      notification.lu = true;
      
      // Mettre à jour les compteurs
      if (notification.type === 'canal' && state.messagesNonLusParCanal[notification.reference] > 0) {
        state.messagesNonLusParCanal[notification.reference]--;
        state.totalMessagesNonLus--;
      } else if (notification.type === 'conversation' && state.messagesNonLusParConversation[notification.reference] > 0) {
        state.messagesNonLusParConversation[notification.reference]--;
        state.totalMessagesNonLus--;
      }
    }
  },
  
  SET_MESSAGES_NON_LUS_POUR_CANAL(state, { canalId, count }) {
    state.messagesNonLusParCanal = {
      ...state.messagesNonLusParCanal,
      [canalId]: count
    };
  },
  
  SET_MESSAGES_NON_LUS_POUR_CONVERSATION(state, { conversationId, count }) {
    state.messagesNonLusParConversation = {
      ...state.messagesNonLusParConversation,
      [conversationId]: count
    };
  },
  
  SET_MESSAGES_NON_LUS_POUR_WORKSPACE(state, { workspaceId, count }) {
    state.messagesNonLusParWorkspace = {
      ...state.messagesNonLusParWorkspace,
      [workspaceId]: count
    };
  },
  
  SET_TOTAL_MESSAGES_NON_LUS(state, count) {
    state.totalMessagesNonLus = count;
  },
  
  INCREMENTER_MESSAGES_NON_LUS_POUR_CANAL(state, { canalId, count = 1 }) {
    if (!state.messagesNonLusParCanal[canalId]) {
      state.messagesNonLusParCanal[canalId] = 0;
    }
    state.messagesNonLusParCanal[canalId] += count;
  },
  
  INCREMENTER_MESSAGES_NON_LUS_POUR_WORKSPACE(state, workspaceId) {
    if (!state.messagesNonLusParWorkspace[workspaceId]) {
      state.messagesNonLusParWorkspace[workspaceId] = 0;
    }
    state.messagesNonLusParWorkspace[workspaceId]++;
  },
  
  INCREMENTER_MESSAGES_NON_LUS_POUR_CONVERSATION(state, conversationId) {
    if (!state.messagesNonLusParConversation[conversationId]) {
      state.messagesNonLusParConversation[conversationId] = 0;
    }
    state.messagesNonLusParConversation[conversationId]++;
  },
  
  INCREMENTER_TOTAL_MESSAGES_NON_LUS(state) {
    state.totalMessagesNonLus++;
  },
  
  DECREMENTER_TOTAL_MESSAGES_NON_LUS(state, count) {
    state.totalMessagesNonLus = Math.max(0, state.totalMessagesNonLus - count);
  },
  
  RESET_MESSAGES_NON_LUS_POUR_CANAL(state, canalId) {
    state.messagesNonLusParCanal[canalId] = 0;
  },
  
  RESET_MESSAGES_NON_LUS_POUR_CONVERSATION(state, conversationId) {
    state.messagesNonLusParConversation[conversationId] = 0;
  },
  
  SET_LOADING(state, loading) {
    state.loading = loading;
  },
  
  SET_ERROR(state, error) {
    state.error = error;
  },
  
  SET_SON_ACTIVE(state, active) {
    state.sonActive = active;
    state.preferences.soundEnabled = active;
    // Sauvegarder la préférence dans le localStorage
    localStorage.setItem('notification_son_active', active ? 'true' : 'false');
  },
  
  SET_PREFERENCES(state, preferences) {
    // Mettre à jour les préférences
    state.preferences = {
      ...state.preferences,
      ...preferences
    };
    
    // Mettre à jour les variables d'état correspondantes
    if (preferences.soundEnabled !== undefined) {
      state.sonActive = preferences.soundEnabled;
    }
    
    // Sauvegarder les préférences dans le localStorage
    if (preferences.mentionsOnly !== undefined) {
      localStorage.setItem('notifications_mentions_only', preferences.mentionsOnly ? 'true' : 'false');
    }
    
    if (preferences.soundEnabled !== undefined) {
      localStorage.setItem('notification_son_active', preferences.soundEnabled ? 'true' : 'false');
    }
    
    if (preferences.desktopEnabled !== undefined) {
      localStorage.setItem('notifications_desktop_enabled', preferences.desktopEnabled ? 'true' : 'false');
    }
    
    // Mettre à jour l'état du son dans le gestionnaire de son
    if (preferences.soundEnabled !== undefined) {
      if (preferences.soundEnabled) {
        notificationSound.unmute();
      } else {
        notificationSound.mute();
      }
    }
  }
};

// Note: Cette fonction est maintenant gérée par le service notificationSound
// et n'est plus utilisée directement ici

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
};
