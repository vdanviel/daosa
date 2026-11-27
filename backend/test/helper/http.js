import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { User } from "../../src/model/user.js";
import Env from "../../src/util/Env.js";

function hashPassword(plain) {
    return bcrypt.hashSync(plain, bcrypt.genSaltSync(10));
}

export async function testUser() {
    const [user] = await User.findOrCreate({
        where: { email: "test-user@daosa.test" },
        defaults: {
            name: "Usuário de teste",
            email: "test-user@daosa.test",
            status: "active",
            password: hashPassword("password")
        }
    });

    if (!String(user.password || "").startsWith("$2")) {
        await user.update({ password: hashPassword("password") });
    }

    return user;
}

export async function validJWTUser() {
    const user = await testUser();

    return jwt.sign({
        data: { sub: user.id },
        scope: []
    }, Env.getJwtSecret(), { expiresIn: "168h" });
}