import { Integration } from '../model/integration.js';

class Controller {

    async findByUser(user_id, provider) {
        return Integration.findOne({
            where: { user_id, provider },
            attributes: { exclude: ['credentials', 'metadata'] }
        });
    }

    async findAllByUser(user_id) {
        return Integration.findAll({
            where: { user_id },
            attributes: { exclude: ['credentials', 'metadata'] }
        });
    }

    async findTokenByUser(user_id, provider) {

        const integration = await Integration.findOne({
            where: {
                user_id,
                ...(provider ? { provider } : {})
            }
        });

        if (!integration) return null;

        const credentials = typeof integration.credentials === 'string' ? JSON.parse(integration.credentials) : integration.credentials;

        switch (integration.provider) {
            case 'google':
                return {access: credentials?.access_token ?? null};
            default:
               throw new Error("Necessário declarar o provider", {status: 400});
               
        }

    }

}

const IntegrationController = new Controller();
export { IntegrationController };