import jwt from "jsonwebtoken"

const secret = process.env.JWT_SECRET

export const authMiddleware = (req, res, next) => {
    const authHeader = req.headers["authorization"]

    if(!authHeader) {
        return res.status(403).json({ Info: "Token não fornecido" })
    }

    const token =  authHeader.split(' ')[1]

    if(!token){
        return res.status(403).json({ Info: "Token invalido"})
    }

    try{
        const decoded = jwt.verify(token, secret)

        req.user = decoded;
        
        next()
    }catch(err){
        console.error("Erro: Token invalido:", err)
        return res.status(401).json({ Info: "Token invalido ou expirado" })
    }

}