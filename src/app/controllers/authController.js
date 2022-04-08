const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const authConfig = require('../../config/auth.json');
const sendgridInfo = require('../../config/sendgrid.json');
const User = require('../models/users');
const sgMail = require("@sendgrid/mail");
const router = express.Router();

function generateToken(params = {}) {
    return jwt.sign(params, authConfig.secret, {expiresIn: 86400});
}

router.post('/register', async (req, res) => {
    const {email} = req.body;
    try {
        if (await User.findOne({email})) {
            return res.status(400).send({error: 'Usuario ja existe'});
        }

        const user = await User.create(req.body);

        user.password = undefined;

        return res.send({user, token: generateToken({id: user.id})});
    } catch (err) {
        return res.status(400).send({error: 'Falha no registro'});
    }
});

router.post('/authenticate', async (req, res) => {
    const {email, password} = req.body;

    const user = await User.findOne({email}).select('+password');

    if (!user) {
        return res.status(400).send({error: 'usuario não encontrado'});
    }

    if (!await bcrypt.compare(password, user.password)) {
        return res.status(400).send({error: 'Senha invalida'});
    }
    user.password = undefined;

    return res.send({user, token: generateToken({id: user.id})});
});

router.post('/forgot_password', async (req, res) => {
    const {email} = req.body;
    try {
        const user = await User.findOne({email});

        if (!user) {
            return res.status(400).send({error: 'Usuario nao encontrado'});
        }

        const token = crypto.randomBytes(20).toString('hex');
        const now = new Date();

        now.setHours(now.getHours() + 1);

        await User.findByIdAndUpdate(user.id, {
            '$set': {
                passwordResetToken: token,
                passwordResetExpires: now
            }
        })

        sgMail.setApiKey(sendgridInfo.SENDGRID_API_KEY);

        const msg = {
            to: email, // Change to your recipient
            from: sendgridInfo.FROM, // Change to your verified sender
            subject: 'Vibranium - Recuperação de senha!',
            text: 'Recover Password',
            html: `<a href="https://vibranium-alunos.parcas.com.br?=${token}">Clique aqui para trocar sua senha</a>`,
        }

        sgMail.send(msg)
            .then(() => {
                return res.status(200).send({sucess: 'Email enviado'});
            })
            .catch((error) => {
                return res.status(400).send({error: error});
            })

    } catch (err) {
        return res.status(400).send({error: 'Erro interno'});
    }
});

router.post('/reset_password', async (req, res) => {
    const {email, token, password} = req.body;

    try {
        const user = await User.findOne({email}).select('+passwordResetToken passwordResetExpires');

        if (!user) {
            return res.status(400).send({error: 'Email not found'});
        }

        if (token !== user.passwordResetToken) {
            return res.status(400).send({error: 'Token invalido'});
        }

        const now = new Date();
        if (now > user.passwordResetExpires) {
            return res.status(400).send({error: 'Token Expirou'});
        }

        user.password = password;

        await user.save();

        return res.status(200).send({sucess: 'Atualizado com sucesso'});

    } catch (err) {
        return res.status(400).send({error: 'Não foi possivel resetar a senha no momento'});
    }

});

module.exports = app => app.use('/auth', router);
