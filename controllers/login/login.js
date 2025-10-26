import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import pool from "../../database/conection.js";
import dotenv from "dotenv";

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: "../.env" });

const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN = "6h";

// =============================================
// LÓGICA EXCLUSIVA PARA ADMINISTRADOR DO SISTEMA
// =============================================
export const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(403).json({ Info: "Acesso negado: username ou senha inválidos!" });
  }

  try {

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

    if (password !== admin.password) {
      return res.status(401).json({ Info: "Usuário ou senha inválidos!" });
    }

    const tokenPayload = {
      id: admin.id,
      username: admin.username,
      role: "Administrator",
      userType: "Administrator"
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    const response = {
      token,
      user: {
        id: admin.id,
        username: admin.username,
        role: "Administrator",
        userType: "Administrator"
      }
    };
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

  if (!username || !password) {
    return res.status(403).json({ Info: "Acesso negado: username ou senha inválidos!" });
  }

  try {
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
        comp.icon AS "companyIcon",
        comp.email AS "companyEmail",
        comp.phone AS "companyPhone",
        comp.cnpj AS "companyCnpj"
      FROM Contributor c
      LEFT JOIN companies comp ON c.companyId = comp.id
      WHERE c.username = $1
    `;
    
    const { rows } = await pool.query(query, [username]);

    if (rows.length === 0) {
      return res.status(404).json({ Info: "Colaborador não encontrado!" });
    }

    const employee = rows[0];

    const validPassword = await bcrypt.compare(password, employee.password);
    if (!validPassword) {
      return res.status(401).json({ Info: "Usuário ou senha inválidos!" });
    }

    if (!employee.active) {
      return res.status(403).json({ Info: "Colaborador inativo!" });
    }

    let companyIconBase64 = null;
    let companyIconUrl = null;

    if (employee.companyIcon) {
      // Caminho absoluto seguro (funciona local e no container)
      const uploadsDir = path.resolve(process.cwd(), "uploads", "logos");
      const logoPath = path.join(uploadsDir, employee.companyIcon);

      console.log("🧩 Caminho do logo:", logoPath);
      console.log("📂 Diretório atual:", process.cwd());
      console.log("📦 __dirname:", __dirname);

      if (fs.existsSync(logoPath)) {
        try {
          const buffer = fs.readFileSync(logoPath);
          const ext = path.extname(employee.companyIcon).toLowerCase().replace(".", "") || "png";
          companyIconBase64 = `data:image/${ext};base64,${buffer.toString("base64")}`;
          
          const appBaseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
          companyIconUrl = `${appBaseUrl}/uploads/logos/${employee.companyIcon}`;
        } catch (fileError) {
          console.error("❌ Erro ao converter logo:", fileError);
        }
      } else {
        console.warn("🚫 Logo não encontrada em:", logoPath);
        try {
          const files = fs.readdirSync(uploadsDir);
          console.log("📁 Arquivos disponíveis:", files);
        } catch {
          console.error("❌ Diretório de uploads/logos não encontrado!");
        }
      }
    }

    const tokenPayload = {
      id: employee.id,
      username: employee.username,
      role: employee.role,
      companyId: employee.companyId,
      active: employee.active,
      status: employee.status,
      access: employee.access,
      sector: employee.sector,
      userType: "Contributor",
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    
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
        
        companyName: employee.companyName,
        companyIcon: companyIconBase64,
        companyIconUrl: companyIconUrl,
        companyEmail: employee.companyEmail,
        companyPhone: employee.companyPhone,
        companyCnpj: employee.companyCnpj
      }
    };

    res.json(response);

  } catch (err) {
    console.error("Erro ao efetuar login do Colaborador:", err);
    return res.status(500).json({ Info: "Sistema de autenticação indisponível" });
  }
};
