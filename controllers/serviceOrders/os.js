import pool from "../../database/conection.js";

// ===================== ENUMS & CONSTANTS ===================== //
const ORDER_STATUS = {
  PENDING: "initialized",
  IN_PROGRESS: "in_progress", 
  CANCELED: "canceled",
  FINISH: "finish"
};

// ===================== QUERIES ===================== //
const Q = {
  INSERT_ORDER: `
    INSERT INTO OrderService 
      (companyId, userId, orderNumber, orderStatus, orderDate, notes, orderItems, message)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id`,

  INSERT_ORDER_ITEM: `
    INSERT INTO OrderServiceItems (orderId, productId, quantity, companyId)
    VALUES ($1, $2, $3, $4)
    RETURNING productId, quantity`,

  GET_ORDER: `
    SELECT
      id, orderNumber, orderDate, orderStatus, notes, orderItems, message,
      userId, companyId, createdAt, updatedAt
    FROM OrderService 
    WHERE id = $1 AND companyId = $2`,

  GET_ALL_ORDERS: `
    SELECT id, orderNumber, orderStatus, orderDate, notes, message, userId, createdAt
    FROM OrderService 
    WHERE companyId = $1
    ORDER BY orderDate DESC`,

  UPDATE_ORDER: `
    UPDATE OrderService
    SET orderStatus = $1, notes = $2, message = $3, updatedAt = NOW()
    WHERE id = $4 AND companyId = $5
    RETURNING *`,

  DELETE_ORDER: `
    DELETE FROM OrderService
    WHERE id = $1 AND companyId = $2
    RETURNING id`,

  GET_ORDER_BY_NUMBER: `
    SELECT id, orderNumber, orderStatus, orderDate, notes, orderItems, message, userId
    FROM OrderService 
    WHERE orderNumber = $1 AND companyId = $2
  `
};

// ===================== HELPERS ===================== //
const insertOrderItems = async (client, orderId, items, companyId) => {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const validItems = items.filter(item => 
    item && item.productId && item.quantity !== undefined
  );

  return Promise.all(
    validItems.map(item =>
      client.query(Q.INSERT_ORDER_ITEM, [orderId, item.productId, item.quantity, companyId])
    )
  );
};

const executeTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// ===================== CONTROLLERS ===================== //

// CRIAR ORDEM DE SERVIÇO
export const createOrderService = async (req, res) => {
  const {
    orderNumber,
    orderItems,
    notes,
    message,
    orderDate,
    orderStatus = ORDER_STATUS.PENDING
  } = req.body;

  if (!orderNumber || !orderItems || !orderDate) {
    return res.status(400).json({
      error: "Campos obrigatórios ausentes!",
      required: ["orderNumber", "orderItems", "orderDate"]
    });
  }

  const companyId = req.user.companyId;
  const userId = req.user.id;

  try {
    const result = await executeTransaction(async (client) => {
      const orderRes = await client.query(Q.INSERT_ORDER, [
        companyId,
        userId,
        orderNumber,
        orderStatus,
        orderDate,
        notes,
        message,
        orderItems
      ]);
      
      const orderId = orderRes.rows[0].id;
      await insertOrderItems(client, orderId, orderItems, companyId);
      
      return client.query(Q.GET_ORDER, [orderId, companyId]);
    });

    res.status(201).json({
      message: "Ordem de serviço criada com sucesso!",
      order: result.rows[0]
    });
  } catch (err) {
    console.error("❌ Erro ao criar ordem de serviço:", err);
    res.status(500).json({
      error: "Erro interno ao criar ordem de serviço",
      details: err.message
    });
  }
};

// ATUALIZAR ORDEM DE SERVIÇO
export const updateOrderService = async (req, res) => {
  const { id } = req.params;
  const { orderStatus, notes, message } = req.body;
  const companyId = req.user.companyId;

  try {
    const result = await pool.query(Q.UPDATE_ORDER, [orderStatus, notes, message || null, id, companyId]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Ordem de serviço não encontrada" });
    }

    res.json({ 
      message: "Ordem de serviço atualizada!", 
      order: result.rows[0] 
    });
  } catch (err) {
    console.error("❌ Erro ao atualizar ordem de serviço:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// LISTAR TODAS AS ORDENS DE SERVIÇO
export const getAllOrderServices = async (req, res) => {
  try {
    const result = await pool.query(Q.GET_ALL_ORDERS, [req.user.companyId]);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao listar ordens de serviço:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// BUSCAR ORDEM DE SERVIÇO POR NÚMERO
export const getOrderServiceByNumber = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const result = await pool.query(Q.GET_ORDER_BY_NUMBER, [orderNumber, req.user.companyId]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Ordem de serviço não encontrada" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Erro ao buscar ordem de serviço:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// DELETAR ORDEM DE SERVIÇO
export const deleteOrderService = async (req, res) => {
  const { id } = req.params;
  const companyId = req.user.companyId;

  try {
    const result = await pool.query(Q.DELETE_ORDER, [id, companyId]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Ordem de serviço não encontrada" });
    }

    res.json({ message: "Ordem de serviço deletada com sucesso!" });
  } catch (err) {
    console.error("❌ Erro ao deletar ordem de serviço:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};