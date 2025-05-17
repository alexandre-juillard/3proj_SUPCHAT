// Ce fichier contient les classes pour gérer les sons de notification
export class NotificationSound {
  constructor() {
    this.notificationSound = new Audio(require('./notification.mp3'));
    // Utiliser le même son pour les mentions pour éviter les erreurs de compilation
    this.mentionSound = new Audio(require('./notification.mp3'));
    this.muted = false;
  }

  playNotification() {
    if (!this.muted) {
      this.notificationSound.currentTime = 0;
      this.notificationSound.play().catch(error => {
        console.error('Erreur lors de la lecture du son de notification:', error);
      });
    }
  }

  playMention() {
    if (!this.muted) {
      this.mentionSound.currentTime = 0;
      this.mentionSound.play().catch(error => {
        console.error('Erreur lors de la lecture du son de mention:', error);
      });
    }
  }

  mute() {
    this.muted = true;
  }

  unmute() {
    this.muted = false;
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
}

// Créer une instance unique pour toute l'application
export const notificationSound = new NotificationSound();
