import pool from "../../database/conection.js";

// ====================== HELPERS ====================== //

const validateRequiredFields = (body) => {
  const { 
    name, code, price, coast, stock, description, location, minimum_stock, 
    brand, supplier_id, category, ncm, cfop, unidade, origem 
  } = body;
  
  // Campos obrigatórios gerais
  if (!name || !code || !price || !coast || !stock || !description || 
      !location || !minimum_stock || !brand || !supplier_id || !category) {
    return true;
  }
  
  // Campos fiscais obrigatórios para NF-e
  if (!ncm || !cfop || !unidade || origem === undefined) {
    return true;
  }
  
  return false;
};

const hasNoFieldsToUpdate = (body) => {
  const allowedFields = [
    'name', 'description', 'code', 'price', 'coast', 'stock', 'location', 
    'minimum_stock', 'brand', 'supplier_id', 'category',
    // Campos fiscais
    'ncm', 'cfop', 'cest', 'unidade', 'origem', 'ean', 'codigo_barras',
    'cst_icms', 'cst_pis', 'cst_cofins', 'cst_ipi',
    'aliquota_icms', 'aliquota_pis', 'aliquota_cofins', 'aliquota_ipi',
    'codigo_beneficio_fiscal', 'cnpj_fabricante', 'informacoes_adicionais'
  ];
  
  return !allowedFields.some(field => body[field] !== undefined);
};

const buildUpdateQuery = (body) => {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const fieldMapping = {
    name: 'name',
    description: 'description',
    code: 'code',
    price: 'price',
    coast: 'coast',
    stock: 'stock',
    location: 'location',
    minimum_stock: 'minimum_stock',
    brand: 'brand',
    supplier_id: 'supplier_id',
    category: 'category',
    // Campos fiscais
    ncm: 'ncm',
    cfop: 'cfop',
    cest: 'cest',
    unidade: 'unidade',
    origem: 'origem',
    ean: 'ean',
    codigo_barras: 'codigo_barras',
    cst_icms: 'cst_icms',
    cst_pis: 'cst_pis',
    cst_cofins: 'cst_cofins',
    cst_ipi: 'cst_ipi',
    aliquota_icms: 'aliquota_icms',
    aliquota_pis: 'aliquota_pis',
    aliquota_cofins: 'aliquota_cofins',
    aliquota_ipi: 'aliquota_ipi',
    codigo_beneficio_fiscal: 'codigo_beneficio_fiscal',
    cnpj_fabricante: 'cnpj_fabricante',
    informacoes_adicionais: 'informacoes_adicionais'
  };

  for (const [key, dbColumn] of Object.entries(fieldMapping)) {
    if (body[key] !== undefined) {
      fields.push(`${dbColumn}=$${paramCount}`);
      values.push(body[key]);
      paramCount++;
    }
  }

  fields.push(`updatedAt=NOW()`);

  return { fields, values, paramCount };
};

// ====================== CONTROLLER ====================== //

//----------- POST ----------//
export const insertProduct = async (req, res) => {
  if (validateRequiredFields(req.body)) {
    return res.status(400).json({ 
      Info: "Todos os campos obrigatórios devem ser preenchidos!",
      required: [
        "name", "code", "price", "coast", "stock", "description", 
        "location", "minimum_stock", "brand", "supplier_id", "category",
        "ncm", "cfop", "unidade", "origem"
      ]
    });
  }

  const { 
    name, code, price, coast, stock, description, location, minimum_stock, 
    brand, supplier_id, category,
    // Campos fiscais obrigatórios
    ncm, cfop, unidade, origem,
    // Campos fiscais opcionais
    cest, ean, codigo_barras,
    cst_icms, cst_pis, cst_cofins, cst_ipi,
    aliquota_icms, aliquota_pis, aliquota_cofins, aliquota_ipi,
    codigo_beneficio_fiscal, cnpj_fabricante, informacoes_adicionais
  } = req.body;

  try {
    await pool.query('BEGIN');

    const query = `
      WITH inserted AS (
        INSERT INTO Products (
          name, code, price, coast, stock, description, location, minimum_stock, 
          brand, supplier_id, category, companyId,
          ncm, cfop, unidade, origem, cest, ean, codigo_barras,
          cst_icms, cst_pis, cst_cofins, cst_ipi,
          aliquota_icms, aliquota_pis, aliquota_cofins, aliquota_ipi,
          codigo_beneficio_fiscal, cnpj_fabricante, informacoes_adicionais,
          createdAt
        ) 
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18, $19,
          $20, $21, $22, $23,
          $24, $25, $26, $27,
          $28, $29, $30,
          NOW()
        )
        RETURNING *
      )
      SELECT i.*, s.name AS supplier_name
      FROM inserted i
      JOIN Suppliers s ON i.supplier_id = s.id;
    `;

    const values = [
      // Dados gerais
      name, code, price, coast, stock, description, location, minimum_stock, 
      brand, supplier_id, category, req.user.companyId,
      // Campos fiscais obrigatórios
      ncm, cfop, unidade, origem,
      // Campos fiscais opcionais
      cest || null, ean || null, codigo_barras || null,
      cst_icms || null, cst_pis || null, cst_cofins || null, cst_ipi || null,
      aliquota_icms || null, aliquota_pis || null, aliquota_cofins || null, aliquota_ipi || null,
      codigo_beneficio_fiscal || null, cnpj_fabricante || null, informacoes_adicionais || null
    ];

    const response = await pool.query(query, values);

    await pool.query('COMMIT');

    return res.status(201).json({
      Info: "Sucesso! Produto adicionado com sucesso.",
      product: response.rows[0]
    });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error("Erro ao adicionar produto:", err);
    return res.status(500).json({ Error: "Erro interno do servidor!", details: err.message });
  }
};

//----------- GET ALL ----------//
export const handleAllProducts = async (req, res) => {
  try {
    const query = `
      SELECT p.*, s.name as supplier_name, s.code as supplier_code
      FROM Products p 
      LEFT JOIN Suppliers s ON p.supplier_id = s.id 
      WHERE p.companyId=$1
      ORDER BY p.createdAt DESC
    `;
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
      SELECT p.*, s.name as supplier_name, s.code as supplier_code
      FROM Products p
      LEFT JOIN Suppliers s ON p.supplier_id = s.id
      WHERE p.id=$1 AND p.companyId=$2
    `;
    const result = await pool.query(query, [id, req.user.companyId]);

    if (!result.rows.length) {
      return res.status(404).json({ Info: "Produto não encontrado!" });
    }

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
    return res.status(400).json({ 
      Info: "É necessário enviar pelo menos um campo para atualizar!" 
    });
  }

  try {
    await pool.query('BEGIN');

    // Verifica se o produto existe
    const productResult = await pool.query(
      'SELECT * FROM Products WHERE id=$1 AND companyId=$2',
      [id, req.user.companyId]
    );

    if (!productResult.rows.length) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ Info: "Nenhum produto encontrado!" });
    }

    // Constrói a query de update dinamicamente
    const { fields, values, paramCount } = buildUpdateQuery(req.body);

    if (fields.length === 1) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ 
        Info: "Nenhum campo válido foi enviado para atualização!" 
      });
    }

    const updateQuery = `
      UPDATE Products
      SET ${fields.join(', ')}
      WHERE id=$${paramCount} AND companyId=$${paramCount + 1}
      RETURNING *
    `;

    const updateValues = [...values, id, req.user.companyId];
    const response = await pool.query(updateQuery, updateValues);

    await pool.query('COMMIT');

    res.status(200).json({ 
      Info: "Informações atualizadas com sucesso!", 
      product: response.rows[0] 
    });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error("Erro ao atualizar produto:", err);
    res.status(500).json({ Error: "Erro interno do servidor!", details: err.message });
  }
};

//----------- DELETE ----------//
export const deleteProduct = async (req, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ Alert: "Informe o ID do produto!" });
  }

  try {
    await pool.query('BEGIN');

    const result = await pool.query(
      'DELETE FROM Products WHERE id=$1 AND companyId=$2 RETURNING id, name',
      [id, req.user.companyId]
    );

    await pool.query('COMMIT');

    if (result.rowCount) {
      res.status(200).json({ 
        Info: "Produto apagado da base de dados.", 
        deleted: result.rows[0]
      });
    } else {
      res.status(404).json({ 
        Info: "Produto não encontrado ou não pertence à empresa." 
      });
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

  if (quantity === undefined || quantity === null) {
    return res.status(400).json({ Info: "Quantidade é obrigatória!" });
  }

  try {
    await pool.query('BEGIN');

    // Verifica o estoque atual
    const checkStock = await pool.query(
      'SELECT stock FROM Products WHERE id=$1 AND companyId=$2',
      [id, req.user.companyId]
    );

    if (!checkStock.rows.length) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ Info: "Produto não encontrado!" });
    }

    const currentStock = checkStock.rows[0].stock;
    const newStock = currentStock + quantity;

    if (newStock < 0) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ 
        Info: "Saldo insuficiente!",
        currentStock,
        requested: Math.abs(quantity),
        shortage: Math.abs(newStock)
      });
    }

    const query = `
      UPDATE Products
      SET stock = stock + $1, updatedAt = NOW()
      WHERE id=$2 AND companyId=$3
      RETURNING id, name, code, stock
    `;

    const result = await pool.query(query, [quantity, id, req.user.companyId]);

    await pool.query('COMMIT');

    res.status(200).json({ 
      Info: "Estoque atualizado com sucesso!", 
      product: result.rows[0] 
    });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error("Erro ao atualizar estoque:", err);
    res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};