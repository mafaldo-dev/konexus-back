import pool from "../../database/conection.js";

// ====================== HELPERS ====================== //

const validateRequiredFields = (body) => {
  const { name, email, phone, code } = body;
  return !name || !email || !phone || !code;
};

const validateAddressFields = (address) => {
  if (!address) return false;
  const { street, city, zip, number } = address;
  return !street || !city || !zip || !number;
};

const buildUpdateValues = (updateFields, existingCustomer) => {
  const { name, email, phone, code } = updateFields;
  return [
    name ?? existingCustomer.name,
    email ?? existingCustomer.email,
    phone ?? existingCustomer.phone,
    code ?? existingCustomer.code
  ];
};

const buildAddressUpdateValues = (updateFields, existingAddress) => {
  const { street, city, zip, number } = updateFields;
  return [
    street ?? existingAddress.street,
    city ?? existingAddress.city,
    zip ?? existingAddress.zip,
    number ?? existingAddress.number
  ];
};

// ====================== CONTROLLER ====================== //

//----------- POST ----------//
export const insertCustomer = async (req, res) => {
  if (validateRequiredFields(req.body)) {
    return res.status(400).json({ 
      Info: "Erro ao adicionar novo cliente, Preencha todos os campos" 
    });
  }

  const { name, email, phone, code, address } = req.body;

  if (address && validateAddressFields(address)) {
    return res.status(400).json({ 
      Info: "Todos os campos do endereço são obrigatórios: street, city, zip, number" 
    });
  }

  try {
    await pool.query('BEGIN');

    // Inserir cliente
    const customerQuery = `
      INSERT INTO Customers (name, email, phone, code, companyId) 
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const customerValues = [name, email, phone, code, req.user.companyId];
    const customerResult = await pool.query(customerQuery, customerValues);
    const customer = customerResult.rows[0];

    let addressResult = null;
    if (address) {
      const addressQuery = `
        INSERT INTO Addresses (street, city, zip, number, companyId, customerId) 
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const addressValues = [
        address.street, 
        address.city, 
        address.zip, 
        address.number, 
        req.user.companyId, 
        customer.id
      ];
      addressResult = await pool.query(addressQuery, addressValues);
    }

    await pool.query('COMMIT');

    res.status(201).json({
      Info: "Cliente adicionado à base de dados",
      customer: {
        ...customer,
        address: addressResult ? addressResult.rows[0] : null
      }
    });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error("Erro ao adicionar novo cliente:", err);
    res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};

//----------- GET ALL ----------//
export const handleAllCustomers = async (req, res) => {
  try {
    const query = `
      SELECT c.*, a.street, a.city, a.zip, a.number, a.id as address_id
      FROM Customers c
      LEFT JOIN Addresses a ON c.id = a.customerId AND a.companyId = c.companyId
      WHERE c.companyId = $1
      ORDER BY c.name
    `;
    const values = [req.user.companyId];
    const response = await pool.query(query, values);

    const customersWithAddress = response.rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      code: row.code,
      companyId: row.companyid,
      createdAt: row.createdat,
      address: row.street ? {
        id: row.address_id,
        street: row.street,
        city: row.city,
        zip: row.zip,
        number: row.number
      } : null
    }));

    res.status(200).json({ 
      status: "success",
      messageInfo: "Lista de clientes",
      data: customersWithAddress
    });

  } catch (err) {
    console.error("Erro ao recuperar lista de clientes:", err);
    res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};

//----------- GET BY ID ----------//
export const getCustomerById = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT c.*, a.street, a.city, a.zip, a.number, a.id as address_id
      FROM Customers c
      LEFT JOIN Addresses a ON c.id = a.customerId AND a.companyId = c.companyId
      WHERE c.id = $1 AND c.companyId = $2
    `;
    const values = [id, req.user.companyId];
    const response = await pool.query(query, values);

    if (!response.rows.length) {
      return res.status(404).json({ Info: "Cliente não encontrado!" });
    }

    const row = response.rows[0];
    const customer = {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      code: row.code,
      companyId: row.companyid,
      createdAt: row.createdat,
      updatedAt: row.updatedat,
      address: row.street ? {
        id: row.address_id,
        street: row.street,
        city: row.city,
        zip: row.zip,
        number: row.number
      } : null
    };

    res.status(200).json({ status: "success", data: customer });

  } catch (err) {
    console.error("Erro ao buscar cliente:", err);
    res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};

//----------- UPDATE ----------//
export const updateCustomerById = async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, code, address } = req.body;

  if ([name, email, phone, code, address].every(f => f === undefined)) {
    return res.status(400).json({ Info: "É necessário enviar pelo menos um campo para atualizar!" });
  }

  try {
    await pool.query('BEGIN');

    // Verificar cliente
    const customerResult = await pool.query(
      'SELECT * FROM Customers WHERE id = $1 AND companyId = $2',
      [id, req.user.companyId]
    );
    if (!customerResult.rows.length) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ Info: "Nenhum cliente encontrado!" });
    }

    // Atualizar cliente
    if (name !== undefined || email !== undefined || phone !== undefined || code !== undefined) {
      const updateCustomerQuery = `
        UPDATE Customers
        SET name = $1, email = $2, phone = $3, code = $4
        WHERE id = $5 AND companyId = $6
        RETURNING *
      `;
      const customerUpdateValues = [
        ...buildUpdateValues(req.body, customerResult.rows[0]),
        id,
        req.user.companyId
      ];
      await pool.query(updateCustomerQuery, customerUpdateValues);
    }

    // Gerenciar endereço
    if (address !== undefined) {
      const addressResult = await pool.query(
        'SELECT * FROM Addresses WHERE customerId = $1 AND companyId = $2',
        [id, req.user.companyId]
      );

      if (address) {
        if (validateAddressFields(address)) {
          await pool.query('ROLLBACK');
          return res.status(400).json({ 
            Info: "Todos os campos do endereço são obrigatórios: street, city, zip, number" 
          });
        }

        if (addressResult.rows.length) {
          const updateAddressQuery = `
            UPDATE Addresses
            SET street=$1, city=$2, zip=$3, number=$4
            WHERE customerId=$5 AND companyId=$6 RETURNING *
          `;
          const addressUpdateValues = [
            ...buildAddressUpdateValues(address, addressResult.rows[0]),
            id,
            req.user.companyId
          ];
          await pool.query(updateAddressQuery, addressUpdateValues);
        } else {
          const insertAddressQuery = `
            INSERT INTO Addresses (street, city, zip, number, companyId, customerId)
            VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
          `;
          const addressValues = [
            address.street, address.city, address.zip, address.number,
            req.user.companyId, id
          ];
          await pool.query(insertAddressQuery, addressValues);
        }
      } else if (addressResult.rows.length) {
        await pool.query(
          'DELETE FROM Addresses WHERE customerId=$1 AND companyId=$2',
          [id, req.user.companyId]
        );
      }
    }

    await pool.query('COMMIT');

    const finalResult = await pool.query(`
      SELECT c.*, a.street, a.city, a.zip, a.number, a.id as address_id
      FROM Customers c
      LEFT JOIN Addresses a ON c.id=a.customerId AND a.companyId=c.companyId
      WHERE c.id=$1 AND c.companyId=$2
    `, [id, req.user.companyId]);

    const row = finalResult.rows[0];
    const customer = {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      code: row.code,
      companyId: row.companyid,
      createdAt: row.createdat,
      updatedAt: row.updatedat,
      address: row.street ? {
        id: row.address_id,
        street: row.street,
        city: row.city,
        zip: row.zip,
        number: row.number
      } : null
    };

    res.status(200).json({ Info: "Informações atualizadas com sucesso!", data: customer });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error("Erro ao atualizar informações do cliente:", err);
    res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};

//----------- DELETE ----------//
export const deleteCustomer = async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ Alert: "Informe o ID do cliente!" });

  try {
    await pool.query('BEGIN');

    await pool.query(
      'DELETE FROM Addresses WHERE customerId=$1 AND companyId=$2',
      [id, req.user.companyId]
    );

    const customerResult = await pool.query(
      'DELETE FROM Customers WHERE id=$1 AND companyId=$2',
      [id, req.user.companyId]
    );

    await pool.query('COMMIT');

    if (customerResult.rowCount) {
      res.status(200).json({ Info: "Cliente e endereços apagados da base de dados.", result: customerResult.rowCount });
    } else {
      res.status(404).json({ Info: "Cliente não encontrado ou não pertence à empresa." });
    }

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error("Erro ao deletar cliente da base de dados:", err);
    res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};
