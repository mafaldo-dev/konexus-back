import pool from "../../database/conection.js";

// ===================== ENUMS & CONSTANTS ===================== //
const ORDER_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  IN_PROGRESS: "in_progress",
  CANCELED: "canceled",
  RECEIVED: "received"
};

// ===================== QUERIES ===================== //
const Q = {
  INSERT_ORDER: `
    INSERT INTO OrdersRequest 
      (companyId, supplierId, orderNumber, orderStatus, orderDate, totalCost, currency, notes, buyer)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id`,

  INSERT_ORDER_ITEM: `
    INSERT INTO PurchaseOrderItems (orderId, productId, quantity, coast, companyId)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING productId, quantity, coast`,

  GET_ORDER_WITH_SUPPLIER: `
    SELECT
      o.id, o.orderNumber, o.orderDate, o.orderStatus, o.totalCost, o.currency, o.notes,
      s.id AS supplierId, s.name AS supplierName, s.email AS supplierEmail, s.phone AS supplierPhone
    FROM OrdersRequest o
    JOIN Suppliers s ON o.supplierId = s.id
    WHERE o.id = $1 AND o.companyId = $2`,

  GET_ORDER_ITEMS: `
    SELECT 
      oi.productId, 
      p.name AS productName, 
      p.code AS productCode,
      p.location AS productLocation,
      oi.quantity, 
      oi.coast AS unitCost, 
      (oi.quantity * oi.coast) AS subtotal
    FROM PurchaseOrderItems oi
    JOIN Products p ON oi.productId = p.id
    WHERE oi.orderId = $1`,

  GET_ALL_ORDERS: `
    SELECT o.id, o.orderNumber, o.orderStatus, o.orderDate, o.totalCost,
           s.name AS supplierName, s.email AS supplierEmail
    FROM OrdersRequest o
    JOIN Suppliers s ON o.supplierId = s.id
    WHERE o.companyId = $1
    ORDER BY o.orderDate DESC`,

  UPDATE_ORDER: `
    UPDATE OrdersRequest
    SET orderStatus = $1, notes = $2, updatedAt = NOW()
    WHERE id = $3 AND companyId = $4
    RETURNING *`,

  DELETE_ORDER: `
    DELETE FROM OrdersRequest
    WHERE id = $1 AND companyId = $2
    RETURNING id`,

  GET_ORDER_BY_NUMBER: `
    SELECT
      o.id, o.orderNumber, o.orderDate, o.orderStatus, o.totalCost, o.currency, o.notes, o.buyer,
      s.id AS supplierId, s.name AS supplierName, s.email AS supplierEmail, s.phone AS supplierPhone
    FROM OrdersRequest o
    JOIN Suppliers s ON o.supplierId = s.id
    WHERE o.orderNumber = $1 AND o.companyId = $2
`

};

// ===================== HELPERS ===================== //
const insertOrderItems = async (client, orderId, items, companyId) => {
  console.log("🔍 DEBUG insertOrderItems - Tipo de items:", typeof items);
  console.log("🔍 DEBUG insertOrderItems - É array?", Array.isArray(items));

  if (!Array.isArray(items)) {
    throw new Error(`Items deve ser um array. Recebido: ${typeof items}`);
  }

  if (items.length === 0) {
    console.warn("⚠️  Array de items está vazio");
    return [];
  }

  // VERIFICAR SE OS PRODUTOS PERTENCEM À COMPANY
  const productIds = items.map(item => item.productId).filter(id => id);
  console.log("🔍 ProductIds a serem verificados:", productIds);

  if (productIds.length > 0) {
    const placeholders = productIds.map((_, index) => `$${index + 2}`).join(', ');
    const checkQuery = `
      SELECT id, name, code FROM Products 
      WHERE companyId = $1 AND id IN (${placeholders})
    `;

    const existingProducts = await client.query(checkQuery, [companyId, ...productIds]);
    console.log("✅ Produtos encontrados:", existingProducts.rows);

    // Verificar se TODOS os produtos existem e pertencem à company
    const existingIds = existingProducts.rows.map(p => p.id);
    const missingIds = productIds.filter(id => !existingIds.includes(id));

    if (missingIds.length > 0) {
      throw new Error(`Produtos não encontrados na sua empresa: ${missingIds.join(', ')}`);
    }
  }

  // Validar estrutura dos itens
  const validItems = items.filter(item => {
    const isValid = item && item.productId && item.quantity !== undefined && item.coast !== undefined;
    if (!isValid) {
      console.warn("❌ Item inválido ignorado:", item);
    }
    return isValid;
  });

  if (validItems.length === 0) {
    throw new Error("Nenhum item válido encontrado para inserir");
  }

  console.log(`✅ Inserindo ${validItems.length} itens válidos`);

  return Promise.all(
    validItems.map(item =>
      client.query(Q.INSERT_ORDER_ITEM, [orderId, item.productId, item.quantity, item.coast, companyId])
    )
  );
};

const getOrderDetails = async (client, orderId, companyId) => {
  const [orderRes, itemsRes] = await Promise.all([
    client.query(Q.GET_ORDER_WITH_SUPPLIER, [orderId, companyId]),
    client.query(Q.GET_ORDER_ITEMS, [orderId])
  ]);

  if (!orderRes.rows[0]) return null;

  const o = orderRes.rows[0];
  return {
    id: o.id,
    orderNumber: o.ordernumber,
    orderDate: o.orderdate,
    orderStatus: o.orderstatus,
    totalCost: o.totalcost,
    currency: o.currency,
    notes: o.notes,
    buyer: o.buyer,
    supplier: {
      id: o.supplierid,
      name: o.suppliername,
      email: o.supplieremail,
      phone: o.supplierphone
    },
    orderItems: itemsRes.rows
  };
};

// ✅ FUNÇÃO DE TRANSAÇÃO MELHORADA
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
    client.release(); // SEMPRE libera a conexão
  }
};

// ===================== CONTROLLERS ===================== //

// CRIAR PEDIDO
export const purchaseOrderBuy = async (req, res) => {
  const {
    orderNumber,
    supplierId,
    orderItems,
    totalCost,
    currency,
    notes,
    orderDate,
    orderStatus = ORDER_STATUS.PENDING,
    buyer
  } = req.body;

  // ===================== VALIDAÇÕES ===================== //
  if (!orderNumber || !supplierId || !orderItems || !totalCost || !currency || !orderDate || !buyer) {
    return res.status(400).json({
      error: "Campos obrigatórios ausentes!",
      required: ["orderNumber", "supplierId", "orderItems", "totalCost", "currency", "orderDate", "buyer"],
      received: {
        orderNumber: !!orderNumber,
        supplierId: !!supplierId,
        orderItems: !!orderItems,
        totalCost: !!totalCost,
        currency: !!currency,
        orderDate: !!orderDate,
        buyer: !!buyer
      }
    });
  }

  // Garantir tipo numérico do supplierId
  const numericSupplierId = parseInt(supplierId, 10);
  if (isNaN(numericSupplierId)) {
    return res.status(400).json({
      error: "supplierId deve ser um número válido",
      received: supplierId
    });
  }

  if (!Array.isArray(orderItems)) {
    return res.status(400).json({
      error: "orderItems deve ser um array",
      received: typeof orderItems
    });
  }

  if (orderItems.length === 0) {
    return res.status(400).json({
      error: "orderItems não pode estar vazio"
    });
  }

  const companyId = req.user.companyId;

  // ===================== TRANSAÇÃO ===================== //
  try {
    const fullOrder = await executeTransaction(async (client) => {

      const supplierCheck = await client.query(
        "SELECT id, name FROM Suppliers WHERE id = $1 AND companyId = $2",
        [numericSupplierId, companyId]
      );

      if (supplierCheck.rows.length === 0) {
        throw new Error(`SUPPLIER_NOT_FOUND: Fornecedor ${numericSupplierId} não encontrado para sua empresa`);
      }

      const orderNumberCheck = await client.query(
        "SELECT id FROM OrdersRequest WHERE companyId = $1 AND orderNumber = $2",
        [companyId, orderNumber]
      );

      if (orderNumberCheck.rows.length > 0) {
        throw new Error(`ORDER_NUMBER_EXISTS: Já existe um pedido com o número ${orderNumber}`);
      }

      const orderRes = await client.query(Q.INSERT_ORDER, [
        companyId,
        numericSupplierId,
        orderNumber,
        orderStatus,
        orderDate,
        totalCost,
        currency,
        notes,
        buyer
      ]);
      const orderId = orderRes.rows[0].id;

      await insertOrderItems(client, orderId, orderItems, companyId);

      const order = await getOrderDetails(client, orderId, companyId);
      return order;
    });

    return res.status(201).json({
      message: "Pedido criado com sucesso!",
      order: fullOrder
    });
  } catch (err) {
    console.error("❌ Erro ao criar pedido:", err.message);
    return res.status(500).json({
      error: "Erro interno ao criar pedido",
      details: err.message
    });
  }
};


// ATUALIZAR PEDIDO
export const updatePurchaseOrder = async (req, res) => {
  const { id } = req.params;
  const { orderStatus, notes } = req.body;
  const companyId = req.user.companyId;

  try {
    const result = await pool.query(Q.UPDATE_ORDER, [orderStatus, notes || null, id, companyId]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    res.json({ message: "Pedido atualizado!", order: result.rows[0] });
  } catch (err) {
    console.error("❌ Erro ao atualizar:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// LISTAR TODOS
export const getAllPurchaseOrders = async (req, res) => {
  try {
    const result = await pool.query(Q.GET_ALL_ORDERS, [req.user.companyId]);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao listar:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// ✅ BUSCAR POR ID - CORRIGIDO PARA RETORNAR NO FORMATO PurchaseOrder
export const getPurchaseOrderByNumber = async (req, res) => {
  try {
    const orderNumber = req.params.orderNumber;
    const order = await executeTransaction(async (client) => {
      const orderRes = await client.query(Q.GET_ORDER_BY_NUMBER, [orderNumber, req.user.companyId]);
      if (!orderRes.rows[0]) return null;

      const itemsRes = await client.query(Q.GET_ORDER_ITEMS, [orderRes.rows[0].id]);

      const o = orderRes.rows[0];
      
      // RETORNO NO FORMATO EXATO DA INTERFACE PurchaseOrder
      return {
        id: o.id,
        orderNumber: o.ordernumber,
        supplierId: o.supplierid.toString(), // ✅ Converte para string como na interface
        orderDate: o.orderdate,
        orderStatus: o.orderstatus,
        totalCost: parseFloat(o.totalcost), // ✅ Garante que é number
        currency: o.currency,
        notes: o.notes,
        companyId: req.user.companyId,
        orderItems: itemsRes.rows.map(item => ({
          productid: item.productid.toString(), // ✅ Converte para string
          quantity: item.quantity,
          cost: parseFloat(item.unitcost), // ✅ Garante que é number
          productname: item.productname,
          productcode: item.productcode,
          productlocation: item.productlocation
        })),
        // Campos opcionais para UI
        supplier: {
          id: o.supplierid.toString(),
          name: o.suppliername,
          email: o.supplieremail,
          phone: o.supplierphone
        },
        requestingCompany: {
          id: req.user.companyId,
          name: req.user.companyName || "Empresa", // ✅ Ajuste conforme seu auth
          buyer: o.buyer
        },
        createdAt: o.createdat || new Date().toISOString()
      };
    });

    if (!order) {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    res.json(order);
  } catch (err) {
    console.error("❌ Erro ao buscar:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// DELETAR PEDIDO
export const deletePurchaseOrder = async (req, res) => {
  const { id } = req.params;
  const companyId = req.user.companyId;

  try {
    await executeTransaction(async (client) => {
      const result = await client.query(Q.DELETE_ORDER, [id, companyId]);

      if (!result.rows[0]) {
        throw new Error("NOT_FOUND");
      }
    });

    res.json({ message: "Pedido deletado com sucesso!" });
  } catch (err) {
    if (err.message === "NOT_FOUND") {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }
    console.error("❌ Erro ao deletar:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};