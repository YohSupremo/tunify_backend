const nodemailer = require('nodemailer');

const sendEmail = async (options) => {

    let transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD
        }
    });

    const message = {
        from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        // Use pre-built html if provided, otherwise wrap plain message
        html: options.html || `<p>${options.message}</p>`,
        attachments: options.attachments || []
    };

    await transporter.sendMail(message);

};

module.exports = sendEmail;
