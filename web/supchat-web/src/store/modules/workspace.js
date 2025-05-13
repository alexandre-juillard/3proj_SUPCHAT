import api from '@/plugins/axios'

const state = {
  workspaces: [],
  currentWorkspace: null
}

const mutations = {
  SET_WORKSPACES(state, workspaces) {
    state.workspaces = workspaces
  },
  SET_CURRENT_WORKSPACE(state, workspace) {
    state.currentWorkspace = workspace
  }
}

const actions = {
  async fetchWorkspaces({ commit }) {
    try {
      const response = await api.get('/workspaces')
      commit('SET_WORKSPACES', response.data.data.workspaces)
      return response.data.data.workspaces
    } catch (error) {
      console.error('Erreur lors de la récupération des workspaces:', error)
      throw error
    }
  },

  async fetchWorkspace({ commit }, workspaceId) {
    try {
      const response = await api.get(`/workspaces/${workspaceId}`)
      const workspace = response.data.data.workspace
      commit('SET_CURRENT_WORKSPACE', workspace)
      return workspace
    } catch (error) {
      console.error('Erreur lors de la récupération du workspace:', error)
      throw error
    }
  },

  async createWorkspace({ dispatch }, workspaceData) {
    try {
      const response = await api.post('/workspaces', workspaceData)
      console.log('Réponse création workspace:', response.data)
      await dispatch('fetchWorkspaces')
      return response.data.data.workspace
    } catch (error) {
      console.error('Erreur lors de la création du workspace:', error)
      throw error
    }
  },

  async inviteUser(_, { workspaceId, email }) {
    try {
      const response = await api.post(`/workspaces/${workspaceId}/inviter`, { email })
      console.log('Réponse invitation:', response.data)
      return response.data.data
    } catch (error) {
      console.error('Erreur lors de l\'invitation:', error)
      throw error
    }
  },

  async verifierInvitation(_, { workspaceId, token, action }) {
    try {
      const response = await api.get(`/workspaces/invitation/${workspaceId}/${token}/${action}`)
      return response.data
    } catch (error) {
      console.error('Erreur lors de la vérification de l\'invitation:', error)
      throw error
    }
  },

  async accepterInvitation(_, { workspaceId, token }) {
    try {
      const response = await api.get(`/workspaces/${workspaceId}/invitations/${token}/accepter`)
      return response.data
    } catch (error) {
      console.error('Erreur lors de l\'acceptation de l\'invitation:', error)
      throw error
    }
  },

  async modifierRoleMembre({ commit }, { workspaceId, membreId, role }) {
    try {
      const response = await api.patch(`/workspaces/${workspaceId}/membres/${membreId}/role`, { role })
      commit('SET_CURRENT_WORKSPACE', response.data.data.workspace)
      return response.data
    } catch (error) {
      console.error('Erreur lors de la modification du rôle:', error)
      throw error
    }
  },

  async updateWorkspace({ commit }, { workspaceId, workspaceData }) {
    try {
      const response = await api.patch(`/workspaces/${workspaceId}`, workspaceData)
      console.log('Réponse mise à jour workspace:', response.data)
      commit('SET_CURRENT_WORKSPACE', response.data.data.workspace)
      return response.data.data.workspace
    } catch (error) {
      console.error('Erreur lors de la mise à jour du workspace:', error)
      throw error
    }
  },

  // Rechercher des workspaces publics
  async searchPublicWorkspaces(_, searchQuery = '') {
    try {
      const response = await api.get(`/workspaces/recherche/public${searchQuery ? `?query=${searchQuery}` : ''}`)
      console.log('Résultats de recherche de workspaces publics:', response.data)
      return response.data.data.workspaces
    } catch (error) {
      console.error('Erreur lors de la recherche de workspaces publics:', error)
      throw error
    }
  }
}

const getters = {
  getWorkspaceById: state => id => state.workspaces.find(w => w._id === id)
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
