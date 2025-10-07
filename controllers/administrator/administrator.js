import pool from "../../database/conection.js";
import bcrypt from "bcrypt";

// Constantes
const ADMIN_ROLE = 'Administrador';

// Validações auxiliares
const validateCompanyCreationFields = ({ companyName, adminUsername, adminPassword }) => {
  return !companyName || !adminUsername || !adminPassword;
};

// Queries SQL
const COMPANY_QUERIES = {
  INSERT: `
    INSERT INTO Companies (name)
    VALUES ($1)
    RETURNING *
  `,
  INSERT_ADMIN: `
    INSERT INTO Employees (username, password, role, companyId)
    VALUES ($1, $2, $3, $4)
    RETURNING username, role, companyId
  `
};

// Respostas padronizadas
const RESPONSES = {
  MISSING_FIELDS: { Info: "Todos os campos são obrigatórios." },
  SUCCESS: (company, admin) => ({
    Info: "Empresa criada com sucesso e usuário admin adicionado!",
    company: { id: company.id, name: company.name },
    admin: admin
  }),
  ERROR: { Error: "Erro interno do servidor!" }
};

export const createCompanyWithAdmin = async (req, res) => {
  const { companyName, adminUsername, adminPassword } = req.body;

  if (validateCompanyCreationFields(req.body)) {
    return res.status(400).json(RESPONSES.MISSING_FIELDS);
  }

  try {
    // Criar a empresa
    const companyResult = await pool.query(COMPANY_QUERIES.INSERT, [companyName]);
    const company = companyResult.rows[0];

    // Criar usuário administrador
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const adminValues = [adminUsername, hashedPassword, ADMIN_ROLE, company.id];
    const adminResult = await pool.query(COMPANY_QUERIES.INSERT_ADMIN, adminValues);

    res.status(201).json(RESPONSES.SUCCESS(company, adminResult.rows[0]));

  } catch (err) {
    console.error("Erro ao criar empresa com admin:", err);
    res.status(500).json(RESPONSES.ERROR);
  }
};