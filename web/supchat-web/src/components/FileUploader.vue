<template>
  <div class="file-uploader">
    <!-- Input file toujours présent dans le DOM mais caché -->
    <input 
      type="file"
      ref="fileInput"
      style="display: none"
      @change="onFileSelected"
    />
    
    <v-dialog v-model="dialog" max-width="500px">
      <template v-slot:activator="{ props }">
        <v-btn
          prepend-icon="mdi-paperclip"
          variant="text"
          density="comfortable"
          v-bind="props"
          @click.stop="openFileSelector"
        >
          Fichier
        </v-btn>
      </template>
      
      <v-card>
        <v-card-title>Téléchargement de fichier</v-card-title>
        <v-card-text>
          <div v-if="filePreview" class="file-preview mb-4">
            <div v-if="isImage" class="image-preview">
              <img :src="filePreview" alt="Aperçu du fichier" class="preview-img" />
            </div>
            <div v-else class="file-info">
              <v-icon size="large" :color="fileIconColor">{{ fileIcon }}</v-icon>
              <div class="file-name">{{ selectedFile.name }}</div>
              <div class="file-size">{{ formatFileSize(selectedFile.size) }}</div>
            </div>
          </div>
          
          <!-- L'input file est maintenant au niveau supérieur du composant -->
          
          <div v-if="!filePreview" class="drop-zone" 
               @dragover.prevent 
               @drop.prevent="onFileDrop"
               @click="openFileSelector">
            <v-icon size="48" color="primary">mdi-cloud-upload</v-icon>
            <div class="text-h6 mb-2">Déposez un fichier ici</div>
            <div class="text-subtitle-1">ou cliquez pour sélectionner</div>
            <div class="text-caption mt-2">Taille maximale: 20 Mo</div>
          </div>
          
          <div v-if="uploadProgress > 0 && uploadProgress < 100" class="progress-container mt-3">
            <v-progress-linear 
              v-model="uploadProgress" 
              color="primary" 
              height="20"
              rounded
            >
              <strong>{{ Math.ceil(uploadProgress) }}%</strong>
            </v-progress-linear>
          </div>
          
          <div v-if="error" class="error-message mt-3">
            <v-alert type="error" variant="tonal" density="compact">{{ error }}</v-alert>
          </div>
        </v-card-text>
        
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn 
            color="error" 
            variant="text" 
            @click="cancelUpload"
            :disabled="uploading"
          >
            Annuler
          </v-btn>
          <v-btn 
            color="primary" 
            @click="uploadFile"
            :loading="uploading"
            :disabled="!selectedFile || uploading"
          >
            Télécharger
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'FileUploader',
  props: {
    targetType: {
      type: String,
      required: true,
      validator: (value) => ['canal', 'conversation'].includes(value)
    },
    targetId: {
      type: String,
      required: true
    },
    messageId: {
      type: String,
      default: null
    },
    onSuccess: {
      type: Function,
      default: () => {}
    }
  },
  data() {
    return {
      dialog: false,
      selectedFile: null,
      filePreview: null,
      uploadProgress: 0,
      uploading: false,
      error: null
    };
  },
  computed: {
    isImage() {
      if (!this.selectedFile) return false;
      return this.selectedFile.type.startsWith('image/');
    },
    fileIcon() {
      if (!this.selectedFile) return 'mdi-file';
      
      const type = this.selectedFile.type;
      if (type.startsWith('image/')) return 'mdi-file-image';
      if (type === 'application/pdf') return 'mdi-file-pdf';
      if (type.includes('word')) return 'mdi-file-word';
      if (type.includes('excel') || type.includes('spreadsheet')) return 'mdi-file-excel';
      if (type.includes('powerpoint') || type.includes('presentation')) return 'mdi-file-powerpoint';
      if (type.includes('zip') || type.includes('rar') || type.includes('compressed')) return 'mdi-zip-box';
      if (type.includes('text/')) return 'mdi-file-document';
      
      return 'mdi-file';
    },
    fileIconColor() {
      if (!this.selectedFile) return 'grey';
      
      const type = this.selectedFile.type;
      if (type.startsWith('image/')) return 'light-blue';
      if (type === 'application/pdf') return 'red';
      if (type.includes('word')) return 'blue';
      if (type.includes('excel') || type.includes('spreadsheet')) return 'green';
      if (type.includes('powerpoint') || type.includes('presentation')) return 'orange';
      if (type.includes('zip') || type.includes('rar')) return 'purple';
      if (type.includes('text/')) return 'grey';
      
      return 'grey';
    }
  },
  methods: {
    openFileSelector() {
      // Vérifier si la référence existe avant d'essayer de l'utiliser
      if (this.$refs.fileInput) {
        // Utiliser setTimeout pour s'assurer que l'exécution est décalée après le cycle de rendu Vue
        setTimeout(() => {
          this.$refs.fileInput.click();
        }, 0);
      } else {
        console.warn('Référence fileInput non disponible');
      }
    },
    
    onFileSelected(event) {
      const file = event.target.files[0];
      this.processFile(file);
    },
    
    onFileDrop(event) {
      const file = event.dataTransfer.files[0];
      this.processFile(file);
    },
    
    processFile(file) {
      if (!file) return;
      
      // Vérifier la taille du fichier (max 20 Mo)
      if (file.size > 20 * 1024 * 1024) {
        this.error = 'Le fichier est trop volumineux (max: 20 Mo)';
        return;
      }
      
      this.error = null;
      this.selectedFile = file;
      
      // Afficher des informations de débogage sur le fichier
      console.log('Fichier sélectionné:', {
        nom: file.name,
        type: file.type,
        taille: file.size,
        derniere_modification: new Date(file.lastModified)
      });
      
      // Créer un aperçu du fichier
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.filePreview = e.target.result;
        };
        reader.readAsDataURL(file);
      } else {
        this.filePreview = 'non-image';
      }
    },
    
    async uploadFile() {
      if (!this.selectedFile) return;
      
      this.uploading = true;
      this.error = null;
      
      const formData = new FormData();
      formData.append('fichier', this.selectedFile);
      
      if (this.messageId) {
        formData.append('messageId', this.messageId);
      }
      
      // URL de l'API en fonction du type de cible (canal ou conversation)
      const API_URL = process.env.VUE_APP_API_URL || 'http://localhost:3000';
      const apiURL = `${API_URL}/api/v1/fichiers/${this.targetType}/${this.targetId}`;
      
      try {
        const response = await axios.post(apiURL, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          onUploadProgress: (progressEvent) => {
            this.uploadProgress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
          }
        });
        
        // Succès
        this.dialog = false;
        this.onSuccess(response.data.data);
        
        // Réinitialiser
        this.resetUploader();
      } catch (error) {
        console.error('Erreur lors du téléchargement du fichier:', error);
        this.error = error.response?.data?.message || 'Erreur lors du téléchargement';
      } finally {
        this.uploading = false;
      }
    },
    
    cancelUpload() {
      this.dialog = false;
      this.resetUploader();
    },
    
    resetUploader() {
      this.selectedFile = null;
      this.filePreview = null;
      this.uploadProgress = 0;
      this.error = null;
      
      // Réinitialiser l'input file
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = '';
      }
    },
    
    formatFileSize(bytes) {
      if (bytes < 1024) return bytes + ' octets';
      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' Ko';
      return (bytes / 1048576).toFixed(1) + ' Mo';
    }
  }
};
</script>

<style scoped>
.file-uploader {
  display: inline-block;
}

.drop-zone {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 30px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.drop-zone:hover {
  border-color: #1976d2;
  background-color: rgba(25, 118, 210, 0.05);
}

.file-preview {
  padding: 20px;
  text-align: center;
  border-radius: 8px;
  background-color: rgba(0, 0, 0, 0.02);
}

.image-preview {
  text-align: center;
}

.preview-img {
  max-width: 100%;
  max-height: 250px;
  border-radius: 4px;
}

.file-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
}

.file-name {
  margin-top: 8px;
  font-weight: bold;
  word-break: break-all;
}

.file-size {
  color: rgba(0, 0, 0, 0.6);
  margin-top: 4px;
}

.progress-container {
  margin-top: 16px;
}
</style>
