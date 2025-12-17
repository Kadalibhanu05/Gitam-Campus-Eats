document.addEventListener('DOMContentLoaded', () => {
    // --- Logic for the Menu Page ---
    const menuPageContainer = document.getElementById('menu-page-container');
    if (menuPageContainer) {
        const cart = new Map();
        const cartSummary = document.getElementById('cart-summary');
        const checkoutButton = document.getElementById('checkout-btn');

        const updateItemUI = (name) => {
            const itemIsInCart = cart.has(name);
            const item = cart.get(name);
            let targetRow = null;
            document.querySelectorAll('.menu-item-row').forEach(row => {
                if (row.querySelector(`[data-name="${name}"]`)) {
                    targetRow = row;
                }
            });

            if (!targetRow) return;

            const quantitySpan = targetRow.querySelector('.item-quantity');
            const removeBtn = targetRow.querySelector('.remove-from-cart-btn');

            if (itemIsInCart && item.quantity > 0) {
                quantitySpan.textContent = `x${item.quantity}`;
                quantitySpan.classList.remove('hidden');
                removeBtn.classList.remove('hidden');
            } else {
                quantitySpan.classList.add('hidden');
                removeBtn.classList.add('hidden');
            }
        };

        const updateCartSummary = () => {
            if (cart.size === 0) {
                cartSummary.textContent = 'No items added yet.';
                checkoutButton.disabled = true;
                return;
            }
            let totalItems = 0;
            let totalPrice = 0;
            for (const item of cart.values()) {
                totalItems += item.quantity;
                totalPrice += item.price * item.quantity;
            }
            cartSummary.textContent = `${totalItems} item(s) in cart. Total: ₹${totalPrice.toFixed(2)}`;
            checkoutButton.disabled = false;
        };

        menuPageContainer.addEventListener('click', (event) => {
            const button = event.target;
            const name = button.dataset.name;
            const price = parseFloat(button.dataset.price);

            if (button.classList.contains('add-to-cart-btn')) {
                if (cart.has(name)) {
                    cart.get(name).quantity++;
                } else {
                    cart.set(name, { price, quantity: 1 });
                }
            }

            if (button.classList.contains('remove-from-cart-btn')) {
                if (cart.has(name)) {
                    cart.get(name).quantity--;
                    if (cart.get(name).quantity === 0) {
                        cart.delete(name);
                    }
                }
            }

            if (name) {
                updateItemUI(name);
                updateCartSummary();
            }
        });

        checkoutButton.addEventListener('click', () => {
            if (cart.size === 0) return;
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/checkout';
            const canteenName = checkoutButton.dataset.canteenName;
            const canteenInput = document.createElement('input');
            canteenInput.type = 'hidden';
            canteenInput.name = 'canteenName';
            canteenInput.value = canteenName;
            form.appendChild(canteenInput);

            for (const [name, item] of cart.entries()) {
                for (let i = 0; i < item.quantity; i++) {
                    const input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = 'items';
                    input.value = `${name}|${item.price}`;
                    form.appendChild(input);
                }
            }
            document.body.appendChild(form);
            form.submit();
        });
        
        updateCartSummary();
    }

    // --- Logic for the Checkout Page ---
    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
        const paymentOptions = document.querySelectorAll('.payment-option');
        const placeOrderBtn = document.getElementById('place-order-btn');
        paymentOptions.forEach(option => {
            option.addEventListener('change', () => {
                if (document.querySelector('input[name="paymentMethod"]:checked')) {
                    placeOrderBtn.disabled = false;
                }
            });
        });
    }

    // Logic for the Add Canteen Page ---
    const addCanteenForm = document.getElementById('add-canteen-form');
    if (addCanteenForm) {
        const foodItemsContainer = document.getElementById('food-items-container');
        const addItemBtn = document.getElementById('add-item-btn');
        let itemCount = 0;

        const addFoodItemRow = () => {
            itemCount++;
            const itemRow = document.createElement('div');
            itemRow.className = 'flex items-center gap-2';
            // This creates the HTML for the two input fields
            itemRow.innerHTML = `
                <input type="text" name="itemName-${itemCount}" placeholder="Item Name" class="flex-grow mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                <input type="number" name="itemPrice-${itemCount}" placeholder="Price" class="w-24 mt-1 block px-3 py-2 border border-gray-300 rounded-md shadow-sm">
            `;
            foodItemsContainer.appendChild(itemRow);
        };

        // Add the first row automatically when the page loads
        addFoodItemRow();

        // Add a new row when the button is clicked
        addItemBtn.addEventListener('click', addFoodItemRow);
    }
});