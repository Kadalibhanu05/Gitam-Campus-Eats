const mongoose = require('mongoose');

// A Schema defines the structure of a document in MongoDB.
const menuItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true // Removes whitespace from both ends
    },
    price: {
        type: Number,
        required: true,
        min: 0 // Price cannot be negative
    }
});

const canteenSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    universityName: {
        type: String,
        required: true,
        trim: true
    },
    address: {
        type: String,
        required: true,
        trim: true
    },
    // This is an array of menu items using the schema we defined above
    menu: [menuItemSchema] 
}, {
    // Automatically adds `createdAt` and `updatedAt` fields
    timestamps: true 
});


const Canteen = mongoose.model('Canteen', canteenSchema);

module.exports = Canteen;