<template>
  <div>
    <v-container fluid>
      <v-row>
        <v-col cols="12" md="9">
          <v-card>
            <v-toolbar>
              <v-toolbar-title>
                {{ canal && canal.type === 'prive' ? '🔒' : '#' }} {{ canal && canal.nom }}
              </v-toolbar-title>
              <v-spacer></v-spacer>
              <v-btn icon @click="showMembers = true">
                <v-icon>mdi-account-group</v-icon>
              </v-btn>
              <v-btn icon @click="showSettings = true">
                <v-icon>mdi-cog</v-icon>
              </v-btn>
            </v-toolbar>

            <v-card-text class="messages-container" ref="messagesContainer">
              <div v-if="loading" class="text-center">
                <v-progress-circular indeterminate color="primary"></v-progress-circular>
              </div>
              <template v-else>
                <div v-if="!messages || messages.length === 0" class="text-center py-4">
                  Aucun message dans ce canal
                </div>
                <v-list v-else class="messages-list">
                  <div v-if="hasMoreMessages" class="text-center py-2 mb-2">
                    <v-btn text color="primary" @click="loadMoreMessages" :disabled="loadingMore">
                      Afficher plus de messages
                      <v-progress-circular v-if="loadingMore" indeterminate size="16" width="2" class="ml-2"></v-progress-circular>
                    </v-btn>
                  </div>
                  
                  <v-list-item v-for="message in visibleMessages" :key="message._id">
                    <v-list-item-avatar>
                      <v-avatar size="40" color="primary" v-if="!message.auteur || !message.auteur.profilePicture">
                        <span class="white--text">{{ getDefaultAvatar(message.auteur ? message.auteur.username : '') }}</span>
                      </v-avatar>
                      <v-avatar size="40" v-else>
                        <v-img 
                          :src="message.auteur.profilePicture" 
                          :alt="message.auteur.username"
                        >
                        </v-img>
                      </v-avatar>
                    </v-list-item-avatar>
                    <v-list-item-content>
                      <v-list-item-title class="d-flex align-center">
                        <span class="font-weight-bold">{{ message.auteur ? message.auteur.username : 'Utilisateur' }}</span>
                        <v-chip x-small class="ml-2" v-if="message.modifie">modifié</v-chip>
                        <v-spacer></v-spacer>
                        <span class="text-caption">{{ formatDate(message.createdAt) }}</span>
                      </v-list-item-title>
                      
                      <div v-if="message.reponseA" class="reply-reference mb-1 pa-2">
                        <div class="d-flex align-center">
                          <v-icon small class="mr-1">mdi-reply</v-icon>
                          <span class="text-caption font-weight-medium">Réponse à {{ message.reponseA.auteur ? message.reponseA.auteur.username : 'Utilisateur' }}</span>
                        </div>
                        <div class="text-caption grey--text text--darken-1 text-truncate reply-preview">
                          {{ message.reponseA.contenu }}
                        </div>
                      </div>
                      
                      <v-list-item-subtitle>
                        <div class="message-content">{{ message.contenu }}</div>
                        <!-- Affichage des fichiers joints -->
                        <div v-if="message.fichiers && message.fichiers.length > 0" class="message-attachments">
                          <FileAttachment 
                            v-for="fichier in message.fichiers" 
                            :key="fichier.url" 
                            :fichier="fichier" 
                            class="mb-2"
                          />
                        </div>
                        <!-- Boutons d'action sur les messages -->
                        <div class="message-actions mt-1">
                          <v-btn icon x-small @click="replyToMessage(message)" title="Répondre">
                            <v-icon small>mdi-reply</v-icon>
                          </v-btn>
                          <v-btn icon x-small @click="reactToMessage(message)" title="Réagir">
                            <v-icon small>mdi-emoticon-outline</v-icon>
                          </v-btn>
                          <template v-if="user && message.auteur && user._id === message.auteur._id">
                            <v-btn icon x-small @click="editMessage(message)" title="Modifier">
                              <v-icon small>mdi-pencil</v-icon>
                            </v-btn>
                            <v-btn icon x-small @click="deleteMessage(message)" title="Supprimer">
                              <v-icon small>mdi-delete</v-icon>
                            </v-btn>
                          </template>
                        </div>
                      </v-list-item-subtitle>
                    </v-list-item-content>
                  </v-list-item>
                </v-list>
              </template>
            </v-card-text>

            <v-card-actions class="message-input-container">
              <FileUploader 
                :targetType="'canal'" 
                :targetId="canalId" 
                :onSuccess="onFileUploaded"
              />
              <div class="message-input-wrapper">
                <v-text-field
                  v-model="contenuMessage"
                  placeholder="Écrivez votre message..."
                  append-icon="mdi-send"
                  @click:append="envoyerMessage"
                  @keyup.enter="envoyerMessage"
                  @input="handleMessageInput"
                  @keydown.down.prevent="navigateSuggestions(1)"
                  @keydown.up.prevent="navigateSuggestions(-1)"
                  @keydown.tab.prevent="selectSuggestion"
                  ref="messageInput"
                  hide-details
                  dense
                  outlined
                  class="message-input"
                ></v-text-field>
                
                <!-- Menu de suggestion pour les mentions d'utilisateurs -->
                <v-menu
                  v-model="showUserSuggestions"
                  :close-on-content-click="false"
                  :position-x="mentionMenuX"
                  :position-y="mentionMenuY"
                  absolute
                  max-width="300"
                >
                  <v-list dense v-if="filteredUsers.length > 0">
                    <v-list-item
                      v-for="(user, index) in filteredUsers"
                      :key="user._id"
                      @click="insertUserMention(user)"
                      :class="{ 'v-list-item--active': index === selectedSuggestionIndex }"
                    >
                      <v-list-item-avatar size="24">
                        <v-avatar size="24" color="primary" v-if="!user.avatar">
                          {{ getDefaultAvatar(user.username) }}
                        </v-avatar>
                        <v-img v-else :src="user.avatar" alt="Avatar"></v-img>
                      </v-list-item-avatar>
                      <v-list-item-content>
                        <v-list-item-title>{{ user.username }}</v-list-item-title>
                      </v-list-item-content>
                    </v-list-item>
                  </v-list>
                </v-menu>
              </div>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>

  <!-- Dialogue pour répondre à un message -->
  <v-dialog v-model="showReplyDialog" max-width="500px">
    <v-card>
      <v-card-title>Répondre au message</v-card-title>
      <v-card-text>
        <div v-if="selectedMessage" class="reply-reference mb-3 pa-2">
          <div class="d-flex align-center">
            <span class="text-subtitle-2">{{ selectedMessage.auteur ? selectedMessage.auteur.username : 'Utilisateur' }}</span>
          </div>
          <div class="text-caption grey--text text--darken-1">{{ selectedMessage.contenu }}</div>
        </div>
        <v-text-field
          v-model="contenuMessage"
          label="Votre réponse"
          outlined
          autofocus
          hide-details
        ></v-text-field>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn text @click="showReplyDialog = false">Annuler</v-btn>
        <v-btn color="primary" @click="confirmReply">Répondre</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Dialogue pour réagir à un message -->
  <v-dialog v-model="showReactDialog" max-width="500px">
    <v-card>
      <v-card-title>Réagir au message</v-card-title>
      <v-card-text>
        <div v-if="selectedMessage" class="mb-3">
          <div class="text-caption grey--text text--darken-1">{{ selectedMessage.contenu }}</div>
        </div>
        <div class="d-flex flex-wrap justify-space-around">
          <v-btn text class="emoji-btn" @click="sendReaction('👍')">👍</v-btn>
          <v-btn text class="emoji-btn" @click="sendReaction('❤️')">❤️</v-btn>
          <v-btn text class="emoji-btn" @click="sendReaction('😂')">😂</v-btn>
          <v-btn text class="emoji-btn" @click="sendReaction('😮')">😮</v-btn>
          <v-btn text class="emoji-btn" @click="sendReaction('😢')">😢</v-btn>
          <v-btn text class="emoji-btn" @click="sendReaction('🔥')">🔥</v-btn>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn text @click="showReactDialog = false">Fermer</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Dialogue pour modifier un message -->
  <v-dialog v-model="showEditDialog" max-width="500px">
    <v-card>
      <v-card-title>Modifier le message</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="editContent"
          label="Message"
          outlined
          autofocus
          hide-details
        ></v-text-field>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn text @click="showEditDialog = false">Annuler</v-btn>
        <v-btn color="primary" @click="confirmEdit">Enregistrer</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Dialogue de confirmation pour supprimer un message -->
  <v-dialog v-model="showDeleteDialog" max-width="500px">
    <v-card>
      <v-card-title class="headline">Supprimer le message</v-card-title>
      <v-card-text>
        Êtes-vous sûr de vouloir supprimer ce message ? Cette action est irréversible.
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn text @click="showDeleteDialog = false">Annuler</v-btn>
        <v-btn color="error" @click="confirmDelete">Supprimer</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { defineComponent, ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useStore } from 'vuex'
import socketService from '../services/socketService'
import FileUploader from '../components/FileUploader.vue'
import FileAttachment from '../components/FileAttachment.vue'

export default defineComponent({
  name: 'CanalView',
  components: {
    FileUploader,
    FileAttachment
  },
  
  setup() {
    const route = useRoute()
    const store = useStore()
    const messagesContainer = ref(null)
    /* eslint-disable-next-line no-unused-vars */
    const apiUrl = process.env.VUE_APP_API_URL || ''
    
    // Variables pour les dialogues d'actions sur les messages
    const showReplyDialog = ref(false)
    const showReactDialog = ref(false)
    const showEditDialog = ref(false)
    const showDeleteDialog = ref(false)
    const selectedMessage = ref(null)
    const editContent = ref('')
    
    /* eslint-disable-next-line no-unused-vars */
    const showMembers = ref(false)
    const showSettings = ref(false)
    const loading = ref(true)
    const sending = ref(false)
    const contenuMessage = ref('')
    const fichiers = ref([])
    
    // Variables pour les suggestions d'utilisateurs
    const showUserSuggestions = ref(false);
    const mentionStartIndex = ref(-1);
    const mentionQuery = ref('');
    const filteredUsers = ref([]);
    const selectedSuggestionIndex = ref(0);
    const mentionMenuX = ref(0);
    const mentionMenuY = ref(0);
    const messageInput = ref(null);

    // Variables pour la pagination et le rendu par lots
    const messagesPerPage = ref(20) // Nombre de messages à afficher par page
    const currentPage = ref(1) // Page actuelle
    const loadingMore = ref(false) // Indicateur de chargement lors du clic sur "Afficher plus"
    const hasMoreMessages = ref(false) // Indique s'il y a plus de messages à charger

    const workspaceId = computed(() => route.params.workspaceId)
    const canalId = computed(() => route.params.canalId)
    const canal = computed(() => store.state.canal.canalActif)
    const messages = computed(() => store.getters['message/allMessages'])
    const user = computed(() => store.state.auth.user)

    const messagesInOrder = computed(() => {
      // Vérification de sécurité pour éviter les erreurs
      if (!messages.value || !Array.isArray(messages.value)) return [];
      
      try {
        // Créer un nouveau tableau pour ne pas modifier le tableau original
        const messagesCopy = [...messages.value];
        
        // Utiliser une méthode de tri optimisée avec des timestamps numériques
        return messagesCopy.sort((a, b) => {
          // Convertir les dates en timestamps numériques une seule fois
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA; // Ordre décroissant (plus récent d'abord)
        });
      } catch (error) {
        console.error('Erreur lors du tri des messages:', error);
        return [...messages.value]; // Retourner une copie en cas d'erreur
      }
    })

    // Propriété calculée pour vérifier s'il y a plus de messages à charger
    const hasMoreMessagesComputed = computed(() => {
      if (!messagesInOrder.value) return false;
      return messagesInOrder.value.length > messagesPerPage.value * currentPage.value;
    });
    
    // Mettre à jour hasMoreMessages lorsque hasMoreMessagesComputed change
    watch(hasMoreMessagesComputed, (newValue) => {
      hasMoreMessages.value = newValue;
    }, { immediate: true });
    
    // Propriété calculée pour obtenir uniquement les messages visibles selon la pagination
    const visibleMessages = computed(() => {
      const allMessages = messagesInOrder.value;
      if (!allMessages) return [];
      
      // Retourner les N messages les plus récents en fonction de la page actuelle
      // (limité par messagesPerPage * currentPage)
      return allMessages.slice(0, messagesPerPage.value * currentPage.value);
    })

    const loadMoreMessages = () => {
      loadingMore.value = true;
      
      // Simuler un délai pour montrer l'indicateur de chargement
      setTimeout(() => {
        currentPage.value++;
        loadingMore.value = false;
      }, 500);
    };

    const onFileUploaded = (fichierInfo) => {
      // Le fichier a été téléchargé avec succès, on rafraîchit les messages
      console.log('Fichier uploadé:', fichierInfo?.nom || 'fichier');
      loadMessages();
      // Faites défiler jusqu'au bas pour voir le nouveau message avec le fichier
      setTimeout(() => {
        scrollToBottom();
      }, 500);
    };

    // Fonction pour formater les dates
    const formatDate = (dateString) => {
      if (!dateString) return '';
      
      const date = new Date(dateString);
      const now = new Date();
      
      // Si c'est aujourd'hui, afficher l'heure
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      // Si c'est hier, afficher "Hier" et l'heure
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return `Hier ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      
      // Sinon, afficher la date complète
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const scrollToBottom = () => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
    };

    const envoyerMessage = async () => {
      if (!contenuMessage.value.trim() && fichiers.value.length === 0) return;
      
      // Si le menu de suggestions est ouvert et qu'on appuie sur Entrée, on sélectionne la suggestion
      if (showUserSuggestions.value) {
        selectSuggestion();
        return;
      }
      
      try {
        sending.value = true;
        await store.dispatch('message/sendMessage', {
          canalId: canalId.value,
          workspaceId: workspaceId.value,
          messageData: {
            contenu: contenuMessage.value
          }
        });
        
        contenuMessage.value = '';
        // Réinitialiser les variables de suggestion
        resetMentionState();
        scrollToBottom();
      } catch (error) {
        console.error('Erreur lors de l\'envoi du message:', error);
      } finally {
        sending.value = false;
      }
    };
    
    // Fonction pour gérer la détection des mentions d'utilisateurs
    /* eslint-disable-next-line no-unused-vars */
    const handleMessageInput = () => {
      const text = contenuMessage.value;
      
      // Si le texte est vide, réinitialiser l'état des mentions
      if (!text) {
        resetMentionState();
        return;
      }
      
      // Détecter les mentions d'utilisateurs avec @
      // Accéder à selectionStart de manière sécurisée pour éviter les erreurs
      const cursorPosition = messageInput.value && messageInput.value.$refs && messageInput.value.$refs.input ? 
                            messageInput.value.$refs.input.selectionStart : 
                            text.length;
      const textBeforeCursor = text.substring(0, cursorPosition);
      
      // Vérifier si nous sommes en train de taper une mention d'utilisateur
      const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
      
      if (lastAtSymbol !== -1) {
        // Vérifier si le @ est au début du texte ou précédé d'un espace
        const charBeforeAt = lastAtSymbol > 0 ? textBeforeCursor[lastAtSymbol - 1] : ' ';
        
        if (charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtSymbol === 0) {
          // Vérifier s'il y a un espace après le @
          const textAfterAt = textBeforeCursor.substring(lastAtSymbol + 1);
          const hasSpaceAfterAt = /^\s/.test(textAfterAt);
          
          // Si un espace est trouvé après @, on ne considère pas comme une mention
          if (!hasSpaceAfterAt) {
            console.log('Détection de mention d\'utilisateur');
            mentionStartIndex.value = lastAtSymbol;
            mentionQuery.value = textAfterAt;
            
            // Positionner le menu de suggestions
            positionMentionMenu();
            
            // Filtrer les utilisateurs en fonction de la requête
            filterUsers();
            
            return;
          }
        }
      }
      
      // Si on arrive ici, on n'est pas en train de taper une mention
      resetMentionState();
    };
    
    // Fonction pour positionner le menu de suggestions
    const positionMentionMenu = () => {
      if (!messageInput.value) return;
      
      const inputEl = messageInput.value.$el;
      const rect = inputEl.getBoundingClientRect();
      
      // Position approximative basée sur la position du curseur
      mentionMenuX.value = rect.left + 20; // Ajuster selon les besoins
      mentionMenuY.value = rect.top - 200; // Placer au-dessus du champ de texte
    };
    
    // Fonction pour filtrer les utilisateurs en fonction de la requête
    const filterUsers = async () => {
      if (!canal.value || !canal.value.membres) {
        filteredUsers.value = [];
        return;
      }
      
      try {
        // Récupérer les membres du canal
        const membres = canal.value.membres;
        
        // Filtrer les membres en fonction de la requête
        if (mentionQuery.value) {
          filteredUsers.value = membres.filter(membre => 
            membre.username && membre.username.toLowerCase().includes(mentionQuery.value.toLowerCase())
          );
        } else {
          filteredUsers.value = membres;
        }
        
        // Limiter le nombre de suggestions
        filteredUsers.value = filteredUsers.value.slice(0, 5);
        
        // Afficher le menu de suggestions s'il y a des résultats
        showUserSuggestions.value = filteredUsers.value.length > 0;
        selectedSuggestionIndex.value = 0;
      } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        filteredUsers.value = [];
        showUserSuggestions.value = false;
      }
    };
    
    // Fonction pour naviguer dans les suggestions
    /* eslint-disable-next-line no-unused-vars */
    const navigateSuggestions = (direction) => {
      if (!showUserSuggestions.value) return;
      
      const newIndex = selectedSuggestionIndex.value + direction;
      if (newIndex >= 0 && newIndex < filteredUsers.value.length) {
        selectedSuggestionIndex.value = newIndex;
      }
    };
    
    // Fonction pour sélectionner une suggestion
    const selectSuggestion = () => {
      if (!showUserSuggestions.value || filteredUsers.value.length === 0) return;
      
      const selectedUser = filteredUsers.value[selectedSuggestionIndex.value];
      insertUserMention(selectedUser);
    };
    
    // Fonction pour insérer une mention d'utilisateur dans le message
    const insertUserMention = (user) => {
      if (!user || !user.username || mentionStartIndex.value === -1) return;
      
      const beforeMention = contenuMessage.value.substring(0, mentionStartIndex.value);
      const afterMention = contenuMessage.value.substring(mentionStartIndex.value + mentionQuery.value.length + 1);
      
      // Insérer la mention avec un espace après
      contenuMessage.value = `${beforeMention}@${user.username} ${afterMention}`;
      
      // Réinitialiser l'état des mentions
      resetMentionState();
      
      // Mettre le focus sur le champ de message
      if (messageInput.value) {
        messageInput.value.focus();
      }
    };
    
    // Fonction pour réinitialiser l'état des mentions
    const resetMentionState = () => {
      showUserSuggestions.value = false;
      mentionStartIndex.value = -1;
      mentionQuery.value = '';
      filteredUsers.value = [];
      selectedSuggestionIndex.value = 0;
    };

    const loadMessages = async () => {
      try {
        await store.dispatch('message/fetchMessages', {
          canalId: canalId.value,
          workspaceId: workspaceId.value
        });
        scrollToBottom();
      } catch (error) {
        console.error('Erreur lors du chargement des messages:', error);
      }
    };

    onMounted(async () => {
      try {
        if (canalId.value) {
          // Charger les détails du canal
          await store.dispatch('canal/fetchCanal', {
            canalId: canalId.value,
            workspaceId: workspaceId.value
          });
          
          // Charger les messages
          await loadMessages();
          loading.value = false;
          scrollToBottom();
        }
      } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        loading.value = false;
      }
    });

    // Approche plus simple pour gérer les avatars
    const getDefaultAvatar = (username) => {
      if (!username) return 'U';
      return username.charAt(0).toUpperCase();
    };
    
    // Fonction pour formater le contenu des messages et détecter les mentions
    /* eslint-disable-next-line no-unused-vars */
    const formatMessageContent = (content) => {
      if (!content) return '';
      
      // Sanitiser le contenu pour éviter les injections XSS
      let sanitizedContent = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
      
      // Détecter les mentions d'utilisateurs (@username)
      const mentionRegex = /@(\w+)/g;
      sanitizedContent = sanitizedContent.replace(mentionRegex, (match, username) => {
        return `<span class="mention-tag">@${username}</span>`;
      });
      
      // Détecter les mentions de canaux (#canal)
      const canalRegex = /#(\w+)/g;
      sanitizedContent = sanitizedContent.replace(canalRegex, (match, canalName) => {
        return `<span class="canal-mention-tag">#${canalName}</span>`;
      });
      
      // Convertir les retours à la ligne en <br>
      sanitizedContent = sanitizedContent.replace(/\n/g, '<br>');
      
      return sanitizedContent;
    };

    // Surveiller les changements de canal pour recharger les messages
    watch(() => canalId.value, async (newCanalId, oldCanalId) => {
      if (newCanalId && newCanalId !== oldCanalId) {
        loading.value = true;
        try {
          // Charger les détails du canal
          await store.dispatch('canal/fetchCanal', {
            canalId: newCanalId,
            workspaceId: workspaceId.value
          });
          
          // Charger les messages
          await loadMessages();
          loading.value = false;
          scrollToBottom();
        } catch (error) {
          console.error('Erreur chargement canal:', error);
          loading.value = false;
        }
      }
    });

    onUnmounted(() => {
      socketService.disconnect();
    });

    // Fonction pour répondre à un message
    const replyToMessage = (message) => {
      selectedMessage.value = message;
      showReplyDialog.value = true;
    };

    // Fonction pour réagir à un message
    const reactToMessage = (message) => {
      selectedMessage.value = message;
      showReactDialog.value = true;
    };
    
    // Fonction pour envoyer une réaction avec un emoji spécifique
    /* eslint-disable-next-line no-unused-vars */
    const sendReaction = async (emoji) => {
      if (!selectedMessage.value) return;
      
      try {
        await store.dispatch('message/reactToMessage', {
          canalId: canalId.value,
          workspaceId: workspaceId.value,
          messageId: selectedMessage.value._id,
          emoji: emoji
        });
        
        showReactDialog.value = false;
      } catch (error) {
        console.error('Erreur lors de l\'envoi de la réaction:', error);
      }
    };

    // Fonction pour modifier un message
    const editMessage = (message) => {
      selectedMessage.value = message;
      editContent.value = message.contenu;
      showEditDialog.value = true;
    };

    // Fonction pour supprimer un message
    const deleteMessage = (message) => {
      selectedMessage.value = message;
      showDeleteDialog.value = true;
    };

    // Fonction pour confirmer la réponse à un message
    const confirmReply = async () => {
      if (!contenuMessage.value.trim() || !selectedMessage.value) return;
      
      try {
        console.log('Réponse au message:', selectedMessage.value._id, 'avec contenu:', contenuMessage.value);
        
        await store.dispatch('message/replyToMessage', {
          canalId: canalId.value,
          workspaceId: workspaceId.value,
          messageData: {
            contenu: contenuMessage.value,
            reponseA: selectedMessage.value._id
          }
        });
        
        contenuMessage.value = '';
        showReplyDialog.value = false;
        selectedMessage.value = null;
        // Charger les messages pour voir la réponse
        await loadMessages();
        scrollToBottom();
      } catch (error) {
        console.error('Erreur lors de la réponse au message:', error);
      }
    };

    // Fonction pour confirmer la modification d'un message
    const confirmEdit = async () => {
      if (!editContent.value.trim() || !selectedMessage.value) return;
      
      try {
        console.log('Modification du message:', selectedMessage.value._id, 'avec contenu:', editContent.value);
        
        await store.dispatch('message/updateMessage', {
          canalId: canalId.value,
          workspaceId: workspaceId.value,
          messageId: selectedMessage.value._id,
          contenu: editContent.value
        });
        
        showEditDialog.value = false;
        selectedMessage.value = null;
        // Recharger les messages pour voir les modifications
        await loadMessages();
      } catch (error) {
        console.error('Erreur lors de la modification du message:', error);
      }
    };

    // Fonction pour confirmer la suppression d'un message
    const confirmDelete = async () => {
      try {
        await store.dispatch('message/deleteMessage', {
          canalId: canalId.value,
          workspaceId: workspaceId.value,
          messageId: selectedMessage.value._id
        });
        
        showDeleteDialog.value = false;
        selectedMessage.value = null;
      } catch (error) {
        console.error('Erreur lors de la suppression du message:', error);
      }
    };

    // Définir les variables manquantes pour éviter les erreurs no-undef
    const error = ref(null);
    
    return {
      // Variables de base
      canalId,
      workspaceId,
      canal,
      messages,
      contenuMessage,
      loading,
      showSettings,
      messagesPerPage,
      currentPage,
      loadingMore,
      hasMoreMessages,
      user,
      error,
      sending,
      fichiers,
      selectedMessage,
      visibleMessages,
      
      // Fonctions de base
      loadMessages,
      loadMoreMessages,
      envoyerMessage,
      replyToMessage,
      reactToMessage,
      editMessage,
      deleteMessage,
      onFileUploaded,
      getDefaultAvatar,
      messagesInOrder,
      scrollToBottom,
      formatDate,
      
      // Dialogues
      showReplyDialog,
      showReactDialog,
      showEditDialog,
      showDeleteDialog,
      editContent,
      confirmReply,
      confirmEdit,
      confirmDelete,
      
      // Fonction pour les mentions
      handleMessageInput,
      navigateSuggestions,
      selectSuggestion,
      showUserSuggestions,
      filteredUsers,
      selectedSuggestionIndex,
      messageInput
    };
  }
});
</script>

<style scoped>
.messages-container {
  height: calc(100vh - 300px);
  overflow-y: auto;
}

.messages-list {
  display: flex;
  flex-direction: column;
}

.message-input-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.message-input-wrapper {
  flex: 1;
  width: 100%;
  display: flex;
}

.message-input {
  flex: 1;
}

.message-attachments {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
}

.reply-reference {
  background-color: rgba(0, 0, 0, 0.05);
  border-left: 3px solid #1976d2;
  border-radius: 4px;
  margin-left: 4px;
}

.reply-preview {
  max-width: 250px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Styles pour le contenu des messages */
.message-content {
  word-break: break-word;
  white-space: pre-wrap;
  overflow: visible;
  text-overflow: initial;
  max-width: none;
}

.mention-tag {
  background-color: rgba(29, 155, 240, 0.1);
  color: #1d9bf0;
  padding: 0 4px;
  border-radius: 4px;
  font-weight: 500;
  display: inline-block;
  cursor: pointer;
}

.mention-tag:hover {
  background-color: rgba(29, 155, 240, 0.2);
}

.canal-mention-tag {
  background-color: rgba(83, 166, 151, 0.1);
  color: #53a697;
  padding: 0 4px;
  border-radius: 4px;
  font-weight: 500;
  display: inline-block;
  cursor: pointer;
}

.canal-mention-tag:hover {
  background-color: rgba(83, 166, 151, 0.2);
}

/* Styles pour les boutons d'action */
.message-actions {
  display: flex;
  gap: 4px;
}

/* Styles pour les boutons emoji */
.emoji-btn {
  font-size: 1.2rem;
  min-width: 40px;
}
</style>
