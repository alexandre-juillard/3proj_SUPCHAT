import { notificationSound } from '@/assets/sounds/notification';
import store from '@/store';

class NotificationService {
  constructor() {
    this.initialized = false;
    this._notificationsEnabled = false;
  }
  
  /**
   * Obtenir l'état des notifications depuis le store
   */
  get notificationsEnabled() {
    return store.getters['notification/desktopEnabled'];
  }
  
  /**
   * Définir l'état des notifications
   */
  set notificationsEnabled(value) {
    this._notificationsEnabled = value;
  }
  
  /**
   * Obtenir l'état du son depuis le store
   */
  get soundEnabled() {
    return store.getters['notification/soundEnabled'];
  }
  
  /**
   * Obtenir la préférence pour les mentions uniquement depuis le store
   */
  get mentionsOnly() {
    return store.getters['notification/mentionsOnly'];
  }

  /**
   * Initialiser le service de notification
   */
  async initialize() {
    if (this.initialized) return;
    
    // Vérifier si les notifications sont supportées
    if (!('Notification' in window)) {
      console.warn('Ce navigateur ne prend pas en charge les notifications de bureau');
      return;
    }
    
    // Demander l'autorisation si ce n'est pas déjà fait
    if (Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        this._notificationsEnabled = permission === 'granted';
        this.saveNotificationPreference(this._notificationsEnabled);
      } catch (error) {
        console.error('Erreur lors de la demande d\'autorisation de notification:', error);
      }
    } else {
      this._notificationsEnabled = Notification.permission === 'granted';
    }
    
    this.initialized = true;
  }

  /**
   * Afficher une notification
   * @param {Object} notification - Objet de notification
   */
  showNotification(notification) {
    if (!this.initialized) {
      this.initialize().then(() => this.showNotification(notification));
      return;
    }
    
    // Vérifier si on doit traiter cette notification
    if (this.mentionsOnly && !notification.estMention) {
      return;
    }
    
    if (!this.notificationsEnabled || Notification.permission !== 'granted') {
      return;
    }
    
    // Jouer un son si activé
    if (this.soundEnabled) {
      if (notification.estMention) {
        notificationSound.playMention();
      } else {
        notificationSound.playNotification();
      }
    }
    
    // Créer la notification
    let title = 'Nouvelle notification';
    let options = {
      icon: '/favicon.ico',
      body: notification.contenu || 'Vous avez reçu une nouvelle notification',
      tag: notification._id || Date.now().toString()
    };
    
    // Personnaliser selon le type
    if (notification.type === 'canal') {
      title = `Nouveau message dans #${notification.canalNom || 'un canal'}`;
      if (notification.estMention) {
        title = `Mention dans #${notification.canalNom || 'un canal'}`;
      }
    } else if (notification.type === 'conversation' || notification.type === 'message-prive') {
      title = 'Nouveau message privé';
      if (notification.estMention) {
        title = 'Mention dans une conversation';
      }
    }
    
    // Ajouter l'expéditeur si disponible
    if (notification.auteur || notification.expediteur) {
      const expediteur = notification.auteur?.username || notification.expediteur?.username || 'Quelqu\'un';
      options.body = `${expediteur}: ${options.body}`;
    }
    
    // Créer et afficher la notification
    const notif = new Notification(title, options);
    
    // Gérer le clic sur la notification
    notif.onclick = () => {
      window.focus();
      
      // Naviguer vers la ressource correspondante
      if (notification.type === 'canal' && notification.reference) {
        window.location.href = `/workspace/${notification.workspaceId}/canal/${notification.reference}`;
      } else if ((notification.type === 'conversation' || notification.type === 'message-prive') && notification.reference) {
        window.location.href = `/messages/${notification.reference}`;
      }
      
      notif.close();
    };
  }

  /**
   * Activer/désactiver les notifications
   * @param {boolean} enabled - État d'activation
   */
  async setNotificationsEnabled(enabled) {
    try {
      await store.dispatch('notification/updatePreferences', { desktopEnabled: enabled });
      
      if (enabled && Notification.permission === 'default') {
        this.initialize();
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour des préférences de notification:', error);
    }
  }

  /**
   * Activer/désactiver les sons
   * @param {boolean} enabled - État d'activation
   */
  async setSoundEnabled(enabled) {
    try {
      await store.dispatch('notification/updatePreferences', { soundEnabled: enabled });
    } catch (error) {
      console.error('Erreur lors de la mise à jour des préférences de son:', error);
    }
  }
  
  /**
   * Activer/désactiver les notifications pour les mentions uniquement
   * @param {boolean} enabled - État d'activation
   */
  async setMentionsOnly(enabled) {
    try {
      await store.dispatch('notification/updatePreferences', { mentionsOnly: enabled });
    } catch (error) {
      console.error('Erreur lors de la mise à jour des préférences de mention:', error);
    }
  }

  /**
   * Charger les préférences depuis l'API
   */
  async loadPreferences() {
    try {
      await store.dispatch('notification/fetchPreferences');
    } catch (error) {
      console.error('Erreur lors du chargement des préférences de notification:', error);
    }
  }
  
  /**
   * Marquer une notification comme lue
   * @param {string} notificationId - ID de la notification
   */
  async markAsRead(notificationId) {
    try {
      await store.dispatch('notification/marquerNotificationLue', notificationId);
    } catch (error) {
      console.error('Erreur lors du marquage de la notification comme lue:', error);
    }
  }
  
  /**
   * Marquer toutes les notifications d'un canal comme lues
   * @param {string} canalId - ID du canal
   */
  async markAllAsReadForCanal(canalId) {
    try {
      await store.dispatch('notification/marquerToutesNotificationsLues', canalId);
    } catch (error) {
      console.error('Erreur lors du marquage de toutes les notifications du canal comme lues:', error);
    }
  }
  
  /**
   * Marquer toutes les notifications d'une conversation comme lues
   * @param {string} conversationId - ID de la conversation
   */
  async markAllAsReadForConversation(conversationId) {
    try {
      await store.dispatch('notification/marquerToutesNotificationsConversationLues', conversationId);
    } catch (error) {
      console.error('Erreur lors du marquage de toutes les notifications de la conversation comme lues:', error);
    }
  }
}

// Exporter une instance unique
const notificationService = new NotificationService();
export default notificationService;
