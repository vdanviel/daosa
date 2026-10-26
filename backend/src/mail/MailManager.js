import nodemailer from 'nodemailer';
import Env from '../util/Env.js';

class MailManager {

    constructor() {
      
        this.transport = {
            sendEmail: true,
            host: Env.getMailHost(),
            port: Env.getMailPort(), //465 to SSL
            secure: false,
            auth: {
                user: Env.getMailUsername(),
                pass: Env.getMailPassword()
            },
        }

        this.from = Env.getMailFromAddress();
        this.fromName = Env.getMailFromName();

    }

    async sendEmail(toEmail, toName, subject, html ) {

        // Create a transport. Replace with your own transport options.
        const transport = nodemailer.createTransport(this.transport);

        const info = await transport.sendMail(
            {
                from: this.fromName, // Header From:
                to: `${toName} <${toEmail}>`, // Header To:
                envelope: {
                from: this.from,
                to: [toEmail]
            },
            html: html,
            subject: subject
            //text: text
        });

        console.log("Envelope used:", info.envelope);

        return info;
    }

}

const manager = new MailManager();

export {manager};