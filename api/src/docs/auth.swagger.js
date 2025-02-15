/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - email
 *         - username
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: Email de l'utilisateur
 *         username:
 *           type: string
 *           minLength: 3
 *           maxLength: 30
 *           description: Nom d'utilisateur
 *         password:
 *           type: string
 *           format: password
 *           minLength: 8
 *           description: Mot de passe
 *         firstName:
 *           type: string
 *           description: Prénom
 *         lastName:
 *           type: string
 *           description: Nom
 *
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *     CookieAuth:
 *       type: apiKey
 *       in: cookie
 *       name: jwt
 *
 * @swagger
 * tags:
 *   name: Authentification
 *   description: API d'authentification
 *
 * @swagger
 * /api/v1/auth/inscription:
 *   post:
 *     summary: Inscription d'un nouvel utilisateur
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - confirmPassword
 *               - username
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *               username:
 *                 type: string
 *                 minLength: 3
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Inscription réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         description: Données invalides
 *
 * @swagger
 * /api/v1/auth/connexion:
 *   post:
 *     summary: Connexion d'un utilisateur
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Connexion réussie
 *       401:
 *         description: Email ou mot de passe incorrect
 *
 * @swagger
 * /api/v1/auth/deconnexion:
 *   get:
 *     summary: Déconnexion de l'utilisateur
 *     tags: [Authentification]
 *     responses:
 *       200:
 *         description: Déconnexion réussie
 *
 * @swagger
 * /api/v1/auth/verifier-email/{token}:
 *   get:
 *     summary: Vérification de l'email
 *     tags: [Authentification]
 *     parameters:
 *       - in: path
 *         name: token
 *         schema:
 *           type: string
 *         required: true
 *         description: Token de vérification
 *     responses:
 *       200:
 *         description: Email vérifié avec succès
 *       400:
 *         description: Token invalide ou expiré
 *
 * @swagger
 * /api/v1/auth/mot-de-passe-oublie:
 *   post:
 *     summary: Demande de réinitialisation de mot de passe
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Email de réinitialisation envoyé
 *       404:
 *         description: Email non trouvé
 *
 * @swagger
 * /api/v1/auth/reinitialiser-mot-de-passe/{token}:
 *   patch:
 *     summary: Réinitialisation du mot de passe
 *     tags: [Authentification]
 *     parameters:
 *       - in: path
 *         name: token
 *         schema:
 *           type: string
 *         required: true
 *         description: Token de réinitialisation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Mot de passe réinitialisé avec succès
 *       400:
 *         description: Token invalide ou expiré
 *
 * @swagger
 * /api/v1/auth/mettre-a-jour-mot-de-passe:
 *   patch:
 *     summary: Mise à jour du mot de passe
 *     tags: [Authentification]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Mot de passe mis à jour avec succès
 *       401:
 *         description: Mot de passe actuel incorrect
 *
 * @swagger
 * /api/v1/auth/google:
 *   get:
 *     tags:
 *       - Authentification
 *     summary: Initier l'authentification avec Google
 *     description: |
 *       Redirige l'utilisateur vers la page de connexion Google.
 *       Après une connexion réussie, l'utilisateur sera redirigé vers l'application
 *       avec un token JWT.
 *     responses:
 *       302:
 *         description: Redirection vers Google pour l'authentification
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 * 
 * @swagger
 * /api/v1/auth/google/callback:
 *   get:
 *     tags:
 *       - Authentification
 *     summary: Callback pour l'authentification Google
 *     description: |
 *       Point de terminaison appelé par Google après une authentification réussie.
 *       - Si l'utilisateur n'existe pas, un nouveau compte sera créé
 *       - Si l'utilisateur existe avec le même email, le compte Google sera lié
 *       - Si l'utilisateur est déjà lié à Google, ses tokens seront mis à jour
 *     responses:
 *       302:
 *         description: Redirection vers l'application avec le token JWT
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 * 
 * @swagger
 * /api/v1/auth/microsoft:
 *   get:
 *     tags:
 *       - Authentification
 *     summary: Initier l'authentification avec Microsoft
 *     description: |
 *       Redirige l'utilisateur vers la page de connexion Microsoft.
 *       Après une connexion réussie, l'utilisateur sera redirigé vers l'application
 *       avec un token JWT.
 *     responses:
 *       302:
 *         description: Redirection vers Microsoft pour l'authentification
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 * 
 * @swagger
 * /api/v1/auth/microsoft/callback:
 *   get:
 *     tags:
 *       - Authentification
 *     summary: Callback pour l'authentification Microsoft
 *     description: |
 *       Point de terminaison appelé par Microsoft après une authentification réussie.
 *       - Si l'utilisateur n'existe pas, un nouveau compte sera créé
 *       - Si l'utilisateur existe avec le même email, le compte Microsoft sera lié
 *       - Si l'utilisateur est déjà lié à Microsoft, ses tokens seront mis à jour
 *     responses:
 *       302:
 *         description: Redirection vers l'application avec le token JWT
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * @swagger
 * /api/v1/auth/oauth/{provider}:
 *   delete:
 *     tags:
 *       - Authentification
 *     summary: Délier un compte OAuth
 *     description: |
 *       Permet de délier un compte OAuth (Google, Microsoft, Facebook) de votre compte.
 *       Conditions :
 *       - Vous devez avoir un mot de passe configuré
 *       - Ce ne doit pas être votre seule méthode de connexion
 *       - Le provider doit être actuellement lié à votre compte
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [google, microsoft, facebook]
 *         description: Le provider OAuth à délier
 *     responses:
 *       200:
 *         description: Compte OAuth délié avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Compte Google délié avec succès
 *       400:
 *         description: Erreur de validation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Vous devez configurer un mot de passe avant de délier votre compte Google
 *       401:
 *         description: Non authentifié
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Provider non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Aucun compte Google n'est lié à votre compte
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * @swagger
 * components:
 *   schemas:
 *     OAuthProfile:
 *       type: object
 *       properties:
 *         provider:
 *           type: string
 *           enum: [google, microsoft, facebook]
 *           description: Le provider OAuth
 *         id:
 *           type: string
 *           description: L'identifiant unique du provider
 *         email:
 *           type: string
 *           description: L'email associé au compte OAuth
 *         name:
 *           type: string
 *           description: Le nom complet de l'utilisateur
 *         picture:
 *           type: string
 *           description: L'URL de la photo de profil
 *         lastUsed:
 *           type: string
 *           format: date-time
 *           description: La dernière utilisation de cette méthode de connexion
 */
