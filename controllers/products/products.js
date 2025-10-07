import pool from "../../database/conection.js";

// ====================== HELPERS ====================== //

const validateRequiredFields = (body) => {
  const { name, code, price, coast, stock, description, location, minimum_stock, brand, supplier_id, category } = body;
  return !name || !code || !price || !coast || !stock || !description || 
         !location || !minimum_stock || !brand || !supplier_id || !category;
};

const hasNoFieldsToUpdate = (body) => {
  const { name, description, code, price, coast, stock } = body;
  return [name, description, code, price, coast, stock].every(field => field === undefined);
};

const buildUpdateValues = (updateFields, existingProduct) => {
  const { name, description, code, price, coast, stock } = updateFields;
  return [
    name ?? existingProduct.name,
    description ?? existingProduct.description,
    code ?? existingProduct.code,
    price ?? existingProduct.price,
    coast ?? existingProduct.coast,
    stock ?? existingProduct.stock
  ];
};

// ====================== CONTROLLER ====================== //

//----------- POST ----------//
export const insertProduct = async (req, res) => {
  if (validateRequiredFields(req.body)) {
    return res.status(400).json({ Info: "Todos os campos são obrigatórios!" });
  }

  const { name, code, price, coast, stock, description, location, minimum_stock, brand, supplier_id, category } = req.body;

  try {
    await pool.query('BEGIN');

    const query = `
      WITH inserted AS (
        INSERT INTO Products 
          (name, code, price, coast, stock, description, location, minimum_stock, brand, supplier_id, category, companyId) 
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *
      )
      SELECT i.*, s.name AS supplier_name
      FROM inserted i
      JOIN Suppliers s ON i.supplier_id = s.id;
    `;

    const values = [name, code, price, coast, stock, description, location, minimum_stock, brand, supplier_id, category, req.user.companyId];
    const response = await pool.query(query, values);

    await pool.query('COMMIT');

    return res.status(201).json({
      Info: "Sucesso! Produto adicionado com sucesso.",
      product: response.rows[0]
    });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error("Erro ao adicionar produto:", err);
    return res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};

//----------- GET ALL ----------//
export const handleAllProducts = async (req, res) => {
  try {
    const query = `SELECT p.*, s.name as supplier_name FROM Products p LEFT JOIN Suppliers s ON p.supplier_id = s.id WHERE p.companyId=$1`;
    const values = [req.user.companyId];
    const response = await pool.query(query, values);

    res.status(200).json({
      Info: "Lista de produtos atualizada",
      products: response.rows
    });

  } catch (err) {
    console.error("Erro ao recuperar lista de produtos:", err);
    res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};

//----------- GET BY ID ----------//
export const getProductById = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT p.*, s.name as supplier_name 
      FROM Products p
      LEFT JOIN Suppliers s ON p.supplier_id = s.id
      WHERE p.id=$1 AND p.companyId=$2
    `;
    const result = await pool.query(query, [id, req.user.companyId]);

    if (!result.rows.length) return res.status(404).json({ Info: "Produto não encontrado!" });

    res.status(200).json({ product: result.rows[0] });

  } catch (err) {
    console.error("Erro ao buscar produto:", err);
    res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};

//----------- UPDATE ----------//
export const updateProduct = async (req, res) => {
  const { id } = req.params;

  if (hasNoFieldsToUpdate(req.body)) {
    return res.status(400).json({ Info: "É necessário enviar pelo menos um campo para atualizar!" });
  }

  try {
    await pool.query('BEGIN');

    const productResult = await pool.query(
      'SELECT * FROM Products WHERE id=$1 AND companyId=$2',
      [id, req.user.companyId]
    );
    if (!productResult.rows.length) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ Info: "Nenhum produto encontrado!" });
    }

    const updateQuery = `
      UPDATE Products
      SET name=$1, description=$2, code=$3, price=$4, coast=$5, stock=$6
      WHERE id=$7 AND companyId=$8
      RETURNING *
    `;
    const updateValues = [...buildUpdateValues(req.body, productResult.rows[0]), id, req.user.companyId];
    const response = await pool.query(updateQuery, updateValues);

    await pool.query('COMMIT');

    res.status(200).json({ Info: "Informações atualizadas com sucesso!", product: response.rows[0] });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error("Erro ao atualizar produto:", err);
    res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};

//----------- DELETE ----------//
export const deleteProduct = async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ Alert: "Informe o ID do produto!" });

  try {
    await pool.query('BEGIN');

    const result = await pool.query(
      'DELETE FROM Products WHERE id=$1 AND companyId=$2',
      [id, req.user.companyId]
    );

    await pool.query('COMMIT');

    if (result.rowCount) {
      res.status(200).json({ Info: "Produto apagado da base de dados.", result: result.rowCount });
    } else {
      res.status(404).json({ Info: "Produto não encontrado ou não pertence à empresa." });
    }

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error("Erro ao deletar produto:", err);
    res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};

//----------- UPDATE STOCK ----------//
export const updateProductStock = async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  if (quantity === undefined) return res.status(400).json({ Info: "Quantidade é obrigatória!" });

  try {
    await pool.query('BEGIN');

    const query = `
      UPDATE Products
      SET stock = stock + $1, updatedAt = NOW()
      WHERE id=$2 AND companyId=$3
      RETURNING id, name, code, stock
    `;
    const result = await pool.query(query, [quantity, id, req.user.companyId]);

    if(result.rows[0].quantity < 0){
      return res.status(400).json({ Info: "Saldo insulficiente" })
    }
    await pool.query('COMMIT');

    if (!result.rows.length) return res.status(404).json({ Info: "Produto não encontrado!" });

    res.status(200).json({ Info: "Estoque atualizado com sucesso!", product: result.rows[0] });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error("Erro ao atualizar estoque:", err);
    res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};
