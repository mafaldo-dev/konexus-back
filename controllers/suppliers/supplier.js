import pool from "../../database/conection.js";

// ====================== HELPERS ====================== //

const validateSupplierFields = (body) => {
  const { name, code, trading_name, email, phone, national_register_code, active } = body;
  return !name || !code || !trading_name || !email || !phone || !national_register_code || active === undefined;
};

const hasNoFieldsToUpdate = (body) => {
  const { name, code, trading_name, email, phone, national_register_code, active } = body;
  return [name, code, trading_name, email, phone, national_register_code, active]
    .every(field => field === undefined);
};

const buildUpdateValues = (updateFields, existingSupplier) => {
  const { name, code, trading_name, email, phone, national_register_code, active } = updateFields;
  return [
    name ?? existingSupplier.name,
    code ?? existingSupplier.code,
    trading_name ?? existingSupplier.trading_name,
    email ?? existingSupplier.email,
    phone ?? existingSupplier.phone,
    national_register_code ?? existingSupplier.national_register_code,
    active ?? existingSupplier.active
  ];
};

// ====================== QUERIES ====================== //

const SUPPLIER_QUERIES = {
  CHECK_CODE: `SELECT code FROM Suppliers WHERE code=$1 AND companyId=$2`,
  INSERT: `INSERT INTO Suppliers 
            (name, code, trading_name, email, phone, national_register_code, active, companyId)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
  SELECT_ALL: `SELECT * FROM Suppliers WHERE companyId=$1`,
  SELECT_BY_ID: `SELECT * FROM Suppliers WHERE id=$1 AND companyId=$2`,
  UPDATE: `UPDATE Suppliers
           SET name=$1, code=$2, trading_name=$3, email=$4, phone=$5, national_register_code=$6, active=$7
           WHERE id=$8 AND companyId=$9
           RETURNING *`,
  DELETE: `DELETE FROM Suppliers WHERE id=$1 AND companyId=$2`
};

// ====================== CONTROLLERS ====================== //

//----------- POST ----------//
export const insertSupplier = async (req, res) => {
  if (validateSupplierFields(req.body)) {
    return res.status(400).json({ Info: "Todos os campos são obrigatórios!" });
  }

  const { name, code, trading_name, email, phone, national_register_code, active } = req.body;

  try {
    await pool.query('BEGIN');

    const checkResult = await pool.query(SUPPLIER_QUERIES.CHECK_CODE, [code, req.user.companyId]);
    if (checkResult.rows.length) {
      await pool.query('ROLLBACK');
      return res.status(409).json({ Info: "Código de fornecedor já cadastrado" });
    }

    const values = [name, code, trading_name, email, phone, national_register_code, active, req.user.companyId];
    const insertResult = await pool.query(SUPPLIER_QUERIES.INSERT, values);

    await pool.query('COMMIT');

    res.status(201).json({ Info: "Fornecedor cadastrado com sucesso.", supplier: insertResult.rows[0] });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error("Erro ao adicionar fornecedor:", err);
    res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};

//----------- GET ALL ----------//
export const handleAllSuppliers = async (req, res) => {
  try {
    const result = await pool.query(SUPPLIER_QUERIES.SELECT_ALL, [req.user.companyId]);
    res.status(200).json({ Info: "Lista de fornecedores atualizada", suppliers: result.rows });
  } catch (err) {
    console.error("Erro ao recuperar fornecedores:", err);
    res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};

//----------- GET BY ID ----------//
export const getSupplierById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(SUPPLIER_QUERIES.SELECT_BY_ID, [id, req.user.companyId]);
    if (!result.rows.length) return res.status(404).json({ Info: "Fornecedor não encontrado" });

    res.status(200).json({ Info: "Fornecedor encontrado", supplier: result.rows[0] });
  } catch (err) {
    console.error("Erro ao buscar fornecedor:", err);
    res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};

//----------- UPDATE ----------//
export const updateSupplier = async (req, res) => {
  const { id } = req.params;

  if (hasNoFieldsToUpdate(req.body)) {
    return res.status(400).json({ Info: "É necessário enviar pelo menos um campo para atualizar!" });
  }

  try {
    await pool.query('BEGIN');

    const existingSupplier = await pool.query(SUPPLIER_QUERIES.SELECT_BY_ID, [id, req.user.companyId]);
    if (!existingSupplier.rows.length) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ Info: "Fornecedor não encontrado" });
    }

    const updateValues = [...buildUpdateValues(req.body, existingSupplier.rows[0]), id, req.user.companyId];
    const result = await pool.query(SUPPLIER_QUERIES.UPDATE, updateValues);

    await pool.query('COMMIT');

    res.status(200).json({ Info: "Fornecedor atualizado com sucesso!", supplier: result.rows[0] });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error("Erro ao atualizar fornecedor:", err);
    res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};

//----------- DELETE ----------//
export const deleteSupplier = async (req, res) => {
  const { id } = req.params;

  if (!id) return res.status(400).json({ Alert: "Informe o ID do fornecedor!" });

  try {
    await pool.query('BEGIN');

    const result = await pool.query(SUPPLIER_QUERIES.DELETE, [id, req.user.companyId]);

    await pool.query('COMMIT');

    if (result.rowCount) {
      res.status(200).json({ Info: "Fornecedor removido com sucesso!", result: result.rowCount });
    } else {
      res.status(404).json({ Info: "Fornecedor não encontrado" });
    }

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error("Erro ao deletar fornecedor:", err);
    res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};
