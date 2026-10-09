import { Customer } from "../model/customer.js";
import { PersonalAccessTokenController } from "./access/PersonalAccessTokenController.js";
import { authController } from "./access/AuthController.js";
import { roleController } from "./access/RoleController.js";

import Util from "../util/Util.js";
import { sender as mailSender } from "../mail/MailSender.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config();

class Controller {

    async find(customerId){
        try {
            const foundCustomer = await Customer.findByPk(customerId);
            
            if (!foundCustomer) {
                const err = new Error("Não há usuário.");
                err.status = 404;
                throw err;
            }
            
            // Remove a senha do objeto retornado
            const { password, ...customerWithoutPassword } = foundCustomer.get({ plain: true });
            return customerWithoutPassword;
            
        } catch (error) {
            if (error.status) throw error;
            const err = new Error("ID inválido.");
            err.status = 500;
            throw err;
        }
    }

    async all(page = 1, size = 10, search = '') {

        page = Math.max(1, parseInt(page, 10) || 1);
        size = Math.max(1, parseInt(size, 10) || 10);
        const where = search ? {
            [Op.or]: [
                { name: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { phone: { [Op.like]: `%${search}%` } }
            ]
        } : {};
        const { rows, count: total } = await Customer.findAndCountAll({
            where,
            attributes: { exclude: ['password'] },
            offset: (page - 1) * size,
            limit: size
        });
        const customer = rows;

		return {
			data: customer,
			total: total,
            quantity: customer.length,
           	totalPages: Math.ceil(total / size)
		};

    }

    async register(name, email, password, phone){
        // Verifica se email já existe
        if (email) {
            const existingCustomer = await Customer.findOne({ where: { email } });
            if (existingCustomer) {
                const err = new Error("Usuário já existe.");
                err.status = 409;
                throw err;
            }
        }

        // Cria hash da senha
        let hash = null;
        if (password) {
            const salt = bcrypt.genSaltSync(10);
            hash = bcrypt.hashSync(password, salt);
        }

        const newCustomer = await Customer.create({
            name: name || null,
            email: email || null,
            phone: phone,
            password: hash,
            status: true,
        });

        // Envia email de boas vindas se foi fornecido email
        if (email) {
            try {
                await mailSender.sendUserWelcomeEmail(email, name);
            } catch (error) {
                console.error('Erro ao enviar email de boas-vindas:', error);
                // Não falha a criação do usuário se o email falhar
            }
        }

        // Remove password antes de retornar
        const { password: savedPassword, ...customerWithoutPassword } = newCustomer.get({ plain: true });
        return customerWithoutPassword;
    }

    async login(email, password, ip, userAgent){
        const foundCustomer = await Customer.findOne({ where: { email } });
        
        if (!foundCustomer) {
            const err = new Error("Usuário não existe.");
            err.status = 401;
            throw err;
        }
        
        if (!bcrypt.compareSync(password, foundCustomer.password)) {
            const err = new Error("A senha é inválida.");
            err.status = 401;
            throw err;
        }

        // Cria JWT sem o password
        const customerData = foundCustomer.get({ plain: true });
        const { password: _, ...customerWithoutPassword } = customerData;

        //gerando o auth ataul..
        const currentAuth = await authController.create(
            customerWithoutPassword.id,
            ip,
            userAgent,
            "customer-login"
        )

        //achar as roles associada ao tipo de usuário (customer) que no caso é "customer-role"
        const role = await roleController.find("customer-role");

        //aqui ele vai criar o objeto "data" a partir do auth ou seja quem será armazenado e acessado em customerRouter é o própio objeto auth
        const encodedJwt = jwt.sign(
        {
            data: currentAuth,
            scope: Array.isArray(role && role.permissions) ? role.permissions : []
        }
        ,process.env.JWT_SECRET, { expiresIn: '168h' });

        return { access_token: encodedJwt };
    }

    async update(customerId, name, phone){
        try {
            const [updatedCount] = await Customer.update(
                { name, phone, updated_at: new Date() },
                { where: { id: customerId } }
            );

            if (updatedCount === 0) {
                const err = new Error("Usuário não existe.");
                err.status = 404;
                throw err;
            }

            return await this.find(customerId);
        } catch (error) {
            if (error.status) throw error;
            const err = new Error("ID inválido.");
            err.status = 500;
            throw err;
        }
    }

    async findByEmail(customerEmail){
        const foundCustomer = await Customer.findOne({ where: { email: customerEmail } });
        
        if (!foundCustomer) {
            const err = new Error("Não há usuário.");
            err.status = 404;
            throw err;
        }
        
        const { password, ...customerWithoutPassword } = foundCustomer.get({ plain: true });
        return customerWithoutPassword;
    }

    async toggleStatus(customerId) {
        try {
            const customer = await Customer.findByPk(customerId);
            
            if (!customer) {
                const err = new Error("Usuário não encontrado.");
                err.status = 404;
                throw err;
            }

            const newStatus = !customer.status;

            await customer.update({ status: newStatus, updated_at: new Date() });

            return { message: `Usuário ${newStatus ? 'ativado' : 'desativado'} com sucesso.` };
        } catch (error) {
            if (error.status) throw error;
            const err = new Error("ID inválido.");
            err.status = 500;
            throw err;
        }
    }

    //enviar email com código para recuperação de senha
    async sendForgotPasswordCode(email) {
        const customer = await Customer.findOne({ where: { email } });
        
        if (!customer) {
            const err = new Error("Usuário não existe.");
            err.status = 404;
            throw err;
        }

        const generatedCode = Util.generateCode(5);
        const secretWord = uuidv4();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1hr

        await PersonalAccessTokenController.register(
            "customer_forgot_password", 
            customer.id, 
            customer.name, 
            secretWord, 
            generatedCode, 
            null, 
            Date.now(), 
            expiresAt
        );

        try {
            await mailSender.sendPasswordResetEmail(customer.email, customer.name, generatedCode);
        } catch (error) {
            console.error('Erro ao enviar email de redefinição de senha:', error);
            const err = new Error('Falha ao enviar email de redefinição de senha');
            err.status = 500;
            throw err;
        }

        return { message: "O código de redefinição de senha foi enviado ao e-mail com sucesso." };
    }

    async changePassword(oldPassword, newPassword, code, secret) {

        const personalAT = await PersonalAccessTokenController.verifyByCode(code);        

        if(personalAT.error){
            const err = new Error(personalAT.error);
            err.status = 500;
            throw err;
        }

        //se o secret for diferente não pode mudar
        if (personalAT.secret !== secret) {
            const err = new Error("Falha na validação de segurança. (SCRT)");
            err.status = 403;
            throw err;
        }

        const customer = await Customer.findByPk(personalAT.tokenable_id);

        if(customer == null){
            const err = new Error("Usuário não existe.");
            err.status = 404;
            throw err;
        }

        if(bcrypt.compareSync(oldPassword, customer.password) == true){

            const salt = bcrypt.genSaltSync(10);
            const hash = bcrypt.hashSync(newPassword, salt);

            await customer.update({ password: hash, updated_at: new Date() });

            //deletar codigo de recuperação antes de retornar para usuario..
            await PersonalAccessTokenController.deleteAllRelated(customer.id);

            return {
                message: "Senha alterada com sucesso."
            };

        }else{
            const err = new Error("A senha antiga é inválida.");
            err.status = 401;
            throw err;
        }

    }

    // envia email com código para mudança de email
    async sendChangeEmailCode(customerId, newEmail) {
        const customer = await Customer.findByPk(customerId);

        if (!customer) {
            const err = new Error("Usuário não existe.");
            err.status = 404;
            throw err;
        }

        // Verifica se o novo email já está em uso
        const emailExists = await Customer.findOne({ where: { email: newEmail } });
        if (emailExists) {
            const err = new Error("Este email já está em uso.");
            err.status = 409;
            throw err;
        }

        const generatedCode = Util.generateCode(5);
        const secretWord = uuidv4();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1hr

        await PersonalAccessTokenController.register(
            "customer_change_email",
            customer.id,
            newEmail,
            secretWord,
            generatedCode,
            null,
            Date.now(),
            expiresAt
        );

        try {
            await mailSender.sendEmailChangeConfirmation(newEmail, customer.name, generatedCode, secretWord);
        } catch (error) {
            console.error('Erro ao enviar email de confirmação de mudança:', error);
            const err = new Error('Falha ao enviar email de confirmação de mudança');
            err.status = 500;
            throw err;
        }

        return { message: "O código de confirmação foi enviado ao novo e-mail com sucesso." };
    }

    // altera o email do usuário após validação
    async changeEmail(currentCustomerId ,email, code, secret) {

        const personalAT = await PersonalAccessTokenController.verifyByCode(code);

        if (personalAT.error) {
            const err = new Error(personalAT.error);
            err.status = 500;
            throw err;
        }

        if (personalAT.secret !== secret) {
            const err = new Error("Falha na validação de segurança. (SCRT)");
            err.status = 403;
            throw err;
        }

        const customer = await Customer.findByPk(personalAT.tokenable_id);

        if (!customer) {
            const err = new Error("Usuário não existe.");
            err.status = 404;
            throw err;
        }
        if (String(customer.id) !== String(currentCustomerId)) {
            const err = new Error("Identity not confirmed.");
            err.status = 403;
            throw err;
        }

        const newEmail = email;

        // Verifica se o novo email já está em uso
        const emailExists = await Customer.findOne({ where: { email: newEmail } });
        if (emailExists) {
            const err = new Error("Este email já está em uso.");
            err.status = 409;
            throw err;
        }

        await customer.update({ email: newEmail, updated_at: new Date() });

        await PersonalAccessTokenController.deleteAllRelated(customer.id);

        return { message: "Email alterado com sucesso." };
    }


}

const CustomerController = new Controller();
export { CustomerController };