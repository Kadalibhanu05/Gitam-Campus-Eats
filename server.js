const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo').default || require('connect-mongo');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- 1. DATABASE CONNECTION ---
const dbURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus-eats';
mongoose.connect(dbURI)
    .then(() => console.log('✅ MongoDB Connected Successfully'))
    .catch((err) => console.error('❌ MongoDB Error:', err));

// --- 2. MODELS ---
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'owner'], default: 'student' }
});
const User = mongoose.model('User', UserSchema);

const MenuItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true }
});

const CanteenSchema = new mongoose.Schema({
    university: { type: String, required: true },
    name: { type: String, required: true },
    menu: [MenuItemSchema],
    //This links the canteen to a specific Owner
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});
const Canteen = mongoose.model('Canteen', CanteenSchema);

const OrderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    canteenName: { type: String, required: true },
    items: [{ name: String, price: Number, quantity: Number }],
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    deliveryAddress: { type: String, required: true },
    orderDate: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', OrderSchema);

// --- 3. MIDDLEWARE ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); 
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: 'super-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: dbURI }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));


// GLOBAL VARIABLES 
app.use((req, res, next) => {
    res.locals.user = req.session.user;
    res.locals.cart = req.session.cart || []; // Default empty cart
    res.locals.university = 'Gitam University';
    next();
});

const isAuthenticated = (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    next();
};

// NEW: Owner Verification Middleware
const isOwner = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'owner') {
        next();
    } else {
        //will Send a styled HTML page
        res.status(403).send(`
            <div style="font-family: sans-serif; text-align: center; margin-top: 100px;">
                <h1 style="color: red; font-size: 3rem; font-weight: bold;">Access Denied 🚫</h1>
                <p style="font-size: 1.5rem; color: #374151; margin: 20px 0;">
                    Only Canteen Owners can add canteens.
                </p>
                <a href="/canteens" style="
                    display: inline-block; 
                    padding: 12px 24px; 
                    background-color: #16a34a; 
                    color: white; 
                    text-decoration: none; 
                    border-radius: 8px; 
                    font-weight: bold;
                    font-size: 1.1rem;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                ">
                    &larr; Back to Canteens
                </a>
            </div>
        `);
    }
};

// --- 4. ROUTES ---

// File: index.ejs
app.get('/', (req, res) => res.render('index'));

// File: canteens.ejs
app.get('/canteens', async (req, res) => {
    try {
        const canteens = await Canteen.find({ university: 'Gitam University' });
        res.render('canteens', { canteens });
    } catch (err) {
        console.error(err);
        res.render('canteens', { canteens: [] });
    }
});

// File: menu.ejs
app.get('/menu/:canteenId', async (req, res) => {
    try {
        const canteen = await Canteen.findById(req.params.canteenId);
        if (!canteen) return res.status(404).send('Canteen not found');
        res.render('menu', { canteen });
    } catch (err) {
        res.status(500).send('Error loading menu');
    }
});

app.get('/add-canteen', isAuthenticated, isOwner, (req, res) => res.render('add-canteen'));
// PROTECTED: Add Canteen
app.post('/add-canteen', isAuthenticated, isOwner, async (req, res) => {
    try {
        const { canteenName, menuItems } = req.body;
        
        // Filter valid items
        const validItems = menuItems ? menuItems.filter(i => i.name && i.price) : [];
        const menu = validItems.map(i => ({ name: i.name, price: parseFloat(i.price) }));
        
        // SAVE WITH OWNER ID
        await new Canteen({ 
            university: 'Gitam University', 
            name: canteenName, 
            menu: menu,
            ownerId: req.session.user.id // Saves WHO created it
        }).save();

        res.redirect('/canteens');
    } catch (err) {
        res.send("Error adding canteen: " + err.message);
    }
});

app.get('/edit-canteen/:id', isAuthenticated, isOwner, async (req, res) => {
    try {
        // Only find canteen if it belongs to THIS user
        const canteen = await Canteen.findOne({ 
            _id: req.params.id, 
            ownerId: req.session.user.id 
        });

        if (!canteen) {
            return res.status(403).send(`
                <h1 style="color:red; text-align:center;">Access Denied</h1>
                <p style="text-align:center;">You do not own this canteen.</p>
                <div style="text-align:center;"><a href="/canteens">Back</a></div>
            `);
        }
        
        res.render('edit-canteen', { canteen });
    } catch (err) {
        res.status(500).send("Error loading page");
    }
});

app.post('/edit-canteen/:id', isAuthenticated, isOwner, async (req, res) => {
    try {
        const { newItems } = req.body;
        
        // Only find canteen owned by THIS user
        const canteen = await Canteen.findOne({ 
            _id: req.params.id, 
            ownerId: req.session.user.id 
        });

        if (!canteen) return res.status(403).send("You cannot edit this canteen.");

        if (newItems && Array.isArray(newItems)) {
            const itemsToAdd = newItems
                .filter(item => item.name && item.price)
                .map(item => ({ name: item.name, price: parseFloat(item.price) }));

            canteen.menu.push(...itemsToAdd);
            await canteen.save();
        }

        res.redirect('/menu/' + req.params.id);
    } catch (err) {
        res.status(500).send("Error updating canteen");
    }
});

// --- DELETE ITEM ROUTE ---
app.post('/delete-item', isAuthenticated, isOwner, async (req, res) => {
    try {
        const { canteenId, itemId } = req.body;
        
        // Only update if ownerId matches
        const result = await Canteen.findOneAndUpdate(
            { _id: canteenId, ownerId: req.session.user.id }, // Condition
            { $pull: { menu: { _id: itemId } } } // Action
        );

        if (!result) return res.status(403).send("Cannot delete: You do not own this canteen.");

        res.redirect('/edit-canteen/' + canteenId);
    } catch (err) {
        res.status(500).send("Error deleting item");
    }
});

// File: cart.ejs (I added this route for you)
app.get('/cart', isAuthenticated, (req, res) => {
    const cartItems = req.session.cart || [];
    
    // Calculate total including quantities
    const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    res.render('cart', { 
        cart: cartItems, 
        total: total, 
        university: 'Gitam University' 
    });
});
   
// 1. Add Item to Cart 
app.post('/add-to-cart', isAuthenticated, (req, res) => {
    // We now read 'itemPrice' and 'quantity' from your new EJS form
    const { canteenId, itemName, itemPrice, quantity } = req.body;
    
    // Initialize cart if needed
    if (!req.session.cart) {
        req.session.cart = [];
    }

    // Check if item already exists in cart to merge quantities
    const existingItemIndex = req.session.cart.findIndex(item => 
        item.name === itemName && item.canteenId === canteenId
    );

    const qtyToAdd = parseInt(quantity) || 1; // Default to 1 if missing
    const price = parseFloat(itemPrice);

    if (existingItemIndex > -1) {
        // Item exists? Just increase the quantity!
        req.session.cart[existingItemIndex].quantity += qtyToAdd;
    } else {
        // New item? Push it to the cart
        req.session.cart.push({
            canteenId,
            name: itemName,
            price: price, // Store unit price
            quantity: qtyToAdd
        });
    }

    // Save and go back
    req.session.save(() => {
        res.redirect('/menu/' + canteenId); 
    });
});

// 3. Remove Item from Cart 
// --- UPDATE CART QUANTITY ROUTES ---

app.post('/update-cart-quantity', isAuthenticated, (req, res) => {
    const { index, action } = req.body;
    const cart = req.session.cart;

    if (cart && cart[index]) {
        if (action === 'increase') {
            // Add 1
            cart[index].quantity += 1;
        } else if (action === 'decrease') {
            // Subtract 1
            cart[index].quantity -= 1;
            // If it hits 0, remove it completely
            if (cart[index].quantity <= 0) {
                cart.splice(index, 1);
            }
        } else if (action === 'remove') {
            // Delete the whole row instantly
            cart.splice(index, 1);
        }
    }

    req.session.save(() => {
        res.redirect('/cart');
    });
});

app.post('/place-order', isAuthenticated, async (req, res) => {
    try {
        // We read the form data we just added in cart.ejs
        const { paymentMethod, itemsJSON, canteenName, totalAmount, address } = req.body;

        if (!paymentMethod || !itemsJSON || !address) {
            return res.status(400).send('Missing order details. Please fill out all fields.');
        }

        const items = JSON.parse(itemsJSON); // Parse the hidden JSON string

        const newOrder = new Order({
            userId: req.session.user.id,
            canteenName: canteenName || 'Campus Canteen',
            items: items,
            totalAmount: parseFloat(totalAmount),
            paymentMethod,
            deliveryAddress: address
        });

        await newOrder.save();

        // Clear cart
        req.session.cart = [];
        
        req.session.save(() => {
            res.redirect('/order-success');
        });

    } catch (error) {
        console.error("Order Error:", error);
        res.status(500).send("Could not place order.");
    }
});

// File: order-success.ejs
app.get('/order-success', isAuthenticated, (req, res) => res.render('order-success'));

// --- AUTH ROUTES ---

// File: signup.ejs
app.get('/signup', (req, res) => res.render('signup'));
app.post('/signup', async (req, res) => {
    try {
        // 1. Get role from the form
        const { name, email, password, role } = req.body;
        
        // 2. Log it to the console to verify it's received
        console.log("Attempting to sign up user:", name, "with Role:", role);

        // 3. Save the role to the database
        const newUser = new User({ 
            name, 
            email, 
            password, 
            role: role || 'student' // Default to 'student' if not provided
        });
        
        await newUser.save();

        // 4. Set the session immediately
        req.session.user = { 
            id: newUser._id, 
            name: newUser.name, 
            email: newUser.email, 
            role: newUser.role // Save role to session
        };

        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(500).send("Signup Error: " + error.message);
    }
});

// File: login.ejs
app.get('/login', (req, res) => res.render('login'));
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (user && user.password === password) {
            // Save role in session
            req.session.user = { id: user._id, name: user.name, email: user.email, role: user.role };
            res.redirect('/');
        } else {
            res.send("Invalid Credentials");
        }
    } catch (e) { res.status(500).send("Error"); }
});

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));
app.get('/deliverers', (req, res) => res.render('deliverers'));
// File: help.ejs
app.get('/help', (req, res) => res.render('help'));

app.post('/checkout', isAuthenticated, (req, res) => {
    // Logic to handle checkout would go here
    res.render('cart'); 
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));