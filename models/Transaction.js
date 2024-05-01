const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
    name: String,
    amount: Number,
    transactionID: String
});

module.exports = mongoose.model("Transaction", transactionSchema);