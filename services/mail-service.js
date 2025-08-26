const nodemailer = require("nodemailer");

class MailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
            },
        });
    }
    async sendActivationMail(to, link, password) {
        await this.transporter.sendMail({
            from: process.env.SMTP_USER,
            to,
            subject: "Test activation account" + process.env.API_URL,
            text: "",
            html: `
        <div style="font-family: Arial, sans-serif; background-color:#f7f9fc; padding:30px;">
            <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,0.1); padding:30px; text-align:center;">
                
                <h1 style="color:#333; font-size:22px; margin-bottom:20px;">
                    Activate your account
                </h1>

                <p style="font-size:16px; color:#555; margin-bottom:25px;">
                    To activate your account, please click the button below:
                </p>

                <a href="${link}" 
                   style="display:inline-block; background:#4a90e2; color:#fff; text-decoration:none; padding:12px 24px; border-radius:5px; font-size:16px; font-weight:bold; margin-bottom:30px;">
                   Activate Account
                </a>

                <p style="font-size:15px; color:#444; margin-top:20px;">
                    Your login password:
                    <span style="font-weight:bold; color:#e74c3c;">${password}</span>
                </p>

                <hr style="border:none; border-top:1px solid #eee; margin:30px 0;">

                <p style="font-size:12px; color:#999;">
                    If the button doesn't work, copy and paste this link into your browser: <br>
                    <a href="${link}" style="color:#4a90e2; word-break:break-all;">${link}</a>
                </p>
            </div>
        </div>
        `,
        });
    }
}

module.exports = new MailService();
