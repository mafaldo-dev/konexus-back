import pool from "../../database/conection.js";
import { createKardexMovements, deleteKardexByOrderId } from "../../controllers/kardex/kardex.js";

// Status do pedido
const ORDER_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  IN_PROGRESS: 'in_progress',
  SHIPPED: 'shipped',
  CANCELLED: 'cancelled',
  DELIVERED: 'delivered',
  BACKOUT: "backout"
};

// Validações auxiliares
const validateOrderFields = (body) => {
  const { orderItems, customerId, totalAmount, currency, orderDate, salesperson, orderNumber } = body;
  return !orderItems || !customerId || !totalAmount || !currency || !orderDate || !salesperson || !orderNumber;
};

// Queries SQL
const ORDER_QUERIES = {
  INSERT_ORDER: `
    INSERT INTO Orders 
      (companyId, orderDate, orderStatus, orderNumber, customerId, totalAmount, currency, shippingAddressId, billingAddressId, salesperson, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id
  `,
  INSERT_ORDER_ITEM: `
    INSERT INTO OrderItems
      (orderId, productId, quantity, unitPrice, location)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING productId, quantity, unitPrice, location
  `,
  GET_FULL_ORDER: `
    SELECT  
      o.id AS orderId,
      o.orderDate,
      o.orderStatus,
      o.orderNumber,
      o.totalAmount,
      o.currency,
      o.salesperson,
      o.notes,
      c.id AS customerId,
      c.name AS customerName,
      c.email AS customerEmail,
      c.phone AS customerPhone,
      c.code AS customerCode,
      sa.id AS shippingAddressId,
      sa.street AS shippingStreet,
      sa.city AS shippingCity,
      sa.zip AS shippingZip,
      sa.number AS shippingNumber,
      ba.id AS billingAddressId,
      ba.street AS billingStreet,
      ba.city AS billingCity,
      ba.zip AS billingZip,
      ba.number AS billingNumber
    FROM Orders o
    JOIN Customers c ON o.customerId = c.id
    LEFT JOIN Addresses sa ON o.shippingAddressId = sa.id
    LEFT JOIN Addresses ba ON o.billingAddressId = ba.id
    WHERE o.id = $1 AND o.companyId = $2
  `,
  GET_ORDER_ITEMS: `
    SELECT 
      oi.productId, 
      p.name AS productName, 
      p.code AS productCode,
      oi.quantity, 
      oi.unitPrice,
      oi.location,
      (oi.quantity * oi.unitPrice) AS subtotal
    FROM OrderItems oi
    JOIN Products p ON oi.productId = p.id
    WHERE oi.orderId = $1
  `,
   GET_ALL_ORDERS: `
    SELECT 
      o.id,
      o.orderDate,
      o.orderStatus,
      o.orderNumber,
      o.totalAmount,
      o.currency,
      o.salesperson,
      o.notes,
      c.name AS customerName,
      c.email AS customerEmail,
      c.code AS customerCode,
      sa.street AS shippingStreet,
      sa.number AS shippingNumber,
      sa.city AS shippingCity,
      sa.zip AS shippingZip,
      ba.street AS billingStreet,
      ba.number AS billingNumber,
      ba.city AS billingCity,
      ba.zip AS billingZip
    FROM Orders o
    JOIN Customers c ON o.customerId = c.id
    LEFT JOIN Addresses sa ON o.shippingAddressId = sa.id
    LEFT JOIN Addresses ba ON o.billingAddressId = ba.id
    WHERE o.companyId = $1
    ORDER BY o.orderDate DESC
    LIMIT $2 OFFSET $3
  `,
  
  COUNT_ALL_ORDERS: `
    SELECT COUNT(*) 
    FROM Orders o
    WHERE o.companyId = $1
  `,

  GET_ORDER_BY_ID: `
    SELECT 
      o.id,
      o.orderDate,
      o.orderStatus,
      o.orderNumber,
      o.totalAmount,
      o.currency,
      o.salesperson,
      o.notes,
      c.id AS customerId,
      c.name AS customerName,
      c.email AS customerEmail,
      c.phone AS customerPhone,
      c.code AS customerCode,
      o.shippingAddressId,
      o.billingAddressId
    FROM Orders o
    JOIN Customers c ON o.customerId = c.id
    WHERE o.id = $1 AND o.companyId = $2
  `,
  GET_ORDER_FOR_EDIT: `
    SELECT  
      o.id,
      o.orderDate,
      o.orderStatus,
      o.orderNumber,
      o.totalAmount,
      o.currency,
      o.salesperson,
      o.notes,
      o.customerId,
      o.shippingAddressId,
      o.billingAddressId,
      c.name AS customerName,
      c.email AS customerEmail,
      c.phone AS customerPhone,
      c.code AS customerCode,
      sa.street AS shippingStreet,
      sa.number AS shippingNumber,
      sa.city AS shippingCity,
      sa.zip AS shippingZip,
      ba.street AS billingStreet,
      ba.number AS billingNumber,
      ba.city AS billingCity,
      ba.zip AS billingZip
    FROM Orders o
    JOIN Customers c ON o.customerId = c.id
    LEFT JOIN Addresses sa ON o.shippingAddressId = sa.id
    LEFT JOIN Addresses ba ON o.billingAddressId = ba.id
    WHERE o.id = $1 AND o.companyId = $2
  `,

  // Query para atualizar pedido
  UPDATE_ORDER: `
    UPDATE Orders 
    SET 
      orderDate = $1,
      customerId = $2,
      totalAmount = $3,
      currency = $4,
      shippingAddressId = $5,
      billingAddressId = $6,
      salesperson = $7,
      notes = $8,
      updatedAt = NOW()
    WHERE id = $9 AND companyId = $10 AND orderStatus IN ('pending', 'backout')
    RETURNING *
  `,

  // Query para verificar se pedido pode ser editado
  CAN_EDIT_ORDER: `
    SELECT orderStatus 
    FROM Orders 
    WHERE id = $1 AND companyId = $2 AND orderStatus IN ('pending', 'backout')
  `,

  UPDATE_ORDER_STATUS: `
    UPDATE Orders 
    SET orderStatus = $1 
    WHERE id = $2 AND companyId = $3
    RETURNING *
  `,
  DELETE_ORDER: `
    DELETE FROM Orders 
    WHERE id = $1 AND companyId = $2
  `,
  DELETE_ORDER_ITEMS: `
    DELETE FROM OrderItems 
    WHERE orderId = $1
  `
};

// Respostas padronizadas
const RESPONSES = {
  MISSING_FIELDS: { Info: "Campos obrigatórios ausentes!" },
  ORDER_NOT_FOUND: { Info: "Pedido não encontrado!" },
  CREATE_SUCCESS: (order) => ({
    Info: "Pedido criado com sucesso!",
    order
  }),
  LIST_SUCCESS: (orders) => ({
    Info: "Lista de pedidos recuperada com sucesso",
    orders
  }),
  GET_SUCCESS: (order) => ({
    Info: "Pedido encontrado",
    order
  }),
  UPDATE_SUCCESS: (order) => ({
    Info: "Status do pedido atualizado com sucesso!",
    order
  }),
  DELETE_SUCCESS: { Info: "Pedido deletado com sucesso!" },
  ERROR: { Error: "Erro interno do servidor!" },

  UPDATE_ORDER_SUCCESS: (order) => ({
    Info: "Pedido atualizado com sucesso!",
    order
  }),
};

// Funções auxiliares
const insertOrderItems = async (client, orderId, orderItems) => {
  const insertPromises = orderItems.map(item =>
    client.query(ORDER_QUERIES.INSERT_ORDER_ITEM, [
      orderId,
      item.productId,
      item.quantity,
      item.unitPrice,
      item.location
    ])
  );
  return await Promise.all(insertPromises);
};

const getFullOrderDetails = async (client, orderId, companyId) => {
  const [orderResult, itemsResult] = await Promise.all([
    client.query(ORDER_QUERIES.GET_FULL_ORDER, [orderId, companyId]), 
    client.query(ORDER_QUERIES.GET_ORDER_ITEMS, [orderId]) 
  ]);

  if (orderResult.rows.length === 0) return null;

  const row = orderResult.rows[0];
  const order = {
    id: row.orderid,
    orderDate: row.orderdate,
    orderStatus: row.orderstatus,
    orderNumber: row.ordernumber,
    totalAmount: row.totalamount,
    currency: row.currency,
    salesperson: row.salesperson,
    notes: row.notes,
    customer: {
      id: row.customerid,
      name: row.customername,
      email: row.customeremail,
      phone: row.customerphone,
      code: row.customercode
    },
    shipping: {
      id: row.shippingaddressid,
      street: row.shippingstreet,
      number: row.shippingnumber,
      city: row.shippingcity,
      zip: row.shippingzip
    },
    billing: {
      id: row.billingaddressid,
      street: row.billingstreet,
      number: row.billingnumber,
      city: row.billingcity,
      zip: row.billingzip
    },
    orderItems: itemsResult.rows
  };

  return order;
};

// ===================== CONTROLADORES ===================== //

export const createOrderSale = async (req, res) => {
  if (validateOrderFields(req.body)) {
    return res.status(400).json(RESPONSES.MISSING_FIELDS);
  }

  const {
    orderDate,
    orderItems,
    orderStatus = ORDER_STATUS.PENDING,
    orderNumber,
    customerId,
    totalAmount,
    currency,
    shippingAddressId,
    billingAddressId,
    salesperson,
    notes
  } = req.body;

  const companyId = req.user.companyId;
  const client = await pool.connect();

  try {
    console.log("🔍 [ORDER] Iniciando transação...");
    await client.query('BEGIN');

    // 1️⃣ Criar pedido
    const orderResult = await client.query(ORDER_QUERIES.INSERT_ORDER, [
      companyId,
      orderDate,
      orderStatus,
      orderNumber,
      customerId,
      totalAmount,
      currency,
      shippingAddressId,
      billingAddressId,
      salesperson,
      notes || null
    ]);

    const orderId = orderResult.rows[0].id;
    console.log("✅ [ORDER] Pedido criado ID:", orderId);

    // 2️⃣ Inserir itens
    const insertedItems = await insertOrderItems(client, orderId, orderItems);
    console.log("✅ [ORDER] Itens inseridos:", insertedItems.length);

    // 3️⃣ Processar Kardex
    await createKardexMovements(companyId, orderId, insertedItems, client);
    console.log("✅ [ORDER] Kardex processado");

    // 4️⃣ Buscar pedido completo - CORRIGIDO: passar client
    const fullOrder = await getFullOrderDetails(client, orderId, companyId);
    console.log("Log fullorder aqui...:", fullOrder);

    if (!fullOrder) {
      throw new Error("Falha ao recuperar detalhes do pedido após criação");
    }

    await client.query('COMMIT');
    console.log("✅ [ORDER] COMMIT realizado!");

    res.status(201).json(RESPONSES.CREATE_SUCCESS(fullOrder));

  } catch (err) {
    console.error("❌ [ORDER] Erro - ROLLBACK:", err);
    await client.query('ROLLBACK');
    res.status(500).json(RESPONSES.ERROR);
  } finally {
    client.release();
  }
};


export const getAllOrders = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { page = 1, limit = 50 } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Buscar pedidos com paginação
    const result = await pool.query(ORDER_QUERIES.GET_ALL_ORDERS, [
      companyId, 
      parseInt(limit), 
      parseInt(offset)
    ]);
    
    // Contar total de pedidos
    const countResult = await pool.query(ORDER_QUERIES.COUNT_ALL_ORDERS, [companyId]);
    const totalOrders = parseInt(countResult.rows[0].count);
    
    const orders = result.rows;

    const ordersWithItems = await Promise.all(
      orders.map(async (row) => {
        const itemsResult = await pool.query(ORDER_QUERIES.GET_ORDER_ITEMS, [row.id]);

        return {
          id: row.id,
          orderDate: row.orderdate,
          orderStatus: row.orderstatus,
          orderNumber: row.ordernumber,
          totalAmount: row.totalamount,
          currency: row.currency,
          salesperson: row.salesperson,
          customer: {
            name: row.customername,
            email: row.customeremail,
            code: row.customercode
          },
          shipping: {
            street: row.shippingstreet,
            number: row.shippingnumber,
            city: row.shippingcity,
            zip: row.shippingzip
          },
          billing: {
            street: row.billingstreet,
            number: row.billingnumber,
            city: row.billingcity,
            zip: row.billingzip
          },
          orderItems: itemsResult.rows,
          notes: row.notes
        };
      })
    );

    res.status(200).json({
      ...RESPONSES.LIST_SUCCESS(ordersWithItems),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalOrders,
        totalPages: Math.ceil(totalOrders / limit),
        hasNext: page < Math.ceil(totalOrders / limit),
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error("❌ [ORDERS] Erro ao buscar pedidos:", err);
    console.error("❌ [ORDERS] Detalhes:", err.message);
    res.status(500).json(RESPONSES.ERROR);
  }
};


export const getOrderById = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect(); // ← Obter client

  try {
    const order = await getFullOrderDetails(client, id, req.user.companyId); // ← Passar client

    if (!order) return res.status(404).json(RESPONSES.ORDER_NOT_FOUND);

    res.status(200).json(RESPONSES.GET_SUCCESS(order));
  } catch (err) {
    console.error("Erro ao buscar pedido:", err);
    res.status(500).json(RESPONSES.ERROR);
  } finally {
    client.release(); // ← Liberar client
  }
};
export const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { orderStatus } = req.body;

  if (!orderStatus) {
    return res.status(400).json({ Info: "Status do pedido é obrigatório!" });
  }

  const validStatuses = Object.values(ORDER_STATUS);
  if (!validStatuses.includes(orderStatus)) {
    return res.status(400).json({
      Info: "Status inválido!",
      validStatuses: validStatuses
    });
  }

  try {
    const result = await pool.query(ORDER_QUERIES.UPDATE_ORDER_STATUS, [
      orderStatus, id, req.user.companyId
    ]);

    if (result.rows.length === 0) return res.status(404).json(RESPONSES.ORDER_NOT_FOUND);

    res.status(200).json(RESPONSES.UPDATE_SUCCESS(result.rows[0]));
  } catch (err) {
    console.error("Erro ao atualizar status do pedido:", err);
    res.status(500).json(RESPONSES.ERROR);
  }
};

export const deleteOrder = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    const orderExists = await client.query(ORDER_QUERIES.GET_ORDER_BY_ID, [id, req.user.companyId]);

    if (orderExists.rows.length === 0) {
      return res.status(404).json(RESPONSES.ORDER_NOT_FOUND);
    }

    await client.query('BEGIN');

    await deleteKardexByOrderId(id, client);

    await client.query(ORDER_QUERIES.DELETE_ORDER_ITEMS, [id]);
    await client.query(ORDER_QUERIES.DELETE_ORDER, [id, req.user.companyId]);

    await client.query('COMMIT');

    res.status(200).json(RESPONSES.DELETE_SUCCESS);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erro ao deletar pedido:", err);
    res.status(500).json(RESPONSES.ERROR);
  } finally {
    client.release();
  }
};

export const getLastOrderNumber = async (req, res) => {
  try {
    const companyId = req.user.companyId;

    const result = await pool.query(`
      SELECT orderNumber 
      FROM Orders 
      WHERE companyId = $1 
      ORDER BY id DESC 
      LIMIT 1
    `, [companyId]);

    if (result.rows.length === 0) {
      return res.status(200).json({
        Info: "Nenhum pedido encontrado, iniciando sequência",
        lastOrderNumber: "100"
      });
    }

    const lastOrderNumber = result.rows[0].ordernumber;

    res.status(200).json({
      Info: "Último número recuperado com sucesso",
      lastOrderNumber: lastOrderNumber ? lastOrderNumber.toString() : "100"
    });
  } catch (err) {
    console.error("Erro ao buscar último número do pedido:", err);
    res.status(500).json(RESPONSES.ERROR);
  }
};

export const getCustomers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.phone,
        c.email,
        c.code,
        c.createdAt,
        a.id as address_id,
        a.street,
        a.city,
        a.zip,
        a.number,
        a.type
      FROM Customers c
      LEFT JOIN Addresses a ON c.id = a.customerId
      WHERE c.companyId = $1
    `, [req.user.companyId]);

    const customers = result.rows.reduce((acc, row) => {
      const existingCustomer = acc.find(c => c.id === row.id);

      if (existingCustomer) {
        if (row.street) {
          existingCustomer.addresses = existingCustomer.addresses || [];
          existingCustomer.addresses.push({
            id: row.address_id,
            street: row.street,
            city: row.city,
            zip: row.zip,
            number: row.number,
            type: row.type
          });
        }
      } else {
        const customer = {
          id: row.id,
          name: row.name,
          phone: row.phone,
          email: row.email,
          code: row.code,
          createdAt: row.createdat,
          address: row.street ? {
            id: row.address_id,
            street: row.street,
            city: row.city,
            zip: row.zip,
            number: row.number,
            type: row.type
          } : null
        };
        acc.push(customer);
      }

      return acc;
    }, []);

    res.status(200).json({
      Info: "Clientes recuperados com sucesso",
      customers
    });
  } catch (err) {
    console.error("Erro ao buscar clientes:", err);
    res.status(500).json(RESPONSES.ERROR);
  }
};
export const getOrderForEdit = async (req, res) => {
  const { id } = req.params;
  const companyId = req.user.companyId;

  try {
    console.log("🔍 [ORDER EDIT] Buscando pedido para edição ID:", id);
    
    // Primeiro verifica se o pedido pode ser editado
    const canEditResult = await pool.query(ORDER_QUERIES.CAN_EDIT_ORDER, [id, companyId]);
    
    if (canEditResult.rows.length === 0) {
      return res.status(403).json({ 
        Error: "Este pedido não pode ser editado. Apenas pedidos com status 'Pendente' ou 'Estornado' podem ser modificados." 
      });
    }

    // Busca os dados completos do pedido
    const orderResult = await pool.query(ORDER_QUERIES.GET_ORDER_FOR_EDIT, [id, companyId]);
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json(RESPONSES.ORDER_NOT_FOUND);
    }

    const order = orderResult.rows[0];
    
    // Busca os itens do pedido
    const itemsResult = await pool.query(ORDER_QUERIES.GET_ORDER_ITEMS, [id]);

    const fullOrder = {
      id: order.id,
      orderDate: order.orderdate,
      orderStatus: order.orderstatus,
      orderNumber: order.ordernumber,
      totalAmount: order.totalamount,
      currency: order.currency,
      salesperson: order.salesperson,
      notes: order.notes,
      customerId: order.customerid,
      shippingAddressId: order.shippingaddressid,
      billingAddressId: order.billingaddressid,
      customer: {
        id: order.customerid,
        name: order.customername,
        email: order.customeremail,
        phone: order.customerphone,
        code: order.customercode
      },
      shipping: order.shippingstreet ? {
        id: order.shippingaddressid,
        street: order.shippingstreet,
        number: order.shippingnumber,
        city: order.shippingcity,
        zip: order.shippingzip
      } : null,
      billing: order.billingstreet ? {
        id: order.billingaddressid,
        street: order.billingstreet,
        number: order.billingnumber,
        city: order.billingcity,
        zip: order.billingzip
      } : null,
      orderItems: itemsResult.rows.map(item => ({
        productId: item.productid,
        productName: item.productname,
        productCode: item.productcode,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitprice),
        location: item.location,
        subtotal: parseFloat(item.subtotal)
      }))
    };

    console.log("✅ [ORDER EDIT] Pedido encontrado para edição");
    res.status(200).json(RESPONSES.GET_SUCCESS(fullOrder));

  } catch (err) {
    console.error("❌ [ORDER EDIT] Erro ao buscar pedido para edição:", err);
    res.status(500).json(RESPONSES.ERROR);
  }
};

export const updateOrder = async (req, res) => {
  const { id } = req.params;
  const companyId = req.user.companyId;
  
  const {
    orderDate,
    customerId,
    totalAmount,
    currency,
    shippingAddressId,
    billingAddressId,
    salesperson,
    notes,
    orderItems
  } = req.body;

  const client = await pool.connect();

  try {
    console.log("🔍 [ORDER UPDATE] Iniciando atualização do pedido ID:", id);
    
    await client.query('BEGIN');

    // 1️⃣ Verificar se o pedido pode ser editado
    const canEditResult = await client.query(ORDER_QUERIES.CAN_EDIT_ORDER, [id, companyId]);
    
    if (canEditResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ 
        Error: "Este pedido não pode ser editado. Apenas pedidos com status 'Pendente' ou 'Estornado' podem ser modificados." 
      });
    }

    // 2️⃣ Atualizar dados principais do pedido
    const orderResult = await client.query(ORDER_QUERIES.UPDATE_ORDER, [
      orderDate,
      customerId,
      totalAmount,
      currency,
      shippingAddressId,
      billingAddressId,
      salesperson,
      notes || null,
      id,
      companyId
    ]);

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(RESPONSES.ORDER_NOT_FOUND);
    }

    // 3️⃣ Remover itens antigos
    await client.query(ORDER_QUERIES.DELETE_ORDER_ITEMS, [id]);

    // 4️⃣ Remover movimentações antigas do Kardex
    await deleteKardexByOrderId(id, client);

    // 5️⃣ Inserir novos itens
    const insertedItems = await insertOrderItems(client, id, orderItems);
    console.log("✅ [ORDER UPDATE] Itens atualizados:", insertedItems.length);

    // 6️⃣ Processar novas movimentações do Kardex
    await createKardexMovements(companyId, id, insertedItems, client);
    console.log("✅ [ORDER UPDATE] Kardex atualizado");

    // 7️⃣ Buscar pedido atualizado
    const fullOrder = await getFullOrderDetails(client, id, companyId);

    await client.query('COMMIT');
    console.log("✅ [ORDER UPDATE] COMMIT realizado!");

    res.status(200).json({
      Info: "Pedido atualizado com sucesso!",
      order: fullOrder
    });

  } catch (err) {
    console.error("❌ [ORDER UPDATE] Erro - ROLLBACK:", err);
    await client.query('ROLLBACK');
    res.status(500).json(RESPONSES.ERROR);
  } finally {
    client.release();
  }
};

export const cancelOrder = async (req, res) => {
  const { id } = req.params;
  const companyId = req.user.companyId;
  const client = await pool.connect();

  try {
    console.log(`🛑 [ORDER CANCEL] Iniciando cancelamento do pedido ID: ${id}`);

    await client.query("BEGIN");

    // 1️⃣ Verifica se o pedido existe e pertence à empresa
    const orderResult = await client.query(ORDER_QUERIES.GET_ORDER_BY_ID, [id, companyId]);
    if (orderResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json(RESPONSES.ORDER_NOT_FOUND);
    }

    const order = orderResult.rows[0];
    if (order.orderstatus === ORDER_STATUS.CANCELLED) {
      await client.query("ROLLBACK");
      return res.status(400).json({ Info: "O pedido já está cancelado!" });
    }

    // 2️⃣ Busca os itens do pedido
    const itemsResult = await client.query(ORDER_QUERIES.GET_ORDER_ITEMS, [id]);
    const items = itemsResult.rows;

    if (items.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ Info: "Pedido não possui itens para cancelamento!" });
    }

    // 3️⃣ Reverte estoque: adiciona novamente a quantidade de cada produto
    for (const item of items) {
      await client.query(
        `UPDATE Products 
         SET stock = stock + $1 
         WHERE id = $2 AND companyId = $3`,
        [item.quantity, item.productid, companyId]
      );
    }

    console.log("✅ [ORDER CANCEL] Estoque revertido com sucesso!");

    // 4️⃣ Remove movimentações antigas no Kardex
    await deleteKardexByOrderId(id, client);
    console.log("✅ [ORDER CANCEL] Movimentações do Kardex removidas.");

    // 5️⃣ Atualiza o status do pedido
    await client.query(ORDER_QUERIES.UPDATE_ORDER_STATUS, [
      ORDER_STATUS.CANCELLED, id, companyId
    ]);

    await client.query("COMMIT");

    console.log(`✅ [ORDER CANCEL] Pedido ${id} cancelado com sucesso!`);

    res.status(200).json({
      Info: "Pedido cancelado com sucesso e estoque revertido.",
      orderId: id
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ [ORDER CANCEL] Erro ao cancelar pedido:", err);
    res.status(500).json(RESPONSES.ERROR);
  } finally {
    client.release();
  }
};


// Exportar constantes
export { ORDER_STATUS };
