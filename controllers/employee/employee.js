import pool from "../../database/conection.js";
import bcrypt from "bcrypt";

// ====================== HELPERS ====================== //

const validateRequiredFields = (body) => {
  const { username, password, role, status, active, access, sector } = body;
  return !username || !password || !role || !status || !active || !access || !sector;
};

const buildUpdateValues = (updateFields, existingEmployee) => {
  const { username, password, role, status, active, access, sector } = updateFields;
  return [
    username ?? existingEmployee.username,
    password ?? existingEmployee.password,
    role ?? existingEmployee.role,
    status ?? existingEmployee.status,
    active ?? existingEmployee.active,
    access ?? existingEmployee.access,
    sector ?? existingEmployee.sector
  ];
};

const mapStatusToBoolean = (status) => {
  const statusMap = { 'Ativo': true, 'Ausente': false, 'Inativo': false };
  return statusMap[status];
};

const mapBooleanToStatus = (bool) => bool ? 'Ativo' : 'Inativo';

// ====================== CONTROLLER ====================== //

//----------- POST ----------//
export const createEmployeeAccess = async (req, res) => {
  if (validateRequiredFields(req.body)) {
    return res.status(400).json({ Info: "Erro ao adicionar novo colaborador, Preencha todos os campos" });
  }

  const { username, password, role, status, active, access, sector } = req.body;

  try {
    await pool.query('BEGIN');

    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO Contributor 
        (username, password, role, status, active, access, sector, companyId) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [username, hashedPassword, role, mapStatusToBoolean(status), active, access, sector, req.user.companyId];

    const response = await pool.query(query, values);
    await pool.query('COMMIT');

    res.status(201).json({
      Info: "Colaborador adicionado à base de dados",
      employee: {
        user: username,
        company: req.user.companyId,
        data: response.rows[0]
      }
    });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error("Erro ao adicionar novo colaborador:", err);
    res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};

//----------- GET ALL ----------//
export const handleAllEmployees = async (req, res) => {
  try {
    const query = `SELECT * FROM Contributor WHERE companyId=$1`;
    const values = [req.user.companyId];
    const result = await pool.query(query, values);

    // Converter status boolean para string
    const employees = result.rows.map(emp => ({
      ...emp,
      status: mapBooleanToStatus(emp.status)
    }));

    res.status(200).json({ status: "success", messageInfo: "Lista de colaboradores", data: employees });

  } catch (err) {
    console.error("Erro ao recuperar lista de colaboradores:", err);
    res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};

//----------- UPDATE ----------//
export const updateEmployeeById = async (req, res) => {
  const { id } = req.params;
  const { username, password, role, status, active, access, sector } = req.body;

  if ([username, password, role, status, active, access, sector].every(f => f === undefined)) {
    return res.status(400).json({ Info: "É necessário enviar pelo menos um campo para atualizar!" });
  }

  try {
    await pool.query('BEGIN');

    const employeeResult = await pool.query(
      'SELECT * FROM Contributor WHERE id=$1 AND companyId=$2',
      [id, req.user.companyId]
    );

    if (!employeeResult.rows.length) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ Info: "Nenhum colaborador encontrado!" });
    }

    // Atualizar senha se fornecida
    let passwordToSave = password ? await bcrypt.hash(password, 10) : undefined;

    const updateValues = buildUpdateValues(
      { ...req.body, password: passwordToSave },
      employeeResult.rows[0]
    );

    const updateQuery = `
      UPDATE Contributor
      SET username=$1, password=$2, role=$3, status=$4, active=$5, access=$6, sector=$7
      WHERE id=$8 AND companyId=$9
      RETURNING *
    `;

    const updatedEmployee = await pool.query(updateQuery, [...updateValues, id, req.user.companyId]);
    await pool.query('COMMIT');

    res.status(200).json({ Info: "Informações atualizadas com sucesso!", data: updatedEmployee.rows[0] });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error("Erro ao atualizar informações do colaborador:", err);
    res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};

//----------- DELETE ----------//
export const deleteEmployee = async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ Alert: "Informe o ID do colaborador!" });

  try {
    await pool.query('BEGIN');
    const deleteResult = await pool.query(
      'DELETE FROM Contributor WHERE id=$1 AND companyId=$2',
      [id, req.user.companyId]
    );
    await pool.query('COMMIT');

    if (deleteResult.rowCount) {
      res.status(200).json({ Info: "Colaborador apagado da base de dados.", result: deleteResult.rowCount });
    } else {
      res.status(404).json({ Info: "Colaborador não encontrado ou não pertence à empresa." });
    }

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error("Erro ao deletar colaborador:", err);
    res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};

//----------- UPDATE STATUS ----------//
export const updateEmployeeStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (status === undefined || status === null) {
    return res.status(400).json({ Info: "Status é obrigatório!" });
  }

  const statusBoolean = mapStatusToBoolean(status);
  if (statusBoolean === undefined) return res.status(400).json({ Info: "Status inválido! Use: Ativo, Ausente ou Inativo" });

  try {
    await pool.query('BEGIN');

    const check = await pool.query(
      'SELECT * FROM Contributor WHERE id=$1 AND companyId=$2',
      [id, req.user.companyId]
    );
    if (!check.rows.length) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ Info: "Colaborador não encontrado!" });
    }

    const result = await pool.query(
      'UPDATE Contributor SET status=$1 WHERE id=$2 AND companyId=$3 RETURNING id, username, role, status, active, sector, companyId',
      [statusBoolean, id, req.user.companyId]
    );
    await pool.query('COMMIT');

    const employeeResponse = { ...result.rows[0], status: mapBooleanToStatus(result.rows[0].status) };

    res.status(200).json({ Info: "Status atualizado com sucesso!", employee: employeeResponse });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error("Erro ao atualizar status do colaborador:", err);
    res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};

//----------- GET STATUS ----------//
export const getEmployeeStatus = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT id, username, role, status, active, sector FROM Contributor WHERE id=$1 AND companyId=$2',
      [id, req.user.companyId]
    );

    if (!result.rows.length) return res.status(404).json({ Info: "Colaborador não encontrado!" });

    const employeeResponse = { ...result.rows[0], status: mapBooleanToStatus(result.rows[0].status) };
    res.status(200).json({ employee: employeeResponse });

  } catch (err) {
    console.error("Erro ao buscar status do colaborador:", err);
    res.status(500).json({ Error: "Erro interno do servidor!" });
  }
};
