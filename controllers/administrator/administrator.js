import pool from "../../database/conection.js";
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// CONSTANTES
// ============================================
const ADMIN_ROLE = "Administrador";
const FULL_ACCESS = "Full-access";
const ADMIN_SECTOR = "Administrador";
const ADMIN_ACTIVE = true;

// ============================================
// QUERIES SQL
// ============================================
const COMPANY_QUERIES = {
  INSERT_COMPANY: `
    INSERT INTO Companies (name, icon)
    VALUES ($1, $2)
    RETURNING id, name, icon;
  `,
  INSERT_ADMIN: `
    INSERT INTO Contributor (username, password, role, companyId, status, active, access, sector)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, username, role, companyId, status, active, access, sector;
  `,
  GET_COMPANY_BY_ID: `
    SELECT id, name, icon, email, phone, cnpj, createdAt, updatedAt
    FROM Companies
    WHERE id = $1;
  `,
  UPDATE_COMPANY: `
    UPDATE Companies
    SET 
      icon = COALESCE($1, icon),
      email = COALESCE($2, email),
      phone = COALESCE($3, phone),
      cnpj = COALESCE($4, cnpj),
      updatedAt = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING id, name, icon, email, phone, cnpj, updatedAt;
  `
};

// ============================================
// VALIDAÇÕES
// ============================================
const validateCompanyCreationFields = ({ companyName, adminUsername, adminPassword }) => {
  return !companyName || !adminUsername || !adminPassword;
};

// ============================================
// RESPOSTAS PADRONIZADAS
// ============================================
const RESPONSES = {
  MISSING_FIELDS: { error: "Todos os campos são obrigatórios." },
  COMPANY_NOT_FOUND: { error: "Empresa não encontrada." },
  VALIDATION_ERROR: (message) => ({ error: message }),
  CREATE_SUCCESS: (company, admin) => ({
    info: "Empresa criada com sucesso e usuário admin adicionado!",
    company,
    admin
  }),
  UPDATE_SUCCESS: (company) => ({
    message: "Empresa atualizada com sucesso!",
    company
  }),
  GET_SUCCESS: (company) => ({
    message: "Empresa encontrada com sucesso!",
    company
  }),
  ERROR: (error) => ({ error: "Erro interno do servidor: " + error })
};

// ============================================
// ENDPOINT: Criar empresa com admin
// ============================================
export const createCompanyWithAdmin = async (req, res) => {
  const client = await pool.connect();

  try {
    const companyData = req.body;

    if (validateCompanyCreationFields(companyData)) {
      return res.status(400).json(RESPONSES.MISSING_FIELDS);
    }

    await client.query("BEGIN");

    // 1. Cria empresa
    const { rows: companyRows } = await client.query(
      COMPANY_QUERIES.INSERT_COMPANY,
      [companyData.companyName, companyData.icon || null]
    );
    const company = companyRows[0];

    // 2. Criptografa senha
    const hashedPassword = await bcrypt.hash(companyData.adminPassword, 10);

    // 3. Cria usuário administrador vinculado à empresa
    const { rows: adminRows } = await client.query(
      COMPANY_QUERIES.INSERT_ADMIN,
      [
        companyData.adminUsername,
        hashedPassword,
        ADMIN_ROLE,
        company.id,
        "active",
        ADMIN_ACTIVE,
        FULL_ACCESS,
        ADMIN_SECTOR
      ]
    );
    const admin = adminRows[0];

    await client.query("COMMIT");

    return res.status(201).json(RESPONSES.CREATE_SUCCESS(company, admin));

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Erro ao criar empresa e admin:", error);
    return res.status(500).json(RESPONSES.ERROR(error.message));
  } finally {
    client.release();
  }
};


export const updateCompany = async (req, res) => {
  const client = await pool.connect();

  try {
    console.log("📥 BODY RECEBIDO:", req.body);
    console.log("📥 PARAMS RECEBIDOS:", req.params);

    const { companyId } = req.params;

    if (!companyId) {
      return res.status(400).json({ error: "Parâmetro 'companyId' é obrigatório." });
    }

    const { email, phone, cnpj } = req.body;

    const uploadedFile = req.file ? req.file.filename : null;
    console.log("📸 Arquivo recebido:", uploadedFile);

    const updates = {};
    if (uploadedFile) updates.icon = uploadedFile;
    if (email?.trim()) updates.email = email.trim();
    if (phone?.trim()) updates.phone = phone.trim();
    if (cnpj?.trim()) updates.cnpj = cnpj.trim();

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "Nenhum campo válido para atualização." });
    }

    await client.query("BEGIN");

    const companyCheck = await client.query(
      `SELECT id FROM Companies WHERE id = $1`,
      [companyId]
    );

    if (companyCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Empresa não encontrada." });
    }

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    setClauses.push(`updatedAt = CURRENT_TIMESTAMP`);
    values.push(companyId);

    const updateQuery = `
      UPDATE Companies
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;

    console.log("🔄 Query:", updateQuery);
    console.log("📊 Valores:", values);

    const updateResult = await client.query(updateQuery, values);
    const updatedCompany = updateResult.rows[0];

    // ✅ CORREÇÃO DO CAMINHO AQUI TAMBÉM
    let iconBase64 = null;
    if (updatedCompany.icon) {
      const iconPath = path.join(__dirname, '../../uploads/logos', updatedCompany.icon); // 👈 2 níveis

      if (fs.existsSync(iconPath)) {
        const buffer = fs.readFileSync(iconPath);
        const ext = path.extname(updatedCompany.icon).replace(".", "");
        iconBase64 = `data:image/${ext};base64,${buffer.toString("base64")}`;
        console.log("✅ Logo convertida para base64 no update");
      } else {
        console.log("❌ Logo não encontrada no update:", iconPath);
      }
    }

    await client.query("COMMIT");

    const appBaseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const logoUrl = updatedCompany.icon
      ? `${appBaseUrl}/uploads/${updatedCompany.icon}`
      : null;

    console.log("✅ Empresa atualizada com sucesso:", updatedCompany);

    return res.status(200).json({
      message: "Empresa atualizada com sucesso!",
      company: {
        ...updatedCompany,
        iconUrl: logoUrl,
        iconBase64,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Erro ao atualizar empresa:", error);
    return res.status(500).json({
      error: "Erro interno do servidor",
      details: error.message,
    });
  } finally {
    client.release();
  }
};

// ============================================
// ENDPOINT: Buscar empresa
// ============================================
export const getCompany = async (req, res) => {
  try {
    // ✅ USA companyId (como está na rota)
    const { companyId } = req.params;

    const { rows } = await pool.query(
      COMPANY_QUERIES.GET_COMPANY_BY_ID,
      [companyId]
    );

    if (rows.length === 0) {
      return res.status(404).json(RESPONSES.COMPANY_NOT_FOUND);
    }

    return res.status(200).json(RESPONSES.GET_SUCCESS(rows[0]));

  } catch (error) {
    console.error("Erro ao buscar empresa:", error);
    return res.status(500).json(RESPONSES.ERROR(error.message));
  }
};