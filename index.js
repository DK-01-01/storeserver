const port = 4000;
const express = require("express");
const app = express()
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const Transaction = require("./models/Transaction")
const stripe = require("stripe")("sk_test_51P9pRjEUof4WzX0eUWdHekJ44W7AewmLUdZHcuVe2HcMllb8cKRsRKcmBCRQIzZeGClVAH5DzU3SZfG0kpJQe6ta00XYVTEWhv");
const { log } = require("console");

app.use(express.json());
app.use(express.static("public"));
app.use(cors());



mongoose.connect("mongodb+srv://dayksontavares90:ly25wCo4HFRcqvcX@cluster0.7ae7zlt.mongodb.net/", {
    serverSelectionTimeoutMS: 30000,
})

app.get("/",(req,res) =>{
    res.send("Express App is Running")
})


const storage = multer.diskStorage({

    destination: './upload/images',
    filename:(req,file,cb) => {
        return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
})

const upload = multer({storage:storage})

app.use('/images', express.static('upload/images'))

app.post('/upload', upload.single('product'),(req,res) => {
    res.json({
        success:1,
        image_url:`http://localhost:${port}/images/${req.file.filename}`
    })
})



const Product = mongoose.model("Product",{
    id: {
        type: Number,
        required:true,
    },
    name: {
        type: String,
        required:true,
    },
    image: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    new_price: {
        type: Number,
        required: true,
    },
    old_price: {
        type: Number,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    avilable: {
        type: Boolean,
        default: true,
    },
})
app.post('/addproduct',async (req, res) => {

    let products = await Product.find({});
    let id;
    if(products.length>0) {
        let last_product_array = products.slice(-1);
        let last_product = last_product_array[0];
        id = last_product.id+1;
    } else {
        id=1;
}

const product = new Product({
        
        id:id,
        name:req.body.name,
        image:req.body.image,
        category:req.body.category,
        new_price:req.body.new_price,
        old_price:req.body.old_price,
    });
    console.log(product);
    await product.save();
    console.log("saved");
    res.json({
        success:true,
        name:req.body.name,
    })
})


app.post('/removeproduct', async(req, res) => {

    await Product.findOneAndDelete({id:req.body.id});
    console.log("remove");
    res.json({
        success:true,
        name:req.body.name
    })
})

app.get('/allproducts',async(req,res)=>{
    let products = await Product.find({});
    console.log("all products");
    res.send(products);
})

const Users = mongoose.model('users', {
    name: {
        type:String,
    },
    email: {
        type:String,
        unique:true,
    },
    password: {
        type:String,
    },
    cartData: {
        type:Object,
    },
    date: {
        type:Date,
        default:Date.now,
    }
})

app.post('/signup',async(req,res)=>{
    let check = await Users.findOne({email:req.body.email});
    if(check) {
        return res.status(400).json({success:false,errors:"existing user found with same email address"})
    }
    let cart = {}
    for (let i = 0; i < 300; i++) {
        cart[i]=0;
    }
    const user = new Users({
        name:req.body.username,
        email:req.body.email,
        password:req.body.password,
        cartData:cart
    })
    await user.save();

    const data = {
        user: {
            id:user.id
        }
    }
    const token = jwt.sign(data,'secret_ecom');
    res.json({success:true,token})
})


app.post('/login', async (req, res) => {
    setTimeout(async () => {
        let user = await Users.findOne({ email: req.body.email });
        if (user) {
            const passCompare = req.body.password === user.password;
            if (passCompare) {
                const data = {
                    user: {
                        id: user.id
                    }
                }
                const token = jwt.sign(data, 'secret_ecom');
                res.json({ success: true, token });
            } else {
                res.json({ success: false, errors: "Senha incorreta" });
            }
        } else {
            res.json({ success: false, errors: "E-mail incorreto" });
        }
    }, 3000);
});


app.get('/popular', async(req,res) => {
    let products = await Product.find({category:"men"});
    let popular = products.slice(0,4);
    console.log("popular");
    res.send(popular);
})

const fetchUser = async(req,res,next)=>{
    const token = req.header('auth-token');
    if(!token) {
        res.status(401).send({errors:"Please authenticate using valid token"})
    } else {
        try {
            const data = jwt.verify(token,'secret_ecom');
            req.user = data.user;
            next();
        } catch(error) {
            res.status(401).send({errors:"Please authenticate using valid token"})
        }
    }
}

app.post('/addtocart',fetchUser,async(req,res)=>{
    console.log("added",req.body.itemId);
    let userData = await Users.findOne({_id:req.user.id});
    userData.cartData[req.body.itemId] += 1;
    await Users.findByIdAndUpdate({_id:req.user.id},{cartData:userData.cartData});
    res.send("added")
})

app.post('/removefromcart', fetchUser, async (req,res) => {

    console.log("removed",req.body.itemId);
    let userData = await Users.findOne({_id:req.user.id});
    if(userData.cartData[req.body.itemId]>0)
    userData.cartData[req.body.itemId] -= 1;
    await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
    res.send("Removed")
})


app.post('/getcart', fetchUser, async (req,res) => {
    console.log("GetCart");
    let userData = await Users.findOne({_id:req.user.id});
    res.json(userData.cartData);
})

app.post("/create-checkout-session", async (req, res) => {
    try {
        const { name, amount } = req.body;
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: "Product Name"
                        },
                        unit_amount: amount
                    },
                    quantity: 1
                }
            ],
            mode: "payment",
            success_url: `http://localhost:4000/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: "http://localhost:4000/cancel"
        });

        res.json({ url: session.url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/success", async (req, res) => {
    const session_id = req.query.session_id;

    try {
        const session = await stripe.checkout.sessions.retrieve(session_id);

        if (session.payment_status === "paid") {
            const name = session.metadata.name;
            const amount = session.amount_total / 100; // Converting amount from cents to dollars

            const newTransaction = new Transaction({ name, amount, transactionID: session_id });
            await newTransaction.save();

            res.status(200).json({ message: "Transaction saved successfully" });
        } else {
            res.status(400).send("Payment Unsuccessful");
        }
    } catch (error) {
        res.status(500).send("Payment Confirmation Error");
    }
});

app.get("/cancel", (req, res) => {
    res.send("Payment Canceled");
});

app.post("/save-transaction", async (req, res) => {
    try {
        const { name, amount, transactionID } = req.body;
        const newTransaction = new Transaction({ name, amount, transactionID });
        await newTransaction.save();

        res.status(200).send("Transaction saved successfully");
    } catch (error) {
        res.status(500).send("Error saving transaction");
    }
});


app.listen(port,(error) => {
    
    if(!error) {
        console.log("Serve running on port " + port)
    }
    else {
        console.log("Error :"+error)
    }
})