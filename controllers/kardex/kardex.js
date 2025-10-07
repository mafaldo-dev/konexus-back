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
      o.orderNumber,
      p.name as productName,
      p.code as productCode
    FROM Kardex k
    JOIN Products p ON k.productId = p.id
    LEFT JOIN Orders o ON k.orderId = o.id
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

// Respostas padronizadas
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

// Cria movimentações do Kardex para uma ordem
export const createKardexMovements = async (companyId, orderId, insertedItems, client = null) => {
  const db = client || pool; // ← CORREÇÃO: mudar "conect" para "pool"

  try {
    console.log("🔍 [KARDEX] Iniciando processamento...");

    const kardexPromises = insertedItems.map(async (result) => {
      const item = result.rows[0];

      console.log("🔍 [KARDEX] Item a processar:", {
        productId: item.productid,
        quantity: item.quantity,
        unitPrice: item.unitprice
      });

      // ✅ Estoque antes
      const stockBefore = await db.query(
        'SELECT stock FROM Products WHERE id = $1 AND companyId = $2',
        [item.productid, companyId]
      );
      console.log("🔍 [KARDEX] Estoque ANTES:", stockBefore.rows[0]?.stock);

      // ✅ Atualiza estoque
      const stockUpdate = await db.query(KARDEX_QUERIES.UPDATE_PRODUCT_STOCK, [
        item.quantity,
        item.productid,
        companyId
      ]);
      console.log("🔍 [KARDEX] Resultado da atualização:", stockUpdate.rows[0]);

      // ✅ Estoque depois
      const stockAfter = await db.query(
        'SELECT stock FROM Products WHERE id = $1 AND companyId = $2',
        [item.productid, companyId]
      );
      console.log("🔍 [KARDEX] Estoque DEPOIS:", stockAfter.rows[0]?.stock);

      // ✅ Inserir registro no Kardex
      const kardexResult = await db.query(KARDEX_QUERIES.INSERT_KARDEX, [
        companyId,
        item.productid,
        orderId,
        MOVEMENT_TYPES.SAIDA,
        item.quantity,
        item.unitprice
      ]);
      console.log("✅ [KARDEX] Movimentação registrada");

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

// Buscar Kardex por produto
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

// Buscar Kardex por pedido
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
    await pool.query(KARDEX_QUERIES.UPDATE_PRODUCT_STOCK, [ // ← CORREÇÃO: mudar "conect" para "pool"
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
