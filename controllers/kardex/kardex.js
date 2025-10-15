import pool from "../../database/conection.js";

// Tipos de movimentação
const MOVEMENT_TYPES = {
  ENTRADA: 'entrada',
  SAIDA: 'saida'
};

// Queries SQL do Kardex
const KARDEX_QUERIES = {
  INSERT_KARDEX: `
    INSERT INTO Kardex
      (companyId, productId, orderId, movementType, quantity, unitPrice, movementDate)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    RETURNING *
  `,
  UPDATE_PRODUCT_STOCK: `
    UPDATE Products 
    SET stock = stock - $1,
        updatedAt = NOW()
    WHERE id = $2 AND companyId = $3
    RETURNING id, name, code, stock
  `,
  DELETE_KARDEX_BY_ORDER: `
    DELETE FROM Kardex 
    WHERE orderId = $1
  `,
  GET_KARDEX_BY_PRODUCT: `
  SELECT
    k.id,
    k.movementType,
    k.quantity,
    k.unitPrice,
    k.movementDate,
    k.orderId,
    i.invoice_number as invoiceNumber, 
    i.issue_date as invoiceDate,           
    i.status as invoiceStatus,            
    po.ordernumber as purchaseOrderNumber, 
    p.name as productName,
    p.code as productCode
  FROM Kardex k
  JOIN Products p ON k.productId = p.id
  LEFT JOIN Invoices i ON k.orderId = i.order_id AND i.companyId = k.companyId  
  LEFT JOIN OrdersRequest po ON k.orderId = po.id  
  WHERE k.productId = $1 AND k.companyId = $2
  ORDER BY k.movementDate DESC
`,
  GET_KARDEX_BY_ORDER: `
    SELECT 
      k.id,
      k.movementType,
      k.quantity,
      k.unitPrice,
      k.movementDate,
      p.name as productName,
      p.code as productCode
    FROM Kardex k
    JOIN Products p ON k.productId = p.id
    WHERE k.orderId = $1 AND k.companyId = $2
    ORDER BY k.movementDate DESC
  `
};

const KARDEX_RESPONSES = {
  CREATE_SUCCESS: (kardex) => ({
    Info: "Movimentação registrada no Kardex!",
    kardex
  }),
  LIST_SUCCESS: (movements) => ({
    Info: "Movimentações do Kardex recuperadas com sucesso",
    movements
  }),
  STOCK_UPDATED: (product) => ({
    Info: "Estoque atualizado com sucesso!",
    product
  }),
  ERROR: { Error: "Erro interno do servidor!" }
};

// ====================== FUNÇÕES ====================== //

export const createKardexMovements = async (companyId, orderId, insertedItems, client = null) => {
  const db = client || pool;

  try {
    const kardexPromises = insertedItems.map(async (result) => {
      const item = result.rows[0];

      const stockBefore = await db.query(
        'SELECT stock FROM Products WHERE id = $1 AND companyId = $2',
        [item.productid, companyId]
      );

      const stockUpdate = await db.query(KARDEX_QUERIES.UPDATE_PRODUCT_STOCK, [
        item.quantity,
        item.productid,
        companyId
      ]);

      const stockAfter = await db.query(
        'SELECT stock FROM Products WHERE id = $1 AND companyId = $2',
        [item.productid, companyId]
      );

      const kardexResult = await db.query(KARDEX_QUERIES.INSERT_KARDEX, [
        companyId,
        item.productid,
        orderId,
        MOVEMENT_TYPES.SAIDA,
        item.quantity,
        item.unitprice
      ]);

      return {
        stockBefore: stockBefore.rows[0],
        stockUpdate: stockUpdate.rows[0],
        stockAfter: stockAfter.rows[0],
        kardex: kardexResult.rows[0]
      };
    });

    const results = await Promise.all(kardexPromises);
    console.log("✅ [KARDEX] Processamento concluído");
    return results;
  } catch (error) {
    console.error("❌ [KARDEX] Erro:", error);
    throw error;
  }
};

export const deleteKardexByOrderId = async (orderId, client = null) => {
  const db = client || pool; // ← CORREÇÃO: mudar "conect" para "pool"

  try {
    const result = await db.query(KARDEX_QUERIES.DELETE_KARDEX_BY_ORDER, [orderId]);
    console.log(`✅ [KARDEX] Movimentações do pedido ${orderId} deletadas`);
    return result;
  } catch (error) {
    console.error("❌ [KARDEX] Erro ao deletar movimentações:", error);
    throw error;
  }
};

export const getKardexByProduct = async (req, res) => {
  const { productId } = req.params;
  const companyId = req.user.companyId;

  try {
    const result = await pool.query(KARDEX_QUERIES.GET_KARDEX_BY_PRODUCT, [productId, companyId]);
    res.status(200).json(KARDEX_RESPONSES.LIST_SUCCESS(result.rows));
  } catch (err) {
    console.error("❌ [KARDEX] Erro ao buscar movimentações por produto:", err);
    res.status(500).json(KARDEX_RESPONSES.ERROR);
  }
};

export const getKardexByOrder = async (req, res) => {
  const { orderId } = req.params;
  const companyId = req.user.companyId;

  try {
    const result = await pool.query(KARDEX_QUERIES.GET_KARDEX_BY_ORDER, [orderId, companyId]);
    res.status(200).json(KARDEX_RESPONSES.LIST_SUCCESS(result.rows));
  } catch (err) {
    console.error("❌ [KARDEX] Erro ao buscar movimentações por pedido:", err);
    res.status(500).json(KARDEX_RESPONSES.ERROR);
  }
};

// Criar movimentação avulsa
export const createKardexMovement = async (req, res) => {
  const { productId, orderId, movementType, quantity, unitPrice } = req.body;
  const companyId = req.user.companyId;

  if (!Object.values(MOVEMENT_TYPES).includes(movementType)) {
    return res.status(400).json({
      Info: "Tipo de movimentação inválido!",
      validTypes: Object.values(MOVEMENT_TYPES)
    });
  }

  try {
    // Verificar estoque se for saída
    if (movementType === MOVEMENT_TYPES.SAIDA) {
      const productResult = await pool.query(
        'SELECT stock FROM Products WHERE id = $1 AND companyId = $2',
        [productId, companyId]
      );

      if (productResult.rows.length === 0) {
        return res.status(404).json({ Info: "Produto não encontrado!" });
      }

      const currentStock = productResult.rows[0].stock;
      if (currentStock < quantity) {
        return res.status(400).json({
          Info: "Estoque insuficiente!",
          currentStock,
          requested: quantity
        });
      }
    }

    const result = await pool.query(KARDEX_QUERIES.INSERT_KARDEX, [
      companyId, productId, orderId, movementType, quantity, unitPrice
    ]);

    // Atualizar estoque do produto
    const stockMultiplier = movementType === MOVEMENT_TYPES.ENTRADA ? 1 : -1;
    await pool.query(KARDEX_QUERIES.UPDATE_PRODUCT_STOCK, [
      quantity * stockMultiplier,
      productId,
      companyId
    ]);

    res.status(201).json(KARDEX_RESPONSES.CREATE_SUCCESS(result.rows[0]));
  } catch (err) {
    console.error("❌ [KARDEX] Erro ao registrar movimentação:", err);
    res.status(500).json(KARDEX_RESPONSES.ERROR);
  }
};
// Exportar constantes
export { MOVEMENT_TYPES };
