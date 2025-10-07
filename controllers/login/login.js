import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import pool from "../../database/conection.js";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN = "6h";

// Funções auxiliares
const validateCredentials = (username, password) => {
  return !username || !password;
};

const generateToken = (userData) => {
  return jwt.sign(userData, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const getUserResponse = (user, token) => ({
  token,
  user: {
    id: user.id,
    username: user.username,
    role: user.role,
    companyId: user.companyId,
    active: user.active,
    status: user.status,
    access: user.access,
    sector: user.sector
  }
});

// Função genérica para autenticação - CORRIGIDA
const authenticateUser = async (req, res, tableName) => {
  const { username, password } = req.body;

  if (validateCredentials(username, password)) {
    return res.status(403).json({ 
      Info: "Acesso negado: username ou senha inválidos!" 
    });
  }

  try {
    const query = `
      SELECT id, username, role, password, companyId AS "companyId", active, status, access, sector
      FROM ${tableName}
      WHERE username = $1
    `;
    
    const { rows } = await pool.query(query, [username]);

    if (rows.length === 0) {
      return res.status(404).json({ 
        Info: "Usuário não encontrado!",
        table: tableName 
      });
    }

    const user = rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ 
        Info: "Usuário ou senha inválidos!",
        table: tableName 
      });
    }

    if (!user.active) {
      return res.status(403).json({ 
        Info: "Usuário inativo!",
        table: tableName 
      });
    }

    const tokenPayload = {
      id: user.id,
      username: user.username,
      role: user.role,
      companyId: user.companyId,  
      active: user.active,
      status: user.status,
      access: user.access,
      sector: user.sector
    };

    const token = generateToken(tokenPayload);
    const response = getUserResponse(user, token);

    console.log(`✅ Login bem-sucedido (${tableName}):`, user.username);

    res.json(response);

  } catch (err) {
    console.error(`Erro ao efetuar login no sistema (${tableName}):`, err);
    
    return res.status(404).json({ 
      Info: "Sistema de autenticação indisponível",
      table: tableName 
    });
  }
};


export const login = async (req, res) => {
  await authenticateUser(req, res, "Employees");
};

export const employeeLogin = async (req, res) => {
  await authenticateUser(req, res, "Contributor");
};