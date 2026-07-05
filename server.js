const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const path = require("path");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve HTML files
app.use(express.static(path.join(__dirname, "public")));

// MySQL Connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",          // Change if your MySQL has a password
    database: "expense_tracker"
});

db.connect((err) => {
    if (err) {
        console.log("Database Connection Failed!");
        console.log(err);
        return;
    }
    console.log("Connected to MySQL");
});


// =========================
// REGISTER
// =========================
app.post("/register", (req, res) => {

    const { full_name, email, password } = req.body;

    const sql = `
    INSERT INTO users(full_name,email,password)
    VALUES(?,?,?)
    `;

    db.query(sql, [full_name, email, password], (err, result) => {

        if (err) {
            return res.json({
                success: false,
                message: "Email already exists"
            });
        }

        res.json({
            success: true,
            message: "Registration Successful"
        });

    });

});


// =========================
// LOGIN
// =========================
app.post("/login", (req, res) => {

    const { email, password } = req.body;

    const sql = `
    SELECT * FROM users
    WHERE email=? AND password=?
    `;

    db.query(sql, [email, password], (err, result) => {

        if (err)
            return res.json({
                success: false
            });

        if (result.length > 0) {

            res.json({
                success: true,
                user: result[0]
            });

        } else {

            res.json({
                success: false,
                message: "Invalid Email or Password"
            });

        }

    });

});


// Start Server
app.listen(3000, () => {
    console.log("Server Running...");
    console.log("http://localhost:3000");
});
// =========================
// DASHBOARD
// =========================
app.get("/dashboard/:userId", (req, res) => {

    const userId = req.params.userId;

    const dashboard = {
        totalIncome: 0,
        totalExpense: 0,
        totalBudget: 0,
        remaining: 0,
        recent: []
    };

    // Total Income
    db.query(
        "SELECT IFNULL(SUM(amount),0) AS total FROM income WHERE user_id=?",
        [userId],
        (err, incomeResult) => {

            if (err) return res.status(500).json(err);

            dashboard.totalIncome = incomeResult[0].total;

            // Total Expense (current month only)
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();

            db.query(
                "SELECT IFNULL(SUM(amount),0) AS total FROM expenses WHERE user_id=? AND MONTH(expense_date)=? AND YEAR(expense_date)=?",
                [userId, currentMonth, currentYear],
                (err, expenseResult) => {

                    if (err) return res.status(500).json(err);

                    dashboard.totalExpense = expenseResult[0].total;

                    // Budget
                    db.query(
                        "SELECT IFNULL(SUM(budget_amount),0) AS total FROM budgets WHERE user_id=?",
                        [userId],
                        (err, budgetResult) => {

                            if (err) return res.status(500).json(err);

                            dashboard.totalBudget = budgetResult[0].total;
                            dashboard.remaining =
                                dashboard.totalBudget - dashboard.totalExpense;

                            // Recent Expenses
                            db.query(
                                `SELECT e.expense_date,
                                        c.category_name,
                                        e.description,
                                        e.amount
                                 FROM expenses e
                                 JOIN categories c
                                 ON e.category_id = c.category_id
                                 WHERE e.user_id=?
                                 ORDER BY e.expense_date DESC
                                 LIMIT 5`,
                                [userId],
                                (err, recentResult) => {

                                    if (err) return res.status(500).json(err);

                                    dashboard.recent = recentResult;

                                    res.json(dashboard);

                                }
                            );

                        }
                    );

                }
            );

        }
    );

});
// ========================
// GET CATEGORIES
// ========================

app.get("/categories", (req, res) => {

    const sql = "SELECT * FROM categories ORDER BY category_name";

    db.query(sql, (err, result) => {

        if (err)
            return res.status(500).json(err);

        res.json(result);

    });

});
// ========================
// ADD EXPENSE
// ========================

app.post("/expenses", (req, res) => {

    const {
        user_id,
        category_id,
        amount,
        expense_date,
        description
    } = req.body;

    const sql = `
    INSERT INTO expenses
    (user_id,category_id,amount,expense_date,description)
    VALUES(?,?,?,?,?)
    `;

    db.query(sql,
        [
            user_id,
            category_id,
            amount,
            expense_date,
            description
        ],
        (err) => {

            if (err)
                return res.status(500).json(err);

            res.json({
                message: "Expense Added Successfully"
            });

        });

});
// ========================
// VIEW EXPENSES
// ========================

app.get("/expenses/:userId", (req, res) => {

    const userId = req.params.userId;
    const month = req.query.month;
    const year = req.query.year;

    let sql = `

    SELECT
    e.expense_id,
    c.category_name,
    e.amount,
    e.expense_date,
    e.description

    FROM expenses e

    JOIN categories c

    ON e.category_id=c.category_id

    WHERE e.user_id=?

    `;

    const params = [userId];

    if (month && year) {
        sql += " AND MONTH(e.expense_date)=? AND YEAR(e.expense_date)=? ";
        params.push(month, year);
    }

    sql += " ORDER BY e.expense_date DESC ";

    db.query(sql, params, (err, result) => {

        if (err)
            return res.status(500).json(err);

        res.json(result);

    });

});
// ========================
// DELETE EXPENSE
// ========================

app.delete("/expenses/:id",(req,res)=>{

    const id=req.params.id;

    db.query(

    "DELETE FROM expenses WHERE expense_id=?",

    [id],

    (err)=>{

        if(err)
            return res.status(500).json(err);

        res.json({
            message:"Expense Deleted Successfully"
        });

    });

});
app.post("/income",(req,res)=>{

const {user_id,amount,source,income_date}=req.body;

db.query(

"INSERT INTO income(user_id,amount,source,income_date) VALUES(?,?,?,?)",

[user_id,amount,source,income_date],

(err)=>{

if(err) return res.status(500).json(err);

res.json({message:"Income Added Successfully"});

});

});
app.get("/income/:userId",(req,res)=>{

const userId=req.params.userId;
const month=req.query.month;
const year=req.query.year;

let sql="SELECT * FROM income WHERE user_id=?";
const params=[userId];

if(month && year){
sql+=" AND MONTH(income_date)=? AND YEAR(income_date)=?";
params.push(month,year);
}

sql+=" ORDER BY income_date DESC";

db.query(

sql,

params,

(err,result)=>{

if(err) return res.status(500).json(err);

res.json(result);

});

});
app.delete("/income/:id",(req,res)=>{

db.query(

"DELETE FROM income WHERE income_id=?",

[req.params.id],

(err)=>{

if(err) return res.status(500).json(err);

res.json({message:"Income Deleted Successfully"});

});

});
// =======================
// SAVE BUDGET
// =======================

app.post("/budget",(req,res)=>{

const {user_id,month,year,budget_amount}=req.body;

db.query(

"DELETE FROM budgets WHERE user_id=? AND month=? AND year=?",

[user_id,month,year],

(err)=>{

if(err)
return res.status(500).json(err);

db.query(

`INSERT INTO budgets(user_id,month,year,budget_amount)
VALUES(?,?,?,?)`,

[user_id,month,year,budget_amount],

(err)=>{

if(err)
return res.status(500).json(err);

res.json({
message:"Budget Saved Successfully"
});

});

});

});
// =======================
// LOAD BUDGET
// =======================

app.get("/budget/:userId",(req,res)=>{

const userId=req.params.userId;
const month=req.query.month || (new Date().getMonth()+1);
const year=req.query.year || new Date().getFullYear();

db.query(

"SELECT IFNULL(SUM(budget_amount),0) totalBudget FROM budgets WHERE user_id=? AND month=? AND year=?",

[userId,month,year],

(err,budget)=>{

if(err)
return res.status(500).json(err);

db.query(

"SELECT IFNULL(SUM(amount),0) totalExpense FROM expenses WHERE user_id=? AND MONTH(expense_date)=? AND YEAR(expense_date)=?",

[userId,month,year],

(err,expense)=>{

if(err)
return res.status(500).json(err);

const totalBudget=budget[0].totalBudget;
const totalExpense=expense[0].totalExpense;

res.json({

totalBudget,
totalExpense,
remaining:totalBudget-totalExpense

});

});

});

});
// ==========================
// REPORTS
// ==========================

app.get("/reports/:userId",(req,res)=>{

const userId=req.params.userId;

const report={};

db.query(

"SELECT IFNULL(SUM(amount),0) totalIncome FROM income WHERE user_id=?",

[userId],

(err,income)=>{

if(err) return res.status(500).json(err);

report.totalIncome=income[0].totalIncome;

const currentMonth = new Date().getMonth() + 1;
const currentYear = new Date().getFullYear();

db.query(

"SELECT IFNULL(SUM(amount),0) totalExpense FROM expenses WHERE user_id=? AND MONTH(expense_date)=? AND YEAR(expense_date)=?",

[userId, currentMonth, currentYear],

(err,expense)=>{

if(err) return res.status(500).json(err);

report.totalExpense=expense[0].totalExpense;

db.query(

`SELECT
c.category_name,
SUM(e.amount) total

FROM expenses e

JOIN categories c

ON e.category_id=c.category_id

WHERE e.user_id=?
AND MONTH(e.expense_date)=?
AND YEAR(e.expense_date)=?

GROUP BY c.category_name`,

[userId, currentMonth, currentYear],

(err,result)=>{
if(err) return res.status(500).json(err);

report.categoryLabels=[];

report.categoryAmounts=[];

result.forEach(r=>{

report.categoryLabels.push(r.category_name);

report.categoryAmounts.push(r.total);

});

res.json(report);

});

});

});

});