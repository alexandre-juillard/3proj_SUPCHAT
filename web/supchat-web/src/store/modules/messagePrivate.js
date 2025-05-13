import axios from 'axios';

const API_URL = process.env.VUE_APP_API_URL || 'http://localhost:3000';

const state = {
  messages: [],
  conversations: [],
  currentConversation: null,
  loading: false,
  error: null
};

const getters = {
  getMessages: state => state.messages,
  getConversations: state => state.conversations,
  getCurrentConversation: state => state.currentConversation,
  isLoading: state => state.loading,
  getError: state => state.error,
  
  // Obtenir les messages triés par date
  getMessagesSorted: state => {
    return [...state.messages].sort((a, b) => 
      new Date(a.horodatage) - new Date(b.horodatage)
    );
  },
  
  // Obtenir les messages d'une conversation spécifique
  getMessagesByConversation: state => userId => {
    return state.messages.filter(message => 
      (message.expediteur._id === userId && message.destinataire._id === state.currentConversation) ||
      (message.expediteur._id === state.currentConversation && message.destinataire._id === userId)
    ).sort((a, b) => new Date(a.horodatage) - new Date(b.horodatage));
  },
  
  // Obtenir le nombre de messages non lus par conversation
  getUnreadCountByConversation: state => userId => {
    return state.messages.filter(message => 
      message.destinataire._id === userId && 
      !message.lu
    ).length;
  }
};

const mutations = {
  SET_LOADING(state, status) {
    state.loading = status;
  },
  
  SET_ERROR(state, error) {
    state.error = error;
  },
  
  SET_MESSAGES(state, messages) {
    state.messages = messages;
  },
  
  SET_CONVERSATIONS(state, conversations) {
    state.conversations = conversations;
  },
  
  SET_CURRENT_CONVERSATION(state, userId) {
    state.currentConversation = userId;
  },
  
  ADD_MESSAGE(state, message) {
    // Vérifier si le message existe déjà
    const existingIndex = state.messages.findIndex(m => m._id === message._id);
    if (existingIndex === -1) {
      state.messages.push(message);
    }
  },
  
  UPDATE_MESSAGE(state, updatedMessage) {
    const index = state.messages.findIndex(message => message._id === updatedMessage._id);
    if (index !== -1) {
      state.messages.splice(index, 1, updatedMessage);
    }
  },
  
  UPDATE_MESSAGE_STATUS(state, { id, status }) {
    const index = state.messages.findIndex(message => message._id === id);
    if (index !== -1) {
      state.messages[index] = {
        ...state.messages[index],
        ...status
      };
    }
  },
  
  REMOVE_MESSAGE(state, messageId) {
    state.messages = state.messages.filter(message => message._id !== messageId);
  }
};

const actions = {
  // Récupérer toutes les conversations privées
  async fetchConversations({ commit }) {
    commit('SET_LOADING', true);
    commit('SET_ERROR', null);
    
    try {
      // Utiliser le nouvel endpoint des conversations
      const response = await axios.get(`${API_URL}/api/v1/conversations`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      // Transformer les données pour maintenir la compatibilité avec l'ancien format
      // Utiliser un Map pour éliminer les doublons par ID de conversation
      const conversationsMap = new Map();
      
      response.data.data.conversations.forEach(conv => {
        // Si cette conversation est déjà dans notre Map, ne pas l'ajouter à nouveau
        if (conversationsMap.has(conv._id)) return;
        
        // Pour les conversations de groupe, utiliser un nom de groupe
        if (conv.estGroupe) {
          conversationsMap.set(conv._id, {
            _id: conv._id,
            user: { 
              username: conv.nom || `Groupe (${conv.participants.length} participants)`, 
              _id: 'group-' + conv._id,
              profilePicture: '/img/group-avatar.png'
            },
            lastMessage: conv.dernierMessage,
            unreadCount: 0, // À implémenter plus tard
            isGroup: true,
            participants: conv.participants.map(p => p.utilisateur),
            createdAt: conv.dateCreation,
            updatedAt: conv.updatedAt
          });
        } else {
          // Pour les conversations 1:1, trouver l'autre utilisateur
          const otherUser = conv.participants.find(
            p => p.utilisateur._id !== localStorage.getItem('userId')
          );
          
          if (otherUser) {
            conversationsMap.set(conv._id, {
              _id: conv._id,
              user: otherUser.utilisateur,
              lastMessage: conv.dernierMessage,
              unreadCount: 0, // À implémenter plus tard
              isGroup: false,
              participants: conv.participants.map(p => p.utilisateur),
              createdAt: conv.dateCreation,
              updatedAt: conv.updatedAt
            });
          }
        }
      });
      
      // Convertir la Map en tableau
      const conversations = Array.from(conversationsMap.values());
      
      commit('SET_CONVERSATIONS', conversations);
      return conversations;
    } catch (error) {
      console.error('Erreur lors de la récupération des conversations:', error);
      commit('SET_ERROR', error.response?.data?.message || 'Erreur lors de la récupération des conversations');
      return [];
    } finally {
      commit('SET_LOADING', false);
    }
  },
  
  // Récupérer les messages d'une conversation spécifique
  async fetchMessages({ commit, state, dispatch }, userId) {
    commit('SET_LOADING', true);
    commit('SET_ERROR', null);
    
    try {
      // D'abord, trouver ou créer la conversation avec cet utilisateur
      let conversationId;
      
      // Vérifier si nous avons déjà une conversation avec cet utilisateur
      const existingConversation = state.conversations.find(conv => {
        // Pour les conversations 1:1, vérifier si l'autre utilisateur correspond
        if (!conv.isGroup && conv.user && conv.user._id === userId) {
          return true;
        }
        return false;
      });
      
      if (existingConversation) {
        conversationId = existingConversation._id;
      } else {
        // Créer une nouvelle conversation
        try {
          const createResponse = await axios.post(
            `${API_URL}/api/v1/conversations`,
            { participants: [userId] },
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`
              }
            }
          );
          
          conversationId = createResponse.data.data.conversation._id;
          
          // Mettre à jour la liste des conversations
          await dispatch('fetchConversations');
        } catch (error) {
          console.error('Erreur lors de la création de la conversation:', error);
          throw error;
        }
      }
      
      // Maintenant, récupérer les messages de cette conversation
      const response = await axios.get(`${API_URL}/api/v1/conversations/${conversationId}/messages`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      // Déboguer la structure des messages reçus
      console.log('Messages reçus de l\'API:', response.data.data.messages);
      if (response.data.data.messages.length > 0) {
        console.log('Structure d\'un message:', response.data.data.messages[0]);
        console.log('Fichiers attachés:', response.data.data.messages[0].fichiers);
      }
      
      // Ajouter un mode de débogage global pour l'application
      window.$DEBUG_MODE = true;
      
      // Log pour déboguer la structure des messages
      console.log('Messages reçus:', response.data.data.messages);
      
      // Vérifier si les messages ont des fichiers
      let hasFiles = false;
      response.data.data.messages.forEach(msg => {
        if (msg.fichiers && msg.fichiers.length > 0) {
          hasFiles = true;
          console.log(`Message ${msg._id} contient ${msg.fichiers.length} fichiers:`, msg.fichiers);
        }
      });
      
      if (!hasFiles) {
        console.log('Aucun message ne contient de fichiers, vérification directe dans la base de données...');
        
        try {
          // Faire une requête directe pour récupérer les messages avec fichiers
          const filesResponse = await axios.get(`${API_URL}/api/v1/messages/private/files/${conversationId}`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }
          });
          
          console.log('Réponse de la requête de fichiers:', filesResponse.data);
          
          // Si nous avons des messages avec fichiers, les ajouter à notre liste
          if (filesResponse.data.success && filesResponse.data.data && filesResponse.data.data.messages) {
            const messagesWithFiles = filesResponse.data.data.messages;
            console.log('Messages avec fichiers trouvés:', messagesWithFiles.length);
            
            // Créer un ensemble des IDs de messages déjà présents
            const existingIds = new Set(response.data.data.messages.map(msg => msg._id));
            
            // Ajouter les messages avec fichiers qui ne sont pas déjà dans notre liste
            messagesWithFiles.forEach(msg => {
              if (!existingIds.has(msg._id)) {
                response.data.data.messages.push(msg);
                console.log(`Ajout du message ${msg._id} avec ${msg.fichiers ? msg.fichiers.length : 0} fichiers`); 
              } else {
                // Mettre à jour les fichiers du message existant
                const existingMsg = response.data.data.messages.find(m => m._id === msg._id);
                if (msg.fichiers && msg.fichiers.length > 0) {
                  existingMsg.fichiers = msg.fichiers;
                  console.log(`Mise à jour des fichiers pour le message ${msg._id}:`, msg.fichiers);
                }
              }
            });
            
            // Trier les messages par date
            response.data.data.messages.sort((a, b) => new Date(a.horodatage) - new Date(b.horodatage));
          }
        } catch (error) {
          console.error('Erreur lors de la récupération des messages avec fichiers:', error);
          
          // Si l'endpoint spécifique n'existe pas, essayer l'API de fichiers générale
          try {
            const fichierResponse = await axios.get(`${API_URL}/api/v1/fichiers/conversation/${conversationId}`, {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`
              }
            });
            
            console.log('Fichiers de la conversation:', fichierResponse.data);
            
            if (fichierResponse.data.success && fichierResponse.data.data && fichierResponse.data.data.fichiers) {
              const fichiers = fichierResponse.data.data.fichiers;
              console.log('Fichiers trouvés:', fichiers.length);
              
              // Créer un dictionnaire des messages par ID
              const messagesMap = {};
              response.data.data.messages.forEach(msg => {
                messagesMap[msg._id] = msg;
                if (!msg.fichiers) {
                  msg.fichiers = [];
                }
              });
              
              // Traiter les fichiers
              fichiers.forEach(fichier => {
                if (fichier.messageId && messagesMap[fichier.messageId]) {
                  messagesMap[fichier.messageId].fichiers.push(fichier);
                }
              });
            }
          } catch (fichierError) {
            console.error('Erreur lors de la récupération des fichiers:', fichierError);
          }
        }
      }
      
      // Stocker l'ID de la conversation pour une utilisation ultérieure
      localStorage.setItem('currentConversationId', conversationId);
      
      commit('SET_MESSAGES', response.data.data.messages);
      commit('SET_CURRENT_CONVERSATION', userId);
      return response.data.data.messages;
    } catch (error) {
      console.error('Erreur lors de la récupération des messages:', error);
      commit('SET_ERROR', error.response?.data?.message || 'Erreur lors de la récupération des messages');
      return [];
    } finally {
      commit('SET_LOADING', false);
    }
  },
  
  // Envoyer un message privé
  async sendMessage({ commit, dispatch }, { destinataireId, contenu, reponseA }) {
    commit('SET_LOADING', true);
    commit('SET_ERROR', null);
    
    try {
      // D'abord, vérifier si une conversation existe déjà ou en créer une nouvelle
      let conversationId;
      
      // Essayer de trouver une conversation existante entre les deux utilisateurs
      try {
        const response = await axios.post(
          `${API_URL}/api/v1/conversations`,
          { participants: [destinataireId] },
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
        
        conversationId = response.data.data.conversation._id;
      } catch (error) {
        console.error('Erreur lors de la récupération/création de la conversation:', error);
        throw error;
      }
      
      // Ensuite, envoyer le message à cette conversation
      const response = await axios.post(
        `${API_URL}/api/v1/conversations/${conversationId}/messages`,
        { contenu, reponseA },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      // Ajouter le message à la liste des messages
      commit('ADD_MESSAGE', response.data.data.message);
      
      // Mettre à jour la liste des conversations
      await dispatch('updateConversationList');
      
      return response.data.data.message;
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      commit('SET_ERROR', error.response?.data?.message || 'Erreur lors de l\'envoi du message');
      return null;
    } finally {
      commit('SET_LOADING', false);
    }
  },
  
  // Marquer un message comme lu
  async markMessageAsRead({ commit }, messageId) {
    try {
      const response = await axios.patch(
        `${API_URL}/api/v1/messages/private/${messageId}/read`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      commit('UPDATE_MESSAGE_STATUS', {
        id: messageId,
        status: { lu: true }
      });
      
      return response.data.data;
    } catch (error) {
      console.error('Erreur lors du marquage du message comme lu:', error);
      return null;
    }
  },
  
  // Modifier un message
  async updateMessage({ commit }, { messageId, contenu }) {
    try {
      const response = await axios.put(
        `${API_URL}/api/v1/messages/private/${messageId}`,
        { contenu },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      commit('UPDATE_MESSAGE', response.data.data);
      return response.data.data;
    } catch (error) {
      console.error('Erreur lors de la modification du message:', error);
      return null;
    }
  },
  
  // Supprimer un message
  async deleteMessage({ commit }, messageId) {
    try {
      await axios.delete(`${API_URL}/api/v1/messages/private/${messageId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      commit('REMOVE_MESSAGE', messageId);
      return true;
    } catch (error) {
      console.error('Erreur lors de la suppression du message:', error);
      return false;
    }
  },
  
  // Mettre à jour la liste des conversations après réception d'un nouveau message
  async updateConversationList({ dispatch }) {
    await dispatch('fetchConversations');
  }
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
};
