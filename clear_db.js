const mongoose = require('mongoose');

// Connect to your database
mongoose.connect('mongodb://127.0.0.1:27017/campus-eats')
    .then(async () => {
        console.log("🔥 Connected to DB...");

        // Delete EVERYTHING in the users collection
        try {
            await mongoose.connection.collection('users').drop();
            console.log("✅ SUCCESS: Old users deleted.");
        } catch (e) {
            console.log("ℹ️ Database was already empty.");
        }
        process.exit();
    })
    .catch(err => {
        console.error("❌ Error:", err);
        process.exit();
    });