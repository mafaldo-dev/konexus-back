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

import dotenv from "dotenv"

dotenv.config({ path: "../.env" })

const app = express()

app.use(cors({
    origin: "http://localhost:3000",
    methods: ["POST", "GET", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"]
}))


// Para PNG + ICO, 5MB é mais que suficiente
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));



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




app.listen(process.env.SERVER_PORT, () => {
    console.log("Server running in port: ", process.env.SERVER_PORT)
})

