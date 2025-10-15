import pool from "../../database/conection.js";
import { MOVEMENT_TYPES } from "../kardex/kardex.js";

const INVOICE_QUERIES = {
  INSERT: `
    INSERT INTO Invoices (order_id, invoice_number, issue_date, total_value, xml_path, status, companyId)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `,
  GET_BY_ORDER: `
    SELECT * FROM Invoices WHERE order_id = $1 AND companyId = $2;
  `,
  GET_ALL: `
    SELECT * FROM Invoices WHERE companyId = $1 ORDER BY createdAt DESC;
  `,
  GET_ORDER_ITEMS: `
    SELECT productid, quantity, coast
    FROM PurchaseOrderItems
    WHERE orderid = $1;
  `,
  UPDATE_PRODUCT_STOCK: `
    UPDATE Products
    SET stock = stock + $1, updatedAt = NOW()
    WHERE id = $2 AND companyId = $3
    RETURNING id, name, stock;
  `,
  INSERT_KARDEX_MOVEMENT: `
    INSERT INTO Kardex (
      productId, 
      orderId, 
      movementType, 
      quantity, 
      unitPrice, 
      companyId, 
      createdAt
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    RETURNING *;
  `
};

// =============================================
// 💾 Criar Nota Fiscal (com transação segura)
// =============================================
export const createInvoice = async (req, res) => {
  const { order_id, invoice_number, issue_date, total_value, xml_path, status } = req.body;
  
  if (!order_id || !invoice_number) {
    return res.status(400).json({ error: "order_id e invoice_number são obrigatórios." });
  }

  if (!req.user.companyId) {
    return res.status(401).json({ error: "Usuário não autenticado!" });
  }

  const companyId = req.user.companyId;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    console.log("🔄 Iniciando transação para order_id:", order_id, "companyId:", companyId);

    // 1️⃣ Inserir Nota Fiscal
    const { rows } = await client.query(INVOICE_QUERIES.INSERT, [
      order_id,
      invoice_number,
      issue_date || null,
      total_value || 0,
      xml_path || null,
      status || 'Pendente',
      companyId
    ]);
    const insertedInvoice = rows[0];
    console.log("✅ Nota fiscal criada:", insertedInvoice);

    // 2️⃣ Buscar itens do pedido
    const { rows: orderItems } = await client.query(INVOICE_QUERIES.GET_ORDER_ITEMS, [order_id]);

    if (orderItems.length === 0) {
      console.log("⚠️ Nenhum item encontrado para o pedido:", order_id);
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Nenhum item encontrado no pedido." });
    }

    console.log("📦 Itens encontrados:", orderItems.length);

    // 3️⃣ Atualizar estoque e registrar movimentações
    const updatedProducts = [];
    const kardexMovements = [];

    for (const item of orderItems) {
      const { productid, quantity, coast } = item;
      
      const validQuantity = parseFloat(quantity) || 0;
      const validCoast = parseFloat(coast) || 0;

      console.log(`📊 Processando produto ${productid}: qty=${validQuantity}, coast=${validCoast}`);

      // Atualizar estoque do produto
      const { rows: updatedStock } = await client.query(INVOICE_QUERIES.UPDATE_PRODUCT_STOCK, [
        validQuantity,
        productid,
        companyId
      ]);

      if (updatedStock.length === 0) {
        throw new Error(`Produto ${productid} não encontrado ou não pertence à empresa ${companyId}`);
      }

      console.log(`✅ Estoque atualizado: ${updatedStock[0].name} - novo estoque: ${updatedStock[0].stock}`);
      updatedProducts.push(updatedStock[0]);

      // ✅ Registrar movimentação no Kardex (sem invoiceId)
      const { rows: kardexRow } = await client.query(INVOICE_QUERIES.INSERT_KARDEX_MOVEMENT, [
        productid,
        order_id,
        MOVEMENT_TYPES.ENTRADA,
        validQuantity,
        validCoast,
        companyId
      ]);

      console.log(`✅ Kardex registrado:`, kardexRow[0]);
      kardexMovements.push(kardexRow[0]);
    }

    await client.query("COMMIT");
    console.log("🎉 Transação concluída com sucesso!");

    res.status(201).json({
      message: "Nota fiscal registrada com sucesso!",
      invoice: insertedInvoice,
      updatedProducts,
      kardexMovements,
      summary: {
        invoiceNumber: invoice_number,  
        totalProducts: updatedProducts.length,
        totalMovements: kardexMovements.length
      }
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Erro ao registrar nota fiscal:", error.message);
    console.error("Stack:", error.stack);
    
    res.status(500).json({ 
      error: "Erro ao registrar nota fiscal.",
      details: error.message 
    });
  } finally {
    client.release();
  }
};

// =============================================
// 🔎 Buscar Notas Fiscais por Pedido
// =============================================
export const getInvoicesByOrder = async (req, res) => {
  const { order_id } = req.params;
  const companyId = req.user.companyId;

  try {
    const { rows } = await pool.query(INVOICE_QUERIES.GET_BY_ORDER, [order_id, companyId]);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Erro ao buscar notas fiscais:", error);
    res.status(500).json({ error: "Erro ao buscar notas fiscais." });
  }
};