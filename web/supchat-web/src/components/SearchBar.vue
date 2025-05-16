<template>
  <div class="search-bar">
    <v-menu
      v-model="showMenu"
      :close-on-content-click="false"
      :nudge-width="300"
      offset-y
    >
      <template v-slot:activator="{ on, attrs }">
        <v-text-field
          v-model="searchQuery"
          prepend-inner-icon="mdi-magnify"
          label="Rechercher..."
          clearable
          hide-details
          dense
          outlined
          class="search-input"
          @keyup.enter="performSearch"
          @click:clear="clearSearch"
          v-bind="attrs"
          v-on="on"
          @focus="showMenu = true"
        ></v-text-field>
      </template>

      <v-card>
        <v-card-title class="text-subtitle-1">
          <span>Recherche</span>
          <v-spacer></v-spacer>
          <v-select
            v-model="searchType"
            :items="searchTypes"
            label="Type"
            dense
            outlined
            hide-details
            class="search-type-select"
            @change="performSearch"
          ></v-select>
        </v-card-title>

        <v-divider></v-divider>

        <!-- Résultats de recherche -->
        <v-card-text class="search-results">
          <div v-if="isLoading" class="text-center pa-4">
            <v-progress-circular indeterminate color="primary"></v-progress-circular>
            <div class="mt-2">Recherche en cours...</div>
          </div>

          <div v-else-if="searchResults.length === 0 && hasSearched" class="text-center pa-4">
            <v-icon large color="grey lighten-1">mdi-alert-circle-outline</v-icon>
            <div class="mt-2 grey--text">Aucun résultat trouvé</div>
          </div>

          <div v-else-if="!hasSearched && !searchQuery" class="text-center pa-4">
            <v-icon large color="grey lighten-1">mdi-magnify</v-icon>
            <div class="mt-2 grey--text">Entrez un terme de recherche</div>
          </div>

          <div v-else>
            <!-- Résultats pour les workspaces -->
            <div v-if="searchType === 'workspaces' && searchResults.length > 0">
              <v-list>
                <v-list-item
                  v-for="workspace in searchResults"
                  :key="workspace._id"
                  :to="'/workspace/' + workspace._id"
                  @click="showMenu = false"
                >
                  <v-list-item-avatar>
                    <v-icon>mdi-domain</v-icon>
                  </v-list-item-avatar>
                  <v-list-item-content>
                    <v-list-item-title>{{ workspace.nom }}</v-list-item-title>
                    <v-list-item-subtitle v-if="workspace.description" class="text-truncate">
                      {{ workspace.description }}
                    </v-list-item-subtitle>
                  </v-list-item-content>
                </v-list-item>
              </v-list>
            </div>

            <!-- Résultats pour les canaux -->
            <div v-if="searchType === 'channels' && searchResults.length > 0">
              <v-list>
                <v-list-item
                  v-for="canal in searchResults"
                  :key="canal._id"
                  :to="'/workspace/' + (currentWorkspaceId || canal.workspace) + '/canal/' + canal._id"
                  @click="showMenu = false"
                >
                  <v-list-item-avatar>
                    <v-icon>{{ canal.type === 'vocal' ? 'mdi-volume-high' : 'mdi-pound' }}</v-icon>
                  </v-list-item-avatar>
                  <v-list-item-content>
                    <v-list-item-title>{{ canal.nom }}</v-list-item-title>
                    <v-list-item-subtitle v-if="canal.description" class="text-truncate">
                      {{ canal.description }}
                    </v-list-item-subtitle>
                  </v-list-item-content>
                </v-list-item>
              </v-list>
            </div>

            <!-- Résultats pour les messages -->
            <div v-if="searchType === 'messages' && searchResults.length > 0">
              <v-list two-line>
                <v-list-item
                  v-for="message in searchResults"
                  :key="message._id"
                  :to="'/workspace/' + currentWorkspaceId + '/canal/' + message.canal._id"
                  @click="showMenu = false"
                >
                  <v-list-item-avatar>
                    <v-avatar color="primary" size="40">
                      <span class="white--text">{{ getInitials(message.auteur) }}</span>
                    </v-avatar>
                  </v-list-item-avatar>
                  <v-list-item-content>
                    <v-list-item-title>
                      <span class="font-weight-medium">{{ message.auteur.username || 'Utilisateur' }}</span>
                      <span class="text-caption ml-2 grey--text">
                        {{ formatDate(message.createdAt) }} dans #{{ message.canal.nom }}
                      </span>
                    </v-list-item-title>
                    <v-list-item-subtitle class="message-content">
                      {{ message.contenu }}
                    </v-list-item-subtitle>
                  </v-list-item-content>
                </v-list-item>
              </v-list>
            </div>

            <!-- Résultats pour les utilisateurs -->
            <div v-if="searchType === 'users' && searchResults.length > 0">
              <v-list>
                <v-list-item
                  v-for="user in searchResults"
                  :key="user._id"
                  @click="showUserProfile(user._id); showMenu = false"
                >
                  <v-list-item-avatar>
                    <v-avatar color="primary" size="40" v-if="!user.profilePicture">
                      <span class="white--text">{{ getInitials(user) }}</span>
                    </v-avatar>
                    <v-avatar size="40" v-else>
                      <v-img :src="user.profilePicture"></v-img>
                    </v-avatar>
                  </v-list-item-avatar>
                  <v-list-item-content>
                    <v-list-item-title>{{ user.username }}</v-list-item-title>
                    <v-list-item-subtitle>
                      {{ user.firstName }} {{ user.lastName }}
                      <v-chip
                        x-small
                        :color="getStatusColor(user.status)"
                        class="ml-2"
                        text-color="white"
                      >
                        {{ user.status || 'hors ligne' }}
                      </v-chip>
                    </v-list-item-subtitle>
                  </v-list-item-content>
                </v-list-item>
              </v-list>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-menu>
  </div>
</template>

<script>
import { defineComponent, ref, computed, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter, useRoute } from 'vue-router';
import axios from 'axios';

export default defineComponent({
  name: 'SearchBar',
  
  setup() {
    const store = useStore();
    const router = useRouter();
    const route = useRoute();
    
    // État local
    const searchQuery = ref('');
    const searchResults = ref([]);
    const isLoading = ref(false);
    const hasSearched = ref(false);
    const showMenu = ref(false);
    const searchType = ref('workspaces');
    const searchTypes = [
      { text: 'Workspaces', value: 'workspaces' },
      { text: 'Canaux', value: 'channels' },
      { text: 'Messages', value: 'messages' },
      { text: 'Utilisateurs', value: 'users' }
    ];
    
    // Computed properties
    const currentWorkspaceId = computed(() => {
      return route.params.id;
    });
    
    // Méthodes
    const performSearch = async () => {
      if (!searchQuery.value.trim()) {
        clearSearch();
        return;
      }
      
      isLoading.value = true;
      hasSearched.value = true;
      searchResults.value = [];
      
      try {
        let endpoint;
        
        switch (searchType.value) {
          case 'workspaces':
            endpoint = '/api/v1/search/workspaces';
            break;
          case 'channels':
            if (!currentWorkspaceId.value) {
              throw new Error('Aucun workspace sélectionné');
            }
            endpoint = `/api/v1/search/workspaces/${currentWorkspaceId.value}/canaux`;
            break;
          case 'messages':
            if (!currentWorkspaceId.value) {
              throw new Error('Aucun workspace sélectionné');
            }
            endpoint = `/api/v1/search/workspaces/${currentWorkspaceId.value}/messages`;
            break;
          case 'users':
            endpoint = '/api/v1/search/users';
            break;
          default:
            endpoint = '/api/v1/search/workspaces';
        }
        
        const response = await axios.get(`${process.env.VUE_APP_API_URL}${endpoint}`, {
          params: { q: searchQuery.value.trim() },
          headers: { Authorization: `Bearer ${store.state.auth.token}` }
        });
        
        if (response.data && response.data.data) {
          // Extraire les résultats selon le type de recherche
          if (searchType.value === 'workspaces' && response.data.data.workspaces) {
            searchResults.value = response.data.data.workspaces;
          } else if (searchType.value === 'channels' && response.data.data.canaux) {
            searchResults.value = response.data.data.canaux;
          } else if (searchType.value === 'messages' && response.data.data.messages) {
            searchResults.value = response.data.data.messages;
          } else if (searchType.value === 'users' && response.data.data.users) {
            searchResults.value = response.data.data.users;
          }
        }
      } catch (error) {
        console.error('Erreur lors de la recherche:', error);
        store.commit('setSnackbar', {
          show: true,
          text: error.message || 'Erreur lors de la recherche',
          color: 'error'
        });
      } finally {
        isLoading.value = false;
      }
    };
    
    const clearSearch = () => {
      searchQuery.value = '';
      searchResults.value = [];
      hasSearched.value = false;
    };
    
    const showUserProfile = (userId) => {
      router.push(`/profile/${userId}`);
    };
    
    const getInitials = (user) => {
      if (!user) return '?';
      
      if (user.firstName && user.lastName) {
        return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
      } else if (user.username) {
        return user.username.charAt(0).toUpperCase();
      }
      
      return '?';
    };
    
    const formatDate = (dateString) => {
      if (!dateString) return '';
      
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };
    
    const getStatusColor = (status) => {
      switch (status) {
        case 'en ligne':
          return 'success';
        case 'absent':
          return 'warning';
        case 'ne pas déranger':
          return 'error';
        default:
          return 'grey';
      }
    };
    
    // Réinitialiser la recherche quand on change de workspace
    watch(currentWorkspaceId, () => {
      if (searchType.value === 'channels' || searchType.value === 'messages') {
        clearSearch();
      }
    });
    
    // Réinitialiser les résultats quand on change de type de recherche
    watch(searchType, () => {
      searchResults.value = [];
      hasSearched.value = false;
      
      // Si on sélectionne channels ou messages et qu'aucun workspace n'est sélectionné
      if ((searchType.value === 'channels' || searchType.value === 'messages') && !currentWorkspaceId.value) {
        store.commit('setSnackbar', {
          show: true,
          text: 'Veuillez d\'abord sélectionner un workspace',
          color: 'info'
        });
      }
    });
    
    return {
      searchQuery,
      searchResults,
      isLoading,
      hasSearched,
      showMenu,
      searchType,
      searchTypes,
      currentWorkspaceId,
      performSearch,
      clearSearch,
      showUserProfile,
      getInitials,
      formatDate,
      getStatusColor
    };
  }
});
</script>

<style scoped>
.search-bar {
  width: 100%;
  max-width: 300px;
}

.search-input {
  min-width: 200px;
}

.search-type-select {
  max-width: 150px;
}

.search-results {
  max-height: 400px;
  overflow-y: auto;
}

.message-content {
  white-space: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>
