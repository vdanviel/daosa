
import express from "express";
import { __TitleModuleName__Controller } from '../controller/__TitleModuleName__Controller.js';

const __TitleModuleName__Router = express.Router();

__TitleModuleName__Router.get('/:id', async (req, res) => {
	res.send(await __TitleModuleName__Controller.find(req.params.id));
});

export { __TitleModuleName__Router };
