import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { User } from "../../src/model/user.js";
import Env from "../../src/util/Env.js";

export const TEST_PASSWORD = "password";

// O UserController guarda/compara senha com bcrypt (igual ao register), então a
// linha de teste precisa ter o hash — texto puro faria o login cair em 401.
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
            password: hashPassword(TEST_PASSWORD)
        }
    });

    // Corrige linhas antigas criadas em texto puro para não travar o login.
    if (!String(user.password || "").startsWith("$2")) {
        await user.update({ password: hashPassword(TEST_PASSWORD) });
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