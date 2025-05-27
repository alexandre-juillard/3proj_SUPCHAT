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
                        <div class="message-content" v-html="formatMessageContent(message.contenu)"></div>
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
                  @keydown.down.prevent="showUserSuggestions ? navigateSuggestions(1) : (showCanalSuggestions ? navigateCanalSuggestions(1) : null)"
                  @keydown.up.prevent="showUserSuggestions ? navigateSuggestions(-1) : (showCanalSuggestions ? navigateCanalSuggestions(-1) : null)"
                  @keydown.tab.prevent="showUserSuggestions ? selectSuggestion() : (showCanalSuggestions ? selectCanalSuggestion() : null)"
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
                  min-width="250"
                  max-width="300"
                  offset-y
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
                
                <!-- Menu de suggestion pour les mentions de canaux -->
                <v-menu
                  v-model="showCanalSuggestions"
                  :close-on-content-click="false"
                  :position-x="canalMenuX"
                  :position-y="canalMenuY"
                  absolute
                  min-width="250"
                  max-width="300"
                  offset-y
                >
                  <v-list dense v-if="filteredCanals.length > 0">
                    <v-list-item
                      v-for="(canal, index) in filteredCanals"
                      :key="canal._id"
                      @click="insertCanalMention(canal)"
                      :class="{ 'v-list-item--active': index === selectedCanalIndex }"
                    >
                      <v-list-item-avatar size="24">
                        <v-avatar size="24" color="teal">
                          #
                        </v-avatar>
                      </v-list-item-avatar>
                      <v-list-item-content>
                        <v-list-item-title>{{ canal.nom }}</v-list-item-title>
                        <v-list-item-subtitle v-if="canal.description" class="text-caption">{{ canal.description }}</v-list-item-subtitle>
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
import { useRoute, useRouter } from 'vue-router'
import { useStore } from 'vuex'
import socketService from '../services/socketService'
import FileUploader from '../components/FileUploader.vue'
import FileAttachment from '../components/FileAttachment.vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

export default defineComponent({
  name: 'CanalView',
  components: {
    FileUploader,
    FileAttachment
  },
  
  setup() {
    const route = useRoute()
    const router = useRouter()
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
    // Utiliser un watcher pour synchroniser isLoading avec loading
    const isLoading = computed(() => loading.value)
    const sending = ref(false)
    const contenuMessage = ref('')
    const fichiers = ref([])
    
    // Variables pour les réponses
    const replyingTo = ref(null)
    const replyingToMessage = ref(null)
    
    // Variables pour les suggestions d'utilisateurs
    const showUserSuggestions = ref(false);
    const mentionStartIndex = ref(-1);
    const mentionQuery = ref('');
    const filteredUsers = ref([]);
    const selectedSuggestionIndex = ref(0);
    const mentionMenuX = ref(0);
    const mentionMenuY = ref(0);
    const messageInput = ref(null);
    
    // Variables pour les suggestions de canaux
    const showCanalSuggestions = ref(false);
    const canalMentionStartIndex = ref(-1);
    const canalMentionQuery = ref('');
    const filteredCanals = ref([]);
    const selectedCanalIndex = ref(0);
    const canalMenuX = ref(0);
    const canalMenuY = ref(0);

    // Variables pour la pagination et le rendu par lots
    const messagesPerPage = ref(20) // Nombre de messages à afficher par page
    const currentPage = ref(1) // Page actuelle
    const loadingMore = ref(false) // Indicateur de chargement lors du clic sur "Afficher plus"
    // Utiliser un computed pour synchroniser isLoadingMore avec loadingMore
    const isLoadingMore = computed(() => loadingMore.value)
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
      // Éviter de charger plus si déjà en cours de chargement
      if (loadingMore.value || loading.value) return;
      
      loadingMore.value = true;
      
      try {
        // Incrémenter la page pour afficher plus de messages
        currentPage.value++;
        
        // Vérifier s'il reste des messages à charger
        hasMoreMessages.value = messagesInOrder.value.length > messagesPerPage.value * currentPage.value;
      } catch (error) {
        console.error('Erreur lors du chargement de plus de messages:', error);
      } finally {
        // Attendre un court délai pour que l'utilisateur voie l'indicateur de chargement
        setTimeout(() => {
          loadingMore.value = false;
        }, 300);
      }
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

    // Fonction pour extraire les canaux référencés dans un message
    const extractReferencedCanals = async (content) => {
      // Extraire toutes les mentions de canaux avec le format #nomcanal
      const canalMentions = content.match(/#(\w+)/g) || [];
      
      if (canalMentions.length === 0) return [];
      
      try {
        // Récupérer tous les canaux du workspace
        const canaux = await store.dispatch('canal/fetchCanaux', workspaceId.value);
        
        if (!canaux || !Array.isArray(canaux)) return [];
        
        // Extraire les noms des canaux mentionnés (sans le #)
        const mentionedCanalNames = canalMentions.map(mention => mention.substring(1).toLowerCase());
        
        // Trouver les canaux mentionnés et extraire leurs IDs
        const referencedCanals = canaux
          .filter(canal => canal.nom && mentionedCanalNames.includes(canal.nom.toLowerCase()))
          .map(canal => canal._id);  // Envoyer uniquement les IDs des canaux
        
        console.log('Canaux référencés:', referencedCanals);
        return referencedCanals;
      } catch (error) {
        console.error('Erreur lors de l\'extraction des canaux référencés:', error);
        return [];
      }
    };
    
    const envoyerMessage = async () => {
      if (!contenuMessage.value.trim() && fichiers.value.length === 0) return;
      
      // Si le menu de suggestions est ouvert et qu'on appuie sur Entrée, on sélectionne la suggestion
      if (showUserSuggestions.value) {
        selectSuggestion();
        return;
      }
      
      if (showCanalSuggestions.value) {
        selectCanalSuggestion();
        return;
      }
      
      try {
        sending.value = true;
        
        // Extraire les canaux référencés dans le message
        const canalsReferenced = await extractReferencedCanals(contenuMessage.value);
        
        // Envoyer le message avec les canaux référencés
        await store.dispatch('message/sendMessage', {
          canalId: canalId.value,
          workspaceId: workspaceId.value,
          messageData: {
            contenu: contenuMessage.value,
            canalsReferenced: canalsReferenced
          }
        });
        
        contenuMessage.value = '';
        // Réinitialiser les variables de suggestion
        resetMentionState();
        resetCanalMentionState();
        scrollToBottom();
      } catch (error) {
        console.error('Erreur lors de l\'envoi du message:', error);
      } finally {
        sending.value = false;
      }
    };
    
    // Fonction pour gérer la détection des mentions d'utilisateurs et de canaux
    /* eslint-disable-next-line no-unused-vars */
    const handleMessageInput = () => {
      const text = contenuMessage.value;
      
      // Si le texte est vide, réinitialiser l'état des mentions
      if (!text) {
        resetMentionState();
        resetCanalMentionState();
        return;
      }
      
      // Accéder à selectionStart de manière sécurisée pour éviter les erreurs
      const cursorPosition = messageInput.value && messageInput.value.$refs && messageInput.value.$refs.input ? 
                            messageInput.value.$refs.input.selectionStart : 
                            text.length;
      const textBeforeCursor = text.substring(0, cursorPosition);
      
      // 1. Détecter les mentions d'utilisateurs avec @
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
            
            // Réinitialiser l'état des mentions de canaux
            resetCanalMentionState();
            
            return;
          }
        }
      }
      
      // 2. Détecter les mentions de canaux avec #
      const lastHashSymbol = textBeforeCursor.lastIndexOf('#');
      
      if (lastHashSymbol !== -1) {
        // Vérifier si le # est au début du texte ou précédé d'un espace
        const charBeforeHash = lastHashSymbol > 0 ? textBeforeCursor[lastHashSymbol - 1] : ' ';
        
        if (charBeforeHash === ' ' || charBeforeHash === '\n' || lastHashSymbol === 0) {
          // Vérifier s'il y a un espace après le #
          const textAfterHash = textBeforeCursor.substring(lastHashSymbol + 1);
          const hasSpaceAfterHash = /^\s/.test(textAfterHash);
          
          // Vérifier si le texte après # contient un espace (mention complète)
          const isCompleteMention = textAfterHash.includes(' ');
          
          // Si un espace est trouvé après # ou si la mention est déjà complète, on ne considère pas comme une mention active
          if (!hasSpaceAfterHash && !isCompleteMention) {
            console.log('Détection de mention de canal');
            canalMentionStartIndex.value = lastHashSymbol;
            canalMentionQuery.value = textAfterHash;
            
            // Positionner le menu de suggestions
            positionCanalMentionMenu();
            
            // Filtrer les canaux en fonction de la requête
            filterCanals();
            
            // Réinitialiser l'état des mentions d'utilisateurs
            resetMentionState();
            
            return;
          }
        }
      }
      
      // Si on arrive ici, on n'est pas en train de taper une mention
      resetMentionState();
      resetCanalMentionState();
    };
    
    // Fonction pour positionner le menu de suggestions
    const positionMentionMenu = () => {
      if (!messageInput.value) return;
      
      const inputEl = messageInput.value.$el;
      const rect = inputEl.getBoundingClientRect();
      
      // Position approximative basée sur la position du curseur
      mentionMenuX.value = rect.left + 10; // Ajuster selon les besoins
      mentionMenuY.value = rect.top - 10; // Juste au-dessus du champ de texte
      
      console.log('Menu position:', mentionMenuX.value, mentionMenuY.value);
    };
    
    // Fonction pour filtrer les utilisateurs en fonction de la requête
    const filterUsers = async () => {
      try {
        // Si le canal n'est pas chargé ou n'a pas de membres, récupérer les membres du workspace
        if (!canal.value || !canal.value.membres || canal.value.membres.length === 0) {
          console.log('Canal sans membres, récupération des utilisateurs du workspace');
          
          // Récupérer les utilisateurs du workspace depuis le store
          const workspace = await store.dispatch('workspace/getWorkspaceById', workspaceId.value);
          
          if (workspace && workspace.membres) {
            console.log('Membres du workspace récupérés:', workspace.membres.length);
            
            // Créer des objets utilisateur avec les propriétés nécessaires
            const users = workspace.membres.map(membre => {
              // Vérifier si membre.utilisateur existe et contient un username
              const username = membre.utilisateur ? membre.utilisateur.username : (membre.username || 'Utilisateur');
              const avatar = membre.utilisateur ? membre.utilisateur.profilePicture : membre.profilePicture;
              const id = membre.utilisateur ? membre.utilisateur._id : membre._id;
              
              console.log('Membre trouvé:', username);
              
              return {
                _id: id,
                username: username,
                avatar: avatar
              };
            });
            
            // Filtrer les utilisateurs en fonction de la requête
            if (mentionQuery.value) {
              filteredUsers.value = users.filter(user => 
                user.username && user.username.toLowerCase().includes(mentionQuery.value.toLowerCase())
              );
            } else {
              filteredUsers.value = users;
            }
          } else {
            console.log('Aucun membre trouvé dans le workspace');
            filteredUsers.value = [];
          }
        } else {
          console.log('Membres du canal disponibles:', canal.value.membres.length);
          
          // Récupérer les membres du canal
          const membres = canal.value.membres.map(membre => {
            // Vérifier si membre.utilisateur existe et contient un username
            const username = membre.utilisateur ? membre.utilisateur.username : (membre.username || 'Utilisateur');
            const avatar = membre.utilisateur ? membre.utilisateur.profilePicture : membre.profilePicture;
            const id = membre.utilisateur ? membre.utilisateur._id : membre._id;
            
            return {
              _id: id,
              username: username,
              avatar: avatar
            };
          });
          
          // Filtrer les membres en fonction de la requête
          if (mentionQuery.value) {
            filteredUsers.value = membres.filter(membre => 
              membre.username && membre.username.toLowerCase().includes(mentionQuery.value.toLowerCase())
            );
          } else {
            filteredUsers.value = membres;
          }
        }
        
        // Ajouter des utilisateurs de test si la liste est vide (pour débogage)
        if (filteredUsers.value.length === 0) {
          console.log('Aucun utilisateur trouvé, ajout d\'utilisateurs de test');
          filteredUsers.value = [
            { _id: '1', username: 'user1', avatar: null },
            { _id: '2', username: 'user2', avatar: null },
            { _id: '3', username: 'admin', avatar: null }
          ];
        }
        
        // Limiter le nombre de suggestions
        filteredUsers.value = filteredUsers.value.slice(0, 5);
        
        console.log('Utilisateurs filtrés:', filteredUsers.value);
        
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
    
    // Fonction pour réinitialiser l'état des mentions d'utilisateurs
    const resetMentionState = () => {
      showUserSuggestions.value = false;
      mentionStartIndex.value = -1;
      mentionQuery.value = '';
      filteredUsers.value = [];
      selectedSuggestionIndex.value = 0;
    };
    
    // Fonction pour réinitialiser l'état des mentions de canaux
    const resetCanalMentionState = () => {
      showCanalSuggestions.value = false;
      canalMentionStartIndex.value = -1;
      canalMentionQuery.value = '';
      filteredCanals.value = [];
      selectedCanalIndex.value = 0;
    };
    
    // Fonction pour positionner le menu de suggestions de canaux
    const positionCanalMentionMenu = () => {
      if (!messageInput.value) return;
      
      const inputEl = messageInput.value.$el;
      const rect = inputEl.getBoundingClientRect();
      
      // Position approximative basée sur la position du curseur
      canalMenuX.value = rect.left + 10; // Ajuster selon les besoins
      canalMenuY.value = rect.top - 10; // Juste au-dessus du champ de texte
      
      console.log('Menu canal position:', canalMenuX.value, canalMenuY.value);
    };
    
    // Fonction pour filtrer les canaux en fonction de la requête
    const filterCanals = async () => {
      try {
        console.log('Filtrage des canaux pour le workspace:', workspaceId.value);
        
        // Récupérer les canaux du workspace depuis le store en utilisant l'action fetchCanaux
        const response = await store.dispatch('canal/fetchCanaux', workspaceId.value);
        
        if (response && Array.isArray(response)) {
          console.log('Canaux récupérés:', response.length);
          
          // Filtrer uniquement les canaux publics
          const publicCanals = response.filter(canal => canal.visibilite === 'public');
          console.log('Canaux publics:', publicCanals.length);
          
          // Créer des objets canal avec les propriétés nécessaires
          const canals = publicCanals.map(canal => ({
            _id: canal._id,
            nom: canal.nom,
            description: canal.description || ''
          }));
          
          // Filtrer les canaux en fonction de la requête
          if (canalMentionQuery.value) {
            filteredCanals.value = canals.filter(canal => 
              canal.nom && canal.nom.toLowerCase().includes(canalMentionQuery.value.toLowerCase())
            );
          } else {
            filteredCanals.value = canals;
          }
          
          // Limiter le nombre de suggestions
          filteredCanals.value = filteredCanals.value.slice(0, 5);
          
          console.log('Canaux filtrés:', filteredCanals.value);
        } else {
          console.log('Aucun canal récupéré');
          filteredCanals.value = [];
        }
        
        // Afficher le menu de suggestions s'il y a des résultats
        showCanalSuggestions.value = filteredCanals.value.length > 0;
        selectedCanalIndex.value = 0;
      } catch (error) {
        console.error('Erreur lors de la récupération des canaux:', error);
        filteredCanals.value = [];
        showCanalSuggestions.value = false;
      }
    };
    
    // Fonction pour naviguer dans les suggestions de canaux
    const navigateCanalSuggestions = (direction) => {
      if (!showCanalSuggestions.value) return;
      
      const newIndex = selectedCanalIndex.value + direction;
      if (newIndex >= 0 && newIndex < filteredCanals.value.length) {
        selectedCanalIndex.value = newIndex;
      }
    };
    
    // Fonction pour sélectionner une suggestion de canal
    const selectCanalSuggestion = () => {
      if (!showCanalSuggestions.value || filteredCanals.value.length === 0) return;
      
      const selectedCanal = filteredCanals.value[selectedCanalIndex.value];
      insertCanalMention(selectedCanal);
    };
    
    // Fonction pour insérer une mention de canal dans le message
    const insertCanalMention = (canal) => {
      if (!canal || !canal.nom || canalMentionStartIndex.value === -1) return;
      
      const beforeMention = contenuMessage.value.substring(0, canalMentionStartIndex.value);
      const afterMention = contenuMessage.value.substring(canalMentionStartIndex.value + canalMentionQuery.value.length + 1);
      
      // Insérer la mention avec un espace après
      contenuMessage.value = `${beforeMention}#${canal.nom} ${afterMention}`;
      
      // Stocker l'ID du canal mentionné pour le référencement
      // (Nous utiliserons cette information lors de l'envoi du message)
      const mentionedCanalId = canal._id;
      console.log('Canal mentionné:', canal.nom, 'ID:', mentionedCanalId);
      
      // Réinitialiser l'état des mentions
      resetCanalMentionState();
      
      // Mettre le focus sur le champ de message
      if (messageInput.value) {
        messageInput.value.focus();
      }
    };
    
    // Fonction pour naviguer vers un canal mentionné
    const navigateToCanal = (canalId) => {
      if (!canalId) return;
      
      // Naviguer vers le canal en utilisant le router
      router.push(`/workspace/${workspaceId.value}/canal/${canalId}`);
    };

    const loadMessages = async () => {
      try {
        loading.value = true; // Mettre loading à true au début du chargement
        await store.dispatch('message/fetchMessages', {
          canalId: canalId.value,
          workspaceId: workspaceId.value
        });
        scrollToBottom();
        return true; // Indiquer que le chargement a réussi
      } catch (error) {
        console.error('Erreur lors du chargement des messages:', error);
        return false; // Indiquer que le chargement a échoué
      } finally {
        loading.value = false; // Toujours mettre loading à false à la fin
      }
    };

    onMounted(async () => {
      try {
        if (canalId.value) {
          loading.value = true; // Mettre loading à true au début de l'initialisation
          
          // Charger les détails du canal avec un timeout pour éviter les blocages
          const canalPromise = store.dispatch('canal/fetchCanal', {
            canalId: canalId.value,
            workspaceId: workspaceId.value
          });
          
          // Ajouter un timeout pour éviter que la requête ne bloque indéfiniment
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout lors du chargement du canal')), 5000);
          });
          
          // Utiliser Promise.race pour terminer si le timeout est atteint
          await Promise.race([canalPromise, timeoutPromise]);
          
          // Charger les messages
          await loadMessages();
          scrollToBottom();
          
          // Marquer les notifications comme lues lorsqu'on entre dans un canal
          await store.dispatch('notification/marquerToutesNotificationsLues', canalId.value)
          
          // Ajouter un gestionnaire d'événements global pour les clics sur les mentions de canaux
          // Après un court délai pour s'assurer que les messages sont rendus
          setTimeout(() => {
            // Définir la fonction handleCanalMention sur window
            window.handleCanalMention = (canalName) => {
              console.log('Clic sur la mention de canal via window:', canalName);
              handleCanalMention(canalName);
            };
            
            // Ajouter un écouteur d'événements pour les clics sur les mentions de canaux
            const messagesContainer = document.querySelector('.messages-container');
            if (messagesContainer) {
              messagesContainer.addEventListener('click', (event) => {
                if (event.target.classList.contains('canal-mention-tag')) {
                  const canalName = event.target.getAttribute('data-canal-name');
                  if (canalName) {
                    console.log('Clic sur la mention de canal via écouteur d\'événements:', canalName);
                    handleCanalMention(canalName);
                  }
                }
              });
            }
          }, 500);
        }
      } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
      } finally {
        loading.value = false; // Toujours mettre loading à false à la fin
      }
    });

    // Surveiller les changements de canal pour recharger les messages
    watch(canalId, async (newId, oldId) => {
      if (newId && newId !== oldId) {
        await loadMessages()
        scrollToBottom()
        
        // Marquer les notifications comme lues lorsqu'on change de canal
        await store.dispatch('notification/marquerToutesNotificationsLues', newId)
      }
    })

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
    
    // Fonction pour gérer les mentions de canaux
    const handleCanalMention = (canalName) => {
      if (!canalName) return;
      
      // Rechercher le canal par son nom
      store.dispatch('canal/searchCanalByName', canalName)
        .then(result => {
          if (result && result.length > 0) {
            const canal = result[0];
            // Naviguer vers le canal trouvé
            router.push({ name: 'Canal', params: { id: canal._id } });
          } else {
            console.warn(`Canal non trouvé: ${canalName}`);
          }
        })
        .catch(error => {
          console.error('Erreur lors de la recherche du canal:', error);
        });
    };
    
    // Fonction pour obtenir les initiales d'un utilisateur pour l'avatar par défaut
    const getDefaultAvatar = (username) => {
      if (!username) return '?';
      return username.substring(0, 2).toUpperCase();
    };
    
    // Fonction pour définir le message auquel on répond
    const setReplyTo = (message) => {
      if (!message) return;
      replyingTo.value = message._id;
      replyingToMessage.value = message;
    };
    
    // Fonction pour annuler la réponse
    const cancelReply = () => {
      replyingTo.value = null;
      replyingToMessage.value = null;
    };
    
    // Fonction pour formater le contenu du message avec Markdown
    const formatMessageContent = (content) => {
      if (!content) return '';
      
      try {
        // Remplacer les mentions d'utilisateurs par des balises HTML
        let formattedContent = content.replace(/@([a-zA-Z0-9_-]+)/g, '<span class="mention-tag">@$1</span>');
        
        // Remplacer les mentions de canaux par des balises HTML
        formattedContent = formattedContent.replace(/#([a-zA-Z0-9_-]+)/g, '<span class="canal-mention-tag" data-canal-name="$1">#$1</span>');
        
        // Utiliser la bibliothèque marked pour le formatage Markdown
        const options = {
          gfm: true,
          breaks: true,
          headerIds: false,
          mangle: false,
          sanitize: false,
          silent: true
        };
        
        // Prétraitement du texte pour s'assurer que les listes sont correctement formatées
        let processedText = formattedContent.replace(/^([-*+])(\S)/gm, '$1 $2');
        processedText = processedText.replace(/^(\d+\.)(\S)/gm, '$1 $2');
        
        // Convertir le Markdown en HTML et sanitiser
        const html = marked.parse(processedText, options);
        return DOMPurify.sanitize(html);
      } catch (error) {
        console.error('Erreur lors du formatage du message:', error);
        return content;
      }
    };
    
    return {
      // Variables de base
      canalId,
      workspaceId,
      canal,
      messages,
      messagesInOrder,
      contenuMessage,
      loading: isLoading,
      isLoading,
      isLoadingMore,
      loadingMore: isLoadingMore,
      hasMoreMessages,
      user,
      error,
      sending,
      fichiers,
      selectedMessage,
      visibleMessages,
      messagesPerPage,
      currentPage,
      showSettings,
      
      // Variables pour les réponses et dialogues
      replyingTo,
      replyingToMessage,
      showReplyDialog,
      showReactDialog,
      showEditDialog,
      showDeleteDialog,
      editContent,
      
      // Variables pour les mentions d'utilisateurs
      showUserSuggestions,
      mentionQuery,
      filteredUsers,
      selectedSuggestionIndex,
      mentionMenuX,
      mentionMenuY,
      messageInput,
      
      // Variables pour les mentions de canaux
      showCanalSuggestions,
      canalMentionQuery,
      filteredCanals,
      selectedCanalIndex,
      canalMenuX,
      canalMenuY,
      
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
      scrollToBottom,
      formatDate,
      
      // Fonctions pour les dialogues
      confirmReply,
      confirmEdit,
      confirmDelete,
      setReplyTo,
      cancelReply,
      
      // Fonctions pour les mentions d'utilisateurs
      handleMessageInput,
      navigateSuggestions,
      selectSuggestion,
      insertUserMention,
      
      // Fonctions pour les mentions de canaux
      navigateCanalSuggestions,
      selectCanalSuggestion,
      insertCanalMention,
      navigateToCanal,
      handleCanalMention,
      
      // Fonctions de formatage
      formatMessageContent
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
color: #1976d2;
font-weight: 500;
cursor: pointer;
padding: 0 2px;
border-radius: 3px;
background-color: rgba(25, 118, 210, 0.1);
}

.mention-tag:hover {
background-color: rgba(25, 118, 210, 0.2);
}

.canal-mention-tag {
color: #4caf50;
font-weight: 500;
cursor: pointer;
padding: 0 2px;
border-radius: 3px;
background-color: rgba(76, 175, 80, 0.1);
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
