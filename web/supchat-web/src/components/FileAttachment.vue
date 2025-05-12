<template>
  <div class="file-attachment" :class="{ 'image-preview': isImage }">
    <!-- Aperçu des images -->
    <div v-if="isImage" class="image-container">
      <img 
        :src="getFileUrl()" 
        :alt="fichier.nom" 
        class="image-attachment"
        @click="openPreview"
      />
      <div class="image-overlay">
        <v-btn
          icon="mdi-download"
          variant="text"
          size="small"
          color="white"
          @click.stop="downloadFile"
          class="overlay-btn"
        ></v-btn>
      </div>
    </div>
    
    <!-- Autres types de fichiers -->
    <v-card v-else class="file-card">
      <div class="file-icon">
        <v-icon :color="fileIconColor" size="large">{{ fileIcon }}</v-icon>
      </div>
      <div class="file-info">
        <div class="file-name">{{ fichier.nom }}</div>
        <div class="file-size">{{ formatFileSize(fichier.taille) }}</div>
      </div>
      <div class="file-actions">
        <v-btn
          icon="mdi-download"
          variant="text"
          size="small"
          @click.stop="downloadFile"
        ></v-btn>
      </div>
    </v-card>
    
    <!-- Dialog pour aperçu des images -->
    <v-dialog v-model="previewDialog" max-width="90%">
      <v-card>
        <v-card-title>
          <span>{{ fichier.nom }}</span>
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" variant="text" @click="previewDialog = false"></v-btn>
        </v-card-title>
        <v-card-text class="text-center">
          <img :src="getFileUrl()" :alt="fichier.nom" class="preview-image" />
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="downloadFile">
            <v-icon left>mdi-download</v-icon>
            Télécharger
          </v-btn>
          <v-spacer></v-spacer>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
export default {
  name: 'FileAttachment',
  
  props: {
    fichier: {
      type: Object,
      required: true,
      validator: (prop) => {
        return prop.nom && prop.type && prop.url && prop.taille !== undefined;
      }
    }
  },
  
  data() {
    return {
      previewDialog: false
    };
  },
  
  computed: {
    isImage() {
      return this.fichier.type.startsWith('image/');
    },
    
    fileIcon() {
      const type = this.fichier.type;
      
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
      const type = this.fichier.type;
      
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
    getFileUrl() {
      const apiURL = process.env.VUE_APP_API_URL || 'http://localhost:3000';
      return `${apiURL}/${this.fichier.url}`;
    },
    
    openPreview() {
      if (this.isImage) {
        this.previewDialog = true;
      }
    },
    
    downloadFile() {
      const fileUrl = this.getFileUrl();
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = this.fichier.nom;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
.file-attachment {
  margin: 8px 0;
  max-width: 100%;
}

.image-preview {
  position: relative;
  display: inline-block;
  max-width: 100%;
}

.image-container {
  position: relative;
  cursor: pointer;
  overflow: hidden;
  border-radius: 8px;
}

.image-attachment {
  max-width: 300px;
  max-height: 200px;
  border-radius: 8px;
  display: block;
}

.image-overlay {
  position: absolute;
  top: 0;
  right: 0;
  padding: 8px;
  display: none;
  background: rgba(0, 0, 0, 0.5);
  border-bottom-left-radius: 8px;
}

.image-container:hover .image-overlay {
  display: block;
}

.file-card {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  background-color: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.05);
  margin-bottom: 8px;
}

.file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.file-size {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.6);
}

.file-actions {
  display: flex;
  align-items: center;
}

.preview-image {
  max-width: 100%;
  max-height: 80vh;
}
</style>
