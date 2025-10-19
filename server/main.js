import express from "express"
import cors from "cors"

import productRouter from "../routes/products.js"
import loginRouter from "../routes/login.js"
import adminRouter from "../routes/administrator.js"
import employeeRouter from "../routes/employee.js"
import supplierRouter from "../routes/supplier.js"
import customerRouter from "../routes/customer.js"
import ordersRouter from "../routes/order.js"
import kardexRouter from '../routes/kardex.js'
import purchseRouter from "../routes/purchase.js"
import invoiceRouter from "../routes/invoices.js"
import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from "dotenv"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: "../.env" })

const app = express()

app.use(cors({
    origin: "http://localhost:3000",
    methods: ["POST", "GET", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"]
}))


// Para PNG + ICO, 5MB é mais que suficiente
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ✅ CRÍTICO: Servir arquivos estáticos (ANTES das rotas de API)
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
console.log('📁 Servindo arquivos estáticos em: /uploads');

app.use("/admin", adminRouter)

// LOGIN ROUTE
app.use("/login", loginRouter )

//PRODUCTS ROUTES
app.use("/products", productRouter)

//EMPLOYEE ROUTES
app.use("/employees", employeeRouter)

//SUPPLIER ROUTES
app.use("/suppliers", supplierRouter)

//CUSTOMER ROUTES
app.use("/customers", customerRouter)

//ORDERS ROUTES
app.use("/orders", ordersRouter)

//PURCHASE ROUTES
app.use("/purchase", purchseRouter)

//KARDEX ROUTER
app.use("/kardex", kardexRouter)

//INVOICE ROUTER
app.use("/invoice", invoiceRouter)




app.listen(process.env.SERVER_PORT, () => {
    console.log("Server running in port: ", process.env.SERVER_PORT)
})

