import { io } from 'socket.io-client';
import store from '../store';

class SocketService {
    constructor() {
        this.socket = null;
    }

    init() {
        if (this.socket) {
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            console.error('Pas de token disponible');
            return;
        }

        const apiUrl = process.env.VUE_APP_API_URL || 'http://localhost:3000';
        
        // Configuration optimisée pour réduire la charge
        this.socket = io(apiUrl, {
            auth: { token },
            transports: ['websocket'],
            withCredentials: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
            // Optimisations pour réduire la charge réseau
            upgrade: false, // Utiliser uniquement WebSocket sans fallback
            forceNew: false, // Réutiliser la connexion existante si possible
            timeout: 5000 // Timeout plus court pour éviter les attentes trop longues
        });

        return new Promise((resolve, reject) => {
            this.socket.on('connect', () => {
                resolve();
            });

            this.socket.on('connect_error', (error) => {
                console.error('Erreur de connexion WebSocket:', error);
                reject(error);
            });

            this.socket.on('disconnect', () => {
                // Gestion silencieuse de la déconnexion
            });

            this.socket.on('reconnect', () => {
                // Gestion silencieuse de la reconnexion
            });

            // Écouter les nouveaux messages (optimisé)
            this.socket.on('nouveau-message', (data) => {
                if (data && data.message) {
                    // Utiliser setTimeout pour éviter de bloquer le thread principal
                    setTimeout(() => {
                        store.commit('canal/AJOUTER_MESSAGE', data.message);
                    }, 0);
                }
            });
            
            // Écouter les messages modifiés (optimisé)
            this.socket.on('message-modifie', (data) => {
                if (data && data.message) {
                    // Utiliser setTimeout pour éviter de bloquer le thread principal
                    setTimeout(() => {
                        // Mettre à jour dans les deux stores pour assurer la cohérence
                        store.commit('canal/UPDATE_MESSAGE', data.message);
                        store.commit('message/UPDATE_MESSAGE', data.message);
                    }, 0);
                }
            });
            
            // Écouter les réactions aux messages (optimisé)
            this.socket.on('reaction-message', (data) => {
                if (data && data.messageId && data.message) {
                    // Utiliser setTimeout pour éviter de bloquer le thread principal
                    setTimeout(() => {
                        // Mettre à jour dans les deux stores pour assurer la cohérence
                        store.commit('canal/UPDATE_MESSAGE', data.message);
                        store.commit('message/UPDATE_MESSAGE', data.message);
                    }, 0);
                }
            });
            
            // Écouter les messages supprimés (optimisé)
            this.socket.on('message-supprime', (data) => {
                if (data && data.messageId) {
                    // Utiliser setTimeout pour éviter de bloquer le thread principal
                    setTimeout(() => {
                        store.commit('canal/REMOVE_MESSAGE', data.messageId);
                        store.commit('message/REMOVE_MESSAGE', data.messageId);
                    }, 0);
                }
            });
            
            // Écouter les réponses aux messages
            this.socket.on('nouvelle-reponse', (data) => {
                if (data && data.message) {
                    // Ajouter la réponse aux messages du canal
                    setTimeout(() => {
                        store.commit('canal/ADD_MESSAGE', data.message);
                        store.commit('message/ADD_MESSAGE', data.message);
                    }, 0);
                }
            });
            
            // Écouter les notifications de nouveau message
            this.socket.on('notification:nouvelle', (data) => {
                if (data) {
                    console.log('Nouvelle notification reçue:', data);
                    
                    let notificationType, notificationReference;
                    
                    // Déterminer le type de notification (canal ou message privé)
                    if (data.type === 'message-prive') {
                        // Notification de message privé
                        notificationType = 'conversation';
                        notificationReference = data.expediteur;
                        
                        // Incrémenter le compteur de messages non lus pour cette conversation
                        store.commit('notification/INCREMENTER_MESSAGES_NON_LUS_POUR_CONVERSATION', data.expediteur);
                        
                        // Mettre à jour la liste des conversations
                        store.dispatch('messagePrivate/updateConversationList');
                    } else {
                        // Notification de canal classique
                        notificationType = 'canal';
                        notificationReference = data.canalId;
                        
                        // Incrémenter le compteur de messages non lus pour ce canal
                        if (data.canalId) {
                            store.commit('notification/INCREMENTER_MESSAGES_NON_LUS_POUR_CANAL', {
                                canalId: data.canalId,
                                count: 1
                            });
                        }
                    }
                    
                    // Incrémenter le total des messages non lus
                    store.commit('notification/INCREMENTER_TOTAL_MESSAGES_NON_LUS');
                    
                    // Ajouter la notification au store
                    store.commit('notification/AJOUTER_NOTIFICATION', {
                        _id: Date.now().toString(), // ID temporaire
                        type: notificationType,
                        reference: notificationReference,
                        message: data.messageId,
                        contenu: data.contenu,
                        contenuType: data.estMention ? 'mention' : 'message',
                        lu: false,
                        date: new Date()
                    });
                    
                    // Jouer le son de notification si activé
                    store.dispatch('notification/jouerSonNotification', {
                        estMention: data.estMention
                    });
                    
                    // Afficher une notification visuelle si les notifications de bureau sont activées
                    const preferences = store.state.notification.preferences;
                    if (
                        preferences.desktopEnabled && 
                        (!preferences.mentionsOnly || data.estMention) && 
                        'Notification' in window && 
                        Notification.permission === 'granted'
                    ) {
                        const title = data.estMention ? 'Vous avez été mentionné' : 'Nouveau message';
                        new Notification(title, {
                            body: data.contenu,
                            icon: '/favicon.ico'
                        });
                    }
                }
            });
            
            // Écouter les notifications de mention
            this.socket.on('notification:mention', (data) => {
                if (data) {
                    console.log('Nouvelle mention reçue:', data);
                    
                    // Ajouter la notification au store
                    store.commit('notification/AJOUTER_NOTIFICATION', {
                        _id: Date.now().toString(), // ID temporaire
                        type: 'canal',
                        reference: data.canalId,
                        message: data.messageId,
                        contenu: data.contenu,
                        contenuType: 'mention',
                        lu: false,
                        date: new Date()
                    });
                    
                    // Jouer le son de mention
                    store.dispatch('notification/jouerSonNotification', {
                        estMention: true
                    });
                    
                    // Afficher une notification visuelle
                    if ('Notification' in window && Notification.permission === 'granted') {
                        const title = 'Vous avez été mentionné';
                        new Notification(title, {
                            body: data.contenu,
                            icon: '/favicon.ico'
                        });
                    }
                }
            });
            
            // Écouter les nouveaux messages privés
            this.socket.on('nouveau-message-prive', (message) => {
                if (message) {
                    // Ajouter le message privé au store
                    setTimeout(() => {
                        store.commit('messagePrivate/ADD_MESSAGE', message);
                        
                        // Mettre à jour la liste des conversations
                        store.dispatch('messagePrivate/updateConversationList');
                    }, 0);
                    
                    // Afficher une notification visuelle
                    if ('Notification' in window && Notification.permission === 'granted') {
                        const expediteur = message.expediteur ? 
                            (message.expediteur.firstName && message.expediteur.lastName ? 
                                `${message.expediteur.firstName} ${message.expediteur.lastName}` : 
                                message.expediteur.username) : 
                            'Quelqu\'un';
                        
                        new Notification('Nouveau message privé', {
                            body: `${expediteur}: ${message.contenu.substring(0, 50)}${message.contenu.length > 50 ? '...' : ''}`,
                            icon: '/favicon.ico'
                        });
                    }
                }
            });
            
            // Écouter les modifications de messages privés
            this.socket.on('message-prive-modifie', (message) => {
                if (message) {
                    // Mettre à jour le message dans le store
                    setTimeout(() => {
                        store.commit('messagePrivate/UPDATE_MESSAGE', message);
                    }, 0);
                }
            });
            
            // Écouter les suppressions de messages privés
            this.socket.on('message-prive-supprime', ({ messageId }) => {
                if (messageId) {
                    // Supprimer le message du store
                    setTimeout(() => {
                        store.commit('messagePrivate/REMOVE_MESSAGE', messageId);
                    }, 0);
                }
            });
            
            // Écouter les confirmations d'envoi de messages privés
            this.socket.on('message-prive-envoye', (data) => {
                if (data && data.messageId) {
                    // Mettre à jour le statut du message
                    setTimeout(() => {
                        store.commit('messagePrivate/UPDATE_MESSAGE_STATUS', {
                            id: data.messageId,
                            status: { envoye: true }
                        });
                    }, 0);
                }
            });
            
            // Écouter les notifications de lecture de messages privés
            this.socket.on('message-prive-lu', (data) => {
                if (data && data.messageId) {
                    // Mettre à jour le statut du message
                    setTimeout(() => {
                        store.commit('messagePrivate/UPDATE_MESSAGE_STATUS', {
                            id: data.messageId,
                            status: { lu: true }
                        });
                    }, 0);
                }
            });
            
            // Écouter les suppressions de messages privés
            this.socket.on('message-prive-supprime', (data) => {
                if (data && data.messageId) {
                    // Supprimer le message du store
                    setTimeout(() => {
                        store.commit('messagePrivate/REMOVE_MESSAGE', data.messageId);
                        
                        // Mettre à jour la liste des conversations
                        store.dispatch('messagePrivate/updateConversationList');
                    }, 0);
                }
            });
            
            // Écouter les nouvelles notifications
            this.socket.on('notification:nouvelle', (notification) => {
                if (notification) {
                    // Ajouter la notification au store
                    setTimeout(() => {
                        store.dispatch('notification/ajouterNotification', notification);
                        
                        // Incrémenter le compteur de messages non lus
                        if (notification.type === 'canal' && notification.canalId) {
                            store.dispatch('notification/incrementerMessagesNonLusCanal', {
                                canalId: notification.canalId,
                                workspaceId: notification.workspaceId
                            });
                        } else if (notification.type === 'conversation' || notification.type === 'message-prive') {
                            store.dispatch('notification/incrementerMessagesNonLusConversation', notification.conversationId || notification.reference);
                        }
                    }, 0);
                }
            });
            
            // Écouter les notifications de mention
            this.socket.on('notification:mention', (notification) => {
                if (notification) {
                    // Ajouter la notification au store avec un flag pour indiquer que c'est une mention
                    setTimeout(() => {
                        store.dispatch('notification/ajouterNotification', {
                            ...notification,
                            estMention: true
                        });
                    }, 0);
                    
                    // Afficher une notification visuelle pour les mentions
                    if ('Notification' in window && Notification.permission === 'granted') {
                        const title = notification.type === 'canal' ?
                            `Mention dans #${notification.canalNom || 'un canal'}` :
                            'Mention dans une conversation';
                            
                        const expediteur = notification.auteur || notification.expediteur ?
                            (notification.auteur?.username || notification.expediteur?.username || 'Quelqu\'un') :
                            'Quelqu\'un';
                            
                        new Notification(title, {
                            body: `${expediteur} vous a mentionné: ${notification.contenu}`,
                            icon: '/favicon.ico'
                        });
                    }
                }
            });
            
            // Écouter les notifications lues
            this.socket.on('notification:lue', ({ notificationId }) => {
                if (notificationId) {
                    // Marquer la notification comme lue dans le store
                    setTimeout(() => {
                        store.commit('notification/MARQUER_NOTIFICATION_LUE', notificationId);
                    }, 0);
                }
            });
            
            // Écouter les notifications toutes lues
            this.socket.on('notification:toutes-lues', ({ canalId, conversationId, count }) => {
                if (canalId) {
                    // Réinitialiser le compteur de messages non lus pour ce canal
                    setTimeout(() => {
                        store.commit('notification/RESET_MESSAGES_NON_LUS_POUR_CANAL', canalId);
                        store.commit('notification/DECREMENTER_TOTAL_MESSAGES_NON_LUS', count);
                    }, 0);
                } else if (conversationId) {
                    // Réinitialiser le compteur de messages non lus pour cette conversation
                    setTimeout(() => {
                        store.commit('notification/RESET_MESSAGES_NON_LUS_POUR_CONVERSATION', conversationId);
                        store.commit('notification/DECREMENTER_TOTAL_MESSAGES_NON_LUS', count);
                    }, 0);
                }
            });
            
            // Écouter les mises à jour des préférences de notification
            this.socket.on('notification:preferences-updated', (preferences) => {
                if (preferences) {
                    // Mettre à jour les préférences dans le store
                    setTimeout(() => {
                        store.commit('notification/SET_PREFERENCES', preferences);
                    }, 0);
                }
            });
        });
    }

    joinCanal(canalId) {
        if (this.socket) {
            this.socket.emit('rejoindre-canal', { canalId });
        }
    }

    joinWorkspace(workspaceId) {
        if (this.socket) {
            this.socket.emit('rejoindre-workspace', workspaceId);
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
    
    // Méthodes pour les notifications
    marquerNotificationLue(notificationId) {
        if (this.socket) {
            this.socket.emit('notification:marquer-lue', { notificationId });
        }
    }
    
    marquerToutesNotificationsCanal(canalId) {
        if (this.socket) {
            this.socket.emit('notification:marquer-toutes-lues-canal', { canalId });
        }
    }
    
    marquerToutesNotificationsConversation(conversationId) {
        if (this.socket) {
            this.socket.emit('notification:marquer-toutes-lues-conversation', { conversationId });
        }
    }
    
    // Méthodes pour les préférences de notification
    updateNotificationPreferences(preferences) {
        if (this.socket) {
            this.socket.emit('notification:update-preferences', preferences);
        }
    }
    
    getNotificationPreferences() {
        if (this.socket) {
            this.socket.emit('notification:get-preferences');
        }
    }
}

export default new SocketService();
