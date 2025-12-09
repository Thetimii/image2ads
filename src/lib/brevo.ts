import * as brevo from '@getbrevo/brevo'

const apiInstance = new brevo.TransactionalEmailsApi()

// Configure API key authorization
const apiKey = process.env.brevo_api_key || process.env.BREVO_API_KEY || ''
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey)

export const sendEmail = async ({
    to,
    subject,
    htmlContent,
    textContent,
}: {
    to: { email: string; name?: string }[]
    subject: string
    htmlContent: string
    textContent?: string
}) => {
    if (!apiKey) {
        console.error('BREVO_API_KEY is not set')
        return null
    }

    const sendSmtpEmail = new brevo.SendSmtpEmail()
    sendSmtpEmail.subject = subject
    sendSmtpEmail.htmlContent = htmlContent
    sendSmtpEmail.textContent = textContent || htmlContent.replace(/<[^>]*>?/gm, '')
    sendSmtpEmail.sender = {
        name: 'Image2Ad',
        email: process.env.brevo_sender_email || process.env.BREVO_SENDER_EMAIL || 'noreply@image2ad.com'
    }
    sendSmtpEmail.to = to

    try {
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail)
        console.log('Email sent successfully:', data)
        return data
    } catch (error) {
        console.error('Error sending email:', error)
        throw error
    }
}
