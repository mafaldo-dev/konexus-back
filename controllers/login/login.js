import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import pool from "../../database/conection.js";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN = "6h";

// =============================================
// LÓGICA EXCLUSIVA PARA ADMINISTRADOR DO SISTEMA
// =============================================
export const login = async (req, res) => {
  const { username, password } = req.body;

  // Validação básica
  if (!username || !password) {
    return res.status(403).json({ Info: "Acesso negado: username ou senha inválidos!" });
  }

  try {
    // Query SIMPLES - apenas os campos que existem na tabela Administrator
    const query = `
      SELECT id, username, password 
      FROM Administrator 
      WHERE username = $1
    `;
    
    const { rows } = await pool.query(query, [username]);

    if (rows.length === 0) {
      return res.status(404).json({ Info: "Administrador não encontrado!" });
    }

    const admin = rows[0];

    // Verifica senha DIRECTAMENTE (sem bcrypt)
    if (password !== admin.password) {
      return res.status(401).json({ Info: "Usuário ou senha inválidos!" });
    }

    // Payload do token - APENAS dados do administrador
    const tokenPayload = {
      id: admin.id,
      username: admin.username,
      role: "Administrator", // Fixo para administradores
      userType: "Administrator"
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    
    // Resposta SIMPLES
    const response = {
      token,
      user: {
        id: admin.id,
        username: admin.username,
        role: "Administrator",
        userType: "Administrator"
      }
    };

    console.log("✅ Login ADMIN bem-sucedido:", admin.username);
    res.json(response);

  } catch (err) {
    console.error("Erro ao efetuar login do Administrator:", err);
    return res.status(500).json({ Info: "Sistema de autenticação indisponível" });
  }
};

// =============================================
// LÓGICA EXCLUSIVA PARA COLABORADORES (EMPRESAS)
// =============================================
export const employeeLogin = async (req, res) => {
  const { username, password } = req.body;

  // Validação básica
  if (!username || !password) {
    return res.status(403).json({ Info: "Acesso negado: username ou senha inválidos!" });
  }

  try {
    // ✅ QUERY COM JOIN - buscando dados da empresa também
    const query = `
      SELECT 
        c.id, 
        c.username, 
        c.password, 
        c.role, 
        c.companyId AS "companyId", 
        c.active, 
        c.status, 
        c.access, 
        c.sector,
        comp.name AS "companyName",
        comp.icon AS "companyIcon"
      FROM Contributor c
      LEFT JOIN companies comp ON c.companyId = comp.id
      WHERE c.username = $1
    `;
    
    const { rows } = await pool.query(query, [username]);

    if (rows.length === 0) {
      return res.status(404).json({ Info: "Colaborador não encontrado!" });
    }

    const employee = rows[0];

    // Verifica senha
    const validPassword = await bcrypt.compare(password, employee.password);
    if (!validPassword) {
      return res.status(401).json({ Info: "Usuário ou senha inválidos!" });
    }

    // Verifica se está ativo
    if (!employee.active) {
      return res.status(403).json({ Info: "Colaborador inativo!" });
    }

    // Payload do token - TODOS os dados do colaborador
    const tokenPayload = {
      id: employee.id,
      username: employee.username,
      role: employee.role,
      companyId: employee.companyId,
      active: employee.active,
      status: employee.status,
      access: employee.access,
      sector: employee.sector,
      userType: "Contributor"
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    
    // ✅ RESPOSTA COMPLETA COM DADOS DA EMPRESA
    const response = {
      token,
      user: {
        id: employee.id,
        username: employee.username,
        role: employee.role,
        companyId: employee.companyId,
        active: employee.active,
        status: employee.status,
        access: employee.access,
        sector: employee.sector,
        userType: "Contributor",
        // ✅ DADOS DA EMPRESA AGREGADOS
        companyName: employee.companyName,
        companyIcon: employee.companyIcon  // base64 puro
      }
    };

    console.log("✅ Login COLABORADOR bem-sucedido:", employee.username);
    res.json(response);

  } catch (err) {
    console.error("Erro ao efetuar login do Colaborador:", err);
    return res.status(500).json({ Info: "Sistema de autenticação indisponível" });
  }
};