import nodemailer from 'nodemailer'

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  const config = useRuntimeConfig()
  if (!config.smtpHost) return null

  if (!transporter) {
    const port = Number(config.smtpPort) || 587
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port,
      secure: port === 465,
      auth: { user: config.smtpUser, pass: config.smtpPass },
    })
  }
  return transporter
}

function emailShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d0d14; color: #fff; padding: 40px 20px; }
  .container { max-width: 480px; margin: 0 auto; background: #12121e; border-radius: 16px; padding: 32px; }
  h1 { color: #3b82f6; margin: 0 0 16px; font-size: 22px; }
  p { color: #94a3b8; line-height: 1.6; margin: 0 0 16px; }
  .button { display: inline-block; background: #3b82f6; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 8px 0 16px; }
  .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #252c44; color: #64748b; font-size: 12px; }
</style></head>
<body><div class="container"><h1>${title}</h1>${bodyHtml}</div></body></html>`
}

export async function sendVerificationEmail(to: string, username: string, token: string, origin: string): Promise<void> {
  const t = getTransporter()
  const url = `${origin}/verify-email?token=${token}`

  if (!t) {
    console.warn(`[email] SMTP non configuré — lien de vérification pour ${to}: ${url}`)
    return
  }

  await t.sendMail({
    from: `"DLE" <${useRuntimeConfig().smtpUser}>`,
    to,
    subject: 'Confirme ton compte DLE',
    text: `Salut ${username}, confirme ton adresse email en ouvrant ce lien : ${url}\n\nCe lien expire dans 24h.`,
    html: emailShell('Bienvenue sur DLE', `
      <p>Salut ${username}, clique ci-dessous pour confirmer ton adresse email :</p>
      <a href="${url}" class="button">Confirmer mon email</a>
      <p class="footer">Ce lien expire dans 24h.</p>
    `),
  })
}

export async function sendPasswordResetEmail(to: string, username: string, token: string, origin: string): Promise<void> {
  const t = getTransporter()
  const url = `${origin}/reset-password?token=${token}`

  if (!t) {
    console.warn(`[email] SMTP non configuré — lien de reset pour ${to}: ${url}`)
    return
  }

  await t.sendMail({
    from: `"DLE" <${useRuntimeConfig().smtpUser}>`,
    to,
    subject: 'Réinitialise ton mot de passe DLE',
    text: `Salut ${username}, réinitialise ton mot de passe en ouvrant ce lien : ${url}\n\nCe lien expire dans 1h. Ignore cet email si tu n'es pas à l'origine de la demande.`,
    html: emailShell('Réinitialisation du mot de passe', `
      <p>Salut ${username}, clique ci-dessous pour choisir un nouveau mot de passe :</p>
      <a href="${url}" class="button">Réinitialiser mon mot de passe</a>
      <p class="footer">Ce lien expire dans 1h. Ignore cet email si tu n'es pas à l'origine de la demande.</p>
    `),
  })
}
