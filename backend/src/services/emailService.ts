// @ts-nocheck
import nodemailer from 'nodemailer';

// Configuration du transporteur SMTP
const smtpPort = parseInt(process.env.SMTP_PORT) || 587;
const isSecure = smtpPort === 465; // SSL direct uniquement sur port 465

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: isSecure,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false // Accepter les certificats auto-signés OVH
  }
});

// Vérifier la connexion au démarrage seulement si SMTP est configuré
if (process.env.SMTP_HOST) {
  transporter.verify((error) => {
    if (error) {
      console.error('Email service error:', error.message);
    } else {
      console.log('Email service ready');
    }
  });
}

/**
 * Envoyer un email de vérification
 */
export async function sendVerificationEmail(to: string, username: string, verificationToken: string): Promise<boolean> {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

  const mailOptions = {
    from: `"Mangadle" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Confirme ton compte Mangadle',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a2e; color: #fff; padding: 40px 20px; }
          .container { max-width: 500px; margin: 0 auto; background: #16213e; border-radius: 16px; padding: 32px; }
          h1 { color: #3b82f6; margin: 0 0 16px 0; font-size: 24px; }
          p { color: #94a3b8; line-height: 1.6; margin: 0 0 16px 0; }
          .button { display: inline-block; background: #3b82f6; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 16px 0; }
          .button:hover { background: #2563eb; }
          .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #334155; color: #64748b; font-size: 12px; }
          .code { background: #0f0f23; padding: 12px 16px; border-radius: 8px; font-family: monospace; color: #3b82f6; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Bienvenue sur Mangadle, ${username} !</h1>
          <p>Merci de t'être inscrit. Clique sur le bouton ci-dessous pour confirmer ton adresse email :</p>
          <a href="${verificationUrl}" class="button">Confirmer mon email</a>
          <p>Ou copie ce lien dans ton navigateur :</p>
          <div class="code">${verificationUrl}</div>
          <p class="footer">Ce lien expire dans 24 heures. Si tu n'as pas créé de compte sur Mangadle, ignore cet email.</p>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return false;
  }
}

/**
 * Envoyer un email de réinitialisation de mot de passe
 */
export async function sendPasswordResetEmail(to: string, username: string, resetToken: string): Promise<boolean> {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: `"Mangadle" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Réinitialise ton mot de passe Mangadle',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a2e; color: #fff; padding: 40px 20px; }
          .container { max-width: 500px; margin: 0 auto; background: #16213e; border-radius: 16px; padding: 32px; }
          h1 { color: #3b82f6; margin: 0 0 16px 0; font-size: 24px; }
          p { color: #94a3b8; line-height: 1.6; margin: 0 0 16px 0; }
          .button { display: inline-block; background: #3b82f6; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 16px 0; }
          .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #334155; color: #64748b; font-size: 12px; }
          .code { background: #0f0f23; padding: 12px 16px; border-radius: 8px; font-family: monospace; color: #3b82f6; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Réinitialisation du mot de passe</h1>
          <p>Salut ${username}, tu as demandé à réinitialiser ton mot de passe. Clique sur le bouton ci-dessous :</p>
          <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
          <p>Ou copie ce lien dans ton navigateur :</p>
          <div class="code">${resetUrl}</div>
          <p class="footer">Ce lien expire dans 1 heure. Si tu n'as pas demandé cette réinitialisation, ignore cet email.</p>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return false;
  }
}

