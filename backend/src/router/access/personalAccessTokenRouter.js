import express from "express";
import { validationResult, param } from "express-validator";
import { PersonalAccessTokenController } from "../../controller/access/PersonalAccessTokenController.js";

const personalAccessTokenRouter = express.Router();

//verifica se token exists
personalAccessTokenRouter.get('/code/verify/:code',[
    param('code').exists().withMessage("O código é obrigatório.").notEmpty().withMessage("O código não pode estar vazio.")
], (req, res, next) => {
    

    const validate = validationResult(req);

    if (validate.isEmpty() == false) {
        return res.status(500).send({
            missing: validate.array()
        });
    }

    PersonalAccessTokenController.verifyByCode(req.params.code).then((token) => {

        return res.send(token);

    }).catch(next);

});

//verifica se token existe pelo secret dele
personalAccessTokenRouter.get('/secret/verify/:secret',[
    param('secret').exists().withMessage("O código é obrigatório.").notEmpty().withMessage("O código não pode estar vazio.")
], (req, res, next) => {
    

    const validate = validationResult(req);

    if (validate.isEmpty() == false) {
        return res.status(500).send({
            missing: validate.array()
        });
    }

    PersonalAccessTokenController.verifyBySecret(req.params.secret).then((token) => {

        return res.send(token);

    }).catch(next);

});

export {personalAccessTokenRouter}