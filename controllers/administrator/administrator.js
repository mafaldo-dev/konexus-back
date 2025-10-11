import pool from "../../database/conection.js";
import bcrypt from "bcrypt";

// Constantes
const ADMIN_ROLE = "Administrador";
const FULL_ACCESS = "Full-access";
const ADMIN_SECTOR = "Administrador";

// Validações auxiliares
const validateCompanyCreationFields = ({ companyName, adminUsername, adminPassword }) => {
  return !companyName || !adminUsername || !adminPassword;
};

// Queries SQL
const COMPANY_QUERIES = {
  INSERT_COMPANY: `
    INSERT INTO Companies (name, logo, icon) 
    VALUES ($1, $2, $3) 
    RETURNING id, name, logo, icon
  `,
  INSERT_ADMIN: `
    INSERT INTO Contributor (username, password, role, companyId, access, sector) 
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, username, role, companyId, access, sector
  `
};

// Respostas padronizadas
const RESPONSES = {
  MISSING_FIELDS: { error: "Todos os campos são obrigatórios." },
  SUCCESS: (company, admin) => ({
    info: "Empresa criada com sucesso e usuário admin adicionado!",
    company,
    admin
  }),
  ERROR: (error) => ({ error: "Erro interno do servidor: " + error })
};

// Função principal
export const createCompanyWhitAdmin = async (companyData) => {
  try {
    // 1. Valida campos obrigatórios
    if (validateCompanyCreationFields(companyData)) {
      return RESPONSES.MISSING_FIELDS;
    }

    // 2. Cria a empresa
    const { rows: companyRows } = await pool.query(
      COMPANY_QUERIES.INSERT_COMPANY,
      [companyData.companyName, companyData.logo, companyData.icon]
    );

    const company = companyRows[0];

    // 3. Criptografa a senha do admin
    const hashedPassword = await bcrypt.hash(companyData.adminPassword, 10);

    // 4. Cria o usuário administrador vinculado à empresa
    const { rows: adminRows } = await pool.query(
      COMPANY_QUERIES.INSERT_ADMIN,
      [
        companyData.adminUsername,
        hashedPassword,
        ADMIN_ROLE,
        company.id,
        FULL_ACCESS,
        ADMIN_SECTOR
      ]
    );

    const admin = adminRows[0];

    // 5. Retorna sucesso
    return RESPONSES.SUCCESS(company, admin);

  } catch (error) {
    console.error("Erro ao criar empresa e admin:", error);
    return RESPONSES.ERROR(error.message);
  }
};
