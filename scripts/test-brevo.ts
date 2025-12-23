import * as brevo from '@getbrevo/brevo'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const run = async () => {
    const apiKey = process.env.brevo_api_key || process.env.BREVO_API_KEY
    const senderEmail = process.env.brevo_sender_email || process.env.BREVO_SENDER_EMAIL

    console.log('Testing Brevo Configuration:')
    console.log('Available Env Keys:', Object.keys(process.env).filter(k => k.toLowerCase().includes('brevo')))
    console.log('API Key present:', !!apiKey)
    console.log('Sender Email:', senderEmail)

    if (!apiKey || !senderEmail) {
        console.error('❌ Missing configuration')
        return
    }

    const apiInstance = new brevo.TransactionalEmailsApi()
    apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey)

    const sendSmtpEmail = new brevo.SendSmtpEmail()
    sendSmtpEmail.subject = 'Test Email from Image2Ad'
    sendSmtpEmail.htmlContent = '<html><body><h1>It works!</h1><p>This is a test email to verify your Brevo configuration.</p></body></html>'
    sendSmtpEmail.sender = { name: 'Image2Ad Test', email: senderEmail }
    sendSmtpEmail.to = [{ email: 'tim@image2ad.com', name: 'Tim' }] // Replace with a valid email if needed, or I'll ask user

    try {
        console.log('Attempting to send email...')
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail)
        console.log('✅ Email sent successfully:', data)
    } catch (error) {
        console.error('❌ Error sending email:', error)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((error as any).response) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            console.error('Response body:', (error as any).response.body)
        }
    }
}

run()
