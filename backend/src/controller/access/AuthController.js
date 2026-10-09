import { Auth } from "../../model/access/auth.js";
import { Op } from 'sequelize';

class Controller {

    async find(id) {
        const auth = await Auth.findByPk(id);
        if (!auth) {
            const err = new Error("Não encontrado.");
            err.status = 404;
            throw err;
        }
        return auth;
	}

    async all(page = 1, size = 10, search = '') {

        page = Math.max(1, parseInt(page, 10) || 1);
        size = Math.max(1, parseInt(size, 10) || 10);
        const where = search ? { sub: { [Op.like]: `%${search}%` } } : {};
        const { rows: auth, count: total } = await Auth.findAndCountAll({
            where,
            offset: (page - 1) * size,
            limit: size
        });

        if (auth.length == 0 ) {
            const err = new Error("Não há auths registrados(a).");
            err.status = 404;
            throw err;
        }

        return {
			data: auth,
			total: total,
            quantity: auth.length,
           	totalPages: Math.ceil(total / size)
		};

    }

	async create(sub, ip, userAgent, description) {
        const data = await Auth.create({
            sub: sub,
            ip: ip,
            description: description,
            userAgent: userAgent,
		});
		return data;
	}

    async update(authId, sub,ip, userAgent, description) {

        const updatedData = {
            sub: sub,
            ip: ip,
            userAgent: userAgent,
            description: description
        };
        
        const fieldsToUpdate = Object.entries(updatedData).reduce((acc, [key, value]) => {
            
            if (value !== undefined) {

                acc[key] = value;

            }

            return acc;
        }, {});

        if (Object.keys(fieldsToUpdate).length === 0) {
            console.log("Nenhum campo para atualizar foi fornecido.");
            return await this.find(authId); 
        }

        fieldsToUpdate.updated_at = new Date();
        const [updatedCount] = await Auth.update(fieldsToUpdate, { where: { id: authId } });

        if (updatedCount === 0) {
            const err = new Error("Não encontrado.");
            err.status = 404;
            throw err;
        }

        return await this.find(authId);
    }

	async delete(authId) {
		// Deleta registro
		const deletedCount = await Auth.destroy({ where: { id: authId } });
        if (deletedCount === 0) {
            const err = new Error("Não encontrado.");
            err.status = 404;
            throw err;
        }
        return { message: "Deletado com sucesso." };
	}

}

const authController = new Controller();
export { authController };
