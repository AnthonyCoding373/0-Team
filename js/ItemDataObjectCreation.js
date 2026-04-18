async function loadOrders() {
    try {
        // Since the JSON is now in the same 'js' folder:
        const response = await fetch('./orders_data.json');
        const orders = await response.json();

        console.log("Data loaded successfully!");
        console.log(orders); // This is now a standard JS Array

        // Example: Accessing the first order's ID (replace 'ID' with your Excel header name)
        // console.log(orders[0].ID);

    } catch (error) {
        console.error("Could not load the JSON file:", error);
    }
}

loadOrders();