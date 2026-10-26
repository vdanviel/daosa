import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { manager as mailManager } from './MailManager.js';
import Env from '../util/Env.js';

class MailSender {
    
    constructor() {
        this.templatePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'template');
        this.appName = Env.getAppName();
    }

    /**
     * Envia email de boas-vindas para novo usuário
     * @param {string} email - Email do usuário
     * @param {string} name - Nome do usuário
     */
    async sendUserWelcomeEmail(email, name) {
        try {
            const templateFilePath = path.join(this.templatePath, 'welcome.html');
            const content = await fs.promises.readFile(templateFilePath, 'utf8');

            const plainHTML = content.toString()
                .replaceAll("{name}", name || "")
                .replaceAll("{company}", this.appName);
            
            const send = await mailManager.sendEmail(email, name || "", "Bem vindo a " + this.appName + "!", plainHTML);

            console.log(`Email de boas-vindas enviado para: ${email}`);

            return send;
        } catch (error) {
            console.error('Erro ao enviar email de boas-vindas:', error);
            throw error;
        }
    }

    /**
     * Envia email de redefinição de senha
     * @param {string} email - Email do usuário
     * @param {string} name - Nome do usuário
     * @param {string} code - Código de redefinição
     */
    async sendPasswordResetEmail(email, name, code) {
        try {
            const templateFilePath = path.join(this.templatePath, 'forgotPassword.html');
            const content = await fs.promises.readFile(templateFilePath, 'utf8');

            const plainHTML = content.toString().
                replaceAll("{name}", name).
                replace("{code}", code).
                replaceAll("{company}", this.appName);

            const send = await mailManager.sendEmail(email, name, "Redefinição de Senha " + this.appName + "!", plainHTML);

            console.log(`Email de redefinição de senha enviado para: ${email}`);

            return send;
        } catch (error) {
            console.error('Erro ao enviar email de redefinição de senha:', error);
            throw error;
        }
    }

    /**
     * Envia email de confirmação de mudança de email
     * @param {string} newEmail - Novo email do usuário
     * @param {string} name - Nome do usuário
     * @param {string} code - Código de confirmação
     * @param {string} secretWord - Palavra secreta
     */
    async sendEmailChangeConfirmation(newEmail, name, code, secretWord) {
        try {
            const templateFilePath = path.join(this.templatePath, 'changeEmail.html');
            const content = await fs.promises.readFile(templateFilePath, 'utf8');

            const plainHTML = content.toString()
                .replaceAll("{name}", name)
                .replaceAll("{host}", Env.getSpaApplicationUrl())
                .replaceAll("{email}", newEmail)
                .replaceAll("{code}", code)
                .replaceAll("{secret}", secretWord)
                .replaceAll("{company}", this.appName);
            
            const send = await mailManager.sendEmail(newEmail, name, "Confirmação de Mudança de Email " + this.appName + "!",plainHTML);
            console.log(`Email de confirmação de mudança enviado para: ${newEmail}`);

            return send;
        } catch (error) {
            console.error('Erro ao enviar email de confirmação de mudança:', error);
            throw error;
        }
    }
}

// Cria e exporta uma instância única
const sender = new MailSender();

export { sender };
