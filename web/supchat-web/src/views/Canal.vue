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
                        <div class="markdown-content" v-html="formatMarkdown(message.contenu)"></div>
                        <!-- Affichage des fichiers joints -->
                        <div v-if="message.fichiers && message.fichiers.length > 0" class="message-attachments">
                          <FileAttachment 
                            v-for="fichier in message.fichiers" 
                            :key="fichier.url" 
                            :fichier="fichier" 
                            class="mb-2"
                          />
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
              <v-text-field
                v-model="contenuMessage"
                placeholder="Écrivez votre message..."
                append-icon="mdi-send"
                @click:append="envoyerMessage"
                @keyup.enter="envoyerMessage"
                hide-details
                dense
                outlined
                class="message-input"
              ></v-text-field>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script>
import { defineComponent, ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useStore } from 'vuex'
import socketService from '../services/socketService'
// eslint-disable-next-line no-unused-vars
import axios from 'axios'
import * as marked from 'marked'
import DOMPurify from 'dompurify'
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
    
    // Fonction pour convertir le Markdown en HTML sécurisé
    const formatMarkdown = (text) => {
      if (!text) return ''
      
      try {
        // Configuration de marked
        const options = {
          gfm: true, // GitHub Flavored Markdown
          breaks: true, // Convertir les retours à la ligne en <br>
          pedantic: false, // Ne pas suivre les spécifications strictes
          headerIds: false, // Pas d'IDs pour les titres
          mangle: false, // Ne pas masquer les emails
          sanitize: false, // Nous utilisons DOMPurify pour la sanitisation
          silent: true // Ne pas lancer d'erreur en cas de problème
        }
        
        // Prétraitement du texte pour s'assurer que les listes sont correctement formatées
        // Ajouter un espace après les marqueurs de liste si nécessaire
        let processedText = text.replace(/^([-*+])(\S)/gm, '$1 $2');
        // Ajouter un espace après les numéros de liste si nécessaire
        processedText = processedText.replace(/^(\d+\.)(\S)/gm, '$1 $2');
        
        // Convertir le Markdown en HTML
        const html = marked.parse(processedText, options)
        
        // Sanitiser l'HTML pour éviter les attaques XSS
        return DOMPurify.sanitize(html)
      } catch (error) {
        console.error('Erreur lors du formatage Markdown:', error)
        return text // Retourner le texte original en cas d'erreur
      }
    }
    
    const messagesContainer = ref(null)
    const showMembers = ref(false)
    const showSettings = ref(false)
    const loading = ref(true)
    const sending = ref(false)
    const contenuMessage = ref('')
    
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
      if (!contenuMessage.value.trim()) return;
      
      sending.value = true;
      
      try {
        await store.dispatch('message/sendMessage', {
          canalId: canalId.value,
          workspaceId: workspaceId.value,
          messageData: {
            contenu: contenuMessage.value
          }
        });
        
        contenuMessage.value = '';
        scrollToBottom();
      } catch (error) {
        console.error('Erreur lors de l\'envoi du message:', error);
      } finally {
        sending.value = false;
      }
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

    return {
      showMembers,
      showSettings,
      loading,
      sending,
      contenuMessage,
      messagesPerPage,
      currentPage,
      loadingMore,
      hasMoreMessages,
      visibleMessages,
      loadMoreMessages,
      canal,
      messages,
      messagesInOrder,
      user,
      messagesContainer,
      formatDate,
      envoyerMessage,
      scrollToBottom,
      formatMarkdown,
      onFileUploaded,
      canalId
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

/* Styles pour le formatage Markdown */
.markdown-content {
  word-break: break-word;
  white-space: pre-wrap;
  overflow: visible;
  text-overflow: initial;
  max-width: none;
}

.markdown-content :deep(h1) {
  font-size: 1.5rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

.markdown-content :deep(h2) {
  font-size: 1.25rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

.markdown-content :deep(h3) {
  font-size: 1.1rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

.markdown-content :deep(p) {
  margin-bottom: 0.5rem;
}

.markdown-content :deep(ul), 
.markdown-content :deep(ol) {
  padding-left: 1.5rem;
  margin-bottom: 0.5rem;
}

.markdown-content :deep(li) {
  margin-bottom: 0.25rem;
}

.markdown-content :deep(code) {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  font-family: monospace;
}

.markdown-content :deep(pre) {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 0.5rem;
  border-radius: 4px;
  overflow-x: auto;
  margin-bottom: 0.5rem;
}

.markdown-content :deep(pre code) {
  background-color: transparent;
  padding: 0;
}

.markdown-content :deep(blockquote) {
  border-left: 3px solid rgba(0, 0, 0, 0.2);
  padding-left: 0.5rem;
  margin-left: 0.5rem;
  color: rgba(0, 0, 0, 0.6);
}

.markdown-content :deep(a) {
  color: #1976d2;
  text-decoration: none;
}

.markdown-content :deep(a:hover) {
  text-decoration: underline;
}

.markdown-content :deep(img) {
  max-width: 100%;
  height: auto;
}
</style>
